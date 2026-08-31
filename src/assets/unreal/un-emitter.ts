import UObject, { FObjectArray } from "@l2js/core";
import UParticleEmitter from "./emitters/un-particle-emitter";
import UAActor from "./un-aactor";
import FBox from "./un-box";
import FVector from "./un-vector";

type EmitterDecodeResult_T = { object: GD.IEmitterActorDecodeInfo, leafIndices: number[], zoneUuid: string };

abstract class UEmitter extends UAActor {
    declare protected emitters: FObjectArray<UObject>;
    protected subEmitterFilter: string[] | null = null;

    declare protected spawnSound: GA.USound;
    declare protected soundRadius: number;
    declare protected soundVolume: number;
    declare protected isRotatingEmitter: boolean;
    declare protected rotPerSecond: GA.FRotator;

    // protected _autoDestroy: any;
    // protected _autoReset: any;
    // protected _disableFogging: any;
    // protected _globalOffsetRange: any;
    // protected _timeTillResetRange: any;
    // protected _autoReplay: any;
    // protected _speedRate: any;
    // protected _fixedBoundingBox: any;
    // protected _fixedBoundingBoxExpand: any;
    // protected _initialized: any;
    // protected _boundingBox: any;
    // protected _emitterRadius: any;
    // protected _emitterHeight: any;
    // protected _actorForcesEnabled: any;
    // protected _globalOffset: any;
    // protected _timeTillReset: any;
    // protected _useParticleProjectors: any;
    // protected _particleMaterial: any;
    // protected _deleteParticleEmitters: any;
    // protected _fixedLifeTime: any;
    // protected _firstSpawnParticle: any;
    // protected _trailerPrePivot: any;
    // protected _bUseLight: any;
    // protected _lightType: any;
    // protected _lightEffect: any;
    // protected _lightBrightness: any;
    // protected _lightRadius: any;
    // protected _lightHue: any;
    // protected _lightSaturation: any;
    // protected _emitterLightingType: any;
    // protected _pEmitterLight: any;
    // protected _eL_LifeSpan: any;
    // protected _eL_InitialDelay: any;
    // protected _bUseQuake: any;
    // protected _shakeType: any;
    // protected _shakeIntensity: any;
    // protected _shakeVector: any;
    // protected _shakeRange: any;
    // protected _shakeCount: any;
    // protected _shakeTime: any;
    // protected _eQ_InitialDelay: any;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "Emitters": "emitters",

            // "AutoDestroy": "_autoDestroy",
            // "AutoReset": "_autoReset",
            // "DisableFogging": "_disableFogging",
            // "GlobalOffsetRange": "_globalOffsetRange",
            // "TimeTillResetRange": "_timeTillResetRange",
            // "AutoReplay": "_autoReplay",
            // "SpeedRate": "_speedRate",
            "bRotEmitter": "isRotatingEmitter",
            "RotPerSecond": "rotPerSecond",
            // "FixedBoundingBox": "_fixedBoundingBox",
            // "FixedBoundingBoxExpand": "_fixedBoundingBoxExpand",
            "SpawnSound": "spawnSound",
            "SoundRadius": "soundRadius",
            "SoundVolume": "soundVolume",
            // "Initialized": "_initialized",
            // "BoundingBox": "_boundingBox",
            // "EmitterRadius": "_emitterRadius",
            // "EmitterHeight": "_emitterHeight",
            // "ActorForcesEnabled": "_actorForcesEnabled",
            // "GlobalOffset": "_globalOffset",
            // "TimeTillReset": "_timeTillReset",
            // "UseParticleProjectors": "_useParticleProjectors",
            // "ParticleMaterial": "_particleMaterial",
            // "DeleteParticleEmitters": "_deleteParticleEmitters",
            // "FixedLifeTime": "_fixedLifeTime",
            // "FirstSpawnParticle": "_firstSpawnParticle",
            // "TrailerPrePivot": "_trailerPrePivot",
            // "bUseLight": "_bUseLight",
            // "LightType": "_lightType",
            // "LightEffect": "_lightEffect",
            // "LightBrightness": "_lightBrightness",
            // "LightRadius": "_lightRadius",
            // "LightHue": "_lightHue",
            // "LightSaturation": "_lightSaturation",
            // "EmitterLightingType": "_emitterLightingType",
            // "pEmitterLight": "_pEmitterLight",
            // "EL_LifeSpan": "_eL_LifeSpan",
            // "EL_InitialDelay": "_eL_InitialDelay",
            // "bUseQuake": "_bUseQuake",
            // "ShakeType": "_shakeType",
            // "ShakeIntensity": "_shakeIntensity",
            // "ShakeVector": "_shakeVector",
            // "ShakeRange": "_shakeRange",
            // "ShakeCount": "_shakeCount",
            // "ShakeTime": "_shakeTime",
            // "EQ_InitialDelay": "_eQ_InitialDelay",
        });
    }

    // _setProperties = [];

    // protected setProperty(tag: PropertyTag, value: any): boolean {
    //     // if (value > 2)
    //     //     debugger;

    //     if (tag.name === "Emitters")
    //         debugger;

    //     this._setProperties.push([
    //         tag.name,
    //         value.toString()
    //     ]);

    //     return super.setProperty(tag, value);
    // }

    public setSubEmitterFilter(filter: string[] | null): this {
        this.subEmitterFilter = filter;
        return this;
    }

    protected getEmitterDecodeInfos(builder: GD.DecodeLibraryBuilder): GD.EmitterConfig_T[] {
        const emittersInfo: GD.EmitterConfig_T[] = [];

        this.emitters.loadSelf().forEach(emitter => {
            if (!emitter) return;

            if (!isParticleEmitter(emitter)) {
                console.warn(`Emitter '${this.objectName}' skipping unsupported sub-emitter '${emitter.objectName}'`);
                return;
            }

            if (this.subEmitterFilter && !this.subEmitterFilter.includes(emitter.objectName)) return;

            const emitterInfo = emitter.setActor(this).getDecodeInfo(builder);

            if (emitterInfo) emittersInfo.push(emitterInfo);
        });

        return emittersInfo;
    }

    protected getSpawnSoundDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IEmitterSpawnSoundDecodeInfo | null {
        if (!this.spawnSound) return null;

        const sound = this.spawnSound.loadSelf();
        const soundName = sound.objectName ?? sound.uuid;

        if (!builder.pullSound(sound)) throw new Error(`Emitter '${this.objectName}' spawn sound '${soundName}' has no audio data.`);

        return { soundName, volume: this.soundVolume, radius: this.soundRadius };
    }

    protected getRotatingDecodeInfo(): GD.IRotatingDecodeInfo | null {
        if (!this.isRotatingEmitter) return null;
        if (!this.rotPerSecond) throw new Error(`Emitter '${this.objectName}' has bRotEmitter but no RotPerSecond.`);

        return {
            rotator: this.rotation.toArray() as GD.Vector3Arr,
            rate: this.rotPerSecond.toArray() as GD.Vector3Arr
        };
    }

    public getTemplateDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IEmitterActorDecodeInfo {
        const info: GD.IEmitterActorDecodeInfo = {
            uuid: this.uuid,
            type: "Emitter",
            name: this.objectName,
            position: [0, 0, 0],
            scale: this.scale.getElements().map(v => v * this.drawScale) as [number, number, number],
            quaternion: this.rotation.getQuaternionElements(),
            children: this.getEmitterDecodeInfos(builder),
            isRangeIgnored: !!this.isRangeIgnored
        };

        const spawnSound = this.getSpawnSoundDecodeInfo(builder);
        const rotating = this.getRotatingDecodeInfo();

        if (spawnSound) info.spawnSound = spawnSound;
        if (rotating) info.rotating = rotating;

        return info;
    }

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): EmitterDecodeResult_T {
        const library = builder.library;
        const emittersInfo = this.getEmitterDecodeInfos(builder);

        const level = this.getLevel();
        const baseModel = level.getModel();
        const localToWorld = this.localToWorld();
        const zone = this.getZone();
        const _position = this.location.getElements();

        const actorInfo: GD.IEmitterActorDecodeInfo = {
            uuid: this.uuid,
            type: "Emitter",
            name: this.objectName,
            position: _position,
            scale: this.scale.getElements().map(v => v * this.drawScale) as [number, number, number],
            quaternion: this.rotation.getQuaternionElements(),
            children: emittersInfo,
            isRangeIgnored: !!this.isRangeIgnored,
            moveEvent: this.l2MoveEvent
        };

        const spawnSound = this.getSpawnSoundDecodeInfo(builder);
        const rotating = this.getRotatingDecodeInfo();

        if (spawnSound) actorInfo.spawnSound = spawnSound;
        if (rotating) actorInfo.rotating = rotating;

        // UParticleEmitter::UpdateParticles (UnParticleEmitter.cpp) rebuilds BoundingBox
        // every tick from live particles - can't replicate at decode time, so register
        // at a zero-extent point (its origin) instead of guessing a static box.
        const worldOrigin = FBox.make(FVector.make(0, 0, 0), FVector.make(0, 0, 0), 1)
            .transformBy(localToWorld).getCenter();

        // mirrors UStaticMeshActor.getDecodeInfo for zone-object.ts's BSP visibility pass; min===max, a point not a box
        actorInfo.bounds = {
            isValid: true,
            min: [worldOrigin.x, worldOrigin.y, worldOrigin.z],
            max: [worldOrigin.x, worldOrigin.y, worldOrigin.z]
        };

        let actorZoneMask = 0n;
        let leafIndices: number[] = [];

        if (baseModel) {
            leafIndices = baseModel.boxLeavesRecursive(0, worldOrigin, FVector.make(0, 0, 0));

            for (const leafIndex of leafIndices) {
                const leaf = library.bspLeaves[leafIndex];
                if (leaf && leaf.zone !== undefined && leaf.zone >= 0) {
                    actorZoneMask |= (1n << BigInt(leaf.zone));
                }
            }
        }

        actorInfo.zoneMask = actorZoneMask;

        return { object: actorInfo, leafIndices, zoneUuid: zone.uuid };
    }
}

function isParticleEmitter(emitter: UObject): emitter is UParticleEmitter {
    return "setActor" in emitter && typeof emitter.setActor === "function";
}

export default UEmitter;
export { UEmitter };
