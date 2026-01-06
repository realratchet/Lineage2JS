import { FObjectArray } from "@l2js/core/unreal/un-array";
import UParticleEmitter from "./emitters/un-particle-emitter";
import UAActor from "./un-aactor";

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

        const emittersInfo = this.emitters.loadSelf().map(e => e.setActor(this).getDecodeInfo(library)) as any as GD.IBaseObjectOrInstanceDecodeInfo[];
        // if (this.emitters.length > 0)
        //     debugger;

        //     // this.rotation.pitch = 0;
        //     // this.rotation.yaw = 0;
        //     // this.rotation.roll = 0;

        //     // debugger;

        //     // if (this.objectName === "Exp_Emitter7")
        //     //     debugger;

        const level = this.getLevel();
        const baseModel = level.getModel();
        const zone = this.getZone();
        const bspZoneIndex = library.bspZoneIndexMap[zone.uuid];
        const zoneInfo = library.bspZones[library.bspZoneIndexMap[this.getZone().uuid]].zoneInfo;

        // const actorInfo = {
        //     uuid: this.uuid,
        //     type: "Emitter",
        //     name: this.objectName,
        //     position: _position,
        //     scale: this.scale.getVectorElements().map(v => v * this.drawScale) as [number, number, number],
        //     quaternion: this.rotation.getQuaternionElements(),
        //     children: emittersInfo.filter(x => x)
        // } as GD.IBaseObjectDecodeInfo;

        // if (baseModel) {
        //     const origin = inflatedBox.getCenter();
        //     const inflatedExtent = inflatedBox.getExtents();
        //     const leafIndices = baseModel.boxLeavesRecursive(0, origin, inflatedExtent);

        //     for (const leafIndex of leafIndices) {
        //         if (library.leafActors[leafIndex]) {
        //             library.leafActors[leafIndex].push(actorInfo);
        //         }
        //         const leaf = library.bspLeaves[leafIndex];
        //         if (leaf && leaf.zone !== undefined && leaf.zone >= 0) {
        //             actorZoneMask |= (1n << BigInt(leaf.zone));
        //         }
        //     }
        // }

        // const _position = this.location.getVectorElements();


        // zoneInfo.children.push(actorInfo);

        return this.uuid;
    }
}

export default UEmitter;
export { UEmitter };