import UObject from "../un-object";

class UParticleEmitter extends UObject {
    protected maxParticles: number;
    protected drawStyle: EParticleDrawStyle_T;
    protected opacity: number;
    protected startSizeRange: URangeVector;
    protected startSpinRange: URangeVector;
    protected colorMultiplierRange: URangeVector;
    
    protected isSpinning: boolean;
    protected isFadingOut: boolean;
    protected isUniformScale: boolean;
    protected isAutomaticInitialSpawning: boolean;
    protected isScaleSizeRegular: any;

    protected particlesPerSecond: number;
    protected initialParticlesPerSecond: number;
    protected lifetimeRange: URange;
    protected clockwiseSpinChance: FVector;
    protected spinsPerSecondRange: URangeVector;

    protected sprite: UTexture;
    protected actor: UEmitter;

    protected texSubdivU: number;
    protected texSubdivV: number;
    protected subdivStart: number;
    protected subdivEnd: number;

    protected colorScale: any;
    protected sizeScale: any;

    protected _acceleration: any;
    protected _independentSprayAccel: any;
    protected _useCollision: any;
    protected _extentMultiplier: any;
    protected _dampingFactorRange: any;
    protected _useCollisionPlanes: any;
    protected _collisionPlanes: any;
    protected _useMaxCollisions: any;
    protected _maxCollisions: any;
    protected _spawnFromOtherEmitter: any;
    protected _spawnAmount: any;
    protected _spawnedVelocityScaleRange: any;
    protected _useSpawnedVelocityScale: any;
    protected _useColorScale: any;
    
    protected _colorScaleRepeats: any;
    
 
    protected _fadeOutFactor: any;
    protected _fadeOutStartTime: any;
    
    protected _fadeInFactor: any;
    protected _fadeInEndTime: any;
    protected _fadeIn: any;
    protected _useActorForces: any;
    protected _coordinateSystem: any;

    protected _resetAfterChange: any;
    protected _effectAxis: any;
    protected _forcedLifeTime: any;
    protected _forcedFade: any;
    protected _forcedMaxParticles: any;
    protected _respawnDeadParticles: any;
    protected _autoDestroy: any;
    protected _autoReset: any;
    protected _disabled: any;
    protected _disableFogging: any;
    protected _autoResetTimeRange: any;
    protected _startLocationOffset: any;
    protected _startLocationRange: any;
    protected _addLocationFromOtherEmitter: any;
    protected _startLocationShape: any;
    protected _sphereRadiusRange: any;
    protected _startLocationPolarRange: any;
    protected _startMassRange: any;
    protected _meshSpawningStaticMesh: any;
    protected _meshSpawning: any;
    protected _velocityFromMesh: any;
    protected _velocityScaleRange: any;
    protected _meshScaleRange: any;
    protected _uniformMeshScale: any;
    protected _uniformVelocityScale: any;
    protected _useColorFromMesh: any;
    protected _spawnOnlyInDirectionOfNormal: any;
    protected _meshNormal: any;
    protected _meshNormalThresholdRange: any;
    protected _alphaRef: any;
    protected _alphaTest: any;
    protected _acceptsProjectors: any;
    protected _zTest: any;
    protected _zWrite: any;
    protected _useRevolution: any;
    protected _revolutionCenterOffsetRange: any;
    protected _revolutionsPerSecondRange: any;
    protected _useRevolutionScale: any;
    protected _revolutionScale: any;
    protected _revolutionScaleRepeats: any;
    protected _useRotationFrom: any;
    
    protected _rotationOffset: any;
    
    
    protected _dampRotation: any;
    protected _rotationDampingFactorRange: any;
    protected _rotationNormal: any;
    protected _useSizeScale: any;
    

    protected _sizeScaleRepeats: any;
    
    
    protected _useSkeletalLocationAs: any;
    protected _skeletalMeshActor: any;
    protected _skeletalScale: any;
    protected _relativeBoneIndexRange: any;
    protected _sounds: any;
    protected _spawningSound: any;
    protected _spawningSoundIndex: any;
    protected _spawningSoundProbability: any;
    protected _collisionSound: any;
    protected _collisionSoundIndex: any;
    protected _collisionSoundProbability: any;

    protected _blendBetweenSubdivisions: any;
    protected _useSubdivisionScale: any;
    protected _subdivisionScale: any;

    protected _useRandomSubdivision: any;
    protected _secondsBeforeInactive: any;
    protected _minSquaredVelocity: any;
    protected _initialTimeRange: any;
    protected _lifetimeRange: any;
    protected _initialDelayRange: any;
    protected _triggerDisabled: any;
    protected _resetOnTrigger: any;
    protected _spawnOnTriggerRange: any;
    protected _spawnOnTriggerPPS: any;
    protected _startVelocityRange: any;
    protected _startVelocityRadialRange: any;
    protected _maxAbsVelocity: any;
    protected _velocityLossRange: any;
    protected _addVelocityFromOtherEmitter: any;
    protected _addVelocityMultiplierRange: any;
    protected _getVelocityDirectionFrom: any;
    protected _useVelocityScale: any;
    protected _velocityScale: any;
    protected _velocityScaleRepeats: any;
    protected _warmupTicksPerSecond: any;
    protected _relativeWarmupTime: any;
    protected _owner: any;
    protected _initialized: any;
    protected _inactive: any;
    protected _inactiveTime: any;
    protected _particles: any;
    protected _particleIndex: any;
    protected _activeParticles: any;
    protected _pPSFraction: any;
    protected _boundingBox: any;
    protected _realExtentMultiplier: any;
    protected _realDisableFogging: any;
    protected _allParticlesDead: any;
    protected _warmedUp: any;
    protected _otherIndex: any;
    protected _initialDelay: any;
    protected _globalOffset: any;
    protected _timeTillReset: any;
    protected _pS2Data: any;
    protected _maxActiveParticles: any;
    protected _currentCollisionSoundIndex: any;
    protected _currentSpawningSoundIndex: any;
    protected _currentMeshSpawningIndex: any;
    protected _maxSizeScale: any;
    protected _killPending: any;
    protected _deferredParticles: any;
    protected _realMeshNormal: any;
    protected _meshVertsAndNormals: any;
    protected _currentSpawnOnTrigger: any;
    protected _bOwnerTracking: any;
    protected _curLifeTime: any;
    protected _bNotifyPreDestroy: any;
    protected _useDirectionAs: any;
    protected _projectionNormal: any;
    protected _refraction: any;
    protected _refrUScale: any;
    protected _refrVScale: any;
    protected _realProjectionNormal: any;

    public setActor(actor: UEmitter) { this.actor = actor; return this; }

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "Sprite": "sprite",
            "MaxParticles": "maxParticles",
            "DrawStyle": "drawStyle",
            "FadeOut": "isFadingOut",
            "SpinParticles": "isSpinning",
            "Opacity": "opacity",
            "StartSizeRange": "startSizeRange",
            "StartSpinRange": "startSpinRange",
            "UniformSize": "isUniformScale",
            "ParticlesPerSecond": "particlesPerSecond",
            "InitialParticlesPerSecond": "initialParticlesPerSecond",
            "ColorMultiplierRange": "colorMultiplierRange",
            "AutomaticInitialSpawning": "isAutomaticInitialSpawning",
            "LifetimeRange": "lifetimeRange",
            "TextureUSubdivisions": "texSubdivU",
            "TextureVSubdivisions": "texSubdivV",
            "SubdivisionStart": "subdivStart",
            "SubdivisionEnd": "subdivEnd",
            "ColorScale": "colorScale",
            "SizeScale": "sizeScale",
            "UseRegularSizeScale": "isScaleSizeRegular",
            "SpinCCWorCW": "clockwiseSpinChance",
            "SpinsPerSecondRange": "spinsPerSecondRange",

            "Acceleration": "_acceleration",
            "IndependentSprayAccel": "_independentSprayAccel",
            "UseCollision": "_useCollision",
            "ExtentMultiplier": "_extentMultiplier",
            "DampingFactorRange": "_dampingFactorRange",
            "UseCollisionPlanes": "_useCollisionPlanes",
            "CollisionPlanes": "_collisionPlanes",
            "UseMaxCollisions": "_useMaxCollisions",
            "MaxCollisions": "_maxCollisions",
            "SpawnFromOtherEmitter": "_spawnFromOtherEmitter",
            "SpawnAmount": "_spawnAmount",
            "SpawnedVelocityScaleRange": "_spawnedVelocityScaleRange",
            "UseSpawnedVelocityScale": "_useSpawnedVelocityScale",
            "UseColorScale": "_useColorScale",
           
            "ColorScaleRepeats": "_colorScaleRepeats",
            
           
            "FadeOutFactor": "_fadeOutFactor",
            "FadeOutStartTime": "_fadeOutStartTime",
            
            "FadeInFactor": "_fadeInFactor",
            "FadeInEndTime": "_fadeInEndTime",
            "FadeIn": "_fadeIn",
            "UseActorForces": "_useActorForces",
            "CoordinateSystem": "_coordinateSystem",

            "ResetAfterChange": "_resetAfterChange",
            "EffectAxis": "_effectAxis",
            "ForcedLifeTime": "_forcedLifeTime",
            "ForcedFade": "_forcedFade",
            "ForcedMaxParticles": "_forcedMaxParticles",
            "RespawnDeadParticles": "_respawnDeadParticles",
            "AutoDestroy": "_autoDestroy",
            "AutoReset": "_autoReset",
            "Disabled": "_disabled",
            "DisableFogging": "_disableFogging",
            "AutoResetTimeRange": "_autoResetTimeRange",
            "StartLocationOffset": "_startLocationOffset",
            "StartLocationRange": "_startLocationRange",
            "AddLocationFromOtherEmitter": "_addLocationFromOtherEmitter",
            "StartLocationShape": "_startLocationShape",
            "SphereRadiusRange": "_sphereRadiusRange",
            "StartLocationPolarRange": "_startLocationPolarRange",
            "StartMassRange": "_startMassRange",
            "MeshSpawningStaticMesh": "_meshSpawningStaticMesh",
            "MeshSpawning": "_meshSpawning",
            "VelocityFromMesh": "_velocityFromMesh",
            "VelocityScaleRange": "_velocityScaleRange",
            "MeshScaleRange": "_meshScaleRange",
            "UniformMeshScale": "_uniformMeshScale",
            "UniformVelocityScale": "_uniformVelocityScale",
            "UseColorFromMesh": "_useColorFromMesh",
            "SpawnOnlyInDirectionOfNormal": "_spawnOnlyInDirectionOfNormal",
            "MeshNormal": "_meshNormal",
            "MeshNormalThresholdRange": "_meshNormalThresholdRange",
            "AlphaRef": "_alphaRef",
            "AlphaTest": "_alphaTest",
            "AcceptsProjectors": "_acceptsProjectors",
            "ZTest": "_zTest",
            "ZWrite": "_zWrite",
            "UseRevolution": "_useRevolution",
            "RevolutionCenterOffsetRange": "_revolutionCenterOffsetRange",
            "RevolutionsPerSecondRange": "_revolutionsPerSecondRange",
            "UseRevolutionScale": "_useRevolutionScale",
            "RevolutionScale": "_revolutionScale",
            "RevolutionScaleRepeats": "_revolutionScaleRepeats",
            "UseRotationFrom": "_useRotationFrom",
            
            "RotationOffset": "_rotationOffset",
            
            
           
            "DampRotation": "_dampRotation",
            "RotationDampingFactorRange": "_rotationDampingFactorRange",
            "RotationNormal": "_rotationNormal",
            "UseSizeScale": "_useSizeScale",
            
       
            "SizeScaleRepeats": "_sizeScaleRepeats",

            
            "UseSkeletalLocationAs": "_useSkeletalLocationAs",
            "SkeletalMeshActor": "_skeletalMeshActor",
            "SkeletalScale": "_skeletalScale",
            "RelativeBoneIndexRange": "_relativeBoneIndexRange",
            "Sounds": "_sounds",
            "SpawningSound": "_spawningSound",
            "SpawningSoundIndex": "_spawningSoundIndex",
            "SpawningSoundProbability": "_spawningSoundProbability",
            "CollisionSound": "_collisionSound",
            "CollisionSoundIndex": "_collisionSoundIndex",
            "CollisionSoundProbability": "_collisionSoundProbability",
           


            "BlendBetweenSubdivisions": "_blendBetweenSubdivisions",
            "UseSubdivisionScale": "_useSubdivisionScale",
            "SubdivisionScale": "_subdivisionScale",
            "UseRandomSubdivision": "_useRandomSubdivision",
            "SecondsBeforeInactive": "_secondsBeforeInactive",
            "MinSquaredVelocity": "_minSquaredVelocity",
            "InitialTimeRange": "_initialTimeRange",
           
            "InitialDelayRange": "_initialDelayRange",
            "TriggerDisabled": "_triggerDisabled",
            "ResetOnTrigger": "_resetOnTrigger",
            "SpawnOnTriggerRange": "_spawnOnTriggerRange",
            "SpawnOnTriggerPPS": "_spawnOnTriggerPPS",
            "StartVelocityRange": "_startVelocityRange",
            "StartVelocityRadialRange": "_startVelocityRadialRange",
            "MaxAbsVelocity": "_maxAbsVelocity",
            "VelocityLossRange": "_velocityLossRange",
            "AddVelocityFromOtherEmitter": "_addVelocityFromOtherEmitter",
            "AddVelocityMultiplierRange": "_addVelocityMultiplierRange",
            "GetVelocityDirectionFrom": "_getVelocityDirectionFrom",
            "UseVelocityScale": "_useVelocityScale",
            "VelocityScale": "_velocityScale",
            "VelocityScaleRepeats": "_velocityScaleRepeats",
            "WarmupTicksPerSecond": "_warmupTicksPerSecond",
            "RelativeWarmupTime": "_relativeWarmupTime",
            "Owner": "_owner",
            "Initialized": "_initialized",
            "Inactive": "_inactive",
            "InactiveTime": "_inactiveTime",
            "Particles": "_particles",
            "ParticleIndex": "_particleIndex",
            "ActiveParticles": "_activeParticles",
            "PPSFraction": "_pPSFraction",
            "BoundingBox": "_boundingBox",
            "RealExtentMultiplier": "_realExtentMultiplier",
            "RealDisableFogging": "_realDisableFogging",
            "AllParticlesDead": "_allParticlesDead",
            "WarmedUp": "_warmedUp",
            "OtherIndex": "_otherIndex",
            "InitialDelay": "_initialDelay",
            "GlobalOffset": "_globalOffset",
            "TimeTillReset": "_timeTillReset",
            "PS2Data": "_pS2Data",
            "MaxActiveParticles": "_maxActiveParticles",
            "CurrentCollisionSoundIndex": "_currentCollisionSoundIndex",
            "CurrentSpawningSoundIndex": "_currentSpawningSoundIndex",
            "CurrentMeshSpawningIndex": "_currentMeshSpawningIndex",
            "MaxSizeScale": "_maxSizeScale",
            "KillPending": "_killPending",
            "DeferredParticles": "_deferredParticles",
            "RealMeshNormal": "_realMeshNormal",
            "MeshVertsAndNormals": "_meshVertsAndNormals",
            "CurrentSpawnOnTrigger": "_currentSpawnOnTrigger",
            "bOwnerTracking": "_bOwnerTracking",
            "CurLifeTime": "_curLifeTime",
            "bNotifyPreDestroy": "_bNotifyPreDestroy",
            "UseDirectionAs": "_useDirectionAs",
            "ProjectionNormal": "_projectionNormal",
            "Refraction": "_refraction",
            "RefrUScale": "_refrUScale",
            "RefrVScale": "_refrVScale",
            "RealProjectionNormal": "_realProjectionNormal",
        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        const spriteUuid = this.sprite.loadSelf().getDecodeInfo(library);

        
        debugger;

        return {
            name: this.objectName,
            type: "ParticleEmitter",
        };
    }
}

export default UParticleEmitter;
export { UParticleEmitter };

enum EParticleDrawStyle_T {
    PTDS_Regular,
    PTDS_AlphaBlend,
    PTDS_Modulated,
    PTDS_Translucent,
    PTDS_AlphaModulate_MightNotFogCorrectly,
    PTDS_Darken,
    PTDS_Brighten
};