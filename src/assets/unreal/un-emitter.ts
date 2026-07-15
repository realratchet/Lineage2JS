import { FObjectArray } from "@l2js/core/unreal/un-array";
import UParticleEmitter from "./emitters/un-particle-emitter";
import UAActor from "./un-aactor";
import FBox from "./un-box";
import FVector from "./un-vector";

abstract class UEmitter extends UAActor {
    declare protected emitters: FObjectArray<UParticleEmitter>;

    // protected _autoDestroy: any;
    // protected _autoReset: any;
    // protected _disableFogging: any;
    // protected _globalOffsetRange: any;
    // protected _timeTillResetRange: any;
    // protected _autoReplay: any;
    // protected _speedRate: any;
    // protected _bRotEmitter: any;
    // protected _rotPerSecond: any;
    // protected _fixedBoundingBox: any;
    // protected _fixedBoundingBoxExpand: any;
    // protected _spawnSound: any;
    // protected _soundRadius: any;
    // protected _soundVolume: any;
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
            // "bRotEmitter": "_bRotEmitter",
            // "RotPerSecond": "_rotPerSecond",
            // "FixedBoundingBox": "_fixedBoundingBox",
            // "FixedBoundingBoxExpand": "_fixedBoundingBoxExpand",
            // "SpawnSound": "_spawnSound",
            // "SoundRadius": "_soundRadius",
            // "SoundVolume": "_soundVolume",
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

    public getDecodeInfo(library: GD.DecodeLibrary) {

        // set by build-decode-library.ts from loadSettings.loadEmitterList - null means
        // "load every sub-emitter" (default), matching this actor not being in the list at all
        const subEmitterFilter: string[] | null = (this as any).__subEmitterFilter ?? null;

        const emittersInfo = this.emitters.loadSelf()
            .filter(e => {
                if (!e) return false; // deleted sub-emitters serialize as None

                // unsupported emitter types decode as plain objects
                if (typeof (e as any).setActor !== "function") {
                    console.warn(`Emitter '${this.objectName}' skipping unsupported sub-emitter '${(e as any).objectName}'`);
                    return false;
                }

                if (subEmitterFilter && !subEmitterFilter.includes((e as any).objectName)) return false;

                return true;
            })
            .map(e => e.setActor(this).getDecodeInfo(library)) as any as GD.IBaseObjectOrInstanceDecodeInfo[];
        // if (this.emitters.length > 0)
        //     debugger;

        //     // this.rotation.pitch = 0;
        //     // this.rotation.yaw = 0;
        //     // this.rotation.roll = 0;

        //     // debugger;

        //     // if (this.objectName === "Emitter7")
        //     //     debugger;

        const level = this.getLevel();
        const baseModel = level.getModel();
        const localToWorld = this.localToWorld();
        const zone = this.getZone();
        const zoneInfo = library.bspZones[library.bspZoneIndexMap[zone.uuid]].zoneInfo;

        const _position = this.location.getElements();

        const actorInfo = {
            uuid: this.uuid,
            type: "Emitter",
            name: this.objectName,
            position: _position,
            scale: this.scale.getElements().map(v => v * this.drawScale) as [number, number, number],
            quaternion: this.rotation.getQuaternionElements(),
            children: emittersInfo.filter(x => x),
            isRangeIgnored: !!this.isRangeIgnored
        } as GD.IBaseObjectDecodeInfo;

        // UParticleEmitter::UpdateParticles (UnParticleEmitter.cpp) rebuilds BoundingBox
        // every tick from live particle positions - there's no static radius/height that
        // predicts it, and CollisionRadius/Height are physical collision footprint, unrelated
        // to visual spread. We can't replicate a per-frame accumulated box at decode time.
        // But the BSP is static and the actor's origin isn't going anywhere: register the
        // actor at its own origin point (zero-extent box - boxLeavesRecursive degenerates to
        // a plane-side point classification), exactly like UE2's own zone/PVS association
        // does (AActor::SetZone uses Model->PointRegion(Location), a point query, not a box).
        // A guessed box here only ever caused trouble: too small and the emitter never
        // registers into the leaf it's actually visible from (particles don't render), too
        // large (even a modest fixed floor) and it registers into every leaf the box happens
        // to span - one leaf ended up with ~200 emitters riding on it, all marked "visible"
        // and simulated/drawn at once the moment the camera entered that leaf.
        const worldOrigin = FBox.make(FVector.make(0, 0, 0), FVector.make(0, 0, 0), 1)
            .transformBy(localToWorld).getCenter();

        // bounds/zoneMask mirror UStaticMeshActor.getDecodeInfo - lets the runtime BSP
        // visibility pass (zone-object.ts) cull emitter simulation the same way it
        // already culls static meshes, instead of a standalone frustum test. min===max:
        // this is a point, not a real box.
        (actorInfo as any).bounds = {
            isValid: true,
            min: [worldOrigin.x, worldOrigin.y, worldOrigin.z],
            max: [worldOrigin.x, worldOrigin.y, worldOrigin.z]
        };

        let actorZoneMask = 0n;

        if (baseModel) {
            const leafIndices = baseModel.boxLeavesRecursive(0, worldOrigin, FVector.make(0, 0, 0));

            for (const leafIndex of leafIndices) {
                if (library.leafActors[leafIndex]) {
                    library.leafActors[leafIndex].push(actorInfo);
                }
                const leaf = library.bspLeaves[leafIndex];
                if (leaf && leaf.zone !== undefined && leaf.zone >= 0) {
                    actorZoneMask |= (1n << BigInt(leaf.zone));
                }
            }
        }

        (actorInfo as any).zoneMask = actorZoneMask;

        // see allEmitterActors' own comment (decode-library.ts) - leafActors alone
        // double-gates a point-registered emitter behind both its single leaf AND
        // its zone; this flat list lets the runtime check the zone mask on its own
        library.allEmitterActors.push(actorInfo);

        zoneInfo.children.push(actorInfo);

        return this.uuid;
    }
}

export default UEmitter;
export { UEmitter };