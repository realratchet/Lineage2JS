import { Box3, Object3D, Vector3, Vector4 } from "three";
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
    protected initialSettings: { particlesPerSecond: number, position: { min: Vector3; max: Vector3; }, scale: { min: Vector3; max: Vector3; }; velocity: { min: Vector3; max: Vector3; }; angularVelocity: { min: Vector3; max: Vector3; }; };
    protected changesOverLifetimeSettings: ChangesOverTime_T;

    protected particlePool: Array<Particle>;

    protected currentTime: number;
    protected lastSpawned: number;

    public getCurrentTime() { return this.currentTime; }

    constructor(config: EmitterConfig_T) {
        super();

        this.fadingSettings = {
            fadeIn: config.fadeIn ? { time: config.fadeIn.time * 1000, color: new Vector4().fromArray(config.fadeIn.color || [1, 1, 1, 1]) } : null,
            fadeOut: config.fadeOut ? { time: config.fadeOut.time * 1000, color: new Vector4().fromArray(config.fadeOut.color || [1, 1, 1, 1]) } : null
        };

        this.generalSettings = {
            colorMultiplierRange: { min: new Vector3().fromArray(config.colorMultiplierRange?.min || [1, 1, 1]), max: new Vector3().fromArray(config.colorMultiplierRange?.max || [1, 1, 1]) },
            opacity: config.opacity || 1,
            maxParticles: 2 || config.maxParticles,
            acceleration: new Vector3().fromArray(config.acceleration || [0, 0, 0]),
            lifetime: { min: config.lifetime[0] * 1000, max: config.lifetime[1] * 1000 },
            particlesPerSecond: config.particlesPerSecond || 0
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
            angularVelocity: {
                min: new Vector3().fromArray(config.initial.angularVelocity?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.angularVelocity?.max || [1, 1, 1])
            }
        };

        Object.assign(this, config.allSettings);

        // this.maxParticles = 2;

        this.activeParticles = 0;
        this.particleIndex = 0;
        this.allParticlesDead = false;
        this.warmedUp = false;
        this.particles = new Array(this.maxParticles).fill(1).map(() => new Particle_T())
        this.RealMeshNormal = new Vector3().copy(this.meshNormal).normalize();

        this.maxActiveParticles = this.maxParticles;

        debugger;

        this.initSettings(config);

        this.particlePool = new Array(this.maxParticles);

        // console.log(this.generalSettings.acceleration);
        console.log(config);

        for (let i = 0; i < this.maxParticles; i++) {
            const particle = this.particlePool[i] = Particle.init(this, this.initParticleMesh());

            particle.name = this.name + "_" + i;
            particle.children[0].name = this.name + "_" + i + "_vis";

            this.add(particle);
        }
    }

    protected warmedUp: boolean;
    protected maxParticles: number;
    protected boundingBox = new Box3();
    protected addLocationFromOtherEmitter: number;
    protected addVelocityFromOtherEmitter: number;
    protected spawnFromOtherEmitter: number;
    protected rotateVelocityLossRange: boolean;
    protected realVelocityLossRange: Range3_T;
    protected velocityLossRange: Range3_T;
    protected rotationSource: any;

    protected RVLMin: THREE.Vector3;
    protected RVLMax: THREE.Vector3;
    protected RotationOffset: any;
    protected rotationNormal: any;

    protected skeletalMeshActor: any;
    protected useSkeletalLocationAs: any;

    protected activeParticles: number = 0;
    protected maxActiveParticles: number;
    protected isAutomaticInitialSpawning: boolean;

    protected lifetimeRange: any;
    protected initialParticlesPerSecond: number;
    protected particlesPerSecond: number;

    protected currentSpawnOnTrigger: number = 0;
    protected spawnOnTriggerPPS: number;

    protected killPending: boolean = false;

    protected ppsFraction: number = 0;

    protected deferredParticles: number = 0;
    protected particleIndex: number;

    protected coordinateSystem: any;
    protected particles: Particle_T[];

    protected isRespawningDeadParticles: boolean;
    protected initialTimeRange: Range_T;

    protected acceleration: THREE.Vector3;
    protected skeletalScale: THREE.Vector3;
    protected meshVertsAndNormals = new Array<THREE.Vector3>();

    protected isUsingRevolution: boolean;
    protected isUsingCollision: boolean;
    protected RealExtentMultiplier: any;

    protected isUsingCollisionPlanes: boolean;
    protected CollisionPlanes: THREE.Vector4[];

    protected CollisionSound: any;
    protected CurrentCollisionSoundIndex: number;
    protected CollisionSoundIndex: Range_T;

    protected SpawnAmount: number;

    protected sounds: any[];
    protected CollisionSoundProbability: Range3_T;

    protected isUsingSpawnedVelocityScale: boolean;
    protected SpawnedVelocityScaleRange: Range3_T;

    protected UseMaxCollisions: boolean;
    protected MaxCollisions: Range_T;

    protected DampingFactorRange: Range3_T;

    protected DampRotation: boolean;
    protected RotationDampingFactorRange: Range3_T;

    protected isScaleSizeRegular: boolean;
    protected isUsingSizeScale: boolean;
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

    protected maxAbsVelocity: THREE.Vector3;
    protected MinSquaredVelocity: number;
    protected maxSizeScale: number;

    protected allParticlesDead: boolean;

    protected startLocationShape: any;
    protected startLocationOffset: THREE.Vector3;
    protected startVelocityRange: Range3_T;
    protected startLocationRange: any;
    protected sphereRadiusRange: any;
    protected startLocationPolarRange: any;

    protected meshSpawning: any;
    protected MeshSpawningStaticMesh: THREE.Mesh;

    protected CurrentMeshSpawningIndex: number;
    protected SpawnOnlyInDirectionOfNormal: boolean;

    protected RealMeshNormal: any;
    protected MeshNormalThresholdRange: Range_T;

    protected MeshScaleRange: Range3_T;
    protected UniformMeshScale: boolean;

    protected isVelocityFromMesh: boolean;
    protected VelocityScaleRange: Range3_T;
    protected UniformVelocityScale: boolean;

    protected isUsingColorFromMesh: boolean;

    protected RelativeBoneIndexRange: Range_T;
    protected otherIndex: number = 0;

    protected effectAxis: any;

    protected revolutionCenterOffsetRange: Range3_T;
    protected revolutionsPerSecondRange: Range3_T;

    protected globalOffset = new Vector3();
    protected colorMultiplierRange: Range3_T;

    protected startMassRange: Range3_T;
    protected startSizeRange: Range3_T;

    protected getVelocityDirectionFrom: any;

    protected isUniformScale: any;
    protected StartVelocityRadialRange: Range3_T;

    protected addVelocityFromOwner: boolean;
    protected addVelocityMultiplierRange: Range3_T;

    protected ScaleSizeByVelocityMax: number;

    protected StartSpin: number;
    protected SpinsPerSecond: number;

    protected startSpinRange: Range3_T;
    protected spinsPerSecondRange: Range3_T;

    protected clockwiseSpinChance: THREE.Vector3;

    protected isUsingRandomSubdiv: boolean;
    protected subdivStart: number;
    protected subdivEnd: number;

    protected texSubdivU: number;
    protected texSubdivV: number;

    protected spawningSound: number;

    protected CurrentSpawningSoundIndex: number;
    protected spawningSoundIndex: Range_T;

    protected SpawningSoundProbability: Range_T;
    protected isDisabled: boolean;
    protected meshNormal: THREE.Vector3;

    protected updateParticle(deltaTime: number, index: number) {
        // only trail emitters use this apparently
    }

    protected spawnParticle(index: number, spawnTime: number, flags: number = 0, spawnFlags: number = 0, localLocationOffset = new Vector3(0, 0, 0)) {
        // debugger;
        const Owner = this.parent;

        if (!this.maxParticles || !Owner || this.killPending || (this.lifetimeRange.Max <= 0))
            return;

        const ownerLocation = () => new Vector3().set(Owner.position.x, Owner.position.z, Owner.position.y);
        const oldOwnerLocation = () => ownerLocation();

        // debugger;

        const Particle = this.particles[index];

        Particle.position.copy(this.startLocationOffset);
        Particle.Velocity.copy(this.startVelocityRange.rand());

        // Handle Shape.
        const ApplyAll = this.startLocationShape.valueOf() === PTLS_All;
        if (ApplyAll || this.startLocationShape.valueOf() === PTLS_Box)
            Particle.position.add(this.startLocationRange.rand());
        if (ApplyAll || this.startLocationShape.valueOf() === PTLS_Sphere)
            Particle.position.add(new Vector3().randomDirection().multiplyScalar(this.sphereRadiusRange.rand()));
        if (ApplyAll || this.startLocationShape.valueOf() === PTLS_Polar) {
            __break__();
            const Polar = this.startLocationPolarRange.rand();
            let X, Y, Z;
            X = Polar.Z * Math.cos(Polar.X * Math.PI / 32768) * Math.sin(Polar.Y * Math.PI / 32768);
            Y = Polar.Z * Math.sin(Polar.X * Math.PI / 32768) * Math.sin(Polar.Y * Math.PI / 32768);
            Z = Polar.Z * Math.cos(Polar.Y * Math.PI / 32768);
            Particle.position.add(new Vector3(X, Y, Z));
        }

        // Handle spawning from mesh.
        Particle.ColorMultiplier.set(1, 1, 1);
        if ((this.meshSpawning.valueOf() !== PTMS_None) && this.MeshSpawningStaticMesh) {
            __break__();
            let MaxIndex = this.MeshSpawningStaticMesh.geometry.getAttribute("position").count;
            if (MaxIndex > 0) {
                let VertexIndex = (this.meshSpawning == PTMS_Linear) ? this.CurrentMeshSpawningIndex++ : (Math.trunc(Math.random() * MaxIndex));
                VertexIndex %= MaxIndex;
                VertexIndex = clamp(VertexIndex, 0, MaxIndex);

                let attrPositions = this.MeshSpawningStaticMesh.geometry.getAttribute("position");
                let attrNormals = this.MeshSpawningStaticMesh.geometry.getAttribute("normal");

                if (this.SpawnOnlyInDirectionOfNormal) {

                    let Normal = new Vector3().fromBufferAttribute(attrNormals, VertexIndex);
                    if ((Normal.dot(this.RealMeshNormal)) < (1 - 2 * this.MeshNormalThresholdRange.GetRand())) {
                        Particle.Flags &= ~PTF_Active;
                        return;
                    }
                }


                let LocationScale = this.MeshScaleRange.GetRand();
                let Location = new Vector3().fromBufferAttribute(attrPositions, VertexIndex);
                Particle.position.add(this.UniformMeshScale ? Location.multiplyScalar(LocationScale.X) : Location.multiply(LocationScale));

                if (this.isVelocityFromMesh) {
                    let VelocityScale = this.VelocityScaleRange.GetRand();
                    let Velocity = new Vector3().fromBufferAttribute(attrNormals, VertexIndex);
                    Particle.Velocity.add(this.UniformVelocityScale ? Velocity.multiplyScalar(VelocityScale.X) : Velocity.multiply(VelocityScale));
                }

                if (this.isUsingColorFromMesh) {
                    let attrColors = this.MeshSpawningStaticMesh.geometry.getAttribute("color");

                    let Color = new Vector3().fromBufferAttribute(attrColors, VertexIndex);
                    Particle.ColorMultiplier.x = Color.x;
                    Particle.ColorMultiplier.y = Color.y;
                    Particle.ColorMultiplier.z = Color.z;
                }
            }
        }

        // debugger;

        // Handle Skeletal mesh spawning.
        let NumBones = Math.round(this.meshVertsAndNormals.length / 2);
        if (this.useSkeletalLocationAs.valueOf() !== PTSU_None && NumBones) {
            __break__();
            Particle.BoneIndex = clamp(Math.trunc(this.RelativeBoneIndexRange.rand() * NumBones), 0, NumBones - 1);
            Particle.OldMeshLocation.copy(this.meshVertsAndNormals[Particle.BoneIndex * 2].clone().multiply(this.skeletalScale));
            Particle.position.add(Particle.OldMeshLocation);
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
                Particle.position.copy(Particle.position.TransformVectorBy(GMath.UnitCoords * Owner.Rotation * this.RotationOffset));
                break;
            case PTRS_Offset:
                __break__();
                Particle.position.copy(Particle.position.TransformVectorBy(GMath.UnitCoords * this.RotationOffset));
                break;
            case PTRS_Normal:
                __break__();
                {
                    let Rotator = this.rotationNormal.Rotation();
                    // Map Z to -X if effect was created along the Z axis instead of negative X
                    if (this.effectAxis.valueOf() === PTEA_PositiveZ)
                        Rotator.Pitch -= 16384;
                    Particle.position.copy(Particle.position.TransformVectorBy(GMath.UnitCoords * Rotator));
                }
                break;
        }

        Particle.RevolutionCenter.copy(this.revolutionCenterOffsetRange.rand());
        Particle.RevolutionsPerSecond.copy(this.revolutionsPerSecondRange.rand());

        if (this.coordinateSystem.valueOf() === PTCS_Independent) {
            if (!(spawnFlags & PSF_NoOwnerLocation))
                Particle.position.add(ownerLocation());
            Particle.RevolutionCenter.add(ownerLocation());
        }

        if (!(spawnFlags & PSF_NoGlobalOffset))
            Particle.position.add(this.globalOffset);

        Particle.position.add(localLocationOffset);

        Particle.OldLocation.copy(Particle.position);
        Particle.StartLocation.copy(Particle.position);
        Particle.ColorMultiplier.multiply(this.colorMultiplierRange.rand());
        Particle.MaxLifetime = this.lifetimeRange.rand();
        Particle.Time = spawnTime + this.initialTimeRange.rand();
        Particle.HitCount = 0;
        Particle.Flags = PTF_Active | flags;
        Particle.Mass = this.startMassRange.rand();
        Particle.StartSize.copy(this.startSizeRange.rand());
        if (this.isUniformScale) {
            Particle.StartSize.y = Particle.StartSize.x;
            Particle.StartSize.z = Particle.StartSize.x;
        }
        Particle.scale.copy(Particle.StartSize);
        Particle.Velocity.add(this.acceleration.clone().multiplyScalar(spawnTime));
        Particle.VelocityMultiplier.set(1, 1, 1);
        Particle.RevolutionsMultiplier.set(1, 1, 1);

        // Adjust velocity.
        switch (this.rotationSource.valueOf()) {
            case PTRS_Actor:
                __break__();
                Particle.Velocity.copy(Particle.Velocity.TransformVectorBy(GMath.UnitCoords * Owner.Rotation * this.RotationOffset));
                break;
            case PTRS_Offset:
                __break__();
                Particle.Velocity.copy(Particle.Velocity.TransformVectorBy(GMath.UnitCoords * this.RotationOffset));
                break;
            case PTRS_Normal:
                __break__();
                Particle.Velocity.copy(Particle.Velocity.TransformVectorBy(GMath.UnitCoords * this.rotationNormal.Rotation()));
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
                    Particle.Velocity.add(this.StartVelocityRadialRange.rand().multiply(Direction));
                    break;
                default:
                    break;
            }
        }


        if (this.addVelocityFromOwner && this.coordinateSystem.valueOf() !== PTCS_Relative)
            __break__() && Particle.Velocity.add(this.addVelocityMultiplierRange.rand().multiply(Owner.AbsoluteVelocity));

        if (this.addVelocityFromOtherEmitter >= 0) {
            __break__();
            let OtherEmitter = Owner.Emitters[this.addVelocityFromOtherEmitter];
            if (OtherEmitter.ActiveParticles > 0)
                Particle.Velocity.add(this.addVelocityMultiplierRange.rand().multiply(OtherEmitter.Particles[this.otherIndex % OtherEmitter.ActiveParticles].Velocity));
        }

        // Location.
        Particle.position.add(Particle.Velocity.multiplyScalar(spawnTime));

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

        Particle.StartSpin.copy(this.startSpinRange.rand());
        Particle.SpinsPerSecond.copy(this.spinsPerSecondRange.rand());

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

            SoundIndex %= Math.trunc(this.spawningSoundIndex.Size() ? this.spawningSoundIndex.Size() + 1 : this.sounds.length);
            SoundIndex += Math.trunc(this.spawningSoundIndex.GetMin());
            SoundIndex = clamp(SoundIndex, 0, this.sounds.length - 1);

            if (Math.random() <= (this.sounds[SoundIndex].Probability.GetRand() * this.SpawningSoundProbability.GetRand()))
                Owner.GetLevel().Engine.Audio.PlaySound(Owner, SLOT_None, this.sounds[SoundIndex].Sound, Particle.position, Owner.TransientSoundVolume * this.sounds[SoundIndex].Volume.GetRand(), this.sounds[SoundIndex].Radius.GetRand(), this.sounds[SoundIndex].Pitch.GetRand(), SF_NoUpdates, 0);
        }

        // Make sure we get ticked.
        this.allParticlesDead = false;
    }

    protected spawnParticles(oldLeftover: number, rate: number, deltaTime: number) {
        const Owner = this.parent;

        if (rate <= 0 || !Owner)
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
            this.particleIndex = (this.particleIndex + 1) % this.maxActiveParticles;
        }

        return newLeftover;
    }

    protected updateParticles(deltaTime: number) {
        const Owner = this.parent;

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
        if (this.activeParticles < this.maxActiveParticles) {
            // Either spawn them continously...
            if (this.isAutomaticInitialSpawning) {
                rate = this.maxActiveParticles / this.lifetimeRange.mid();
            }
            // ... or at a fixed rate.
            else {
                rate = this.initialParticlesPerSecond;
            }
        }
        else {
            rate = this.particlesPerSecond; //!! TODO: PPSLightFactor
            //Rate = ParticlesPerSecond * PPSLightFactor * LightBrightness / 255.f;
        }

        // Spawning on trigger.
        if (this.currentSpawnOnTrigger)
            rate += this.spawnOnTriggerPPS;

        // Actually spawn them.
        if (rate > 0 && !this.killPending)
            this.ppsFraction = this.spawnParticles(this.ppsFraction, rate, deltaTime);

        const ownerLocation = () => new Vector3().set(Owner.position.x, Owner.position.z, Owner.position.y);
        const oldOwnerLocation = () => ownerLocation();

        let Percent = 0;
        let bInterpolate = oldOwnerLocation().distanceTo(ownerLocation()) > 1;

        // Deferred spawning.
        if (!this.killPending) {

            let Amount = clamp(this.deferredParticles, 0, this.maxActiveParticles);

            for (let i = 0; i < Amount; i++) {
                debugger;
                this.spawnParticle(this.particleIndex, 0);

                // Laurent -- Location interpolation
                if (bInterpolate && this.coordinateSystem.valueOf() == PTCS_Independent) {
                    Percent = 1 - (i + 1) / Amount;

                    this.particles[this.particleIndex].position.add((oldOwnerLocation().clone().sub(ownerLocation())).multiplyScalar(Percent));
                }

                this.activeParticles = Math.max(this.activeParticles, this.particleIndex + 1);
                this.particleIndex = (this.particleIndex + 1) % this.maxActiveParticles;
            }
            this.deferredParticles = 0;
        }

        // Laurent -- Count particles to respawn for interpolation
        let PtclRespawnCount = 0;
        let PtclRespawnIndex = 0;

        for (let Index = 0; Index < Math.min(this.maxActiveParticles, this.activeParticles); Index++) {
            let Particle = this.particles[Index];

            if (!(Particle.Flags & PTF_Active))
                continue;

            // Don't tick particle if it just got spawned via initial spawning.
            if (!(Particle.Flags & PTF_InitialSpawn))
                Particle.Time += deltaTime;

            if (Particle.Time > Particle.MaxLifetime) {
                if (!this.isRespawningDeadParticles)
                    continue;

                PtclRespawnCount++;
            }
        }

        let MaxVelocityScale = 1;
        let OneOverDeltaTime = 1 / clamp(deltaTime, 0.001, 0.15);

        // Only particles 0..Min(MaxActiveParticles, ActiveParticles) are active.
        for (let index = 0; index < Math.min(this.maxActiveParticles, this.activeParticles); index++) {
            let Particle = this.particles[index];

            if (!(Particle.Flags & PTF_Active)) {
                DeadParticles++;
                continue;
            }
            // Don't tick particles with PTF_NoTick
            let TickParticle = !(Particle.Flags & PTF_NoTick) || (this.coordinateSystem.valueOf() === PTCS_Relative);
            // Don't tick particle if it just got spawned via initial spawning.
            if (Particle.Flags & PTF_InitialSpawn) {
                TickParticle = false;
                Particle.Flags &= ~PTF_InitialSpawn;
            }
            //else
            //	Particle.Time += DeltaTime;

            if (Particle.Time > Particle.MaxLifetime) {
                if (!this.isRespawningDeadParticles) {
                    Particle.Flags &= ~PTF_Active;
                    DeadParticles++;
                    continue;
                }
                let NewTime = Particle.Time - Particle.MaxLifetime + this.initialTimeRange.rand();
                if (Particle.MaxLifetime)
                    NewTime = NewTime % Particle.MaxLifetime;
                else
                    NewTime = 0;

                this.spawnParticle(index, NewTime);

                // Laurent -- Location interpolation
                if (bInterpolate && this.coordinateSystem.valueOf() === PTCS_Independent) {
                    __break__();
                    Percent = 1 - (PtclRespawnIndex + 1) / PtclRespawnCount;

                    this.particles[index].Location += Percent * (Owner.OldLocation - Owner.Location);
                }
                PtclRespawnIndex++;
            }
            else if (TickParticle) {
                Particle.Velocity.add(this.acceleration.clone().multiplyScalar(deltaTime));
                Particle.OldLocation.copy(Particle.position);
                Particle.position.add(Particle.Velocity.clone().multiply(Particle.VelocityMultiplier).multiplyScalar(deltaTime));

                // if (index === 0)
                //     console.log(index, Particle.StartLocation.distanceTo(Particle.position), Particle.MaxLifetime - Particle.Time)

                if (numBones && this.useSkeletalLocationAs.valueOf() === PTSU_Location) {
                    const NewMeshLocation = this.meshVertsAndNormals[Particle.BoneIndex * 2].clone().multiply(this.skeletalScale);
                    Particle.position.add(NewMeshLocation.clone().sub(Particle.OldMeshLocation));
                    Particle.OldMeshLocation.copy(NewMeshLocation);
                }

                if (this.isUsingRevolution) {
                    __break__();
                    let RevolutionCenter = Particle.RevolutionCenter;
                    let Location = Particle.Location - RevolutionCenter;
                    Location = Location.RotateAngleAxis(Math.trunc(Particle.RevolutionsPerSecond.X * Particle.RevolutionsMultiplier.X * deltaTime * 0xFFFF), new Vector3(1, 0, 0));
                    Location = Location.RotateAngleAxis(Math.trunc(Particle.RevolutionsPerSecond.Y * Particle.RevolutionsMultiplier.Y * deltaTime * 0xFFFF), new Vector3(0, 1, 0));
                    Location = Location.RotateAngleAxis(Math.trunc(Particle.RevolutionsPerSecond.Z * Particle.RevolutionsMultiplier.Z * deltaTime * 0xFFFF), new Vector3(0, 0, 1));
                    Particle.Location = Location + RevolutionCenter;
                }
            }

            // Colission detection.
            let Collided = false;
            let HitNormal = new Vector3(0, 0, 0);
            let HitLocation = new Vector3(0, 0, 0);
            if (TickParticle && (this.coordinateSystem.valueOf() !== PTCS_Relative)) {
                if (this.isUsingCollision) {
                    __break__();
                    let Hit: any;
                    let Direction = (Particle.Location - Particle.OldLocation).SafeNormal() * this.RealExtentMultiplier * Particle.Size;
                    // JG: This was TRACE_AllBlocking, but this seems a better default... 
                    // Should pass in flags for this.
                    if (!Owner.GetLevel().SingleLineCheck(
                        Hit,
                        Owner,
                        Particle.Location + Direction,
                        Particle.OldLocation,
                        TRACE_LevelGeometry | TRACE_Level
                    )
                    ) {
                        HitNormal = Hit.Normal;
                        HitLocation = Hit.Location - Direction;
                        Collided = true;
                    }
                }
                if (this.isUsingCollisionPlanes && !Collided) {
                    __break__();
                    for (let i = 0; i < this.CollisionPlanes.length; i++) {
                        let Plane = this.CollisionPlanes[i];
                        if (Math.sign(Plane.PlaneDot(Particle.Location)) != Math.sign(Plane.PlaneDot(Particle.OldLocation))) {
                            HitLocation = FLinePlaneIntersection(Particle.Location, Particle.OldLocation, Plane);
                            HitNormal = Plane;
                            Collided = true;
                            break;
                        }
                    }
                }
            }

            // Handle collided particle.
            if (Collided) {
                __break__();
                // Play sound on collision
                if ((this.CollisionSound != PTSC_None) && Owner.GetLevel().Engine.Audio) {
                    let SoundIndex = 0;
                    switch (this.CollisionSound) {
                        case PTSC_LinearGlobal:
                            SoundIndex = this.CurrentCollisionSoundIndex++;
                            break;
                        case PTSC_LinearLocal:
                            SoundIndex = Particle.HitCount;
                            break;
                        case PTSC_Random:
                            SoundIndex = Math.trunc(1000 * Math.random());
                            break;
                    }

                    SoundIndex %= Math.trunc(this.CollisionSoundIndex.Size() ? this.CollisionSoundIndex.Size() + 1 : this.sounds.length);
                    SoundIndex += Math.trunc(this.CollisionSoundIndex.min);
                    SoundIndex = clamp(SoundIndex, 0, this.sounds.length - 1);

                    if (Math.random() <= (this.sounds[SoundIndex].Probability.GetRand() * this.CollisionSoundProbability.GetRand()))
                        Owner.GetLevel().Engine.Audio.PlaySound(Owner, SLOT_None, this.sounds[SoundIndex].Sound, HitLocation, Owner.TransientSoundVolume * Sounds(SoundIndex).Volume.GetRand(), this.sounds[SoundIndex].Radius.GetRand(), this.sounds[SoundIndex].Pitch.GetRand(), SF_NoUpdates, 0);
                }

                // Spawn particle in another emitter on collision.
                if (this.spawnFromOtherEmitter >= 0) {
                    let OtherEmitter = Owner.Emitters[this.spawnFromOtherEmitter];
                    if (OtherEmitter.Initialized && OtherEmitter.Owner && deltaTime) {
                        for (let i = 0; i < this.SpawnAmount; i++) {
                            OtherEmitter.SpawnParticle(OtherEmitter.ParticleIndex, deltaTime, 0, PSF_NoGlobalOffset | PSF_NoOwnerLocation, HitLocation + HitNormal * 0.01);
                            if (this.isUsingSpawnedVelocityScale) {
                                let OtherParticle = OtherEmitter.Particles[OtherEmitter.ParticleIndex];
                                OtherParticle.Velocity += HitNormal * this.SpawnedVelocityScaleRange.GetRand();
                            }
                            OtherEmitter.ActiveParticles = Math.max(OtherEmitter.ActiveParticles, OtherEmitter.ParticleIndex + 1);
                            OtherEmitter.ParticleIndex = (OtherEmitter.ParticleIndex + 1) % OtherEmitter.MaxActiveParticles;
                        }
                    }
                }

                // Update.
                if (this.UseMaxCollisions && (Particle.HitCount + 1 >= Math.trunc(this.MaxCollisions.GetRand()))) {
                    if (this.isRespawningDeadParticles)
                        this.spawnParticle(index, 0.5 * deltaTime); //!! HACK
                    else {
                        Particle.Flags &= ~PTF_Active;
                        DeadParticles++;
                        continue;
                    }
                }
                else {
                    Particle.Velocity -= this.acceleration * deltaTime * 0.5; //!! HACK
                    Particle.Velocity = Particle.Velocity.MirrorByVector(HitNormal);
                    Particle.Velocity *= this.DampingFactorRange.GetRand();
                    if (this.DampRotation)
                        Particle.SpinsPerSecond *= this.RotationDampingFactorRange.GetRand();
                    Particle.Location = HitLocation + HitNormal * 0.01;
                    Particle.OldLocation = Particle.Location;
                    ++Particle.HitCount;
                }
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
            Particle.scale.copy(Particle.StartSize.clone().multiplyScalar(TimeFactor));

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
                            let Multiplier = lerp(V1, V2, A);
                            Particle.VelocityMultiplier.copy(Multiplier);
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
                            let Multiplier = lerp(V1, V2, A);
                            Particle.RevolutionsMultiplier.copy(Multiplier);
                            break;
                        }
                    }
                }
            }

            // Color scaling.
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
                        Color.x = lerp(C1.x, C2.x, A);
                        Color.y = lerp(C1.y, C2.y, A);
                        Color.z = lerp(C1.z, C2.z, A);
                        if (this.drawStyle.valueOf() === PTDS_AlphaBlend)
                            Color.w = lerp(C1.w, C2.w, A);
                        else
                            Color.w = 1;

                        break;
                    }
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
                        1 - this.FadeFactor * MaxFade.w
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
            Particle.Velocity.sub(Particle.Velocity.clone().multiply(this.realVelocityLossRange.rand()).multiplyScalar(deltaTime));

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
        if (this.scaleSizeXByVelocity || this.scaleSizeXByVelocity || this.scaleSizeXByVelocity) {
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

        // Ugh, this is getting ugly. Subtle assumptions because of indirect spawning.
        if ((DeadParticles >= this.maxActiveParticles || this.activeParticles === DeadParticles) && rate == 0 && !this.isRespawningDeadParticles)
            this.allParticlesDead = true;
        else
            this.allParticlesDead = false;

        return this.activeParticles - DeadParticles;
    }

    public update(currentTime: number) {
        if (currentTime === 0) return;

        // if (this.name !== "Exp_SpriteEmitter3" || this.parent.name !== "Exp_Emitter7") return;

        // if (this.isDisabled)
        //     return;


        if (this.currentTime === undefined) this.currentTime = currentTime;
        else this.updateParticles(1 / 120 /*(currentTime - this.currentTime) / 1000*/);

        this.particlePool.forEach((p, i) => {
            const settings = this.particles[i];

            p.visible = true;
            p.position.set(settings.position.x, settings.position.z, settings.position.y).multiplyScalar(1);
            p.scale.set(settings.scale.x, settings.scale.z, settings.scale.y);


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

    protected abstract initSettings(info: EmitterConfig_T): void;
    protected abstract initParticleMesh(): THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>;
}

export default BaseEmitter;
export { BaseEmitter };

class Particle extends Object3D {
    protected readonly particleSystem: BaseEmitter;
    protected readonly visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial>;

    public isAlive: boolean = false;
    public visible: boolean = false;

    public bornTime: number;
    public deathTime: number;

    protected fadeIn: Fade_T;
    protected fadeOut: Fade_T;

    protected lastUpdate: number;

    protected velocity = new Vector3();
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

        tmp.copy(this.acceleration).multiplyScalar(0.5).multiplyScalar(dtSeconds ** 2);
        this.position.add(tmp);

        tmp.copy(this.velocity).multiplyScalar(dtSeconds);
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