import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, IObject, ObjectComponent } from "@client/game/components";
import UnScriptVM, { ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "@client/ue-script/vm";

const SCRIPT_CALL_EVENT = "scriptCall";
const SCRIPT_NATIVE_EVENT = "scriptNative";

type ScriptCallEvent_T = {
    name: string,
    args: ScriptValue_T[]
};

class ScriptComponent<TParent extends IObject & ScriptHost_T = IObject & ScriptHost_T> extends ObjectComponent<TParent> {
    public readonly componentName = "script";
    protected readonly vm: UnScriptVM;

    public constructor(vm: UnScriptVM) {
        super();

        this.vm = vm;
    }

    public call(name: string, args: ScriptValue_T[] = []): ScriptValue_T {
        const parent = this.getParent();
        const event: ScriptCallEvent_T = { name, args };

        this.dispatchEvent(SCRIPT_CALL_EVENT, event);

        return this.vm.call(parent, name, args);
    }

    public dispatchNative(call: ScriptNativeCall_T): ComponentEventResult_T<ScriptValue_T> {
        return this.dispatchEvent<ScriptValue_T>(SCRIPT_NATIVE_EVENT, call);
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        if (type !== SCRIPT_CALL_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        const event = data as ScriptCallEvent_T;

        return this.vm.call(this.getParent(), event.name, event.args);
    }

    public getVM(): UnScriptVM { return this.vm; }
}

export { COMPONENT_EVENT_NOT_HANDLED, SCRIPT_CALL_EVENT, SCRIPT_NATIVE_EVENT, ScriptComponent };
export type { ScriptCallEvent_T };
