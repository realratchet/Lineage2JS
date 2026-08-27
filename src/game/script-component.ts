import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, IObject, ObjectComponent } from "@client/game/components";
import UnScriptVM, { ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "@client/ue-script/vm";

const SCRIPT_CALL_EVENT = "scriptCall";
const SCRIPT_NATIVE_EVENT = "scriptNative";

type ScriptCallEvent_T = {
    name: string,
    args: ScriptValue_T[]
};

type ScriptObjectFactory_T = (classId: string) => ScriptHost_T;

class ScriptComponent<TParent extends IObject & ScriptHost_T = IObject & ScriptHost_T> extends ObjectComponent<TParent> {
    public readonly componentName = "script";
    public readonly updateOrder = -100;
    protected readonly vm: UnScriptVM;
    protected readonly objectFactory: ScriptObjectFactory_T;
    protected readonly classId: string;
    protected readonly properties = new Map<string, ScriptValue_T>();
    protected hasBegunPlay = false;
    protected isTicking = false;
    protected isDestroyed = false;

    public constructor(vm: UnScriptVM, objectFactory: ScriptObjectFactory_T, classId: string) {
        super();

        this.vm = vm;
        this.objectFactory = objectFactory;
        this.classId = classId;
    }

    public onAttach(): void {
        const parent = this.getParent();

        this.vm.initializeHost(parent);
        this.isTicking = this.vm.hasScriptFunction(this.classId, "Tick") && this.vm.findFunction(this.classId, "Tick").program.entries.length > 2;
    }

    public onDetach(): void { this.destroy(); }

    public beginPlay(): void {
        if (this.hasBegunPlay || this.isDestroyed) return;

        this.hasBegunPlay = true;
        this.call("PostBeginPlay");
    }

    public tick(deltaTime: number): void {
        if (this.hasBegunPlay && this.isTicking && !this.isDestroyed) this.call("Tick", [deltaTime]);
    }

    public onUpdate(_currentTime: number, deltaTime: number): void { this.tick(deltaTime); }

    public destroy(): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;
        this.isTicking = false;

        if (this.hasBegunPlay && this.hasFunction("Destroyed")) this.call("Destroyed");
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

    public createObject(classId: string): ScriptHost_T { return this.objectFactory(classId); }
    public hasFunction(name: string): boolean { return this.vm.hasScriptFunction(this.classId, name); }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        if (type !== SCRIPT_CALL_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        const event = data as ScriptCallEvent_T;

        return this.vm.call(this.getParent(), event.name, event.args);
    }

    public getVM(): UnScriptVM { return this.vm; }
    public getClassId(): string { return this.classId; }
    public getProperties(): Map<string, ScriptValue_T> { return this.properties; }
}

export { COMPONENT_EVENT_NOT_HANDLED, SCRIPT_CALL_EVENT, SCRIPT_NATIVE_EVENT, ScriptComponent };
export type { ScriptCallEvent_T, ScriptObjectFactory_T };
