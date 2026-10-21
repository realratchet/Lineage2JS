import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, IObject, ObjectComponent } from "./components";
import UnScriptVM, { getProperty, setProperty, registerLevelActor, ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";

export const SCRIPT_CALL_EVENT = "scriptCall";
export const SCRIPT_NATIVE_EVENT = "scriptNative";

export type ScriptCallEvent_T = { name: string, args: ScriptValue_T[] };
export type ScriptObjectFactory_T = (classId: string) => ScriptHost_T;

const cachePropertyNames = new Map<string, string>();

export function getScriptPropertyName(id: string): string {
    let name = cachePropertyNames.get(id);

    if (name === undefined) cachePropertyNames.set(id, name = id.slice(id.lastIndexOf(".") + 1).toLowerCase());

    return name;
}

const cachePropertyKeys = new WeakMap<Map<string, unknown>, { size: number, keys: Map<string, string> }>();

export function findScriptPropertyKey(properties: Map<string, unknown>, name: string): string | undefined {
    let cache = cachePropertyKeys.get(properties);

    if (!cache || cache.size !== properties.size) { // property keys are only ever added, so size tracks the key set
        const keys = new Map<string, string>();

        for (const key of properties.keys()) {
            const short = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
            if (!keys.has(short)) keys.set(short, key);
        }

        cache = { size: properties.size, keys };
        cachePropertyKeys.set(properties, cache);
    }

    return cache.keys.get(name);
}

export class ScriptComponent<TParent extends IObject & ScriptHost_T = IObject & ScriptHost_T> extends ObjectComponent<TParent> {
    public readonly componentName = "script";
    public readonly updateOrder = -100;
    protected vm: UnScriptVM;
    protected objectFactory: ScriptObjectFactory_T;
    protected readonly classId: string;
    protected readonly properties = new Map<string, ScriptValue_T>();
    protected hasBegunPlay = false;
    protected isDestroyed = false;

    public constructor(vm: UnScriptVM, objectFactory: ScriptObjectFactory_T, classId: string) {
        super();

        this.vm = vm;
        this.objectFactory = objectFactory;
        this.classId = classId;
    }

    public setRuntime(vm: UnScriptVM, objectFactory: ScriptObjectFactory_T): void {
        vm.bindHost(this.getParent());
        this.vm = vm;
        this.objectFactory = objectFactory;
    }

    public onAttach(): void {
        const parent = this.getParent();

        this.vm.initializeHost(parent);
        if (this.vm.getLevelInfo()) setProperty(parent, "Level", this.vm.getLevelInfo());
        registerLevelActor(parent);
    }

    public onDetach(): void { this.destroy(); }

    public getHasBegunPlay(): boolean { return this.hasBegunPlay; }

    public beginPlay(initialize?: () => void): void {
        if (this.hasBegunPlay || this.isDestroyed) return;

        this.hasBegunPlay = true;
        registerLevelActor(this.getParent());
        if (initialize) initialize();
        this.call("PostBeginPlay");
        if (!this.isDestroyed && !getProperty(this.getParent(), "bDeleteMe")) this.call("SetInitialState");
    }

    public tick(deltaTime: number): void {
        if (!this.hasBegunPlay || this.isDestroyed) return;

        const parent = this.getParent();

        if (this.vm.hasTickFunction(parent)) this.call("Tick", [deltaTime]);
        this.vm.processState(parent, deltaTime);

        const rate = Math.fround(getProperty(parent, "TimerRate") as number);

        if (!(rate > 0)) return;

        const counter = Math.fround(Math.fround(getProperty(parent, "TimerCounter") as number) + Math.fround(deltaTime));

        setProperty(parent, "TimerCounter", counter);
        if (!(counter >= rate)) return;

        // AActor::UpdateTimers 0x10594900..0x1059499f dispatches once after normalizing all elapsed intervals.
        const ticks = Math.trunc(counter / rate) | 0;

        setProperty(parent, "TimerCounter", Math.fround(counter - rate * ticks));
        if (ticks && !getProperty(parent, "bTimerLoop")) setProperty(parent, "TimerRate", 0);
        if (!this.isDestroyed) this.call("Timer");
    }

    public onUpdate(_currentTime: number, deltaTime: number): void { this.tick(deltaTime); }

    public destroy(notify = true): void {
        if (this.isDestroyed) return;

        this.isDestroyed = true;

        if (notify && this.hasBegunPlay && this.hasFunction("Destroyed")) this.call("Destroyed");
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

    public createObject(classId: string): ScriptHost_T {
        const object = this.objectFactory(classId);

        this.vm.initializeHost(object);
        return object;
    }
    public hasFunction(name: string): boolean { return this.vm.hasScriptFunction(this.getParent(), name); }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        if (type !== SCRIPT_CALL_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        const event = data as ScriptCallEvent_T;

        return this.vm.call(this.getParent(), event.name, event.args);
    }

    public getVM(): UnScriptVM { return this.vm; }
    public getClassId(): string { return this.classId; }
    public getProperties(): Map<string, ScriptValue_T> { return this.properties; }
}
