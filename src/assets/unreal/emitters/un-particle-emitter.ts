import UObject from "../un-object";

abstract class UParticleEmitter extends UObject {
    protected actor: UEmitter;

    // Acceleration
    protected acceleration: FVector; // Vector which determines the acceleration of the particles in any of the three planes

    // Color
    protected colorMultiplierRange: URangeVector; // Used to randomize the color of the particles. X corresponds to red, Y corresponds to Green and Z corresponds to blue. A value of 1 preserves the color of the original textures. To make everything darker, for example, set 0.5 for all values.
    protected colorScale: FArray<UParticleColorScale>; // Used to change the color of a particle over time. You set both a color you want it to be, and the relative time at which you want it to be that color. It will fade from whatever color it is to the color you want it to be over the interval you specify. The time is relative, so 0.5 would be half the particles lifespan.
    protected colorScaleRepeats: number; // How many times to repeat the color scales. Example, if you have a color scale that changes it to black at 0.5 time(half its lifespan), with color repeats it will be black by the time its half way done living. With one repeat, it will be black at 1/4 of its lifespan, normal at 1/2, and black again at 3/4ths of its lifespan.
    protected isUsingColorScale: boolean; // Must be true for ColorScales and ColorScaleRepeats to have any effect on the particles.

    // Fading
    protected isFadingIn: boolean; // If true, it will fade the particle in
    protected fadeInEndTime: number; // If FadeIn is true, this is the time at which the particle will have completly faded in and is 100% visible. This is NOT relative. 0.5 is 1/2 a second, not 1/2 of the particles lifespan.
    protected fadeInFactor: UPlane; // Specifies how much each component of the particle colors should be faded. 1 means start at 0 while e.g. 0.5 means start at half the normal value. X,Y,Z correspond to R,G,B and W corresponds to the alpha value.

    protected isFadingOut: boolean; // If true, the particle will fade out.
    protected fadeOutFactor: UPlane; // If Fadeout is true, this is the absolute time at which the particle will start fading out. Fading out overrules fading in, so if a particle is not yet faded in and starts fading out, it will start at full color values.
    protected fadeOutStartTime: UPlane; // Specifies how much each component of the particle colors should be faded. 1 means end at 0 while e.g. 0.5 means end at half the normal value. X,Y,Z correspond to R,G,B and W corresponds to the alpha value.

    // Forces
    protected isUsingActorForces: boolean; /* Whether the particles can be affected by Actor forces.
                                              Note: Setting this to True can cause a huge performance hit and will only work when physics details are set high enough. */

    // General
    protected coordinateSystem: EParticleCoordinateSystem_T; // Determines how the settings in the location section are calculated.
    protected effectAxis: EParticleEffectAxis_T;
    protected maxParticles: number; // Maximum number of particles that this ParticleEmitter can have at a time.
    protected isResettingAfterChange: boolean; // Determines if this emitter reset after a change has been made to its properties. It currently has no effect. (emitter resets no matter what if you make a change)

    // Local
    protected isAutoDestroyed: boolean; // Determines if this emitter will destroy itself once all particles are gone.
    protected isAutoReset: boolean; // Determines if this emitter will reset itself after a specified amount of time.
    protected autoResetTimeRange: number; // The time delay for auto-resets.
    protected isDisabled: boolean; // If true, this emitter wont emit anything. Typically used along with TriggerDisabled=true to create a trigger-toggled emitter that starts inactive and only begins emitting once the trigger Event occurs. Also used during testing to disable certain emitters within an emitter system.
    protected isFoggingDisabled: boolean; // Determines if particles are affected by distance fog.
    protected isRespawningDeadParticles: boolean; // Determines if dead particles (i.e. particles that have exceeded their lifespan or maximum collisions) should be respawned.

    // Mass
    protected startMassRange: URange;

    // Mesh
    protected meshNormal: FVector;
    protected meshNormalThresholdRange: URange;
    protected meshScaleRange: URangeVector; // This determines the size scale of an emitted mesh, similar to DrawScale3D for actors. It takes each axis independantly, so setting a good range can result in a lot of different shapes on the same mesh.
    protected meshSpawning: EParticleMeshSpawning_T;
    protected meshSpawningStaticMesh: UStaticMesh; // A StaticMesh, whose vertices should be used as possible start location offsets. The ParticleMeshes static mesh package provides some useful StaticMeshes for this.
    protected isSpawningTowardsNormal: boolean;
    protected isUniformMeshScale: boolean; // If this is true, the settings in meshscalerange are no longer used for each axis independantly. Instead, the mesh will be scaled along all axis using the x values.
    protected isUniformVelocityScale: boolean;
    protected isUsingColorFromMesh: boolean;
    protected isVelocityFromMesh: boolean;
    protected velocityScaleRange: URangeVector;

    // Rendering
    protected isAcceptingProjectors: boolean;
    protected alphaRef: number;
    protected isAlphaTest: boolean;
    protected isDepthTesting: boolean;
    protected isDepthWriting: boolean;

    /* Revolution
       Note: Revolution moves all particles around a central point or area. This might be useful for vortex-like particle effects. */
    protected isUsingRevolution: boolean; // If true, the particles will orbit a center point.
    protected isUsingRevolutionScale: boolean; // Whether the RevolutionScale settings should be used.
    protected revolutionCenterOffsetRange: URangeVector; // The range of where the center of revolution for this particle will be
    protected revolutionScale: FArray<UParticleRevolutionScale>;
    protected revolutionScaleRepeats: number;
    protected revolutionsPerSecondRange: URangeVector; // Determines how many times the particle will orbit the center per second, it takes each axis independantly.

    // Rotation
    protected isDampingRotation: boolean; // Whether collision should affect a particle's rotation.
    protected rotationDampingFactorRange: URangeVector; // How collision affects the particle's rotation.
    protected rotationNormal: FVector; // The normal used when UseRotationFrom is set to PTRS_Normal.
    protected rotationOffset: FRotator;
    protected clockwiseSpinChance: FVector; // The chance that particles will spin clockwise. 0 will make all particles spin counterclockwise, 0.7 will give a 70% chance that particles spin clockwise and a 30% chance for spinning counterclockwise.
    protected isSpinning: boolean; // Whether particles should spin.
    protected spinsPerSecondRange: URangeVector; // The range that determines how fast the particles will spin. X, Y and Z correspond to Pitch, Yaw and Roll.
    protected startSpinRange: URangeVector; // Specifies the initial rotation of the particles. Again, X, Y and Z correspond to Pitch, Yaw and Roll.
    protected rotationSource: EParticleRotationSource_T; // What to base the rotation on.

    // Size
    protected sizeScale: FArray<UParticleTimeScale>;
    protected sizeScaleRepeats: number;
    protected startSizeRange: URangeVector;
    protected isUniformScale: boolean;
    protected isScaleSizeRegular: boolean;
    protected isUsingSizeScale: boolean;

    // Sekeletal mesh
    protected relativeBoneIndexRange: URange;
    protected skeletalMeshActor: UAActor;
    protected skeletalScale: FVector;
    protected useSkeletalLocationAs: ESkelLocationUpdate_T;

    // Sound
    protected collisionSound: EParticleCollisionSound_T;
    protected collisionSoundIndex: URange;
    protected collisionSoundProbability: URange;
    protected sounds: FArray<UParticleSound>;
    protected spawningSound: EParticleCollisionSound_T;
    protected spawningSoundIndex: URange;
    protected spawningSoundProbability: URange;

    // Spawning
    protected isAutomaticInitialSpawning: boolean; // Automatically determines a particle spawn rate based on the particle lifetime and the maximum number of particles allowed so that the maximum number of particles is reached exactly when the first particle's lifetime is up. ParticlesPerSecond must be 0 for this to work.
    protected initialParticlesPerSecond: number; // The initial particle spawn rate until the point when the maximum number of particles is reached.
    protected particlesPerSecond: number; // The particle spawn rate after the initial warmup phase reached the maximum number of particles.

    // Texture
    protected isBlendBetweenSubdivisions: boolean;
    protected drawStyle: EParticleDrawStyle_T = EParticleDrawStyle_T.PTDS_Regular;
    protected subdivEnd: number;
    protected subdivisionScale: FPrimitiveArray<"float">;
    protected subdivStart: number;
    protected texture: UTexture;
    protected texSubdivU: number;
    protected texSubdivV: number;
    protected isUsingRandomSubdiv: boolean;
    protected isUsingSubdivisionScale: boolean;

    // Tick
    protected minSquaredVelocity: number; // The minimum velocity a particle may have before it gets inactive. This is essential for colliding particles that are supposed to stay idle on ground. The number should be in squared uu/s, ie if you want to set it to 50 uu/s, enter 2500 (50*50) instead.
    protected secondsBeforeInactive: number; // The amount of time that has to pass when the emitter is out of view before particle calculation is paused. Set this to 0.0 to disable the pausing effect, e.g. for Emitter-based weapon effects like explosions, tracers, sparks, etc.

    // Time
    protected initialTimeRange: URange; // Determines how long before this emitter will become active
    protected initialDelayRange: URange; // The initial particle age. For obvious reasons this should be lower than LifetimeRange. You might be able to create interesting effects in combination with the various scales parameters if you have a particle with e.g. LifetimeRange 4 seconds and InitialTimeRange 3 seconds. Effectively the particle will have 1 second left, but it already starts at 75% of its entire lifetime.
    protected lifetimeRange: URange; // Determines the lifespan of the particles that this emitter emits.

    // Trigger
    protected isResetOnTrigger: boolean; // Whether this ParticleEmitter should be reset when it's triggered. When the ParticleEmitter is reset, all its particles are removed and it starts spawning according to its initial spawn parameters. (initial delay, initial particles per second, etc.)
    protected spawnOnTriggerPPS: number;
    protected spawnOnTriggerRange: URange; // When triggered, this ParticleEmitter should spawn SpawnOnTriggerRange.Min to SpawnOnTriggerRange.Max particles, with a spawn rate of SpawnOnTriggerPPS particles per second.
    protected isTriggerDisabled: boolean; // If true allows the emitter to be toggled on/off by the Event named in the Emitter system's Event>Tag. As the Tag belongs to the entire emitter system sub-emitters can only respond to the one Event, albeit in different ways. By default the initial status of emitters is active, and will be toggled off upon first firing of the Event, but setting Local>bDisabled=true will disable emitter at start and wait for Event to turn on. Always set this to false if you want to use the other trigger options or if you don't want the ParticleEmitter's regular particle spawning to be affected by triggering.

    // Velocity
    protected addVelocityFromOtherEmitter: number;
    protected addVelocityMultiplierRange: URangeVector;
    protected getVelocityDirectionFrom: EParticleVelocityDirection_T;
    protected maxAbsVelocity: FVector;
    protected startVelocityRadialRange: URange;
    protected startVelocityRange: URangeVector;
    protected isUsingVelocityScale: boolean;
    protected velocityLossRange: URangeVector;
    protected velocityScale: FArray<UParticleVelocityScale>;
    protected velocityScaleRepeats: number;

    /* Warmup
       Note: Warmup precalculates particle spawning and movement so when the emitter first comes into sight it looks like it has been running for some time already. */
    protected relativeWarmupTime: number; // The time to precalculate, relative to the particle lifetime. 1.0 is the time corresponding to one particle's entire lifetime.
    protected warmupTicksPerSecond: number; // How many ticks per second to precalculate during warmup. Higher values can look better, but very high values might also freeze the game for a split-second while the emitter warms up when it comes into view for the first time.

    protected opacity: number;

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

    protected _forcedLifeTime: any;
    protected _forcedFade: any;
    protected _forcedMaxParticles: any;

    protected _startLocationOffset: any;
    protected _startLocationRange: any;
    protected _addLocationFromOtherEmitter: any;
    protected _startLocationShape: any;
    protected _sphereRadiusRange: any;
    protected _startLocationPolarRange: any;

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

    protected _refraction: any;
    protected _refrUScale: any;
    protected _refrVScale: any;

    public setActor(actor: UEmitter) { this.actor = actor; return this; }

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
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
            "Acceleration": "acceleration",
            "ColorScaleRepeats": "colorScaleRepeats",
            "UseColorScale": "isUsingColorScale",
            "FadeIn": "isFadingIn",
            "FadeInFactor": "fadeInFactor",
            "FadeInEndTime": "fadeInEndTime",
            "FadeOutFactor": "fadeOutFactor",
            "FadeOutStartTime": "fadeOutStartTime",
            "UseActorForces": "isUsingActorForces",
            "CoordinateSystem": "coordinateSystem",
            "EffectAxis": "effectAxis",
            "ResetAfterChange": "isResettingAfterChange",
            "AutoDestroy": "isAutoDestroyed",
            "AutoReset": "isAutoReset",
            "AutoResetTimeRange": "autoResetTimeRange",
            "Disabled": "isDisabled",
            "DisableFogging": "isFoggingDisabled",
            "RespawnDeadParticles": "isRespawningDeadParticles",
            "StartMassRange": "startMassRange",
            "MeshNormal": "meshNormal",
            "MeshNormalThresholdRange": "meshNormalThresholdRange",
            "MeshScaleRange": "meshScaleRange",
            "MeshSpawning": "meshSpawning",
            "MeshSpawningStaticMesh": "meshSpawningStaticMesh",
            "SpawnOnlyInDirectionOfNormal": "isSpawningTowardsNormal",
            "UniformMeshScale": "isUniformMeshScale",
            "UniformVelocityScale": "isUniformVelocityScale",
            "UseColorFromMesh": "isUsingColorFromMesh",
            "VelocityFromMesh": "isVelocityFromMesh",
            "VelocityScaleRange": "velocityScaleRange",
            "AcceptsProjectors": "isAcceptingProjectors",
            "AlphaRef": "alphaRef",
            "AlphaTest": "isAlphaTest",
            "ZTest": "isDepthTesting",
            "ZWrite": "isDepthWriting",
            "UseRevolution": "isUsingRevolution",
            "RevolutionCenterOffsetRange": "revolutionCenterOffsetRange",
            "RevolutionsPerSecondRange": "revolutionsPerSecondRange",
            "UseRevolutionScale": "isUsingRevolutionScale",
            "RevolutionScale": "revolutionScale",
            "RevolutionScaleRepeats": "revolutionScaleRepeats",
            "DampRotation": "isDampingRotation",
            "RotationDampingFactorRange": "rotationDampingFactorRange",
            "RotationNormal": "rotationNormal",
            "RotationOffset": "rotationOffset",
            "UseRotationFrom": "rotationSource",
            "SizeScaleRepeats": "sizeScaleRepeats",
            "UseSizeScale": "isUsingSizeScale",
            "RelativeBoneIndexRange": "relativeBoneIndexRange",
            "SkeletalMeshActor": "skeletalMeshActor",
            "SkeletalScale": "skeletalScale",
            "UseSkeletalLocationAs": "useSkeletalLocationAs",
            "CollisionSound": "collisionSound",
            "CollisionSoundIndex": "collisionSoundIndex",
            "CollisionSoundProbability": "collisionSoundProbability",
            "Sounds": "sounds",
            "SpawningSound": "spawningSound",
            "SpawningSoundIndex": "spawningSoundIndex",
            "SpawningSoundProbability": "spawningSoundProbability",
            "BlendBetweenSubdivisions": "isBlendBetweenSubdivisions",
            "UseSubdivisionScale": "isUsingSubdivisionScale",
            "SubdivisionScale": "_subdivisionScale",
            "Texture": "texture",
            "UseRandomSubdivision": "isUsingRandomSubdiv",
            "MinSquaredVelocity": "minSquaredVelocity",
            "SecondsBeforeInactive": "secondsBeforeInactive",
            "InitialTimeRange": "initialTimeRange",
            "InitialDelayRange": "initialDelayRange",
            "ResetOnTrigger": "isResetOnTrigger",
            "SpawnOnTriggerPPS": "spawnOnTriggerPPS",
            "SpawnOnTriggerRange": "spawnOnTriggerRange",
            "TriggerDisabled": "isTriggerDisabled",
            "AddVelocityFromOtherEmitter": "addVelocityFromOtherEmitter",
            "AddVelocityMultiplierRange": "addVelocityMultiplierRange",
            "GetVelocityDirectionFrom": "getVelocityDirectionFrom",
            "MaxAbsVelocity": "maxAbsVelocity",
            "StartVelocityRadialRange": "startVelocityRadialRange",
            "StartVelocityRange": "startVelocityRange",
            "UseVelocityScale": "isUsingVelocityScale",
            "VelocityLossRange": "velocityLossRange",
            "VelocityScale": "velocityScale",
            "VelocityScaleRepeats": "velocityScaleRepeats",
            "RelativeWarmupTime": "relativeWarmupTime",
            "WarmupTicksPerSecond": "warmupTicksPerSecond",

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

            "ForcedLifeTime": "_forcedLifeTime",
            "ForcedFade": "_forcedFade",
            "ForcedMaxParticles": "_forcedMaxParticles",

            "StartLocationOffset": "_startLocationOffset",
            "StartLocationRange": "_startLocationRange",
            "AddLocationFromOtherEmitter": "_addLocationFromOtherEmitter",
            "StartLocationShape": "_startLocationShape",
            "SphereRadiusRange": "_sphereRadiusRange",
            "StartLocationPolarRange": "_startLocationPolarRange",

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

            "Refraction": "_refraction",
            "RefrUScale": "_refrUScale",
            "RefrVScale": "_refrVScale",

        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        if (this._particles && this._particles.length > 0)
            debugger;


        return {
            name: this.objectName,
            maxParticles: this.maxParticles,
            opacity: this.opacity,
            lifetime: this.lifetimeRange.loadSelf().getDecodeInfo(library),
            fadeIn: this.isFadingIn ? { time: this.fadeInEndTime, color: this.fadeInFactor?.loadSelf().getElements() as ColorArr } : null,
            fadeOut: this.isFadingOut ? { time: this.fadeOutStartTime, color: this.fadeOutFactor?.loadSelf().getElements() as ColorArr } : null,
            uniformScale: this.isUniformScale,
            acceleration: this.acceleration?.getVectorElements(),
            warmupTime: this.relativeWarmupTime,
            initial: {
                particlesPerSecond: this.initialParticlesPerSecond,
                scale: this.startSizeRange.loadSelf().getDecodeInfo(library),
                angularVelocity: this.startSpinRange.loadSelf().getDecodeInfo(library),
                velocity: this.startVelocityRange?.loadSelf().getDecodeInfo(library)
            },
            colorMultiplierRange: this.colorMultiplierRange?.loadSelf().getDecodeInfo(library),
            particlesPerSecond: this.particlesPerSecond,
            angularVelocity: this.spinsPerSecondRange?.loadSelf().getDecodeInfo(library),
            blendingMode: blendingNames[this.drawStyle]
        };
    }
}

class UParticleRevolutionScale extends UObject {

};

class UParticleTimeScale extends UObject {

};

class UParticleVelocityScale extends UObject {

};

class UParticleSound extends UObject {

};

class UParticle extends UObject {

};

class UParticleColorScale extends UObject {

};

export default UParticleEmitter;
export { UParticleEmitter, UParticleRevolutionScale, UParticleTimeScale, UParticleSound, UParticleVelocityScale, UParticle, UParticleColorScale };

enum EParticleCoordinateSystem_T {
    PTCS_Independent, //Initial values (Start Location, Starting Velocity, etc.) are relative to the Emitter actor. Values that change over time, such as acceleration, are relative to the world. (aka absolute)
    PTCS_Relative, //All coordinates are relative to the Emitter actor's position.
    PTCS_Absolute, //All coordinates are absolute world coordinates.
    PTCS_RelativeRotation,
    PTCS_Spray
};

enum EParticleEffectAxis_T {
    PTEA_NegativeX,
    PTEA_PositiveZ
};

enum EParticleMeshSpawning_T {
    PTMS_None,
    PTMS_Linear,
    PTMS_Random
};

enum EParticleRotationSource_T {
    PTRS_None,
    PTRS_Actor,
    PTRS_Offset,
    PTRS_Normal
};

enum ESkelLocationUpdate_T {
    PTSU_None,
    PTSU_SpawnOffset,
    PTSU_Location
};

enum EParticleCollisionSound_T {
    PTSC_None,
    PTSC_LinearGlobal,
    PTSC_LinearLocal,
    PTSC_Random
};

enum EParticleVelocityDirection_T {
    PTVD_None, // This is the default.
    PTVD_StartPositionAndOwner, // Particles move in the direction from the Emitter actor towards their starting location.
    PTVD_OwnerAndStartPosition, // Like PTVD_StartPositionAndOwner, but particles move towards the Emitter actor.
    PTVD_AddRadial // The particle will move outward from the Emitter actor at a rate set by the StartVelocityRadialRange. If the particle starts at 0,0,0 relative to the Emitter, this will have no effect.
};

enum EParticleDrawStyle_T {
    PTDS_Regular,   // Just draws the particle textures without any color blending and transparency like the STY_Normal color blending mode for Actors.
    PTDS_AlphaBlend, // Uses the texture's alpha channel to make parts of it transparent like the STY_Alpha color blending mode for Actors.
    PTDS_Modulated, // Like the STY_Modulated color blending mode for Actors.
    PTDS_Translucent, // Like the STY_Translucent color blending mode for Actors.
    PTDS_AlphaModulate_MightNotFogCorrectly, // Uses the alpha channel to modulate the pixel colors. As you may have guessed, this might cause fogging problems.
    PTDS_Darken, // Like the STY_Subtractive color blending mode for Actors.
    PTDS_Brighten // Like the STY_Additive color blending mode for Actors.
};

const blendingNames = {
    [EParticleDrawStyle_T.PTDS_Regular]: "normal",
    [EParticleDrawStyle_T.PTDS_AlphaBlend]: "alpha",
    [EParticleDrawStyle_T.PTDS_Modulated]: "modulate",
    [EParticleDrawStyle_T.PTDS_Translucent]: "translucent",
    [EParticleDrawStyle_T.PTDS_AlphaModulate_MightNotFogCorrectly]: "alphaModulate",
    [EParticleDrawStyle_T.PTDS_Darken]: "darken",
    [EParticleDrawStyle_T.PTDS_Brighten]: "brighten",
} as Record<EParticleDrawStyle_T, ParticleBlendModes_T>;