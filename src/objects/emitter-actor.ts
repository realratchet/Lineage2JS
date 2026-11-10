import { Quaternion, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, GameObject } from "../game/components";
import { SCRIPT_NATIVE_EVENT } from "../game/script-component";
import { findScriptPropertyKey, getScriptPropertyName } from "../ue-script/script-properties";
import type { ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";
import ActorOwnershipComponent from "./components/actor-ownership-component";
import { setScriptObjectProperty } from "./actor-properties";
import type { BaseEmitter } from "./emitters/base-emitter";
import Rotator from "../utils/rotator";
import { ENetRole_T } from "../assets/unreal/un-aactor";
import type { IEmitterSpawnSoundDecodeInfo } from "@l2js/engine/contracts/emitter";
import type { IRotatingDecodeInfo } from "@l2js/engine/contracts/mesh";

const tmpScriptLocation = new Vector3();

type EmitterSpawnSound_T = IEmitterSpawnSoundDecodeInfo & { dataUri: string };

export class EmitterActor extends GameObject {
    public actorUuid: string;
    public scriptClassId: string;
    public scriptProperties: Map<string, ScriptValue_T>;
    public spawnSound: EmitterSpawnSound_T = null;
    public speedRate: number = 1;
    public readonly emitterRotation = new Quaternion();
    public readonly globalOffset = new Vector3();

    protected emitterRotator: Rotator = null;
    protected readonly inverseInitialRotation = new Quaternion();
    protected ratePitch: number = 0;
    protected rateYaw: number = 0;
    protected rateRoll: number = 0;
    protected rotationTime: number;

    public constructor() {
        super();

        (this as any).isEmitterActor = true;
        this.addComponent(new ActorOwnershipComponent());
    }

    public getUnrealScriptProperty(id: string): ScriptValue_T {
        const name = getScriptPropertyName(id);

        if (name === "location") return this.getWorldPosition(tmpScriptLocation).toArray();
        const key = findScriptPropertyKey(this.scriptProperties, name);

        return key === undefined ? null : this.scriptProperties.get(key);
    }

    public setUnrealScriptProperty(id: string, value: ScriptValue_T): void {
        const name = getScriptPropertyName(id);

        if (name === "location") {
            tmpScriptLocation.fromArray(value as number[]);
            if (this.parent) this.parent.worldToLocal(tmpScriptLocation);
            this.position.copy(tmpScriptLocation);
            this.updateMatrix();
        }

        if (name === "level") return setScriptObjectProperty(this, id, value);
        const key = findScriptPropertyKey(this.scriptProperties, name) ?? id.slice(id.lastIndexOf(".") + 1);

        this.scriptProperties.set(key, value);
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        if (call.context === this && call.name.toLowerCase() === "kill") { this.kill(); return undefined; }
        const result = this.dispatchComponentEvent<ScriptValue_T>(SCRIPT_NATIVE_EVENT, call);

        if (result !== COMPONENT_EVENT_NOT_HANDLED) return result;
        // Preserve UnScriptVM.invokeNative's outer-self dispatch for actor contexts.
        if (call.self !== this && call.self.callUnrealNative) return call.self.callUnrealNative(call);

        throw new Error(`UnrealScript native '${call.name}' (${call.index}) is not implemented for '${call.context.scriptClassId}'.`);
    }

    public kill(): void {
        // Engine.dll AEmitter::Kill 0x105d2990..0x105d2a23.
        for (const emitter of this.scriptProperties.get("Emitters") as BaseEmitter[])
            if (emitter) emitter.kill();

        this.scriptProperties.set("AutoReset", false);
        this.scriptProperties.set("AutoDestroy", true);
    }

    public l2EventShow(value: number): void {
        // AEmitter::L2EventShow 0x8a4150: SetDisabled(!value, 1, 0).
        for (const emitter of this.scriptProperties.get("Emitters") as BaseEmitter[])
            if (emitter) emitter.setDisabled(value === 0);
    }

    public l2EventPlay(_value: number): void { }

    public getSpeedRate(): number {
        const speedRate = (this as any).scriptProperties?.get("SpeedRate") ?? this.speedRate;

        if (!Number.isFinite(speedRate)) throw new Error(`Emitter '${this.name}' has invalid SpeedRate '${speedRate}'.`);

        return speedRate;
    }

    protected sampleEmitterRanges(): void {
        const range = this.scriptProperties.get("GlobalOffsetRange") as any;
        const resetRange = this.scriptProperties.get("TimeTillResetRange") as any;

        if (!range || !resetRange) throw new Error(`Emitter '${this.name}' has no parent ranges.`);
        for (const value of [range.X, range.Y, range.Z, resetRange])
            if (!value || !Number.isFinite(value.Min) || !Number.isFinite(value.Max)) throw new Error(`Emitter '${this.name}' has invalid parent ranges.`);

        // Core.dll FRangeVector::GetRand 101101E0 samples Y before X and Z.
        this.globalOffset.y = Math.fround(range.Y.Max + Math.random() * (range.Y.Min - range.Y.Max));
        this.globalOffset.x = Math.fround(range.X.Max + Math.random() * (range.X.Min - range.X.Max));
        this.globalOffset.z = Math.fround(range.Z.Max + Math.random() * (range.Z.Min - range.Z.Max));
        this.scriptProperties.set("GlobalOffset", this.globalOffset.toArray());
        this.scriptProperties.set("TimeTillReset", Math.fround(resetRange.Max + Math.random() * (resetRange.Min - resetRange.Max)));
    }

    public updateEmitters(currentTime: number, deltaTime: number): boolean {
        const properties = this.scriptProperties;
        const emitters = properties.get("Emitters") as unknown as BaseEmitter[];

        const dt = Math.fround(deltaTime * this.getSpeedRate());
        let noNormalChild = true, noEnabledChild = true, pendingInitialDelay = false;

        if (!properties.get("Initialized")) {
            this.sampleEmitterRanges();
            properties.set("Initialized", 1);
        } else this.globalOffset.fromArray(properties.get("GlobalOffset") as number[]);

        for (const emitter of emitters) {
            const branch = emitter.update(currentTime, deltaTime);

            if (branch === "disabled") continue;
            noEnabledChild = false;
            if (branch === "delayed") pendingInitialDelay = true;
            if (branch === "normal") noNormalChild = false;
        }

        // Engine.dll AEmitter::Tick 105D571D uses branch outcomes, not final particle counts.
        if (noNormalChild && !noEnabledChild && emitters.length !== 0 && properties.get("AutoDestroy") && !pendingInitialDelay) {
            if (properties.get("bStatic") || properties.get("bNoDelete")) return false;
            if (properties.get("bDeleteMe")) return false;
            if (properties.get("Role") !== ENetRole_T.ROLE_Authority && !properties.get("bNetTemporary")) return false;

            properties.set("bDeleteMe", true);
            return true;
        }

        if (noNormalChild && properties.get("AutoReset") && !properties.get("AutoDestroy")) {
            const timeTillReset = properties.get("TimeTillReset") as number;

            if (!Number.isFinite(timeTillReset)) throw new Error(`Emitter '${this.name}' has invalid TimeTillReset.`);

            const remaining = Math.fround(timeTillReset - dt);

            if (remaining > 0) properties.set("TimeTillReset", remaining);
            else {
                this.sampleEmitterRanges();
                for (const emitter of emitters) emitter.reset();
                properties.set("FirstSpawnParticle", false);
            }
        }

        return false;
    }

    public adjustParticleLife(lifetime: number): void {
        if (!Number.isFinite(lifetime)) throw new Error(`Invalid emitter lifetime '${lifetime}'.`);
        lifetime = Math.max(0, lifetime);

        const emitters = this.scriptProperties.get("Emitters") as unknown as BaseEmitter[];
        let maxLifetime = 0;

        for (const emitter of emitters) maxLifetime = Math.max(maxLifetime, emitter.getForcedLifeTime());

        const delta = lifetime - maxLifetime;
        const lightLifeSpan = this.scriptProperties.get("EL_LifeSpan") as number;

        if (!Number.isFinite(lightLifeSpan)) throw new Error(`Emitter '${this.name}' has no EL_LifeSpan default.`);

        // Engine.dll SetParticleLifeTimeRange 0x8a2e09 / SpawnEmitterLight 0x8a3b3a.
        this.scriptProperties.set("EL_LifeSpan", lightLifeSpan + delta);

        for (const emitter of emitters) emitter.adjustParticleLife(lifetime, delta);
    }

    public setRotating(info: IRotatingDecodeInfo): void {
        this.emitterRotator = new Rotator(...info.rotator);
        this.emitterRotator.toQuaternion(this.inverseInitialRotation).invert();
        [this.ratePitch, this.rateYaw, this.rateRoll] = info.rate;
    }

    public updateEmitterRotation(currentTime: number): void {
        if (!this.emitterRotator) return;
        if (this.rotationTime === currentTime) return;

        if (this.rotationTime === undefined) {
            this.rotationTime = currentTime;
            return;
        }

        const dt = (currentTime - this.rotationTime) / 1000 * this.getSpeedRate();

        this.emitterRotator.pitch += this.ratePitch * dt;
        this.emitterRotator.yaw += this.rateYaw * dt;
        this.emitterRotator.roll += this.rateRoll * dt;
        this.emitterRotator.toQuaternion(this.emitterRotation).premultiply(this.inverseInitialRotation);
        this.rotationTime = currentTime;
    }
}

export default EmitterActor;
