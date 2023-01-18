import UParticleEmitter from "./emitters/un-particle-emitter";
import UAActor from "./un-aactor";
import { FObjectArray } from "./un-array";

abstract class UEmitter extends UAActor {
    protected emitters = new FObjectArray<UParticleEmitter>();

    protected _autoDestroy: any;
    protected _autoReset: any;
    protected _disableFogging: any;
    protected _globalOffsetRange: any;
    protected _timeTillResetRange: any;
    protected _autoReplay: any;
    protected _speedRate: any;
    protected _bRotEmitter: any;
    protected _rotPerSecond: any;
    protected _fixedBoundingBox: any;
    protected _fixedBoundingBoxExpand: any;
    protected _spawnSound: any;
    protected _soundRadius: any;
    protected _soundVolume: any;
    protected _initialized: any;
    protected _boundingBox: any;
    protected _emitterRadius: any;
    protected _emitterHeight: any;
    protected _actorForcesEnabled: any;
    protected _globalOffset: any;
    protected _timeTillReset: any;
    protected _useParticleProjectors: any;
    protected _particleMaterial: any;
    protected _deleteParticleEmitters: any;
    protected _fixedLifeTime: any;
    protected _firstSpawnParticle: any;
    protected _trailerPrePivot: any;
    protected _bUseLight: any;
    protected _lightType: any;
    protected _lightEffect: any;
    protected _lightBrightness: any;
    protected _lightRadius: any;
    protected _lightHue: any;
    protected _lightSaturation: any;
    protected _emitterLightingType: any;
    protected _pEmitterLight: any;
    protected _eL_LifeSpan: any;
    protected _eL_InitialDelay: any;
    protected _bUseQuake: any;
    protected _shakeType: any;
    protected _shakeIntensity: any;
    protected _shakeVector: any;
    protected _shakeRange: any;
    protected _shakeCount: any;
    protected _shakeTime: any;
    protected _eQ_InitialDelay: any;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "Emitters": "emitters",

            "AutoDestroy": "_autoDestroy",
            "AutoReset": "_autoReset",
            "DisableFogging": "_disableFogging",
            "GlobalOffsetRange": "_globalOffsetRange",
            "TimeTillResetRange": "_timeTillResetRange",
            "AutoReplay": "_autoReplay",
            "SpeedRate": "_speedRate",
            "bRotEmitter": "_bRotEmitter",
            "RotPerSecond": "_rotPerSecond",
            "FixedBoundingBox": "_fixedBoundingBox",
            "FixedBoundingBoxExpand": "_fixedBoundingBoxExpand",
            "SpawnSound": "_spawnSound",
            "SoundRadius": "_soundRadius",
            "SoundVolume": "_soundVolume",
            "Initialized": "_initialized",
            "BoundingBox": "_boundingBox",
            "EmitterRadius": "_emitterRadius",
            "EmitterHeight": "_emitterHeight",
            "ActorForcesEnabled": "_actorForcesEnabled",
            "GlobalOffset": "_globalOffset",
            "TimeTillReset": "_timeTillReset",
            "UseParticleProjectors": "_useParticleProjectors",
            "ParticleMaterial": "_particleMaterial",
            "DeleteParticleEmitters": "_deleteParticleEmitters",
            "FixedLifeTime": "_fixedLifeTime",
            "FirstSpawnParticle": "_firstSpawnParticle",
            "TrailerPrePivot": "_trailerPrePivot",
            "bUseLight": "_bUseLight",
            "LightType": "_lightType",
            "LightEffect": "_lightEffect",
            "LightBrightness": "_lightBrightness",
            "LightRadius": "_lightRadius",
            "LightHue": "_lightHue",
            "LightSaturation": "_lightSaturation",
            "EmitterLightingType": "_emitterLightingType",
            "pEmitterLight": "_pEmitterLight",
            "EL_LifeSpan": "_eL_LifeSpan",
            "EL_InitialDelay": "_eL_InitialDelay",
            "bUseQuake": "_bUseQuake",
            "ShakeType": "_shakeType",
            "ShakeIntensity": "_shakeIntensity",
            "ShakeVector": "_shakeVector",
            "ShakeRange": "_shakeRange",
            "ShakeCount": "_shakeCount",
            "ShakeTime": "_shakeTime",
            "EQ_InitialDelay": "_eQ_InitialDelay",
        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        const emittersInfo = this.emitters.loadSelf().map(e => e.setActor(this).getDecodeInfo(library)) as any as IBaseObjectOrInstanceDecodeInfo[];

        const zoneInfo = library.bspZones[library.bspZoneIndexMap[this.getZone().uuid]].zoneInfo;
        const _position = this.location.getVectorElements();
        const actorInfo = {
            uuid: this.uuid,
            type: "Group",
            name: this.objectName,
            position: _position,
            scale: this.scale.getVectorElements().map(v => v * this.drawScale) as [number, number, number],
            rotation: this.rotation.getEulerElements(),
            children: emittersInfo
        } as IBaseObjectDecodeInfo;

        zoneInfo.children.push(actorInfo);

        return this.uuid;
    }
}

export default UEmitter;
export { UEmitter };