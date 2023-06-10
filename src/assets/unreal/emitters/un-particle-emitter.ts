import { BufferValue } from "@l2js/core";
import FArray, { FPrimitiveArray } from "../un-array";
import UObject from "@l2js/core";
import { UPlane } from "../un-plane";
import { PropertyTag } from "../un-property-tag";
import URange, { URangeVector } from "../un-range";
import FRotator from "../un-rotator";
import FVector from "../un-vector";

abstract class UParticleEmitter extends UObject {
    protected actor: UEmitter;

    // Acceleration
    protected acceleration = new FVector(); // Vector which determines the acceleration of the particles in any of the three planes

    // Collision
    protected collisionPlanes = new FArray(UPlane); // Can be used to specify planes in the Unreal world the particle will collide with. The planes will be used for collision when UseCollisionPlanes is True.
    protected dampingFactorRange = new URangeVector(new URange(1, 1), new URange(1, 1), new URange(1, 1)); // Damping applied to the particle's velocity when it collides with something.
    protected extentMultiplier = new FVector(1, 1, 1); // A multiplier for the particles' size for collision calculations.
    protected maxCollisions = new URange(); // Maximum number of collisions before the particle is destroyed. This property will only be used when UseMaxCollisions is True.
    protected spawnAmount = 0; // The number of sub-particles spawned when the particles collide with something.
    protected spawnedVelocityScaleRange = new URangeVector(); // The velocity of the spawned sub-particles.
    protected spawnFromOtherEmitter: number = -1; // The ParticleEmitter within the same Emitter actor used for the sub-particles.
    protected isUsingCollision: boolean = false; // Whether the particles should use collision. If False, they will fall through static meshes, BSP, etc.
    protected isUsingCollisionPlanes: boolean = false; // Whether the particles should collide with the CollisionPlanes.
    protected isUsingMaxCollisions: boolean = false; // Whether the particles should be destroyed when they reach their maximum number of collisons.
    protected isUsingSpawnedVelocityScale: boolean = false; // Whether to use SpawnedVelocityScaleRange for collision sub-particles.

    // Color
    protected colorMultiplierRange = new URangeVector(new URange(1, 1), new URange(1, 1), new URange(1, 1)); // Used to randomize the color of the particles. X corresponds to red, Y corresponds to Green and Z corresponds to blue. A value of 1 preserves the color of the original textures. To make everything darker, for example, set 0.5 for all values.
    protected colorScale = new FArray(UParticleColorScale); // Used to change the color of a particle over time. You set both a color you want it to be, and the relative time at which you want it to be that color. It will fade from whatever color it is to the color you want it to be over the interval you specify. The time is relative, so 0.5 would be half the particles lifespan.
    protected colorScaleRepeats = 0; // How many times to repeat the color scales. Example, if you have a color scale that changes it to black at 0.5 time(half its lifespan), with color repeats it will be black by the time its half way done living. With one repeat, it will be black at 1/4 of its lifespan, normal at 1/2, and black again at 3/4ths of its lifespan.
    protected isUsingColorScale: boolean = false; // Must be true for ColorScales and ColorScaleRepeats to have any effect on the particles.

    // Fading
    protected isFadingIn: boolean = false; // If true, it will fade the particle in
    protected fadeInEndTime: number = 0; // If FadeIn is true, this is the time at which the particle will have completly faded in and is 100% visible. This is NOT relative. 0.5 is 1/2 a second, not 1/2 of the particles lifespan.
    protected fadeInFactor = new UPlane(1, 1, 1, 1); // Specifies how much each component of the particle colors should be faded. 1 means start at 0 while e.g. 0.5 means start at half the normal value. X,Y,Z correspond to R,G,B and W corresponds to the alpha value.
    protected isFadingOut: boolean = false; // If true, the particle will fade out.
    protected fadeOutFactor = new UPlane(1, 1, 1, 1); // If Fadeout is true, this is the absolute time at which the particle will start fading out. Fading out overrules fading in, so if a particle is not yet faded in and starts fading out, it will start at full color values.
    protected fadeOutStartTime = new UPlane(); // Specifies how much each component of the particle colors should be faded. 1 means end at 0 while e.g. 0.5 means end at half the normal value. X,Y,Z correspond to R,G,B and W corresponds to the alpha value.

    // Forces
    protected isUsingActorForces: boolean = false; /* Whether the particles can be affected by Actor forces.
                                              Note: Setting this to True can cause a huge performance hit and will only work when physics details are set high enough. */

    // General
    protected coordinateSystem: EParticleCoordinateSystem_T = EParticleCoordinateSystem_T.PTCS_Relative; // Determines how the settings in the location section are calculated.
    protected effectAxis: EParticleEffectAxis_T = 0;
    protected maxParticles: number = 10; // Maximum number of particles that this ParticleEmitter can have at a time.
    protected isResettingAfterChange: boolean; // Determines if this emitter reset after a change has been made to its properties. It currently has no effect. (emitter resets no matter what if you make a change)

    // Local
    protected isAutoDestroyed: boolean = false; // Determines if this emitter will destroy itself once all particles are gone.
    protected isAutoReset: boolean = false; // Determines if this emitter will reset itself after a specified amount of time.
    protected autoResetTimeRange: number = 0; // The time delay for auto-resets.
    protected isDisabled: boolean = false; // If true, this emitter wont emit anything. Typically used along with TriggerDisabled=true to create a trigger-toggled emitter that starts inactive and only begins emitting once the trigger Event occurs. Also used during testing to disable certain emitters within an emitter system.
    protected isFoggingDisabled: boolean = false; // Determines if particles are affected by distance fog.
    protected isRespawningDeadParticles: boolean = true; // Determines if dead particles (i.e. particles that have exceeded their lifespan or maximum collisions) should be respawned.

    // Location
    protected addLocationFromOtherEmitter: number = -1;
    protected sphereRadiusRange = new URange();
    protected startLocationOffset: FVector = new FVector();
    protected startLocationPolarRange = new URangeVector();
    protected startLocationRange = new URangeVector();
    protected startLocationShape = EParticleStartLocationShape_T.PTLS_Box;

    // Mass
    protected startMassRange: URange = new URange(1, 1);

    // Mesh
    protected meshNormal: FVector = new FVector(0, 0, 1);
    protected meshNormalThresholdRange: URange;
    protected meshScaleRange: URangeVector = new URangeVector(new URange(1, 1), new URange(1, 1), new URange(1, 1)); // This determines the size scale of an emitted mesh, similar to DrawScale3D for actors. It takes each axis independantly, so setting a good range can result in a lot of different shapes on the same mesh.
    protected meshSpawning: EParticleMeshSpawning_T = 0;
    protected meshSpawningStaticMesh: UStaticMesh = null; // A StaticMesh, whose vertices should be used as possible start location offsets. The ParticleMeshes static mesh package provides some useful StaticMeshes for this.
    protected isSpawningTowardsNormal: boolean = false;
    protected isUniformMeshScale: boolean = false; // If this is true, the settings in meshscalerange are no longer used for each axis independantly. Instead, the mesh will be scaled along all axis using the x values.
    protected isUniformVelocityScale: boolean = false;
    protected isUsingColorFromMesh: boolean = false;
    protected isVelocityFromMesh: boolean = false;
    protected velocityScaleRange = new URangeVector(new URange(1, 1), new URange(1, 1), new URange(1, 1));

    // Rendering
    protected isAcceptingProjectors: boolean = false;
    protected alphaRef: number = 0;
    protected isAlphaTest: boolean = true;
    protected isDepthTesting: boolean = true;
    protected isDepthWriting: boolean = true;

    /* Revolution
       Note: Revolution moves all particles around a central point or area. This might be useful for vortex-like particle effects. */
    protected isUsingRevolution: boolean = false; // If true, the particles will orbit a center point.
    protected isUsingRevolutionScale: boolean = false; // Whether the RevolutionScale settings should be used.
    protected revolutionCenterOffsetRange = new URangeVector(); // The range of where the center of revolution for this particle will be
    protected revolutionScale = new FArray(UParticleRevolutionScale);
    protected revolutionScaleRepeats = 0;
    protected revolutionsPerSecondRange = new URangeVector(); // Determines how many times the particle will orbit the center per second, it takes each axis independantly.

    // Rotation
    protected isDampingRotation: boolean = false; // Whether collision should affect a particle's rotation.
    protected rotationDampingFactorRange = new URangeVector(); // How collision affects the particle's rotation.
    protected rotationNormal = new FVector(); // The normal used when UseRotationFrom is set to PTRS_Normal.
    protected rotationOffset = new FRotator();
    protected clockwiseSpinChance = new FVector(0.5, 0.5, 0.5); // The chance that particles will spin clockwise. 0 will make all particles spin counterclockwise, 0.7 will give a 70% chance that particles spin clockwise and a 30% chance for spinning counterclockwise.
    protected isSpinning: boolean = false; // Whether particles should spin.
    protected spinsPerSecondRange = new URangeVector(); // The range that determines how fast the particles will spin. X, Y and Z correspond to Pitch, Yaw and Roll.
    protected startSpinRange = new URangeVector(); // Specifies the initial rotation of the particles. Again, X, Y and Z correspond to Pitch, Yaw and Roll.
    protected rotationSource: EParticleRotationSource_T = 0; // What to base the rotation on.

    // Size
    protected sizeScale = new FArray(UParticleTimeScale);
    protected sizeScaleRepeats: number = 0;
    protected startSizeRange = new URangeVector(new URange(100, 100), new URange(100, 100), new URange(100, 100));
    protected isUniformScale: boolean = false;
    protected isScaleSizeRegular: boolean = true;
    protected isUsingSizeScale: boolean = false;

    // Skeletal mesh
    protected relativeBoneIndexRange = new URange(0, 1);
    protected skeletalMeshActor: UAActor = null;
    protected skeletalScale = new FVector(1, 1, 1);
    protected useSkeletalLocationAs: ESkelLocationUpdate_T = 0;

    // Sound
    protected collisionSound: EParticleCollisionSound_T = 0;
    protected collisionSoundIndex = new URange();
    protected collisionSoundProbability = new URange();
    protected sounds = new FArray(UParticleSound);
    protected spawningSound: EParticleCollisionSound_T = 0;
    protected spawningSoundIndex = new URange();
    protected spawningSoundProbability = new URange();

    // Spawning
    protected isAutomaticInitialSpawning: boolean = true; // Automatically determines a particle spawn rate based on the particle lifetime and the maximum number of particles allowed so that the maximum number of particles is reached exactly when the first particle's lifetime is up. ParticlesPerSecond must be 0 for this to work.
    protected initialParticlesPerSecond: number = 0; // The initial particle spawn rate until the point when the maximum number of particles is reached.
    protected particlesPerSecond: number = 0; // The particle spawn rate after the initial warmup phase reached the maximum number of particles.

    // Texture
    protected isBlendBetweenSubdivisions: boolean = false;
    protected drawStyle = EParticleDrawStyle_T.PTDS_Translucent;
    protected subdivEnd = 0;
    protected subdivisionScale: FPrimitiveArray<"float"> = new FPrimitiveArray(BufferValue.float);
    protected subdivStart = 0;
    protected texture: UTexture = null;
    protected texSubdivU = 0;
    protected texSubdivV = 0;
    protected isUsingRandomSubdiv: boolean = false;
    protected isUsingSubdivisionScale: boolean = false;

    // Tick
    protected minSquaredVelocity = 0; // The minimum velocity a particle may have before it gets inactive. This is essential for colliding particles that are supposed to stay idle on ground. The number should be in squared uu/s, ie if you want to set it to 50 uu/s, enter 2500 (50*50) instead.
    protected secondsBeforeInactive = 1; // The amount of time that has to pass when the emitter is out of view before particle calculation is paused. Set this to 0.0 to disable the pausing effect, e.g. for Emitter-based weapon effects like explosions, tracers, sparks, etc.

    // Time
    protected initialTimeRange = new URange(); // Determines how long before this emitter will become active
    protected initialDelayRange = new URange(); // The initial particle age. For obvious reasons this should be lower than LifetimeRange. You might be able to create interesting effects in combination with the various scales parameters if you have a particle with e.g. LifetimeRange 4 seconds and InitialTimeRange 3 seconds. Effectively the particle will have 1 second left, but it already starts at 75% of its entire lifetime.
    protected lifetimeRange = new URange(4, 4); // Determines the lifespan of the particles that this emitter emits.

    // Trigger
    protected isResetOnTrigger: boolean = false; // Whether this ParticleEmitter should be reset when it's triggered. When the ParticleEmitter is reset, all its particles are removed and it starts spawning according to its initial spawn parameters. (initial delay, initial particles per second, etc.)
    protected spawnOnTriggerPPS = 0;
    protected spawnOnTriggerRange = new URange(); // When triggered, this ParticleEmitter should spawn SpawnOnTriggerRange.Min to SpawnOnTriggerRange.Max particles, with a spawn rate of SpawnOnTriggerPPS particles per second.
    protected isTriggerDisabled: boolean = false; // If true allows the emitter to be toggled on/off by the Event named in the Emitter system's Event>Tag. As the Tag belongs to the entire emitter system sub-emitters can only respond to the one Event, albeit in different ways. By default the initial status of emitters is active, and will be toggled off upon first firing of the Event, but setting Local>bDisabled=true will disable emitter at start and wait for Event to turn on. Always set this to false if you want to use the other trigger options or if you don't want the ParticleEmitter's regular particle spawning to be affected by triggering.

    // Velocity
    protected addVelocityFromOtherEmitter = -1;
    protected addVelocityMultiplierRange = new URangeVector(new URange(1, 1), new URange(1, 1), new URange(1, 1));
    protected getVelocityDirectionFrom = EParticleVelocityDirection_T.PTVD_None;
    protected maxAbsVelocity: FVector = new FVector(10000.000000, 10000.000000, 10000.000000);
    protected startVelocityRadialRange = new URange();
    protected startVelocityRange = new URangeVector();
    protected isUsingVelocityScale: boolean = false;
    protected velocityLossRange = new URangeVector();
    protected velocityScale = new FArray(UParticleVelocityScale);
    protected velocityScaleRepeats: number = 0;
    protected rotateVelocityLossRange: boolean = false;

    /* Warmup
       Note: Warmup precalculates particle spawning and movement so when the emitter first comes into sight it looks like it has been running for some time already. */
    protected relativeWarmupTime: number = 0; // The time to precalculate, relative to the particle lifetime. 1.0 is the time corresponding to one particle's entire lifetime.
    protected warmupTicksPerSecond: number = 0; // How many ticks per second to precalculate during warmup. Higher values can look better, but very high values might also freeze the game for a split-second while the emitter warms up when it comes into view for the first time.


    protected opacity: number = 1;

    protected _independentSprayAccel: any;

    protected _forcedLifeTime: any;
    protected _forcedFade: any;
    protected _forcedMaxParticles: any;

    protected _owner: any;
    protected _initialized: any;
    protected _inactive: any;
    protected _inactiveTime: any;
    protected _particles: any;
    protected _particleIndex: any;
    protected _activeParticles: any;
    protected _ppsFraction: number;
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
    protected _killPending: any = false;
    protected _deferredParticles: number;
    protected _realMeshNormal: any;
    protected meshVertsAndNormals = new FArray(FVector);
    protected _currentSpawnOnTrigger: number = 0;
    protected _bOwnerTracking: any;
    protected _curLifeTime: any;
    protected _bNotifyPreDestroy: any;

    protected _refraction: any;








    protected addVelocityFromOwner: boolean = false;
    protected scaleSizeXByVelocity: boolean = false;
    protected scaleSizeYByVelocity: boolean = false;
    protected scaleSizeZByVelocity: boolean = false;
    protected scaleSizeByVelocityMultiplier: FVector = new FVector(1, 1, 1);
    protected determineVelocityByLocationDifference: boolean = false;
    protected useAbsoluteTimeForSizeScale: boolean = false;

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

    _setProperties = [];

    protected setProperty(tag: PropertyTag, value: any): boolean {
        // if (value > 2)
        //     debugger;

        this._setProperties.push([
            tag.name,
            value.toString()
        ]);

        return super.setProperty(tag, value);
    }

    public getDecodeInfo(library: DecodeLibrary) {
        if (this._particles && this._particles.length > 0)
            debugger;

        // if (this.isFadingIn || this.isFadingOut)
        //     debugger;

        // debugger;
        // console.log(this);

        if (this.sizeScale?.length === 1)
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
                particlesPerSecond: this.isAutomaticInitialSpawning ? this.maxParticles / this.lifetimeRange.mid() : this.initialParticlesPerSecond,
                scale: this.startSizeRange.loadSelf().getDecodeInfo(library),
                angularVelocity: this.startSpinRange?.loadSelf().getDecodeInfo(library),
                velocity: this.startVelocityRange?.loadSelf().getDecodeInfo(library),
                location: this.startLocationRange?.loadSelf().getDecodeInfo(library)
            },
            colorMultiplierRange: this.colorMultiplierRange?.loadSelf().getDecodeInfo(library),
            particlesPerSecond: this.particlesPerSecond,
            angularVelocity: this.spinsPerSecondRange?.loadSelf().getDecodeInfo(library),
            blendingMode: blendingNames[(this.drawStyle.valueOf() as EParticleDrawStyle_T)],
            changesOverLifetime: {
                scale: this.isUsingSizeScale && this.sizeScale.length > 1 ? {
                    values: this.sizeScale.map(s => s.getDecodeInfo(library)),
                    repeats: this.sizeScaleRepeats
                } : null
            },
            /**
             * 
             * 
             * 
             * 
             */
            allSettings: this
        };
    }
}

class UParticleRevolutionScale extends UObject {

};

class UParticleTimeScale extends UObject {

    public relSize: number;
    public relTime: number;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "RelativeSize": "relSize",
            "RelativeTime": "relTime"
        });
    }

    public getDecodeInfo(library: DecodeLibrary): [number, number] { return [this.relTime, this.relSize]; }

    public toString() { return `ParticleTimeScale=(time=${this.relTime.toFixed(2)}, size=${this.relSize})`; }
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
} as Record<EParticleDrawStyle_T, ParticleBlendModes_T>;