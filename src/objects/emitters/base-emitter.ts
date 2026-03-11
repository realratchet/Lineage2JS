import { Box3, Matrix4, Object3D, Vector3, Vector4 } from "three";
import { clamp, lerp, mapLinear } from "three/src/math/MathUtils";


class Particle_T {
    public readonly position = new Vector3();
    public readonly OldLocation = new Vector3();
    public readonly Velocity = new Vector3();
    public readonly StartSize = new Vector3();
    public readonly SpinsPerSecond = new Vector3();
    public readonly StartSpin = new Vector3();
    public readonly RevolutionCenter = new Vector3();
    public readonly RevolutionsPerSecond = new Vector3();
    public readonly RevolutionsMultiplier = new Vector3();
    public readonly scale = new Vector3();
    public readonly StartLocation = new Vector3();
    public readonly ColorMultiplier = new Vector3();
    public readonly VelocityMultiplier = new Vector3();
    public readonly OldMeshLocation = new Vector3();
    public readonly Color = new Vector4();
    public Time: number = 0;
    public MaxLifetime: number = 0;
    public Mass: number = 0;
    public HitCount: number = 0;
    public Flags: number = 0;
    public Subdivision: number = 0;
    public BoneIndex: number = 0;
}

const GMath = { UnitCoords: null as any };

const PTF_None = 0;
const PTF_Active = 1;
const PTF_NoTick = 2;
const PTF_InitialSpawn = 4;

const PTCS_Independent = 0;
const PTCS_Relative = 1;
const PTCS_Absolute = 2;
const PTCS_MAX = 3;

const PTMS_None = 0;
const PTMS_Linear = 1;
const PTMS_Random = 2;
const PTMS_MAX = 3;

const PTLS_Box = 0;
const PTLS_Sphere = 1;
const PTLS_Polar = 2;
const PTLS_All = 3;
const PTLS_MAX = 4;

const PSF_None = 0;
const PSF_NoGlobalOffset = 1;
const PSF_NoOwnerLocation = 2;

const PTEA_NegativeX = 0;
const PTEA_PositiveZ = 1;
const PTEA_MAX = 2;

const PTRS_None = 0;
const PTRS_Actor = 1;
const PTRS_Offset = 2;
const PTRS_Normal = 3;
const PTRS_MAX = 4;

const PTVD_None = 0;
const PTVD_StartPositionAndOwner = 1;
const PTVD_OwnerAndStartPosition = 2;
const PTVD_AddRadial = 3;
const PTVD_MAX = 4;

const PTSC_None = 0;
const PTSC_LinearGlobal = 1;
const PTSC_LinearLocal = 2;
const PTSC_Random = 3;
const PTSC_MAX = 4;

const PTDS_Regular = 0;
const PTDS_AlphaBlend = 1;
const PTDS_Modulated = 2;
const PTDS_Translucent = 3;
const PTDS_AlphaModulate_MightNotFogCorrectly = 4;
const PTDS_Darken = 5;
const PTDS_Brighten = 6;
const PTDS_MAX = 7;

const PTSU_None = 0;
const PTSU_SpawnOffset = 1;
const PTSU_Location = 2;
const PTSU_MAX = 3;

abstract class BaseEmitter extends Object3D {
    protected readonly isUpdatable = true;

    protected fadingSettings: FadeSettings_T;
    protected generalSettings: { colorMultiplierRange: Range3_T, opacity: number, maxParticles: number; acceleration: Vector3; lifetime: Range_T; particlesPerSecond: number };
    protected initialSettings: { particlesPerSecond: number, position: { min: Vector3; max: Vector3; }, offset: Vector3, scale: { min: Vector3; max: Vector3; }; velocity: { min: Vector3; max: Vector3; }; angularVelocity: { min: Vector3; max: Vector3; }; };
    protected changesOverLifetimeSettings: ChangesOverTime_T;

    protected particlePool: Array<Particle>;
    protected tmpVec = new Vector3();

    protected currentTime: number;
    protected lastSpawned: number;
    protected isSpinning: boolean;
    protected isSpriteEmitter: boolean = false;
    protected SpinParticles: boolean;

    public getCurrentTime() { return this.currentTime; }

    constructor(config: GD.EmitterConfig_T) {
        super();

        this.fadingSettings = {
            fadeIn: config.fadeIn ? { time: config.fadeIn.time * 1000, color: new Vector4().fromArray(config.fadeIn.color || [1, 1, 1, 1]) } : null,
            fadeOut: config.fadeOut ? { time: config.fadeOut.time * 1000, color: new Vector4().fromArray(config.fadeOut.color || [1, 1, 1, 1]) } : null
        };

        this.generalSettings = {
            colorMultiplierRange: { min: new Vector3().fromArray(config.colorMultiplierRange?.min ?? [1, 1, 1]), max: new Vector3().fromArray(config.colorMultiplierRange?.max ?? [1, 1, 1]) },
            opacity: config.opacity ?? 1,
            maxParticles: config.maxParticles ?? 2,
            acceleration: new Vector3().fromArray(config.acceleration ?? [0, 0, 0]),
            lifetime: { min: config.lifetime[0] * 1000, max: config.lifetime[1] * 1000 },
            particlesPerSecond: config.particlesPerSecond ?? 0
        };

        this.changesOverLifetimeSettings = {
            scale: buildChangeRanges(config.changesOverLifetime.scale)
        };

        this.initialSettings = {
            particlesPerSecond: config.initial.particlesPerSecond || 0,
            scale: {
                min: new Vector3().fromArray(config.initial.scale?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.scale?.max || [1, 1, 1])
            },
            velocity: {
                min: new Vector3().fromArray(config.initial.velocity?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.velocity?.max || [1, 1, 1])
            },
            position: {
                min: new Vector3().fromArray(config.initial.position?.min || [0, 0, 0]),
                max: new Vector3().fromArray(config.initial.position?.max || [0, 0, 0])
            },
            offset: new Vector3().fromArray(config.initial.offset || [0, 0, 0]),
            angularVelocity: {
                min: new Vector3().fromArray(config.initial.angularVelocity?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.angularVelocity?.max || [1, 1, 1])
            }
        };
        this.drawScale = config.drawScale ?? 1;

        Object.assign(this, config.allSettings);

        this.acceleration = new Vector3().fromArray(config.acceleration ?? [0, 0, 0]);
        this.maxAbsVelocity = config.maxAbsVelocity ? new Vector3().fromArray(config.maxAbsVelocity) : new Vector3(0, 0, 0);
        this.realVelocityLossRange = config.velocityLossRange ? {
            min: new Vector3().fromArray(config.velocityLossRange.min),
            max: new Vector3().fromArray(config.velocityLossRange.max)
        } : { min: new Vector3(0, 0, 0), max: new Vector3(0, 0, 0) };

        this.oldOwnerLocation = this.parent?.position.clone() ?? new Vector3();

        this.startMassRange = { min: config.startMassRange?.[0] ?? 0, max: config.startMassRange?.[1] ?? 0 };
        this.initialTimeRange = { min: config.initialTimeRange?.[0] ?? 0, max: config.initialTimeRange?.[1] ?? 0 };
        this.lifetimeRange = { min: config.lifetime?.[0] ?? 0, max: config.lifetime?.[1] ?? 0 };
        this.colorMultiplierRange = { 
            min: new Vector3().fromArray(config.colorMultiplierRange?.min || [1, 1, 1]), 
            max: new Vector3().fromArray(config.colorMultiplierRange?.max || [1, 1, 1]) 
        };
        this.revolutionCenterOffsetRange = config.revolutionCenterOffsetRange ? {
            min: new Vector3().fromArray(config.revolutionCenterOffsetRange.min),
            max: new Vector3().fromArray(config.revolutionCenterOffsetRange.max)
        } : { min: new Vector3(), max: new Vector3() };
        this.revolutionsPerSecondRange = config.revolutionsPerSecondRange ? {
            min: new Vector3().fromArray(config.revolutionsPerSecondRange.min),
            max: new Vector3().fromArray(config.revolutionsPerSecondRange.max)
        } : { min: new Vector3(), max: new Vector3() };

        this.forcedMaxParticles = !!config.forcedMaxParticles;
        this.warmupTime = config.warmupTime ?? 0;
        this.warmupTicksPerSecond = config.warmupTicksPerSecond ?? 1;
        this.initialTimeRange = config.initialTimeRange ? { min: config.initialTimeRange[0], max: config.initialTimeRange[1] } : { min: 0, max: 0 };
        this.startLocationPolarRange = config.startLocationPolarRange ? {
            min: new Vector3().fromArray(config.startLocationPolarRange.min),
            max: new Vector3().fromArray(config.startLocationPolarRange.max)
        } : { min: new Vector3(), max: new Vector3() };
        this.addVelocityMultiplierRange = config.addVelocityMultiplierRange ? {
            min: new Vector3().fromArray(config.addVelocityMultiplierRange.min),
            max: new Vector3().fromArray(config.addVelocityMultiplierRange.max)
        } : { min: new Vector3(), max: new Vector3() };
        this.velocityLossRange = config.velocityLossRange ? {
            min: new Vector3().fromArray(config.velocityLossRange.min),
            max: new Vector3().fromArray(config.velocityLossRange.max)
        } : { min: new Vector3(), max: new Vector3() };
        this.sphereRadiusRange = config.sphereRadiusRange ? { min: config.sphereRadiusRange[0], max: config.sphereRadiusRange[1] } : { min: 0, max: 0 };
        this.startSpinRange = {
            min: new Vector3().fromArray(config.initial.angularVelocity?.min || [0, 0, 0]),
            max: new Vector3().fromArray(config.initial.angularVelocity?.max || [0, 0, 0])
        };
        this.spinsPerSecondRange = config.angularVelocity ? {
            min: new Vector3().fromArray(config.angularVelocity.min),
            max: new Vector3().fromArray(config.angularVelocity.max)
        } : { min: new Vector3(), max: new Vector3() };


        this.activeParticles = 0;
        this.particleIndex = 0;
        this.allParticlesDead = false;
        this.warmedUp = false;

        // Soft limit: when ForcedMaxParticles is NOT set, the particle pool is
        // larger than maxParticles so the emitter can temporarily exceed the
        // target count instead of recycling active particles prematurely.
        const poolSize = this.forcedMaxParticles ? this.maxParticles : this.maxParticles * 2;

        this.particles = new Array(poolSize).fill(1).map(() => new Particle_T())
        this.RealMeshNormal = new Vector3().copy(this.meshNormal).normalize();

        this.maxActiveParticles = poolSize;

        // debugger;

        this.initSettings(config);

        this.particlePool = new Array(poolSize);


        for (let i = 0; i < poolSize; i++) {
            const particle = this.particlePool[i] = Particle.init(this, this.initParticleMesh());

            particle.name = this.name + "_" + i;
            particle.children[0].name = this.name + "_" + i + "_vis";

            this.add(particle);
        }



        // Neutralize actor scaling for particle simulation space.
        // The Emitter actor's world matrix already includes DrawScale.
        // By setting our local scale to 1/DrawScale, we ensure our local units
        // (positions, velocities) are 1:1 with world units.
        if (this.drawScale > 0) {
            this.scale.setScalar(1 / this.drawScale);
        }
    }

    public warmUp(relativeTime: number, ticksPerSecond: number) {
        if (relativeTime <= 0 || ticksPerSecond <= 0) return;

        // UE2 warmup (UnParticleSystem.cpp lines 201-208):
        // PrimeTime = LifetimeRange.GetCenter() * RelativeWarmupTime
        // DeltaTime = 1 / WarmupTicksPerSecond
        // Loop: UpdateParticles(DeltaTime) for (WarmupTicksPerSecond * PrimeTime) iterations
        const primeTime = ((this.lifetimeRange.min + this.lifetimeRange.max) / 2) * relativeTime;
        const dt = 1 / ticksPerSecond;
        const numTicks = Math.floor(ticksPerSecond * primeTime);

        for (let i = 0; i < numTicks; i++) {
            this.updateParticles(dt);
        }
    }

    protected warmedUp: boolean;
    protected warmupTime: number;
    protected warmupTicksPerSecond: number;
    declare protected maxParticles: number;
    protected boundingBox = new Box3();
    protected drawScale: number = 1;
    declare protected addLocationFromOtherEmitter: number;
    declare protected addVelocityFromOtherEmitter: number;
    declare protected spawnFromOtherEmitter: number;
    declare protected rotateVelocityLossRange: boolean;
    protected realVelocityLossRange: Range3_T;
    protected velocityLossRange: Range3_T;
    declare protected rotationSource: any;

    protected RVLMin: THREE.Vector3;
    protected RVLMax: THREE.Vector3;
    protected RotationOffset: any;
    protected rotationNormal: any;

    declare protected skeletalMeshActor: any;
    declare protected useSkeletalLocationAs: any;

    protected oldOwnerLocation: THREE.Vector3;
    protected lastDeltaTime: number = 0.016;
    protected activeParticles: number = 0;
    protected activeCount: number = 0;
    declare protected maxActiveParticles: number;
    declare protected isAutomaticInitialSpawning: boolean;

    protected lifetimeRange: { min: number, max: number };
    declare protected initialParticlesPerSecond: number;
    declare protected particlesPerSecond: number;

    protected currentSpawnOnTrigger: number = 0;
    declare protected spawnOnTriggerPPS: number;

    protected killPending: boolean = false;

    protected ppsFraction: number = 0;

    protected deferredParticles: number = 0;
    protected particleIndex: number;

    declare protected coordinateSystem: any;
    protected particles: Particle_T[];
    protected isRespawningDeadParticles: boolean;
    protected forcedMaxParticles: boolean = false;
    protected initialTimeRange: { min: number, max: number };

    declare protected acceleration: THREE.Vector3;
    protected skeletalScale: THREE.Vector3;
    protected meshVertsAndNormals = new Array<THREE.Vector3>();

    declare protected isUsingRevolution: boolean;
    declare protected isUsingCollision: boolean;
    declare protected isUsingCollisionPlanes: boolean;
    declare protected isUsingSizeScale: boolean;
    declare protected isScaleSizeRegular: boolean;
    declare protected maxAbsVelocity: THREE.Vector3;
    protected startMassRange: { min: number, max: number };
    declare protected meshNormal: THREE.Vector3;
    declare protected meshNormalThresholdRange: Range_T;
    protected meshScaleRange: Range3_T;
    declare protected meshSpawning: any;
    declare protected meshSpawningStaticMesh: any;
    declare protected isVelocityFromMesh: boolean;
    protected velocityScaleRange: Range3_T;
    declare protected isUsingColorFromMesh: boolean;
    declare protected isUniformMeshScale: boolean;
    declare protected isUniformVelocityScale: boolean;
    protected addVelocityMultiplierRange: Range3_T;
    protected globalOffset = new Vector3();
    protected RelativeBoneIndexRange: Range_T;
    declare protected effectAxis: any;
    declare protected revolutionCenterOffsetRange: Range3_T;
    declare protected revolutionsPerSecondRange: Range3_T;
    protected colorMultiplierRange: Range3_T;
    protected startSizeRange: Range3_T;
    declare protected isUniformScale: any;
    declare protected StartVelocityRadialRange: Range3_T;
    declare protected addVelocityFromOwner: boolean;
    declare protected ScaleSizeByVelocityMax: number;
    declare protected startSpinRange: Range3_T;
    declare protected spinsPerSecondRange: Range3_T;
    declare protected clockwiseSpinChance: THREE.Vector3;
    declare protected isUsingRandomSubdiv: boolean;
    declare protected subdivStart: number;
    declare protected subdivEnd: number;
    declare protected texSubdivU: number;
    declare protected texSubdivV: number;
    declare protected spawningSound: number;
    declare protected spawningSoundIndex: Range_T;
    declare protected SpawningSoundProbability: Range_T;
    declare protected isDisabled: boolean;

    protected RealExtentMultiplier: any;
    protected CollisionPlanes: THREE.Vector4[];
    protected CollisionSound: any;
    protected CurrentCollisionSoundIndex: number;
    protected CollisionSoundIndex: Range_T;
    protected SpawnAmount: number;
    protected sounds: any[];
    protected CollisionSoundProbability: Range_T;
    protected isUsingSpawnedVelocityScale: boolean;
    protected SpawnedVelocityScaleRange: Range3_T;
    protected UseMaxCollisions: boolean;
    protected MaxCollisions: Range_T;
    protected DampingFactorRange: Range3_T;
    protected DampRotation: boolean;
    protected RotationDampingFactorRange: Range3_T;
    protected useAbsoluteTimeForSizeScale: boolean;
    protected sizeScaleRepeats: number;
    protected sizeScale: any[];
    protected isUsingVelocityScale: boolean;
    protected velocityScaleRepeats: number;
    protected velocityScale: any[];
    protected scaleSizeXByVelocity: boolean;
    protected scaleSizeYByVelocity: boolean;
    protected scaleSizeZByVelocity: boolean;
    protected scaleSizeByVelocityMultiplier: Vector3;
    protected determineVelocityByLocationDifference: boolean;
    protected isUsingRevolutionScale: boolean;
    protected RevolutionScaleRepeats: number;
    protected RevolutionScale: any[];
    protected isUsingColorScale: boolean;
    protected colorScaleRepeats: number;
    protected colorScale: any[];
    protected drawStyle: any;
    protected isFadingOut: boolean;
    protected fadeOutStartTime: number;
    protected fadeOutFactor: THREE.Vector4;
    protected isFadingIn: boolean;
    protected fadeInEndTime: number;
    protected fadeInFactor: THREE.Vector4;
    protected FadeFactor: number;
    protected opacity: number;
    protected MinSquaredVelocity: number;
    protected allParticlesDead: boolean;
    protected startLocationShape: any;
    protected startLocationOffset: THREE.Vector3;
    protected startVelocityRange: Range3_T;
    protected startLocationRange: any;
    protected sphereRadiusRange: Range_T;
    protected startLocationPolarRange: Range3_T;
    protected CurrentMeshSpawningIndex: number;
    protected isSpawningTowardsNormal: boolean;
    protected RealMeshNormal: any;
    protected MeshNormalThresholdRange: Range_T;
    protected UniformMeshScale: boolean;
    protected UniformVelocityScale: boolean;
    protected otherIndex: number = 0;
    protected getVelocityDirectionFrom: any;
    protected maxSizeScale: number;
    protected CurrentSpawningSoundIndex: number = 0;

    protected updateParticle(deltaTime: number, index: number) {
        // only trail emitters use this apparently
    }

    protected spawnParticle(index: number, spawnTime: number, flags: number = 0, spawnFlags: number = 0, localLocationOffset = new Vector3(0, 0, 0)) {
        // debugger;
        const Owner = this.parent || this;

        if (!this.maxParticles || this.killPending || (this.lifetimeRange.max <= 0))
            return;

        const ownerLocation = () => Owner.position;
        const oldOwnerLocation = () => ownerLocation();

        // debugger;

        const Particle = this.particles[index];

        Particle.position.copy(this.initialSettings.offset);
        randVector(Particle.Velocity, this.initialSettings.velocity.min, this.initialSettings.velocity.max);

        // Handle Shape.
        const ApplyAll = this.startLocationShape.valueOf() === PTLS_All;
        if (ApplyAll || this.startLocationShape.valueOf() === PTLS_Box)
            randVector(this.tmpVec, this.initialSettings.position.min, this.initialSettings.position.max), Particle.position.add(this.tmpVec);
        if (ApplyAll || this.startLocationShape.valueOf() === PTLS_Sphere)
            Particle.position.add(new Vector3().randomDirection().multiplyScalar(randRange(this.sphereRadiusRange.min, this.sphereRadiusRange.max)));
        if (ApplyAll || this.startLocationShape.valueOf() === PTLS_Polar) {
            __break__();
            const Polar = this.tmpVec;
            randVector(Polar, this.startLocationPolarRange.min, this.startLocationPolarRange.max);
            let X, Y, Z;
            X = Polar.z * Math.cos(Polar.x * Math.PI / 32768) * Math.sin(Polar.y * Math.PI / 32768);
            Z = Polar.z * Math.sin(Polar.x * Math.PI / 32768) * Math.sin(Polar.y * Math.PI / 32768);
            Y = Polar.z * Math.cos(Polar.y * Math.PI / 32768);
            Particle.position.add(new Vector3(X, Y, Z));
        }

        // Handle spawning from mesh.
        Particle.ColorMultiplier.set(1, 1, 1);
        if ((this.meshSpawning.valueOf() !== PTMS_None) && this.meshSpawningStaticMesh) {
            __break__();
            let MaxIndex = this.meshSpawningStaticMesh.geometry.getAttribute("position").count;
            if (MaxIndex > 0) {
                let VertexIndex = (this.meshSpawning == PTMS_Linear) ? this.CurrentMeshSpawningIndex++ : (Math.trunc(Math.random() * MaxIndex));
                VertexIndex %= MaxIndex;
                VertexIndex = clamp(VertexIndex, 0, MaxIndex);

                let attrPositions = this.meshSpawningStaticMesh.geometry.getAttribute("position");
                let attrNormals = this.meshSpawningStaticMesh.geometry.getAttribute("normal");

                if (this.isSpawningTowardsNormal) {

                    let Normal = new Vector3().fromBufferAttribute(attrNormals, VertexIndex);
                    if ((Normal.dot(this.RealMeshNormal)) < (1 - 2 * randRange(this.MeshNormalThresholdRange.min, this.MeshNormalThresholdRange.max))) {
                        Particle.Flags &= ~PTF_Active;
                        return;
                    }
                }


                let LocationScale = randVector(new Vector3(), this.meshScaleRange.min, this.meshScaleRange.max);
                let Location = new Vector3().fromBufferAttribute(attrPositions, VertexIndex);
                Particle.position.add(this.UniformMeshScale ? Location.multiplyScalar(LocationScale.x) : Location.multiply(LocationScale));

                if (this.isVelocityFromMesh) {
                    let VelocityScale = randVector(new Vector3(), this.velocityScaleRange.min, this.velocityScaleRange.max);
                    let Velocity = new Vector3().fromBufferAttribute(attrNormals, VertexIndex);
                    Particle.Velocity.add(this.UniformVelocityScale ? Velocity.multiplyScalar(VelocityScale.x) : Velocity.multiply(VelocityScale));
                }

                if (this.isUsingColorFromMesh) {
                    let attrColors = this.meshSpawningStaticMesh.geometry.getAttribute("color");

                    let Color = new Vector3().fromBufferAttribute(attrColors, VertexIndex);
                    Particle.ColorMultiplier.x = Color.x;
                    Particle.ColorMultiplier.y = Color.y;
                    Particle.ColorMultiplier.z = Color.z;
                }
            }
        }

        // debugger;

        // Handle Skeletal mesh spawning.
        // Replicate C++ logic from UnParticleEmitter.cpp:226-232
        // C++: INT NumBones = MeshVertsAndNormals.Num();
        // Note: MeshVertsAndNormals contains [bone0_vertex, bone0_normal, bone1_vertex, bone1_normal, ...]
        // So array length = actual_bone_count * 2, but C++ uses total array length as NumBones
        // Only execute if skeletal mesh actor is set and meshVertsAndNormals is populated
        if (this.useSkeletalLocationAs && this.useSkeletalLocationAs.valueOf() !== PTSU_None && 
            this.meshVertsAndNormals && this.meshVertsAndNormals.length > 0 && 
            this.RelativeBoneIndexRange && this.skeletalScale) {
            const NumBones = this.meshVertsAndNormals.length;
            // C++: Particle.BoneIndex = Clamp<INT>(RelativeBoneIndexRange.GetRand() * NumBones, 0.f, NumBones - 1);
            // RelativeBoneIndexRange.GetRand() returns value in range [min, max]
            // For TypeScript, if RelativeBoneIndexRange is [min, max] tuple, use: min + (max - min) * Math.random()
            const rangeMin = Array.isArray(this.RelativeBoneIndexRange) ? this.RelativeBoneIndexRange[0] : 0;
            const rangeMax = Array.isArray(this.RelativeBoneIndexRange) ? this.RelativeBoneIndexRange[1] : 1;
            const randValue = rangeMin + (rangeMax - rangeMin) * Math.random();
            const boneIndexFloat = randValue * NumBones;
            Particle.BoneIndex = clamp(Math.trunc(boneIndexFloat), 0, NumBones - 1);
            
            // C++: Particle.OldMeshLocation = MeshVertsAndNormals( Particle.BoneIndex ) * SkeletalScale;
            // C++ accesses array directly by BoneIndex - but we need to ensure we get vertex (even index)
            // Since vertices are at even indices (0, 2, 4, ...) and normals at odd (1, 3, 5, ...)
            const vertexIndex = Particle.BoneIndex & ~1; // Round down to nearest even number
            if (vertexIndex < this.meshVertsAndNormals.length) {
                const scaleVec = Array.isArray(this.skeletalScale) 
                    ? new Vector3().fromArray(this.skeletalScale) 
                    : this.skeletalScale;
                Particle.OldMeshLocation.copy(this.meshVertsAndNormals[vertexIndex].clone().multiply(scaleVec));
                Particle.position.add(Particle.OldMeshLocation);
            }
        }


        this.otherIndex++;
        if (this.addLocationFromOtherEmitter >= 0) {
            __break__();
            let OtherEmitter = Owner.Emitters[this.addLocationFromOtherEmitter] as BaseEmitter;
            if (OtherEmitter.activeParticles > 0)
                Particle.position.add(OtherEmitter.particles[this.otherIndex % OtherEmitter.activeParticles].position.clone().sub(ownerLocation()));
        }

        // Handle Rotation.
        switch (this.rotationSource.valueOf()) {
            case PTRS_Actor:
                __break__();
                // Particle.position.copy(Particle.position.TransformVectorBy(GMath.UnitCoords * Owner.Rotation * this.RotationOffset));
                break;
            case PTRS_Offset:
                __break__();
                // Particle.position.copy(Particle.position.TransformVectorBy(GMath.UnitCoords * this.RotationOffset));
                break;
            case PTRS_Normal:
                __break__();
                {
                    let Rotator = this.rotationNormal.Rotation();
                    // Map Z to -X if effect was created along the Z axis instead of negative X
                    if (this.effectAxis.valueOf() === PTEA_PositiveZ)
                        Rotator.Pitch -= 16384;
                    // Particle.position.copy(Particle.position.TransformVectorBy(GMath.UnitCoords * Rotator));
                }
                break;
        }

        randVector(Particle.RevolutionCenter, this.revolutionCenterOffsetRange.min, this.revolutionCenterOffsetRange.max);
        randVector(Particle.RevolutionsPerSecond, this.revolutionsPerSecondRange.min, this.revolutionsPerSecondRange.max);

        if (this.coordinateSystem.valueOf() === PTCS_Independent) {
            // Particle.RevolutionCenter.add(ownerLocation());
        }

        if (!(spawnFlags & PSF_NoGlobalOffset))
            Particle.position.add(this.globalOffset);

        Particle.position.add(localLocationOffset);

        Particle.OldLocation.copy(Particle.position);
        Particle.StartLocation.copy(Particle.position);
        randVector(Particle.ColorMultiplier, this.colorMultiplierRange.min, this.colorMultiplierRange.max);
        Particle.MaxLifetime = randRange(this.lifetimeRange.min, this.lifetimeRange.max);
        Particle.Time = spawnTime + randRange(this.initialTimeRange.min, this.initialTimeRange.max);
        Particle.HitCount = 0;
        Particle.Flags = PTF_Active | flags;
        Particle.Mass = randRange(this.startMassRange.min, this.startMassRange.max);
        randVector(Particle.StartSize, this.initialSettings.scale.min, this.initialSettings.scale.max);
        if (this.isUniformScale) {
            Particle.StartSize.y = Particle.StartSize.x;
            Particle.StartSize.z = Particle.StartSize.x;
        }
        Particle.scale.copy(Particle.StartSize);
        let currentAccel = this.acceleration.clone();
        if (this.coordinateSystem.valueOf() === PTCS_Independent) {
            this.parent.updateMatrixWorld();
            const worldToLocal = new Matrix4().copy(this.parent.matrixWorld).invert();
            currentAccel.applyMatrix4(new Matrix4().extractRotation(worldToLocal));
        }
        Particle.Velocity.add(currentAccel.multiplyScalar(spawnTime));
        Particle.VelocityMultiplier.set(1, 1, 1);
        Particle.RevolutionsMultiplier.set(1, 1, 1);

        // Adjust velocity.
        switch (this.rotationSource.valueOf()) {
            case PTRS_Actor:
                __break__();
                // Particle.Velocity.copy(Particle.Velocity.TransformVectorBy(GMath.UnitCoords * Owner.Rotation * this.RotationOffset));
                break;
            case PTRS_Offset:
                __break__();
                // Particle.Velocity.copy(Particle.Velocity.TransformVectorBy(GMath.UnitCoords * this.RotationOffset));
                break;
            case PTRS_Normal:
                __break__();
                // Particle.Velocity.copy(Particle.Velocity.TransformVectorBy(GMath.UnitCoords * this.rotationNormal.Rotation()));
                break;
        }

        if (this.getVelocityDirectionFrom.valueOf() !== PTVD_None) {
            let Direction;

            if (this.coordinateSystem.valueOf() === PTCS_Relative)
                Direction = Particle.position.clone().normalize();
            else
                Direction = (ownerLocation().clone().sub(Particle.position)).normalize();

            switch (this.getVelocityDirectionFrom.valueOf()) {
                case PTVD_StartPositionAndOwner:
                    
                    Particle.Velocity.copy(Particle.Velocity.clone().negate().multiply(Direction));
                    break;
                case PTVD_OwnerAndStartPosition:
                    Particle.Velocity.copy(Particle.Velocity.clone().multiply(Direction));
                    break;
                case PTVD_AddRadial:
                    __break__();
                    randVector(this.tmpVec, this.StartVelocityRadialRange.min, this.StartVelocityRadialRange.max), Particle.Velocity.add(this.tmpVec.clone().multiply(Direction));
                    break;
                default:
                    break;
            }
        }


        if (this.addVelocityFromOwner && this.coordinateSystem.valueOf() !== PTCS_Relative)
            __break__() && Particle.Velocity.add(randVector(this.tmpVec, this.addVelocityMultiplierRange.min, this.addVelocityMultiplierRange.max).clone().multiply(Owner.AbsoluteVelocity));

        if (this.addVelocityFromOtherEmitter >= 0) {
            __break__();
            let OtherEmitter = Owner.Emitters[this.addVelocityFromOtherEmitter];
            if (OtherEmitter.ActiveParticles > 0)
                Particle.Velocity.add(randVector(this.tmpVec, this.addVelocityMultiplierRange.min, this.addVelocityMultiplierRange.max).clone().multiply(OtherEmitter.Particles[this.otherIndex % OtherEmitter.ActiveParticles].Velocity));
        }

        // Location.
        if (this.coordinateSystem.valueOf() === PTCS_Independent && spawnTime > 0) {
            const ownerVelocity = ownerLocation().clone().sub(this.oldOwnerLocation).divideScalar(clamp(this.lastDeltaTime, 0.001, 1.0));
            Particle.position.sub(ownerVelocity.multiplyScalar(spawnTime));
        }
        Particle.position.add(Particle.Velocity.clone().multiplyScalar(spawnTime));

        // Scale size by velocity.
        if (this.scaleSizeXByVelocity || this.scaleSizeYByVelocity || this.scaleSizeZByVelocity) {
            let VelocitySize = Math.min(Particle.Velocity.length(), this.ScaleSizeByVelocityMax);
            if (this.scaleSizeXByVelocity)
                Particle.scale.x *= VelocitySize * this.scaleSizeByVelocityMultiplier.x;
            if (this.scaleSizeYByVelocity)
                Particle.scale.y *= VelocitySize * this.scaleSizeByVelocityMultiplier.y;
            if (this.scaleSizeZByVelocity)
                Particle.scale.z *= VelocitySize * this.scaleSizeByVelocityMultiplier.z;
        }

        // Mass is stored as one over mass internally.
        if (Particle.Mass)
            Particle.Mass = 1 / Particle.Mass;

        randVector(Particle.StartSpin, this.startSpinRange.min, this.startSpinRange.max);
        randVector(Particle.SpinsPerSecond, this.spinsPerSecondRange.min, this.spinsPerSecondRange.max);

        // Determine spin.
        if (this.clockwiseSpinChance.x > Math.random())
            Particle.SpinsPerSecond.x *= -1;
        if (this.clockwiseSpinChance.y > Math.random())
            Particle.SpinsPerSecond.y *= -1;
        if (this.clockwiseSpinChance.z > Math.random())
            Particle.SpinsPerSecond.z *= -1;

        Particle.StartSpin.multiplyScalar(0xFFFF);
        Particle.SpinsPerSecond.multiplyScalar(0xFFFF);

        if (this.isUsingRandomSubdiv) {
            if (this.subdivEnd)
                Particle.Subdivision = Math.trunc((this.subdivEnd - this.subdivStart) * Math.random() + this.subdivStart);
            else
                Particle.Subdivision = Math.trunc(Math.random() * this.texSubdivU * this.texSubdivV);
        }
        else
            Particle.Subdivision = -1;


        if ((Particle.Time > Particle.MaxLifetime) && Particle.MaxLifetime)
            this.spawnParticle(index, (Particle.Time % Particle.MaxLifetime));

        // Play sound on spawning.
        if ((this.spawningSound.valueOf() !== PTSC_None) && __break__() && Owner.GetLevel().Engine.Audio && this.sounds.length) {
            __break__();
            let SoundIndex = 0;
            switch (this.spawningSound.valueOf()) {
                case PTSC_LinearGlobal:
                case PTSC_LinearLocal:
                    SoundIndex = this.CurrentSpawningSoundIndex++;
                    break;
                case PTSC_Random:
                    SoundIndex = Math.trunc(1000 * Math.random());
                    break;
            }

            SoundIndex %= Math.trunc((this.spawningSoundIndex.max - this.spawningSoundIndex.min) ? (this.spawningSoundIndex.max - this.spawningSoundIndex.min) + 1 : this.sounds.length);
            SoundIndex += Math.trunc(this.spawningSoundIndex.min);
            SoundIndex = clamp(SoundIndex, 0, this.sounds.length - 1);

            if (Math.random() <= (randRange(this.sounds[SoundIndex].Probability.min, this.sounds[SoundIndex].Probability.max) * randRange(this.SpawningSoundProbability.min, this.SpawningSoundProbability.max)))
                Owner.GetLevel().Engine.Audio.PlaySound(Owner, SLOT_None, this.sounds[SoundIndex].Sound, Particle.position, Owner.TransientSoundVolume * randRange(this.sounds[SoundIndex].Volume.min, this.sounds[SoundIndex].Volume.max), randRange(this.sounds[SoundIndex].Radius.min, this.sounds[SoundIndex].Radius.max), randRange(this.sounds[SoundIndex].Pitch.min, this.sounds[SoundIndex].Pitch.max), SF_NoUpdates, 0);
        }

        // Make sure we get ticked.
        this.allParticlesDead = false;
    }

    protected spawnParticles(oldLeftover: number, rate: number, deltaTime: number) {
        const Owner = this.parent || this; // Fallback to self (identity) for warmup

        if (rate <= 0)
            return 0;

        // debugger

        let newLeftover = oldLeftover + deltaTime * rate;
        let spawnCount = Math.trunc(newLeftover);

        newLeftover = newLeftover - spawnCount;

        const increment = 1 / rate;
        const startTime = deltaTime + oldLeftover * increment - increment;

        spawnCount = clamp(spawnCount, 0, this.maxActiveParticles);
        if (this.currentSpawnOnTrigger) {
            __break__();
            spawnCount = clamp(spawnCount, 0, this.currentSpawnOnTrigger);
            this.currentSpawnOnTrigger -= spawnCount;
        }

        const ownerLocation = () => new Vector3().set(Owner.position.x, Owner.position.z, Owner.position.y);
        const oldOwnerLocation = () => ownerLocation();

        let percent;
        const shouldInterpolate = oldOwnerLocation().distanceTo(ownerLocation()) > 1;

        for (let i = 0; i < spawnCount; i++) {

            this.spawnParticle(this.particleIndex, startTime - i * increment, PTF_InitialSpawn);

            // Laurent -- location interpolation
            if (shouldInterpolate && this.coordinateSystem.valueOf() === PTCS_Independent) {
                __break__();
                percent = 1 - (i + 1) / spawnCount;
                this.particles[this.particleIndex].position.add((oldOwnerLocation().clone().sub(ownerLocation())).multiplyScalar(percent));
            }

            this.activeParticles = Math.max(this.activeParticles, this.particleIndex + 1);
            this.activeCount++;
            this.particleIndex = (this.particleIndex + 1) % this.maxActiveParticles;
        }

        return newLeftover;
    }

    protected updateParticles(deltaTime: number) {
        const Owner = this.parent || this; // Fallback to self (identity) for warmup

        // debugger;

        this.boundingBox.makeEmpty();
        let DeadParticles = 0;

        // Verify range of critical variables.
        if (Owner) {
            if (this.addLocationFromOtherEmitter >= 0)
                this.addLocationFromOtherEmitter = __break__() && clamp(this.addLocationFromOtherEmitter, 0, Owner.Emitters.Num() - 1);
            if (this.addVelocityFromOtherEmitter >= 0)
                this.addVelocityFromOtherEmitter = __break__() && clamp(this.addVelocityFromOtherEmitter, 0, Owner.Emitters.Num() - 1);
            if (this.spawnFromOtherEmitter >= 0)
                this.spawnFromOtherEmitter = __break__() && clamp(this.spawnFromOtherEmitter, 0, Owner.Emitters.Num() - 1);
        }
        else
            return 0;

        // Update velocity loss range.
        if (!this.rotateVelocityLossRange) {
            this.realVelocityLossRange = this.velocityLossRange;
        } else {
            __break__();
            const RVLMin = new Vector3(this.velocityLossRange.min.x, this.velocityLossRange.min.y, this.velocityLossRange.min.z);
            const RVLMax = new Vector3(this.velocityLossRange.max.x, this.velocityLossRange.max.y, this.velocityLossRange.max.z);

            switch (this.rotationSource) {
                case PTRS_Actor:
                    this.RVLMin = RVLMin.TransformVectorBy(GMath.UnitCoords * Owner.Rotation * this.RotationOffset);
                    this.RVLMax = RVLMax.TransformVectorBy(GMath.UnitCoords * Owner.Rotation * this.RotationOffset);
                    break;
                case PTRS_Offset:
                    this.RVLMin = RVLMin.TransformVectorBy(GMath.UnitCoords * this.RotationOffset);
                    this.RVLMax = RVLMax.TransformVectorBy(GMath.UnitCoords * this.RotationOffset);
                    break;
                case PTRS_Normal:
                    this.RVLMin = RVLMin.TransformVectorBy(GMath.UnitCoords * this.rotationNormal.Rotation());
                    this.RVLMax = RVLMax.TransformVectorBy(GMath.UnitCoords * this.rotationNormal.Rotation());
                    break;
                default:
                    break;
            }

            this.realVelocityLossRange = { min: new Vector3(), max: new Vector3() }
            this.realVelocityLossRange.min.x = RVLMin.x;
            this.realVelocityLossRange.min.y = RVLMin.y;
            this.realVelocityLossRange.min.z = RVLMin.z;

            this.realVelocityLossRange.max.x = RVLMax.x;
            this.realVelocityLossRange.max.y = RVLMax.y;
            this.realVelocityLossRange.max.z = RVLMax.z;
        }

        // Skeletal mesh stuff.
        let numBones = 0;
        if (this.skeletalMeshActor && __break__() && this.useSkeletalLocationAs.valueOf() !== PTSU_None) {
            if (!this.skeletalMeshActor.bDeleteMe && this.skeletalMeshActor.Mesh && this.skeletalMeshActor.Mesh.IsA("USkeletalMesh")) {
                const SkeletalMeshInstance = this.skeletalMeshActor.Mesh.MeshGetInstance(this.skeletalMeshActor);
                if (SkeletalMeshInstance)
                    numBones = SkeletalMeshInstance.GetMeshJointsAndNormals(this.skeletalMeshActor, this.meshVertsAndNormals);
            }
        }

        // Spawning.
        let rate;
        // UE2 logic: Use initial/automatic rate while filling up to the TARGET count, then switch to PPS.
        // Note: maxParticles is the target count; maxActiveParticles may be larger (soft limit buffer).
        if (this.activeParticles < this.maxParticles) {
            if (this.isAutomaticInitialSpawning) {
                rate = this.maxParticles / ((this.lifetimeRange.min + this.lifetimeRange.max) / 2);
            } else {
                rate = this.initialParticlesPerSecond;
            }
        } else {
            rate = this.particlesPerSecond;
        }

        // Spawning on trigger.
        if (this.currentSpawnOnTrigger)
            rate += this.spawnOnTriggerPPS;

        // Actually spawn them.
        if (rate > 0 && !this.killPending)
            this.ppsFraction = this.spawnParticles(this.ppsFraction, rate, deltaTime);

        const ownerLocation = () => Owner.position;
        const oldOwnerLocation = () => this.oldOwnerLocation;


        // Deferred spawning.
        if (!this.killPending) {

            let Amount = clamp(this.deferredParticles, 0, this.maxActiveParticles);

            for (let i = 0; i < Amount; i++) {
                debugger;
                if (this.particleIndex !== -1) {
                    this.spawnParticle(this.particleIndex, 0);
                    this.activeParticles = Math.max(this.activeParticles, this.particleIndex + 1);
                    this.particleIndex = (this.particleIndex + 1) % this.maxActiveParticles;
                }
            }
            this.deferredParticles = 0;
        }


        for (let Index = 0; Index < Math.min(this.maxActiveParticles, this.activeParticles); Index++) {
            let Particle = this.particles[Index];

            if (!(Particle.Flags & PTF_Active))
                continue;

            // Don't tick particle if it just got spawned via initial spawning.
            if (!(Particle.Flags & PTF_InitialSpawn))
                Particle.Time += deltaTime;

            if (Particle.Time > Particle.MaxLifetime) {
                if (!this.isRespawningDeadParticles) {
                    Particle.Flags &= ~PTF_Active;
                    DeadParticles++;
                    this.activeCount--;
                    continue;
                }

                // UE2 Spawn with NewTime randomization
                let newTime = Particle.Time - Particle.MaxLifetime + randRange(this.initialTimeRange.min, this.initialTimeRange.max);
                if (Particle.MaxLifetime > 0) {
                    newTime %= Particle.MaxLifetime;
                } else {
                    newTime = 0;
                }

                this.spawnParticle(Index, newTime);
            }
        }

        let MaxVelocityScale = 1;
        let OneOverDeltaTime = 1 / clamp(deltaTime, 0.001, 0.15);

        // 2. Physics & Movement Update
        for (let index = 0; index < Math.min(this.maxActiveParticles, this.activeParticles); index++) {
            let Particle = this.particles[index];

            if (!(Particle.Flags & PTF_Active))
                continue;

            // UE2: UBOOL TickParticle = !(Particle.Flags & PTF_NoTick) || (CoordinateSystem == PTCS_Relative);
            let TickParticle = !(Particle.Flags & PTF_NoTick) || (this.coordinateSystem.valueOf() === PTCS_Relative);

            // Don't tick particle if it just got spawned via initial spawning or respawn.
            if (Particle.Flags & PTF_InitialSpawn) {
                TickParticle = false;
                Particle.Flags &= ~PTF_InitialSpawn;
            }

            if (TickParticle) {
                let currentAccel = this.acceleration.clone();
                if (this.coordinateSystem.valueOf() === PTCS_Independent) {
                    // For Independent emitters, acceleration is world-space but applied to local velocity.
                    this.parent.updateMatrixWorld();
                    const worldToLocal = new Matrix4().copy(this.parent.matrixWorld).invert();
                    currentAccel.applyMatrix4(new Matrix4().extractRotation(worldToLocal));
                }

                Particle.Velocity.add(currentAccel.multiplyScalar(deltaTime));

                // Support Independent Coordinate System:
                if (this.coordinateSystem.valueOf() === PTCS_Independent) {
                    const ownerOffset = ownerLocation().clone().sub(oldOwnerLocation());
                    Particle.position.sub(ownerOffset);
                }

                Particle.OldLocation.copy(Particle.position);
                Particle.position.add(Particle.Velocity.clone().multiply(Particle.VelocityMultiplier).multiplyScalar(deltaTime));

                if (numBones && this.useSkeletalLocationAs.valueOf() === PTSU_Location) {
                    const NewMeshLocation = this.meshVertsAndNormals[Particle.BoneIndex * 2].clone().multiply(this.skeletalScale);
                    Particle.position.add(NewMeshLocation.clone().sub(Particle.OldMeshLocation));
                    Particle.OldMeshLocation.copy(NewMeshLocation);
                }

                if (this.isUsingRevolution) {
                    __break__();
                    // let RevolutionCenter = Particle.RevolutionCenter;
                    // let Location = Particle.Location - RevolutionCenter;
                    // Location = Location.RotateAngleAxis(Math.trunc(Particle.RevolutionsPerSecond.X * Particle.RevolutionsMultiplier.X * deltaTime * 0xFFFF), new Vector3(1, 0, 0));
                    // Location = Location.RotateAngleAxis(Math.trunc(Particle.RevolutionsPerSecond.Y * Particle.RevolutionsMultiplier.Y * deltaTime * 0xFFFF), new Vector3(0, 1, 0));
                    // Location = Location.RotateAngleAxis(Math.trunc(Particle.RevolutionsPerSecond.Z * Particle.RevolutionsMultiplier.Z * deltaTime * 0xFFFF), new Vector3(0, 0, 1));
                    // Particle.Location = Location + RevolutionCenter;
                }
            }

            // 3. Collision Detection
            let Collided = false;
            let HitNormal = new Vector3(0, 0, 0);
            let HitLocation = new Vector3(0, 0, 0);

            if (TickParticle && (this.coordinateSystem.valueOf() !== PTCS_Relative)) {
                if (this.isUsingCollision) {
                    __break__();
                }
            }

            // Handle collided particle.
            if (Collided) {
                __break__();
            }

            // Scaling over time.
            let RelativeTime;
            let TimeFactor = 1.0;
            let Time = Particle.Time;
            const Color = new Vector4(1, 1, 1, 1);

            if (Particle.MaxLifetime)
                RelativeTime = clamp(Time / Particle.MaxLifetime, 0, 1);
            else
                RelativeTime = 0;

            // Size scale.
            if (this.isUsingSizeScale) {
                if (this.isScaleSizeRegular)
                    TimeFactor = TimeFactor / (1 + Particle.Time);
                else {
                    let SizeRelativeTime = ((this.useAbsoluteTimeForSizeScale ? Time : RelativeTime) * (this.sizeScaleRepeats + 1)) % 1;
                    for (let n = 0; n < this.sizeScale.length; n++) {
                        if (this.sizeScale[n].relTime >= SizeRelativeTime) {
                            let S1, R1;
                            let S2 = this.sizeScale[n].relSize;
                            let R2 = this.sizeScale[n].relTime;
                            if (n) {
                                S1 = this.sizeScale[n - 1].relSize;
                                R1 = this.sizeScale[n - 1].relTime;
                            }
                            else {
                                S1 = 1;
                                R1 = 0;
                            }
                            let A;
                            if (R2)
                                A = (SizeRelativeTime - R1) / (R2 - R1);
                            else
                                A = 1;

                            // Interpolate between two scales.
                            TimeFactor = lerp(S1, S2, A);
                            break;
                        }
                    }
                }
            }
            Particle.scale.copy(Particle.StartSize.clone().multiplyScalar(TimeFactor * this.drawScale));

            // Velocity scale.
            if (this.isUsingVelocityScale) {
                __break__();
                if (Particle.MaxLifetime) {
                    let VelocityRelativeTime = (RelativeTime * (this.velocityScaleRepeats + 1)) % 1;
                    for (let n = 0; n < this.velocityScale.length; n++) {
                        if (this.velocityScale[n].RelativeTime >= VelocityRelativeTime) {
                            let V1,
                                V2 = this.velocityScale[n].RelativeVelocity;
                            let R1,
                                R2 = this.velocityScale[n].RelativeTime;
                            if (n) {
                                V1 = this.velocityScale[n - 1].RelativeVelocity;
                                R1 = this.velocityScale[n - 1].RelativeTime;
                            }
                            else {
                                V1 = new Vector3(1, 1, 1);
                                R1 = 0;
                            }
                            let A;
                            if (R2)
                                A = (VelocityRelativeTime - R1) / (R2 - R1);
                            else
                                A = 1;

                            // Interpolate between two scales.
                            Particle.VelocityMultiplier.lerpVectors(V1, V2, A);
                            break;
                        }
                    }
                }
            }

            // Scale size by velocity.
            if (this.scaleSizeXByVelocity || this.scaleSizeYByVelocity || this.scaleSizeZByVelocity) {
                __break__();
                let VelocitySize = this.determineVelocityByLocationDifference ? (Particle.position.clone().sub(Particle.OldLocation)).length() * OneOverDeltaTime : (Particle.Velocity.clone().multiply(Particle.VelocityMultiplier)).length();
                MaxVelocityScale = Math.max(MaxVelocityScale, VelocitySize);
                if (this.scaleSizeXByVelocity)
                    Particle.scale.x *= VelocitySize * this.scaleSizeByVelocityMultiplier.x;
                if (this.scaleSizeYByVelocity)
                    Particle.scale.y *= VelocitySize * this.scaleSizeByVelocityMultiplier.y;
                if (this.scaleSizeZByVelocity)
                    Particle.scale.z *= VelocitySize * this.scaleSizeByVelocityMultiplier.z;
            }

            // Revolution scale.
            if (this.isUsingRevolutionScale) {
                __break__();
                if (Particle.MaxLifetime) {
                    let RevolutionRelativeTime = (RelativeTime * (this.RevolutionScaleRepeats + 1)) % 1;
                    for (let n = 0; n < this.RevolutionScale.length; n++) {
                        if (this.RevolutionScale[n].RelativeTime >= RevolutionRelativeTime) {
                            let V1,
                                V2 = this.RevolutionScale[n].RelativeRevolution;
                            let R1,
                                R2 = this.RevolutionScale[n].RelativeTime;
                            if (n) {
                                V1 = this.RevolutionScale[n - 1].RelativeRevolution;
                                R1 = this.RevolutionScale[n - 1].RelativeTime;
                            }
                            else {
                                V1 = new Vector3(1, 1, 1);
                                R1 = 0;
                            }
                            let A;
                            if (R2)
                                A = (RevolutionRelativeTime - R1) / (R2 - R1);
                            else
                                A = 1;

                            // Interpolate between two scales.
                            Particle.RevolutionsMultiplier.lerpVectors(V1, V2, A);
                            break;
                        }
                    }
                }
            }

            // Color scale.
            if (this.isUsingColorScale && Particle.MaxLifetime) {
                let ColorRelativeTime = (RelativeTime * (this.colorScaleRepeats + 1)) % 1;
                for (let n = 0; n < this.colorScale.length; n++) {
                    if (this.colorScale[n].RelativeTime >= ColorRelativeTime) {
                        let R1;
                        let R2 = this.colorScale[n].RelativeTime;
                        let C1;
                        let C2 = new Vector4().fromArray(this.colorScale[n].Color.toArray());
                        if (n) {
                            C1 = new Vector4().fromArray(this.colorScale[n - 1].Color.toArray());
                            R1 = this.colorScale[n - 1].RelativeTime;
                        }
                        else {
                            C1 = new Vector4(1, 1, 1, 1);
                            R1 = 0;
                        }
                        let A;
                        if (R2)
                            A = (ColorRelativeTime - R1) / (R2 - R1);
                        else
                            A = 1;

                        // Interpolate between two colors.
                        Color.lerpVectors(C1, C2, A);
                        break;
                    }
                }
            }


            if (!this.isRespawningDeadParticles) {
                if (this.particlesPerSecond === 0 && this.initialParticlesPerSecond === 0) {
                    Color.x *= this.opacity;
                    Color.y *= this.opacity;
                    Color.z *= this.opacity;
                }
            }

            Color.x *= Particle.ColorMultiplier.x;
            Color.y *= Particle.ColorMultiplier.y;
            Color.z *= Particle.ColorMultiplier.z;

            // Fade In/ Out.
            if ((this.isFadingOut && (Time > this.fadeOutStartTime) && (Particle.MaxLifetime != this.fadeOutStartTime))
                || (this.isFadingIn && (Time < this.fadeInEndTime) && this.fadeInEndTime)
            ) {
                let FadeFactor;
                let MaxFade: any;

                if (this.isFadingOut && (Time > this.fadeOutStartTime)) {
                    FadeFactor = Time - this.fadeOutStartTime;
                    FadeFactor /= (Particle.MaxLifetime - this.fadeOutStartTime);
                    MaxFade = this.fadeOutFactor;
                } else {
                    FadeFactor = this.fadeInEndTime - Time;
                    FadeFactor /= this.fadeInEndTime;
                    MaxFade = this.fadeInFactor;
                }

                if (this.drawStyle.valueOf() === PTDS_Modulated) {
                    Color.set(
                        0.5,
                        0.5,
                        0.5,
                        1 - FadeFactor * MaxFade.w
                    );
                }
                else if (this.drawStyle.valueOf() === PTDS_AlphaBlend) {
                    Color.w -= FadeFactor * MaxFade.w;
                } else {
                    Color.sub(new Vector4().copy(MaxFade).multiplyScalar(FadeFactor));
                }
            }

            // Laurent -- Global Opacity
            if (this.opacity < 1 && this.drawStyle.valueOf() !== PTDS_Regular) //don't do Opacity for Regular blend mode
            {
                if (this.drawStyle.valueOf() === PTDS_AlphaBlend ||
                    this.drawStyle.valueOf() === PTDS_Modulated ||
                    this.drawStyle.valueOf() === PTDS_AlphaModulate_MightNotFogCorrectly) {
                    Color.w *= this.opacity;
                }
                else {
                    Color.x *= this.opacity;
                    Color.y *= this.opacity;
                    Color.z *= this.opacity;
                }
            }

            Particle.Color.copy(Color);

            // Bounding box creation.
            this.boundingBox.expandByPoint(Particle.position);

            // Clamping velocity.
            if (this.maxAbsVelocity.x)
                Particle.Velocity.x = clamp(Particle.Velocity.x, -this.maxAbsVelocity.x, this.maxAbsVelocity.x);
            if (this.maxAbsVelocity.y)
                Particle.Velocity.y = clamp(Particle.Velocity.y, -this.maxAbsVelocity.y, this.maxAbsVelocity.y);
            if (this.maxAbsVelocity.z)
                Particle.Velocity.z = clamp(Particle.Velocity.z, -this.maxAbsVelocity.z, this.maxAbsVelocity.z);

            // Friction.
            Particle.Velocity.sub(Particle.Velocity.clone().multiply(randVector(this.tmpVec, this.realVelocityLossRange.min, this.realVelocityLossRange.max)).multiplyScalar(deltaTime));

            // Don't tick if particle is no longer moving.
            if (Collided && (new Vector3().copy(Particle.Velocity).lengthSq() < this.MinSquaredVelocity))
                Particle.Flags |= PTF_NoTick;

            // Used by trail emitter e.g.
            this.updateParticle(deltaTime, index);
        }

        // Account for SizeScale when expanding bounding box.
        let MaxScale = 1;
        if (this.isUsingSizeScale && !this.isScaleSizeRegular) {
            for (let i = 0; i < this.sizeScale.length; i++)
                MaxScale = Math.max(this.sizeScale[i].relSize, MaxScale);
        }

        // Take ScaleSizeByVelocityMultiplier into account.
        let MaxScaleSizeByVelocityMultiplier = 1;
        if (this.scaleSizeXByVelocity || this.scaleSizeYByVelocity || this.scaleSizeZByVelocity) {
            MaxScaleSizeByVelocityMultiplier = 0;
            if (this.scaleSizeXByVelocity)
                MaxScaleSizeByVelocityMultiplier = Math.max(MaxScaleSizeByVelocityMultiplier, this.scaleSizeByVelocityMultiplier.x);
            if (this.scaleSizeYByVelocity)
                MaxScaleSizeByVelocityMultiplier = Math.max(MaxScaleSizeByVelocityMultiplier, this.scaleSizeByVelocityMultiplier.y);
            if (this.scaleSizeZByVelocity)
                MaxScaleSizeByVelocityMultiplier = Math.max(MaxScaleSizeByVelocityMultiplier, this.scaleSizeByVelocityMultiplier.z);
        }

        // Subclasses use this to expand bounding box accordingly.
        this.maxSizeScale = MaxScale * MaxVelocityScale * MaxScaleSizeByVelocityMultiplier;

        // Finalize state.
        if ((DeadParticles >= this.maxActiveParticles || (this.activeParticles - DeadParticles) <= 0) && this.particlesPerSecond === 0 && !this.isRespawningDeadParticles)
            this.allParticlesDead = true;
        else
            this.allParticlesDead = false;

        this.activeCount = this.activeParticles - DeadParticles;
        if (this.parent)
            this.oldOwnerLocation.copy(Owner.position);
        return this.activeCount;
    }

    public update(currentTime: number) {
        if (currentTime === 0) return;

        // if (this.name !== "SpriteEmitter3" || this.parent.name !== "Emitter7") return;

        if (this.isDisabled)
            return;


        if (!this.warmedUp && this.parent) {
            this.oldOwnerLocation.copy(this.parent.position);
            
            if (this.warmupTime > 0) {
                this.warmUp(this.warmupTime, this.warmupTicksPerSecond);
            } else if (this.forcedMaxParticles || this.isAutomaticInitialSpawning) {
                // Jump-start the population by pre-filling the pool with particles at random ages
                if (this.maxParticles > 0) {
                    const numToSpawn = (this.forcedMaxParticles || this.isAutomaticInitialSpawning)
                        ? this.maxParticles
                        : Math.min(this.maxParticles, Math.floor(Math.max((this.lifetimeRange.min + this.lifetimeRange.max) / 2, 0) * this.initialSettings.particlesPerSecond));
                    
                    for (let i = 0; i < numToSpawn; i++) {
                        const randomAge = lerp(this.initialTimeRange.min, this.initialTimeRange.max, Math.random());
                        this.spawnParticle(i, -randomAge, PTF_InitialSpawn);
                    }
                }
            }
            this.warmedUp = true;
        }

        if (this.currentTime === undefined) {
            this.currentTime = currentTime;
            return;
        } else {
            const dt = clamp((currentTime - this.currentTime) / 1000, 0, 0.15);
            this.lastDeltaTime = dt;
            this.updateParticles(dt);
        }

        this.particlePool.forEach((p, i) => {
            const settings = this.particles[i];

            p.visible = (settings.Flags & PTF_Active) !== 0;
            if (!p.visible) return;

            p.position.copy(settings.position);
            p.scale.copy(settings.scale);


            if (this.isSpinning || this.SpinParticles) {
                // Mapping from un-particle-emitter.ts: X=Pitch, Y=Yaw, Z=Roll
                const rotPitch = (settings.StartSpin.x + settings.Time * settings.SpinsPerSecond.x) * (Math.PI * 2 / 65536);
                const rotYaw = (settings.StartSpin.y + settings.Time * settings.SpinsPerSecond.y) * (Math.PI * 2 / 65536);
                const rotRoll = (settings.StartSpin.z + settings.Time * settings.SpinsPerSecond.z) * (Math.PI * 2 / 65536);
                
                if (this.isSpriteEmitter) {
                    (p as any).spin = rotRoll;
                } else {
                    // Restore old (working) mapping for Mesh Emitters:
                    // Three X = Roll (UE Z)
                    // Three Y = Pitch (UE X)
                    // Three Z = Yaw (UE Y)
                    p.rotation.set(rotRoll, rotPitch, rotYaw, "XZY");
                }
            }

            const visualizer = p.children[0] as THREE.Mesh;
            const mats = visualizer.material instanceof Array ? visualizer.material : [visualizer.material];
            for (const mat of mats) {
                if ((mat as any).isMeshEmitterMaterial) {
                    const emat = mat as any;
                    if (emat.isUpdatable) emat.update(settings.Time);
                    emat.uniforms.diffuse.value.setRGB(settings.Color.x, settings.Color.y, settings.Color.z);
                    emat.uniforms.opacity.value = settings.Color.w;
                } else if ((mat as any).isStaticMeshMaterial) {
                    const smat = mat as any;
                    if (smat.isUpdatable) smat.update(settings.Time);
                    
                    smat.uniforms.diffuse.value.setRGB(settings.Color.x, settings.Color.y, settings.Color.z);
                    smat.uniforms.opacity.value = settings.Color.w;
                } else if ((mat as any).isParticleMaterial) {
                    const pmat = mat as any;
                    if (pmat.isUpdatable) pmat.update(settings.Time);

                    pmat.uniforms.diffuse.value.setRGB(settings.Color.x, settings.Color.y, settings.Color.z);
                    pmat.uniforms.opacity.value = settings.Color.w;
                } else {
                    (mat as any).color.setRGB(settings.Color.x, settings.Color.y, settings.Color.z);
                    mat.opacity = settings.Color.w;
                }
            }

            if (i > 0) return;

            // console.log(p.position.toArray().map(x => x.toFixed(2)).join(", ") + " |" + settings.Velocity.toArray().map(x => x.toFixed(2)).join(", "));
        })

        this.currentTime = currentTime;
    }

    // public update(currentTime: number) {
    //     if (currentTime === 0) return;

    //     this.currentTime = currentTime;

    //     let deadParticlesCount = 0;
    //     const deadParticlePool = new Array<Particle>(this.particlePool.length);

    //     for (const particle of this.particlePool) {
    //         if (!particle.isAlive) {
    //             deadParticlePool[deadParticlesCount++] = particle;
    //             continue;
    //         }

    //         particle.update(currentTime);

    //         if (!particle.isAlive) // particle has died after update
    //             deadParticlePool[deadParticlesCount++] = particle;
    //     }

    //     const needsToSpawn = !isFinite(this.lastSpawned) || ((currentTime - this.lastSpawned) > this.initialSettings.particlesPerSecond * 1000);

    //     if (!needsToSpawn)
    //         return;

    //     const timePassed = isFinite(this.lastSpawned) ? currentTime - this.lastSpawned : 1000;
    //     const particlesToSpawn = Math.min((timePassed / 1000) * this.initialSettings.particlesPerSecond, deadParticlesCount);

    //     for (let i = 0; i < particlesToSpawn; i++)
    //         deadParticlePool[i].spawn({
    //             lifetime: this.generalSettings.lifetime,
    //             fading: this.fadingSettings,
    //             acceleration: this.generalSettings.acceleration,
    //             velocity: this.initialSettings.velocity,
    //             scale: this.initialSettings.scale,
    //             position: this.initialSettings.position,
    //             changesOverLifetime: this.changesOverLifetimeSettings,
    //             opacity: this.generalSettings.opacity,
    //             colorMultiplierRange: this.generalSettings.colorMultiplierRange
    //         });

    //     this.lastSpawned = currentTime;
    // }

    protected abstract initSettings(info: GD.EmitterConfig_T): void;
    protected abstract initParticleMesh(): THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>;
}

export default BaseEmitter;
export { BaseEmitter };

class Particle extends Object3D {
    protected readonly particleSystem: BaseEmitter;
    protected readonly visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>;

    public isAlive: boolean = false;
    public visible: boolean = false;
    public spin: number = 0;

    public bornTime: number;
    public deathTime: number;

    protected fadeIn: Fade_T;
    protected fadeOut: Fade_T;

    protected lastUpdate: number;

    protected _velocity = new Vector3();
    public get velocity(): Readonly<Vector3> { return this._velocity; }

    protected _oldLocation = new Vector3();
    public get oldLocation(): Readonly<Vector3> { return this._oldLocation; }

    protected acceleration = new Vector3();
    protected changesOverLifetime: ChangesOverTime_T;



    protected initial = {
        scale: new Vector3(),
        color: new Vector4(),
    };


    private constructor(particleSystem: BaseEmitter, visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>) {
        super();

        this.particleSystem = particleSystem;
        this.visualizer = visualizer;

        if ('particleRef' in this.visualizer) {
             (this.visualizer as any).particleRef = this;
        }

        this.add(visualizer);
    }

    static init(particleSystem: BaseEmitter, visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>): Particle {
        return new Particle(particleSystem, visualizer);
    }

    public update(currentTime: number) {
        if (!this.isAlive) return;

        if (currentTime >= this.deathTime) {
            this.kill();
            return;
        }

        const dtSeconds = (currentTime - this.lastUpdate) / 1000;
        const tmp = new Vector3();

        this._oldLocation.copy(this.position);

        tmp.copy(this.acceleration).multiplyScalar(0.5).multiplyScalar(dtSeconds ** 2);
        this.position.add(tmp);

        tmp.copy(this._velocity).multiplyScalar(dtSeconds);
        this.position.add(tmp);

        const timeAlive = currentTime - this.bornTime;
        const lifespan = this.deathTime - this.bornTime;


        const mats = this.visualizer.material instanceof Array ? this.visualizer.material : [this.visualizer.material];

        for (const mat of mats) {
            if (this.fadeIn && this.fadeIn.time > timeAlive) {
                const fade = mapLinear(timeAlive, 0, this.fadeIn.time, 0, 1);
                const [r, g, b, a] = this.fadeIn.color.toArray().map(v => v * fade);

                mat.color.setRGB(this.initial.color.x * r, this.initial.color.y * g, this.initial.color.z * b);
                mat.opacity = this.initial.color.w * a;
            } else if (this.fadeOut && this.fadeOut.time < timeAlive) {
                const fade = mapLinear(timeAlive, this.fadeOut.time, lifespan, 0, 1);
                const [r, g, b, a] = this.fadeOut.color.toArray().map(v => 1 - v * fade);

                mat.color.setRGB(this.initial.color.x * r, this.initial.color.y * g, this.initial.color.z * b);
                mat.opacity = this.initial.color.w * a;
            } else if (this.fadeIn || this.fadeOut) {
                mat.color.setRGB(this.initial.color.x, this.initial.color.y, this.initial.color.z);
                mat.opacity = this.initial.color.w;
            }
        }

        if (this.changesOverLifetime.scale) {
            const { times, values } = this.changesOverLifetime.scale;
            const timePassed = timeAlive / lifespan;

            let idxStart: number = -1;

            for (let i = 0; i < times.length - 1; i++) {
                if (times[i] > timePassed) break;

                idxStart = i;
            }

            const idxFinish = idxStart + 1;

            if (idxStart < 0)
                debugger;

            const startValue = values[idxStart];
            const finishValue = values[idxFinish];

            const size = mapLinear(timePassed, 0, 1, startValue, finishValue);

            this.scale.copy(this.initial.scale).multiplyScalar(size);

            // debugger;
        }

        this.lastUpdate = currentTime;
    }

    public kill() {
        this.isAlive = false;
        this.visible = false;
    }

    public spawn({ lifetime, fading: { fadeIn, fadeOut }, acceleration, velocity, scale, position, changesOverLifetime, opacity, colorMultiplierRange }: {
        lifetime: Range_T, fading: FadeSettings_T,
        acceleration: THREE.Vector3,
        velocity: Range3_T,
        position: Range3_T,
        scale: Range3_T,
        changesOverLifetime: ChangesOverTime_T,
        opacity: number,
        colorMultiplierRange: Range3_T
    }) {

        const now = this.bornTime = this.particleSystem.getCurrentTime();
        const lifespan = randRange(lifetime.min, lifetime.max);

        this.fadeIn = fadeIn;
        this.fadeOut = fadeOut;

        this.deathTime = now + lifespan;
        this.changesOverLifetime = changesOverLifetime;

        // randVector(this.scale, scale.min, scale.max);
        // randVector(this.velocity, velocity.min, velocity.max);
        // randVector(this.position, position.min, position.max);
        // randVector(this.initial.color as any as Vector3, colorMultiplierRange.min, colorMultiplierRange.max);

        const mats = this.visualizer.material instanceof Array ? this.visualizer.material : [this.visualizer.material];

        for (const mat of mats)
            mat.color.setRGB(this.initial.color.x, this.initial.color.y, this.initial.color.z);

        this.acceleration.copy(acceleration);
        this.initial.scale.copy(this.scale);
        this.initial.color.w = opacity;

        this._oldLocation.copy(this.position);

        this.lastUpdate = now;
        this.isAlive = true;

        this.update(now);

        this.visible = true;
    }
}

function randRange(min: number, max: number) { return Math.random() * (max - min) + min; }

function randVector(dst: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3) {
    dst.x = randRange(min.x, max.x);
    dst.y = randRange(min.y, max.y);
    dst.z = randRange(min.z, max.z);

    return dst;
}

function buildChangeRanges(ranges: { values: [number, number][], repeats: number }): { times: number[], values: number[] } {
    if (!ranges) return null;

    const repeats = ranges.repeats || 1;
    const totalSegments = ranges.values.length * repeats;

    const times = new Array<number>(totalSegments);
    const values = new Array<number>(totalSegments);

    let i = 0;
    for (let mul = 1; mul <= repeats; mul++) {
        for (const [it, v] of ranges.values) {
            const t = it / repeats * mul;

            times[i] = t;
            values[i] = v;

            i++;
        }
    }

    return { values, times };
}

type Range_T = { min: number; max: number; };
type Fade_T = { time: number; color: Vector4; };
type FadeSettings_T = { fadeIn: Fade_T; fadeOut: Fade_T; };
type Range3_T = { min: THREE.Vector3, max: THREE.Vector3 };
type ChangesOverTime_T = { scale?: { times: number[], values: number[] }; };

const __break__ = () => { debugger; throw new Error("dunno") };