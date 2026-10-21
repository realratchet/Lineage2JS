import { COMPONENT_EVENT_NOT_HANDLED, GameObject } from "../game/components";
import UnScriptVM, { unregisterLevelActor, type ScriptNativeCall_T, type ScriptValue_T } from "../ue-script/vm";
import { findScriptPropertyKey, getScriptPropertyName, ScriptComponent, ScriptObjectFactory_T } from "../game/script-component";
import type { ICollidable } from "./objects";
import type BaseActor from "../base-actor";
import { setScriptObjectProperty } from "./components/actor-ownership-component";
import { beginTouch, endTouch, releaseTouching, TouchActor_T } from "./components/transform-component";

type ActorInfo_T = { uuid: string; name: string; scriptClassId: string; scriptProperties: Record<string, ScriptValue_T>; sharedScriptProperties?: Record<string, ScriptValue_T> };

export class Actor extends GameObject {
    public readonly actorUuid: string;
    public readonly scriptClassId: string;
    public readonly scriptProperties: Map<string, ScriptValue_T>;
    public readonly isLevelActor: boolean;
    protected readonly basedActors = new Set<ICollidable>();
    protected scriptComponent: ScriptComponent = null;

    public constructor(info: ActorInfo_T, isLevelActor: boolean = true) {
        super();

        this.name = info.name;
        this.actorUuid = info.uuid;
        this.scriptClassId = info.scriptClassId;
        this.isLevelActor = isLevelActor;
        this.scriptProperties = new Map(Object.entries(structuredClone(info.sharedScriptProperties ? { ...info.sharedScriptProperties, ...info.scriptProperties } : info.scriptProperties)));
        // UGameEngine::LoadMap (0x831cbf..0x831cd3) clears serialized Touching.
        setScriptObjectProperty(this, "Touching", []);
    }

    public setScriptRuntime(vm: UnScriptVM, objectFactory: ScriptObjectFactory_T, beginPlay: boolean = true): void {
        if (this.scriptComponent) {
            this.scriptComponent.setRuntime(vm, objectFactory);
            return;
        }

        this.scriptComponent = this.addComponent(new ScriptComponent(vm, objectFactory, this.scriptClassId));
        if (beginPlay) this.beginPlay();
    }

    public beginPlay(initialize?: () => void): void { this.scriptComponent.beginPlay(initialize); }

    public setUnrealScriptProperty(id: string, value: ScriptValue_T): void { setScriptObjectProperty(this, id, value); }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        const result = this.scriptComponent.dispatchNative(call);

        if (result !== COMPONENT_EVENT_NOT_HANDLED) return result;
        throw new Error(`UnrealScript native '${call.name}' (${call.index}) is not implemented for '${call.context.scriptClassId}'.`);
    }

    public getUnrealScriptProperty(id: string): ScriptValue_T {
        if (this.scriptProperties.has(id)) return this.scriptProperties.get(id);
        const key = findScriptPropertyKey(this.scriptProperties, getScriptPropertyName(id));

        return key === undefined ? null : this.scriptProperties.get(key);
    }

    public getBaseActor(): ICollidable | null {
        const base = this.getUnrealScriptProperty("Base");

        if (typeof base === "string") throw new Error(`Unresolved actor Base '${base}'.`);
        return base as unknown as ICollidable;
    }

    public getBasedActors(): ReadonlySet<ICollidable> { return this.basedActors; }
    public addBasedActor(actor: ICollidable): void { this.basedActors.add(actor); }
    public removeBasedActor(actor: ICollidable): void { this.basedActors.delete(actor); }
    public isPendingKill(): boolean { return !!this.getUnrealScriptProperty("bDeleteMe"); }
    public beginTouch(other: TouchActor_T): void { beginTouch(this, other); }
    public endTouch(other: TouchActor_T, noNotifySelf = false): void { endTouch(this, other, noNotifySelf); }

    public release(notifyDestroyed = true): void {
        if (this.getUnrealScriptProperty("bPendingDelete")) return;

        setScriptObjectProperty(this, "bPendingDelete", true);
        if (this.scriptComponent) this.scriptComponent.destroy(notifyDestroyed);
        for (const actor of this.basedActors) (actor as BaseActor).setBase(null);
        this.basedActors.clear();
        if (this.scriptComponent) releaseTouching(this);
        this.detachComponents();
        unregisterLevelActor(this);
        setScriptObjectProperty(this, "bDeleteMe", true);
    }
}

export default Actor;
