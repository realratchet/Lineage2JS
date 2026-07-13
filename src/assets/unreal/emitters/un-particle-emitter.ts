import { BufferValue } from "@l2js/core";
import UObject from "@l2js/core";
import UPlane from "../un-plane";
import FRange, { FRangeVector } from "../un-range";
import FRotator from "../un-rotator";
import FVector from "../un-vector";
import FColor from "../un-color";
import FArray, { FPrimitiveArray } from "@l2js/core/unreal/un-array";

abstract class UParticleEmitter extends UObject {
    declare protected actor: GA.UEmitter;

    // Acceleration
    declare protected acceleration: FVector; // Vector which determines the acceleration of the particles in any of the three planes

    // Collision
    declare protected collisionPlanes: FArray<UPlane>; // Can be used to specify planes in the Unreal world the particle will collide with. The planes will be used for collision when UseCollisionPlanes is True.
    declare protected dampingFactorRange: FRangeVector; // Damping applied to the particle's velocity when it collides with something.
    declare protected extentMultiplier: FVector; // A multiplier for the particles' size for collision calculations.
    declare protected maxCollisions: FRange; // Maximum number of collisions before the particle is destroyed. This property will only be used when UseMaxCollisions is True.
    declare protected spawnAmount: number; // The number of sub-particles spawned when the particles collide with something.
    declare protected spawnedVelocityScaleRange: FRangeVector; // The velocity of the spawned sub-particles.
    declare protected spawnFromOtherEmitter: number; // The ParticleEmitter within the same Emitter actor used for the sub-particles.
    declare protected isUsingCollision: boolean; // Whether the particles should use collision. If False, they will fall through static meshes, BSP, etc.
    declare protected isUsingCollisionPlanes: boolean; // Whether the particles should collide with the CollisionPlanes.
    declare protected isUsingMaxCollisions: boolean; // Whether the particles should be destroyed when they reach their maximum number of collisons.
    declare protected isUsingSpawnedVelocityScale: boolean; // Whether to use SpawnedVelocityScaleRange for collision sub-particles.

    // Color
    declare protected colorMultiplierRange: FRangeVector; // Used to randomize the color of the particles. X corresponds to red, Y corresponds to Green and Z corresponds to blue. A value of 1 preserves the color of the original textures. To make everything darker, for example, set 0.5 for all values.
    declare protected colorScale: FArray<UParticleColorScale>; // Used to change the color of a particle over time. You set both a color you want it to be, and the relative time at which you want it to be that color. It will fade from whatever color it is to the color you want it to be over the interval you specify. The time is relative, so 0.5 would be half the particles lifespan.
    declare protected colorScaleRepeats: number; // How many times to repeat the color scales. Example, if you have a color scale that changes it to black at 0.5 time(half its lifespan), with color repeats it will be black by the time its half way done living. With one repeat, it will be black at 1/4 of its lifespan, normal at 1/2, and black again at 3/4ths of its lifespan.
    declare protected isUsingColorScale: boolean; // Must be true for ColorScales and ColorScaleRepeats to have any effect on the particles.

    // Fading
    declare protected isFadingIn: boolean; // If true, it will fade the particle in
    declare protected fadeInEndTime: number; // If FadeIn is true, this is the time at which the particle will have completly faded in and is 100% visible. This is NOT relative. 0.5 is 1/2 a second, not 1/2 of the particles lifespan.
    declare protected fadeInFactor: UPlane; // Specifies how much each component of the particle colors should be faded. 1 means start at 0 while e.g. 0.5 means start at half the normal value. X,Y,Z correspond to R,G,B and W corresponds to the alpha value.
    declare protected isFadingOut: boolean; // If true, the particle will fade out.
    declare protected fadeOutFactor: UPlane; // If Fadeout is true, this is the absolute time at which the particle will start fading out. Fading out overrules fading in, so if a particle is not yet faded in and starts fading out, it will start at full color values.
    declare protected fadeOutStartTime: UPlane; // Specifies how much each component of the particle colors should be faded. 1 means end at 0 while e.g. 0.5 means end at half the normal value. X,Y,Z correspond to R,G,B and W corresponds to the alpha value.

    // Forces
    declare protected isUsingActorForces: boolean; /* Whether the particles can be affected by Actor forces.
                                              Note: Setting this to True can cause a huge performance hit and will only work when physics details are set high enough. */

    // General
    declare protected coordinateSystem: EParticleCoordinateSystem_T; // Determines how the settings in the location section are calculated.
    declare protected effectAxis: EParticleEffectAxis_T;
    declare protected maxParticles: number; // Maximum number of particles that this ParticleEmitter can have at a time.
    declare protected isResettingAfterChange: boolean; // Determines if this emitter reset after a change has been made to its properties. It currently has no effect. (emitter resets no matter what if you make a change)

    // Local
    declare protected isAutoDestroyed: boolean; // Determines if this emitter will destroy itself once all particles are gone.
    declare protected isAutoReset: boolean; // Determines if this emitter will reset itself after a specified amount of time.
    declare protected autoResetTimeRange: number; // The time delay for auto-resets.
    declare protected isDisabled: boolean; // If true, this emitter wont emit anything. Typically used along with TriggerDisabled=true to create a trigger-toggled emitter that starts inactive and only begins emitting once the trigger Event occurs. Also used during testing to disable certain emitters within an emitter system.
    declare protected isFoggingDisabled: boolean; // Determines if particles are affected by distance fog.
    declare protected isRespawningDeadParticles: boolean; // Determines if dead particles (i.e. particles that have exceeded their lifespan or maximum collisions) should be respawned.

    // Location
    declare protected addLocationFromOtherEmitter: number;
    declare protected sphereRadiusRange: FRange;
    declare protected startLocationOffset: FVector;
    declare protected startLocationPolarRange: FRangeVector;
    declare protected startLocationRange: FRangeVector;
    declare protected startLocationShape: EParticleStartLocationShape_T;

    // Mass
    declare protected startMassRange: FRange;

    // Mesh
    declare protected meshNormal: FVector;
    declare protected meshNormalThresholdRange: FRange;
    declare protected meshScaleRange: FRangeVector; // This determines the size scale of an emitted mesh, similar to DrawScale3D for actors. It takes each axis independantly, so setting a good range can result in a lot of different shapes on the same mesh.
    declare protected meshSpawning: EParticleMeshSpawning_T;
    declare protected meshSpawningStaticMesh: GA.UStaticMesh; // A StaticMesh, whose vertices should be used as possible start location offsets. The ParticleMeshes static mesh package provides some useful StaticMeshes for this.
    declare protected isSpawningTowardsNormal: boolean;
    declare protected isUniformMeshScale: boolean; // If this is true, the settings in meshscalerange are no longer used for each axis independantly. Instead, the mesh will be scaled along all axis using the x values.
    declare protected isUniformVelocityScale: boolean;
    declare protected isUsingColorFromMesh: boolean;
    declare protected isVelocityFromMesh: boolean;
    declare protected velocityScaleRange: FRangeVector;

    // Rendering
    declare protected isAcceptingProjectors: boolean;
    declare protected alphaRef: number;
    declare protected isAlphaTest: boolean;
    declare protected isDepthTesting: boolean;
    declare protected isDepthWriting: boolean;

    /* Revolution
       Note: Revolution moves all particles around a central point or area. This might be useful for vortex-like particle effects. */
    declare protected isUsingRevolution: boolean; // If true, the particles will orbit a center point.
    declare protected isUsingRevolutionScale: boolean; // Whether the RevolutionScale settings should be used.
    declare protected revolutionCenterOffsetRange: FRangeVector; // The range of where the center of revolution for this particle will be
    declare protected revolutionScale: FArray<UParticleRevolutionScale>;
    declare protected revolutionScaleRepeats: number;
    declare protected revolutionsPerSecondRange: FRangeVector; // Determines how many times the particle will orbit the center per second, it takes each axis independantly.

    // Rotation
    declare protected isDampingRotation: boolean; // Whether collision should affect a particle's rotation.
    declare protected rotationDampingFactorRange: FRangeVector; // How collision affects the particle's rotation.
    declare protected rotationNormal: FVector; // The normal used when UseRotationFrom is set to PTRS_Normal.
    declare protected rotationOffset: FRotator;
    declare protected clockwiseSpinChance: FVector; // The chance that particles will spin clockwise. 0 will make all particles spin counterclockwise, 0.7 will give a 70% chance that particles spin clockwise and a 30% chance for spinning counterclockwise.
    declare protected isSpinning: boolean; // Whether particles should spin.
    declare protected spinsPerSecondRange: FRangeVector; // The range that determines how fast the particles will spin. X, Y and Z correspond to Pitch, Yaw and Roll.
    declare protected startSpinRange: FRangeVector; // Specifies the initial rotation of the particles. Again, X, Y and Z correspond to Pitch, Yaw and Roll.
    declare protected rotationSource: EParticleRotationSource_T; // What to base the rotation on.

    // Size
    declare protected sizeScale: FArray<UParticleTimeScale>;
    declare protected sizeScaleRepeats: number;
    declare protected startSizeRange: FRangeVector;
    declare protected isUniformScale: boolean;
    declare protected isScaleSizeRegular: boolean;
    declare protected isUsingSizeScale: boolean;

    // Skeletal mesh
    declare protected relativeBoneIndexRange: FRange;
    declare protected skeletalMeshActor: GA.AActor;
    declare protected skeletalScale: FVector;
    declare protected useSkeletalLocationAs: ESkelLocationUpdate_T;

    // Sound
    declare protected collisionSound: EParticleCollisionSound_T;
    declare protected collisionSoundIndex: FRange;
    declare protected collisionSoundProbability: FRange;
    declare protected sounds: FArray<UParticleSound>;
    declare protected spawningSound: EParticleCollisionSound_T;
    declare protected spawningSoundIndex: FRange;
    declare protected spawningSoundProbability: FRange;

    // Spawning
    declare protected isAutomaticInitialSpawning: boolean; // Automatically determines a particle spawn rate based on the particle lifetime and the maximum number of particles allowed so that the maximum number of particles is reached exactly when the first particle's lifetime is up. ParticlesPerSecond must be 0 for this to work.
    declare protected initialParticlesPerSecond: number; // The initial particle spawn rate until the point when the maximum number of particles is reached.
    declare protected particlesPerSecond: number; // The particle spawn rate after the initial warmup phase reached the maximum number of particles.

    // Texture
    declare protected isBlendBetweenSubdivisions: boolean;
    declare protected drawStyle: EParticleDrawStyle_T;
    declare protected subdivEnd: number;
    declare protected subdivisionScale: FPrimitiveArray<"float">;
    declare protected subdivStart: number;
    declare protected texture: GA.UTexture;
    declare protected texSubdivU: number;
    declare protected texSubdivV: number;
    declare protected isUsingRandomSubdiv: boolean;
    declare protected isUsingSubdivisionScale: boolean;

    // Tick
    declare protected minSquaredVelocity: number; // The minimum velocity a particle may have before it gets inactive. This is essential for colliding particles that are supposed to stay idle on ground. The number should be in squared uu/s, ie if you want to set it to 50 uu/s, enter 2500 (50*50) instead.
    declare protected secondsBeforeInactive: number; // The amount of time that has to pass when the emitter is out of view before particle calculation is paused. Set this to 0.0 to disable the pausing effect, e.g. for Emitter-based weapon effects like explosions, tracers, sparks, etc.

    // Time
    declare protected initialTimeRange: FRange; // Determines how long before this emitter will become active
    declare protected initialDelayRange: FRange; // The initial particle age. For obvious reasons this should be lower than LifetimeRange. You might be able to create interesting effects in combination with the various scales parameters if you have a particle with e.g. LifetimeRange 4 seconds and InitialTimeRange 3 seconds. Effectively the particle will have 1 second left, but it already starts at 75% of its entire lifetime.
    declare protected lifetimeRange: FRange; // Determines the lifespan of the particles that this emitter emits.

    // Trigger
    declare protected isResetOnTrigger: boolean; // Whether this ParticleEmitter should be reset when it's triggered. When the ParticleEmitter is reset, all its particles are removed and it starts spawning according to its initial spawn parameters. (initial delay, initial particles per second, etc.)
    declare protected spawnOnTriggerPPS: number;
    declare protected spawnOnTriggerRange: FRange; // When triggered, this ParticleEmitter should spawn SpawnOnTriggerRange.Min to SpawnOnTriggerRange.Max particles, with a spawn rate of SpawnOnTriggerPPS particles per second.
    declare protected isTriggerDisabled: boolean; // If true allows the emitter to be toggled on/off by the Event named in the Emitter system's Event>Tag. As the Tag belongs to the entire emitter system sub-emitters can only respond to the one Event, albeit in different ways. By default the initial status of emitters is active, and will be toggled off upon first firing of the Event, but setting Local>bDisabled=true will disable emitter at start and wait for Event to turn on. Always set this to false if you want to use the other trigger options or if you don't want the ParticleEmitter's regular particle spawning to be affected by triggering.

    // Velocity
    declare protected addVelocityFromOtherEmitter: number;
    declare protected addVelocityMultiplierRange: FRangeVector;
    declare protected getVelocityDirectionFrom: EParticleVelocityDirection_T;
    declare protected maxAbsVelocity: FVector;
    declare protected startVelocityRadialRange: FRange;
    declare protected startVelocityRange: FRangeVector;
    declare protected isUsingVelocityScale: boolean;
    declare protected velocityLossRange: FRangeVector;
    declare protected velocityScale: FArray<UParticleVelocityScale>;
    declare protected velocityScaleRepeats: number;
    declare protected rotateVelocityLossRange: boolean;

    /* Warmup
       Note: Warmup precalculates particle spawning and movement so when the emitter first comes into sight it looks like it has been running for some time already. */
    declare protected relativeWarmupTime: number; // The time to precalculate, relative to the particle lifetime. 1.0 is the time corresponding to one particle's entire lifetime.
    declare protected warmupTicksPerSecond: number; // How many ticks per second to precalculate during warmup. Higher values can look better, but very high values might also freeze the game for a split-second while the emitter warms up when it comes into view for the first time.

    declare protected opacity: number;

    declare protected _independentSprayAccel: any;

    declare protected _forcedLifeTime: any;
    declare protected _forcedFade: any;
    declare protected _forcedMaxParticles: any;

    declare protected _owner: any;
    declare protected _initialized: any;
    declare protected _inactive: any;
    declare protected _inactiveTime: any;
    declare protected _particles: any;
    declare protected _particleIndex: any;
    declare protected _activeParticles: any;
    declare protected _ppsFraction: number;
    declare protected _boundingBox: any;
    declare protected _realExtentMultiplier: any;
    declare protected _realDisableFogging: any;
    declare protected _allParticlesDead: any;
    declare protected _warmedUp: any;
    declare protected _otherIndex: any;
    declare protected _initialDelay: any;
    declare protected _globalOffset: any;
    declare protected _timeTillReset: any;
    declare protected _pS2Data: any;
    declare protected _maxActiveParticles: any;
    declare protected _currentCollisionSoundIndex: any;
    declare protected _currentSpawningSoundIndex: any;
    declare protected _currentMeshSpawningIndex: any;
    declare protected _maxSizeScale: any;
    declare protected _killPending: boolean;
    declare protected _deferredParticles: number;
    declare protected _realMeshNormal: any;
    declare protected meshVertsAndNormals: FArray<FVector>;
    declare protected _currentSpawnOnTrigger: number;
    declare protected _bOwnerTracking: any;
    declare protected _curLifeTime: any;
    declare protected _bNotifyPreDestroy: any;

    declare protected _refraction: any;

    declare protected addVelocityFromOwner: boolean;
    declare protected scaleSizeXByVelocity: boolean;
    declare protected scaleSizeYByVelocity: boolean;
    declare protected scaleSizeZByVelocity: boolean;
    declare protected scaleSizeByVelocityMultiplier: FVector;
    declare protected determineVelocityByLocationDifference: boolean;
    declare protected useAbsoluteTimeForSizeScale: boolean;

    public setActor(actor: GA.UEmitter) { this.actor = actor; return this; }

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
            "CollisionPlanes": "collisionPlanes",
            "DampingFactorRange": "dampingFactorRange",
            "ExtentMultiplier": "extentMultiplier",
            "MaxCollisions": "maxCollisions",
            "SpawnAmount": "spawnAmount",
            "SpawnedVelocityScaleRange": "spawnedVelocityScaleRange",
            "SpawnFromOtherEmitter": "spawnFromOtherEmitter",
            "UseCollision": "isUsingCollision",
            "UseCollisionPlanes": "isUsingCollisionPlanes",
            "UseMaxCollisions": "isUsingMaxCollisions",
            "UseSpawnedVelocityScale": "isUsingSpawnedVelocityScale",
            "AddLocationFromOtherEmitter": "addLocationFromOtherEmitter",
            "SphereRadiusRange": "sphereRadiusRange",
            "StartLocationOffset": "startLocationOffset",
            "StartLocationPolarRange": "startLocationPolarRange",
            "StartLocationRange": "startLocationRange",
            "StartLocationShape": "startLocationShape",
            "RotateVelocityLossRange": "rotateVelocityLossRange",


            "IndependentSprayAccel": "_independentSprayAccel",
            "ForcedLifeTime": "_forcedLifeTime",
            "ForcedFade": "_forcedFade",
            "ForcedMaxParticles": "_forcedMaxParticles",

            "Owner": "_owner",
            "Initialized": "_initialized",
            "Inactive": "_inactive",
            "InactiveTime": "_inactiveTime",
            "Particles": "_particles",
            "ParticleIndex": "_particleIndex",
            "ActiveParticles": "_activeParticles",
            "PPSFraction": "_ppsFraction",
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
            "MeshVertsAndNormals": "meshVertsAndNormals",
            "CurrentSpawnOnTrigger": "_currentSpawnOnTrigger",
            "bOwnerTracking": "_bOwnerTracking",
            "CurLifeTime": "_curLifeTime",
            "bNotifyPreDestroy": "_bNotifyPreDestroy",

            "Refraction": "_refraction",
        });
    }

    // _setProperties = [];

    // protected setProperty(tag: PropertyTag, value: any): boolean {
    //     // if (value > 2)
    //     //     debugger;

    //     this._setProperties.push([
    //         tag.name,
    //         value.toString()
    //     ]);

    //     return super.setProperty(tag, value);
    // }

    public getDecodeInfo(library: GD.DecodeLibrary): GD.EmitterConfig_T {
        if (this._particles && this._particles.length > 0)
            debugger;

        // if (this.isFadingIn || this.isFadingOut)
        //     debugger;

        // debugger;
        // console.log(this);

        if (this.sizeScale?.length === 1)
            debugger;

        return {
            name: this.uuid,
            maxParticles: this.maxParticles,
            drawScale: this.actor?.drawScale ?? 1,
            opacity: this.opacity,
            lifetime: this.lifetimeRange.loadSelf().getDecodeInfo(library),
            fadeIn: this.isFadingIn ? { time: this.fadeInEndTime, color: this.fadeInFactor?.loadSelf().getElements() as GD.Vector4Arr } : null,
            fadeOut: this.isFadingOut ? { time: (this.fadeOutStartTime as any)?.x ?? 0, color: this.fadeOutFactor?.loadSelf().getElements() as GD.Vector4Arr } : null,
            uniformScale: this.isUniformScale,
            acceleration: this.acceleration?.getElements(),
            warmupTime: this.relativeWarmupTime,
            warmupTicksPerSecond: this.warmupTicksPerSecond,
            initial: {
                particlesPerSecond: this.isAutomaticInitialSpawning ? this.maxParticles / this.lifetimeRange.mid() : this.initialParticlesPerSecond,
                scale: this.startSizeRange.loadSelf().getDecodeInfo(library),
                angularVelocity: this.startSpinRange?.loadSelf().getDecodeInfo(library),
                velocity: this.startVelocityRange?.loadSelf().getDecodeInfo(library),
                position: this.startLocationRange?.loadSelf().getDecodeInfo(library),
                offset: this.startLocationOffset?.getElements() || [0, 0, 0]
            },
            colorMultiplierRange: this.colorMultiplierRange?.loadSelf().getDecodeInfo(library),
            revolutionCenterOffsetRange: this.revolutionCenterOffsetRange?.loadSelf().getDecodeInfo(library),
            revolutionsPerSecondRange: this.revolutionsPerSecondRange?.loadSelf().getDecodeInfo(library),
            initialTimeRange: this.initialTimeRange?.loadSelf().getDecodeInfo(library) || [0, 0],
            startMassRange: this.startMassRange?.loadSelf().getDecodeInfo(library) || [0, 0],
            sphereRadiusRange: this.sphereRadiusRange?.loadSelf().getDecodeInfo(library),
            startLocationPolarRange: this.startLocationPolarRange?.loadSelf().getDecodeInfo(library),
            addVelocityMultiplierRange: this.addVelocityMultiplierRange?.loadSelf().getDecodeInfo(library),
            velocityLossRange: this.velocityLossRange?.loadSelf().getDecodeInfo(library),
            forcedMaxParticles: this._forcedMaxParticles,
            particlesPerSecond: this.particlesPerSecond,
            angularVelocity: this.spinsPerSecondRange?.loadSelf().getDecodeInfo(library),
            blendingMode: blendingNames[(this.drawStyle.valueOf() as EParticleDrawStyle_T)],
            changesOverLifetime: {
                scale: this.isUsingSizeScale && (this.sizeScale?.length ?? 0) > 1 ? {
                    values: this.sizeScale.map(s => s.getDecodeInfo(library)),
                    repeats: this.sizeScaleRepeats
                } : null,
                color: this.isUsingColorScale && (this.colorScale?.length ?? 0) > 1 ? {
                    values: this.colorScale.map(s => s.getDecodeInfo(library)),
                    repeats: this.colorScaleRepeats
                } : null,
                velocity: this.isUsingVelocityScale && (this.velocityScale?.length ?? 0) > 1 ? {
                    values: this.velocityScale.map(s => s.getDecodeInfo(library)),
                    repeats: this.velocityScaleRepeats
                } : null,
                revolution: this.isUsingRevolutionScale && (this.revolutionScale?.length ?? 0) > 1 ? {
                    values: this.revolutionScale.map(s => s.getDecodeInfo(library)),
                    repeats: this.revolutionScaleRepeats
                } : null
            },
            settings: this.getSettingsSnapshot(library)
        };
    }

    // BaseEmitter Object.assign's these onto itself. Structs serialize through their
    // regular getDecodeInfo and BaseEmitter rehydrates the array forms, so no live
    // UObject ever crosses the decode-worker boundary.
    protected getSettingsSnapshot(library: GD.DecodeLibrary): Record<string, any> {
        const snapshot: Record<string, any> = {};

        for (const varName of REQUIRED_SETTINGS) {
            const value = toCloneSafeSetting((this as any)[varName], library);

            if (value !== CLONE_UNSAFE) snapshot[varName] = value;
        }

        return snapshot;
    }
}

// settings the emitters read off themselves after the assign and which aren't already
// covered by explicit EmitterConfig_T fields, scale curves travel via changesOverLifetime
const REQUIRED_SETTINGS = [
    "acceleration", "addLocationFromOtherEmitter", "addVelocityFromOtherEmitter",
    "clockwiseSpinChance", "colorScaleRepeats", "coordinateSystem", "drawStyle", "maxParticles",
    "effectAxis", "fadeInEndTime", "fadeInFactor", "fadeOutFactor", "fadeOutStartTime",
    "getVelocityDirectionFrom", "initialParticlesPerSecond", "isAutomaticInitialSpawning",
    "isDisabled", "isFadingIn", "isFadingOut", "isRespawningDeadParticles",
    "isScaleSizeRegular", "isSpawningTowardsNormal", "isSpinning", "isUniformScale",
    "isUsingCollision", "isUsingColorFromMesh", "isUsingColorScale", "isUsingRandomSubdiv",
    "isUsingRevolution", "isUsingRevolutionScale", "isUsingSizeScale", "isUsingVelocityScale",
    "isVelocityFromMesh", "maxAbsVelocity", "meshNormal", "meshScaleRange", "meshSpawning",
    "rotateVelocityLossRange", "rotationNormal", "rotationSource", "sizeScaleRepeats",
    "skeletalScale", "spawnFromOtherEmitter", "spawnOnTriggerPPS", "spawningSoundIndex",
    "startLocationShape", "startSpinRange", "subdivEnd", "subdivStart", "texSubdivU",
    "texSubdivV", "useSkeletalLocationAs", "velocityScaleRepeats"
];

const CLONE_UNSAFE = Symbol("clone-unsafe");

function toCloneSafeSetting(value: any, library: GD.DecodeLibrary): any {
    if (value === null || value === undefined) return value;

    const t = typeof value;

    if (t === "number" || t === "string" || t === "boolean" || t === "bigint") return value;
    if (t === "function") return CLONE_UNSAFE;

    if (Array.isArray(value)) {
        const result = value.map(v => toCloneSafeSetting(v, library));

        return result.some(v => v === CLONE_UNSAFE) ? CLONE_UNSAFE : result;
    }

    if (t === "object") {
        if (value.constructor === Object) return value;

        // math structs serialize through their regular getDecodeInfo, anything else
        // (textures, actors, FArrays) has no business in the settings snapshot
        if (value instanceof FVector || value instanceof UPlane || value instanceof FRange || value instanceof FRangeVector)
            return value.getDecodeInfo(library);

        return CLONE_UNSAFE;
    }

    return CLONE_UNSAFE;
}

abstract class UParticleRevolutionScale extends UObject {
    declare public relTime: number;
    declare public relRevolution: FVector;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "RelativeTime": "relTime",
            "RelativeRevolution": "relRevolution"
        });
    }

    public getDecodeInfo(_library: GD.DecodeLibrary): [number, GD.Vector3Arr] {
        return [this.relTime, this.relRevolution?.getElements() || [0, 0, 0]];
    }
}

abstract class UParticleTimeScale extends UObject {
    declare public relSize: number;
    declare public relTime: number;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "RelativeSize": "relSize",
            "RelativeTime": "relTime"
        });
    }

    public getDecodeInfo(library: GD.DecodeLibrary): [number, number] { return [this.relTime, this.relSize]; }

    public toString() { return `ParticleTimeScale=(time=${this.relTime.toFixed(2)}, size=${this.relSize})`; }
};

abstract class UParticleVelocityScale extends UObject {
    declare public relTime: number;
    declare public relVelocity: FVector;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "RelativeTime": "relTime",
            "RelativeVelocity": "relVelocity"
        });
    }

    public getDecodeInfo(_library: GD.DecodeLibrary): [number, GD.Vector3Arr] {
        return [this.relTime, this.relVelocity?.getElements() || [0, 0, 0]];
    }
}

abstract class UParticleSound extends UObject {

};

// BeamEmitter.uc structs
abstract class UParticleBeamEndPoint extends UObject {
    declare public offset: FRangeVector;
    declare public weight: number;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "ActorTag": "_actorTag",
            "Offset": "offset",
            "Weight": "weight"
        });
    }
}

abstract class UParticleBeamScale extends UObject {
    declare public frequencyScale: FVector;
    declare public relativeLength: number;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "FrequencyScale": "frequencyScale",
            "RelativeLength": "relativeLength"
        });
    }
}

abstract class UParticle extends UObject {

};

abstract class UParticleColorScale extends UObject {
    declare public relTime: number;
    declare public color: FColor;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "RelativeTime": "relTime",
            "Color": "color"
        });
    }

    public getDecodeInfo(_library: GD.DecodeLibrary): [number, GD.Vector4Arr] {
        return [this.relTime, this.color?.toArray() as GD.Vector4Arr || [255, 255, 255, 255]];
    }
}

export default UParticleEmitter;
export { UParticleEmitter, UParticleRevolutionScale, UParticleTimeScale, UParticleSound, UParticleVelocityScale, UParticle, UParticleColorScale, UParticleBeamEndPoint, UParticleBeamScale };

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

enum EParticleStartLocationShape_T {
    PTLS_Box,
    PTLS_Sphere, // SphereRadiusRange will be used to specify a sphere.
    PTLS_Polar, // StartLocationPolarRange will be used to describe the spawning area with a range of polar coordinates.
    PTLS_All // Combines all of the above. The StartLocationRange will determine the initial location, then the SphereRadiusRange will be added to that, then the StartLocationPolarRange will be added to the result to get the final starting location.
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
} as Record<EParticleDrawStyle_T, GD.ParticleBlendModes_T>;