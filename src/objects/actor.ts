import { COMPONENT_EVENT_NOT_HANDLED, GameObject } from "../game/components";
import UnScriptVM, { cloneScriptValue, getProperty, setProperty, unregisterLevelActor, type ScriptHost_T, type ScriptLevelActors_T, type ScriptNativeCall_T, type ScriptValue_T } from "../ue-script/vm";
import { ScriptComponent, ScriptObjectFactory_T } from "../game/script-component";
import { findScriptPropertyKey, getScriptPropertyName } from "../ue-script/script-properties";
import type { ICollidable } from "./objects";
import type BaseActor from "../base-actor";
import { setActorOwner, type OwnedActor_T } from "./components/actor-ownership-component";
import { setScriptObjectProperty } from "./actor-properties";
import { beginTouch, endTouch, releaseTouching, TouchActor_T } from "./components/transform-component";
import { EL2EventCmd_T } from "../assets/unreal/un-aactor";

type ActorInfo_T = { uuid: string; name?: string; scriptClassId?: string; scriptProperties?: Record<string, ScriptValue_T> | null; sharedScriptProperties?: Record<string, ScriptValue_T> };
export type L2GameEvent_T = { EventID: number, EventCmd: EL2EventCmd_T };
type L2EventActor_T = ScriptHost_T & { l2EventShow?(value: number): void, l2EventPlay?(value: number): void };

export function execL2GameEvent(actor: L2EventActor_T, command: EL2EventCmd_T, value: number): void {
    switch (command) {
        case EL2EventCmd_T.LEC_None: return;
        case EL2EventCmd_T.LEC_Show:
            if (actor.l2EventShow) actor.l2EventShow(value);
            else setProperty(actor, "bHidden", value === 0);
            return;
        case EL2EventCmd_T.LEC_Play:
            // AActor/AEmitter/AMover vtable +0xb4 -> 0x5f6190: retn 4.
            if (actor.l2EventPlay) actor.l2EventPlay(value);
            return;
        default: throw new Error(`Unknown L2 event command '${command}'.`);
    }
}

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
        this.scriptProperties = new Map();
        if (info.scriptProperties !== null) {
            const properties = info.sharedScriptProperties ? { ...info.sharedScriptProperties, ...info.scriptProperties } : info.scriptProperties;

            for (const [key, value] of Object.entries(properties)) this.scriptProperties.set(key, cloneScriptValue(value)); // structuredClone took 70 ms on TerrainInfo's TIntMap
            // UGameEngine::LoadMap (0x831cbf..0x831cd3) clears serialized Touching.
            setScriptObjectProperty(this, "Touching", []);
        }
    }

    public setScriptRuntime(vm: UnScriptVM, objectFactory: ScriptObjectFactory_T, beginPlay: boolean = true): void {
        if (this.scriptComponent) {
            this.scriptComponent.setRuntime(vm, objectFactory);
            return;
        }

        setScriptObjectProperty(this, "Name", this.name);
        setScriptObjectProperty(this, "Class", this.scriptClassId);
        this.scriptComponent = this.addComponent(new ScriptComponent(vm, objectFactory, this.scriptClassId));
        if (beginPlay) this.beginPlay();
    }

    public bindScriptRuntime(vm: UnScriptVM, objectFactory: ScriptObjectFactory_T): void {
        if (this.scriptComponent) {
            this.scriptComponent.setRuntime(vm, objectFactory, false);
            return;
        }

        vm.bindHost(this, false);
        this.scriptComponent = this.addComponent(new ScriptComponent(vm, objectFactory, this.scriptClassId, false));
    }

    public beginPlay(initialize?: () => void): void { this.scriptComponent.beginPlay(initialize); }
    public getLevel(): ScriptLevelActors_T { return this.getUnrealScriptProperty("XLevel") as unknown as ScriptLevelActors_T; }

    public spawned(): void { }

    public postBeginPlay(): void {
        for (let index = 0; ; index++) {
            const arrEvents = getProperty(this, "L2GameEvent") as L2GameEvent_T[];

            if (index >= arrEvents.length) return;
            execL2GameEvent(this, arrEvents[index].EventCmd, 0);
        }
    }

    public l2EventShow(value: number): void { this.setUnrealScriptProperty("bHidden", value === 0); }
    public l2EventPlay(_value: number): void { }
    public setOwner(owner: OwnedActor_T): void { setActorOwner(this, owner); }

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
