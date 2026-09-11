import { Box3, Matrix4, Object3D, Quaternion, Vector3, Vector4 } from "three";
import { clamp, lerp, mapLinear } from "three/src/math/MathUtils";
import InstancedSpriteMesh from "./instanced-sprite-mesh";
import { isOrderIndependentAdditive } from "./instanced-sprite-batcher";
import type { ParticleMaterial, ParticleMaterialInitSettings_T } from "../../materials/particle-material/particle-material";
import type { IParticleSoundDecodeInfo, EmitterConfig_T } from "@l2js/engine/contracts/emitter";

const frozenUpdateMatrixWorld = function () { };

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const ZERO_VECTOR3 = new Vector3();
const ONE_VECTOR3 = new Vector3(1, 1, 1);
const ONE_VECTOR4 = new Vector4(1, 1, 1, 1);
const tmpPhysicsVector = new Vector3();
const tmpPhysicsVector2 = new Vector3();
const tmpCurrentAcceleration = new Vector3();
const tmpOwnerOffset = new Vector3();
const tmpWorldToLocal = new Matrix4();
const tmpWorldRotation = new Matrix4();
const tmpFadeColor = new Vector4();
const tmpParticleQuaternion = new Quaternion();
const tmpBoxExpand = new Vector3();
const tmpSoundWorldPos = new Vector3();
const tmpVelocityLossRange: Range3_T = { min: new Vector3(), max: new Vector3() };

const tmpSubdivUV: [number, number, number, number] = [0, 0, 1, 1];


class Particle_T {
    public readonly position = new Vector3();
    public readonly oldLocation = new Vector3();
    public readonly velocity = new Vector3();
    public readonly startSize = new Vector3();
    public readonly spinsPerSecond = new Vector3();
    public readonly startSpin = new Vector3();
    public readonly revolutionCenter = new Vector3();
    public readonly revolutionsPerSecond = new Vector3();
    public readonly revolutionsMultiplier = new Vector3();
    public readonly scale = new Vector3();
    public readonly startLocation = new Vector3();
    public readonly colorMultiplier = new Vector3();
    public readonly velocityMultiplier = new Vector3();
    public readonly oldMeshLocation = new Vector3();
    public readonly color = new Vector4();
    public time: number = 0;
    public maxLifetime: number = 0;
    public mass: number = 0;
    public hitCount: number = 0;
    public flags: number = 0;
    public subdivision: number = 0;
    public boneIndex: number = 0;
}

enum EParticleFlags_T {
    PTF_None = 0,
    PTF_Active = 1,
    PTF_NoTick = 2,
    PTF_InitialSpawn = 4
}

enum EParticleSpawnFlags_T {
    PSF_None = 0,
    PSF_NoGlobalOffset = 1,
    PSF_NoOwnerLocation = 2
}

type CoordinateSystem_T = "independent" | "relative" | "absolute" | "relativeRotation" | "spray";
type EffectAxis_T = "negativeX" | "positiveZ";
type MeshSpawning_T = "none" | "linear" | "random";
type RotationSource_T = "none" | "actor" | "offset" | "normal";
type SkeletalLocationUse_T = "none" | "spawnOffset" | "location";
type CollisionSound_T = "none" | "linearGlobal" | "linearLocal" | "random";
type VelocityDirection_T = "none" | "startPositionAndOwner" | "ownerAndStartPosition" | "addRadial";
type StartLocationShape_T = "box" | "sphere" | "polar" | "all";
type DrawStyle_T = "normal" | "alpha" | "modulate" | "translucent" | "alphaModulate" | "darken" | "brighten";

export abstract class BaseEmitter extends Object3D {
    protected readonly isUpdatable = true;

    public warmupGate: boolean = true; // set false by PhysicsManager while a sector's higher-priority tiers are still loading
    public readonly pendingSounds: PendingEmitterSound_T[] = []; // spawning-sound requests queued by spawnParticle(), drained by RenderManager each frame

    protected fadingSettings: FadeSettings_T;
    protected generalSettings: { colorMultiplierRange: Range3_T, opacity: number, maxParticles: number; acceleration: THREE.Vector3; lifetime: Range_T; particlesPerSecond: number };
    protected initialSettings: { particlesPerSecond: number, position: { min: THREE.Vector3; max: THREE.Vector3; }, offset: THREE.Vector3, scale: { min: THREE.Vector3; max: THREE.Vector3; }; velocity: { min: THREE.Vector3; max: THREE.Vector3; }; angularVelocity: { min: THREE.Vector3; max: THREE.Vector3; }; };
    protected changesOverLifetimeSettings: ChangesOverTime_T;

    protected particlePool: Array<Particle>;
    protected tmpVec = new Vector3();

    protected currentTime: number;
    protected lastSpawned: number;
    protected isSpinning: boolean;
    protected isSpriteEmitter: boolean = false;
    protected spinParticles: boolean;
    protected secondsBeforeInactive: number;

    protected isInstancedRendering: boolean = false;
    protected instancedMesh: InstancedSpriteMesh | null = null;
    protected material: ParticleMaterialInitSettings_T;

    protected warmedUp: boolean;
    protected warmupTime: number;
    protected warmupTicksPerSecond: number;
    protected maxParticles: number;
    protected boundingBox = new Box3();
    public worldParticleExtent: number = 0;
    protected particleGeometryRadius: number = 1;
    protected drawScale: number = 1;
    protected addLocationFromOtherEmitter: number;
    protected addVelocityFromOtherEmitter: number;
    protected spawnFromOtherEmitter: number;
    protected rotateVelocityLossRange: boolean;
    protected realVelocityLossRange: Range3_T;
    protected velocityLossRange: Range3_T;
    protected rotationSource: RotationSource_T;

    protected rotationOffset = new Quaternion();
    protected rotationNormal: THREE.Vector3;

    protected skeletalMeshActor: any; // UE Actor reference, never resolved by the decoder
    protected useSkeletalLocationAs: SkeletalLocationUse_T;

    protected oldOwnerLocation: THREE.Vector3;
    protected lastDeltaTime: number = 0.016;
    protected activeParticles: number = 0;
    protected activeCount: number = 0;
    protected maxActiveParticles: number;
    protected isAutomaticInitialSpawning: boolean;

    protected lifetimeRange: { min: number, max: number };
    protected initialParticlesPerSecond: number;
    protected particlesPerSecond: number;

    protected currentSpawnOnTrigger: number = 0;
    protected spawnOnTriggerPPS: number;

    protected killPending: boolean = false;

    protected ppsFraction: number = 0;

    protected deferredParticles: number = 0;
    protected particleIndex: number;

    protected coordinateSystem: CoordinateSystem_T;
    protected particles: Particle_T[];
    protected isRespawningDeadParticles: boolean;
    protected forcedLifeTime: boolean = false;
    protected forcedFade: boolean = false;
    protected forcedMaxParticles: boolean = false;
    protected initialTimeRange: { min: number, max: number };
    protected initialDelayRange: { min: number, max: number };
    protected initialDelay: number = null;

    protected acceleration: THREE.Vector3;
    protected skeletalScale: THREE.Vector3;
    protected meshVertsAndNormals = new Array<THREE.Vector3>();

    protected isUsingRevolution: boolean;
    protected isUsingCollision: boolean;
    protected isUsingCollisionPlanes: boolean;
    protected isUsingSizeScale: boolean;
    protected isScaleSizeRegular: boolean;
    protected maxAbsVelocity: THREE.Vector3;
    protected startMassRange: { min: number, max: number };
    protected meshNormal: THREE.Vector3;
    protected meshNormalThresholdRange: Range_T;
    protected meshScaleRange: Range3_T;
    protected meshSpawning: MeshSpawning_T;
    protected meshSpawningStaticMesh: THREE.Mesh;
    protected isVelocityFromMesh: boolean;
    protected velocityScaleRange: Range3_T;
    protected isUsingColorFromMesh: boolean;
    protected isUniformMeshScale: boolean;
    protected isUniformVelocityScale: boolean;
    protected addVelocityMultiplierRange: Range3_T;
    protected globalOffset = new Vector3();
    protected relativeBoneIndexRange: Range_T;
    protected effectAxis: EffectAxis_T;
    protected revolutionCenterOffsetRange: Range3_T;
    protected revolutionsPerSecondRange: Range3_T;
    protected colorMultiplierRange: Range3_T;
    protected startSizeRange: Range3_T;
    protected isUniformScale: boolean;
    protected startVelocityRadialRange: Range_T;
    protected addVelocityFromOwner: boolean;
    protected scaleSizeByVelocityMax: number;
    protected startSpinRange: Range3_T;
    protected spinsPerSecondRange: Range3_T;
    protected clockwiseSpinChance: THREE.Vector3;
    protected isUsingRandomSubdiv: boolean;
    protected subdivStart: number;
    protected subdivEnd: number;
    protected texSubdivU: number;
    protected texSubdivV: number;
    protected spawningSound: CollisionSound_T;
    protected spawningSoundIndex: Range_T;
    protected spawningSoundProbability: Range_T;
    protected isDisabled: boolean;

    protected realExtentMultiplier: any; // unused - never populated from decode data, no shape to confirm
    protected collisionPlanes: THREE.Vector4[];
    protected collisionSound: CollisionSound_T;
    protected currentCollisionSoundIndex: number;
    protected collisionSoundIndex: Range_T;
    protected spawnAmount: number;
    protected sounds: IParticleSoundDecodeInfo[];
    protected collisionSoundProbability: Range_T;
    protected isUsingSpawnedVelocityScale: boolean;
    protected spawnedVelocityScaleRange: Range3_T;
    protected useMaxCollisions: boolean;
    protected maxCollisions: Range_T;
    protected dampingFactorRange: Range3_T;
    protected dampRotation: boolean;
    protected rotationDampingFactorRange: Range3_T;
    protected useAbsoluteTimeForSizeScale: boolean;
    protected sizeScaleRepeats: number;
    protected sizeScale: { relTime: number, relSize: number }[];
    protected isUsingVelocityScale: boolean;
    protected velocityScaleRepeats: number;
    protected velocityScale: { relativeTime: number, relativeVelocity: THREE.Vector3 }[];
    protected scaleSizeXByVelocity: boolean;
    protected scaleSizeYByVelocity: boolean;
    protected scaleSizeZByVelocity: boolean;
    protected scaleSizeByVelocityMultiplier: THREE.Vector3;
    protected determineVelocityByLocationDifference: boolean;
    protected isUsingRevolutionScale: boolean;
    protected revolutionScaleRepeats: number;
    protected revolutionScale: { relativeTime: number, relativeRevolution: THREE.Vector3 }[];
    protected isUsingColorScale: boolean;
    protected colorScaleRepeats: number;
    protected colorScale: { relativeTime: number, color: THREE.Vector4 }[];
    protected drawStyle: DrawStyle_T;
    protected isFadingOut: boolean;
    protected fadeOutStartTime: number;
    protected fadeOutFactor: THREE.Vector4;
    protected isFadingIn: boolean;
    protected fadeInEndTime: number;
    protected fadeInFactor: THREE.Vector4;
    protected fadeFactor: number;
    protected opacity: number;
    protected minSquaredVelocity: number;
    protected allParticlesDead: boolean;
    protected startLocationShape: StartLocationShape_T;
    protected startLocationOffset: THREE.Vector3;
    protected startVelocityRange: Range3_T;
    protected startLocationRange: any; // unused - never populated from decode data, no shape to confirm
    protected sphereRadiusRange: Range_T;
    protected startLocationPolarRange: Range3_T;
    protected currentMeshSpawningIndex: number;
    protected isSpawningTowardsNormal: boolean;
    protected realMeshNormal: any;
    protected meshNormalThreshold: Range_T;
    protected uniformMeshScale: boolean;
    protected uniformVelocityScale: boolean;
    protected otherIndex: number = 0;
    protected getVelocityDirectionFrom: VelocityDirection_T;
    protected maxSizeScale: number;
    protected currentSpawningSoundIndex: number = 0;

    public getCurrentTime() { return this.currentTime; }
    public isFinished() { return this.isDisabled || this.allParticlesDead; }
    public kill() { this.killPending = true; }
    public setRenderOrder(renderOrder: number): void {
        this.traverse(object => object.renderOrder = renderOrder);
    }
    public setDelayed(delay: number): void {
        this.initialDelayRange.min += delay;
        this.initialDelayRange.max += delay;
    }
    public getForcedLifeTime(): number { return this.forcedLifeTime ? this.lifetimeRange.max : 0; }

    public adjustParticleLife(lifetime: number, delta: number): void {
        // Engine.dll SetParticleLifeTimeRange 0x8a2e3c: ForcedFade is nested under ForcedLifeTime.
        if (this.forcedLifeTime) {
            this.lifetimeRange.min += delta;
            this.lifetimeRange.max += delta;
            if (this.forcedFade) this.fadeOutStartTime += delta;
        }

        if (!this.forcedMaxParticles) return;

        // Engine.dll SetParticleMaxParticles 0x8a2f6c: truncate the initial rate before multiplying.
        const count = Math.trunc(Math.trunc(this.initialParticlesPerSecond) * (lifetime - (this.lifetimeRange.min + this.lifetimeRange.max) / 2));

        if (!Number.isFinite(count) || count < 0) throw new Error(`Invalid adjusted particle count '${count}' for '${this.name}'.`);

        this.maxParticles = count;
        if (this.currentTime !== undefined) return;

        this.maxActiveParticles = count;
        if (count <= this.particlePool.length) return;

        if (this.instancedMesh) {
            const previous = this.instancedMesh;
            this.instancedMesh = new InstancedSpriteMesh(previous.material, count);
            this.instancedMesh.renderOrder = previous.renderOrder;
            this.remove(previous);
            previous.geometry.dispose();
            this.add(this.instancedMesh);
        }

        for (let i = this.particlePool.length; i < count; i++) {
            this.particles[i] = new Particle_T();
            const particle = this.particlePool[i] = Particle.init(this, this.instancedMesh ? null : this.initParticleMesh());

            if (!this.instancedMesh) {
                particle.name = this.name + "_" + i;
                if (particle.children[0]) {
                    particle.children[0].name = this.name + "_" + i + "_vis";
                    particle.children[0].renderOrder = this.renderOrder;
                }
                this.add(particle);
            }
        }
    }

    public setSizeScale(scale: number): void {
        if (!Number.isFinite(scale) || scale < 0) throw new Error(`Invalid emitter size scale '${scale}'.`);

        this.acceleration.multiplyScalar(scale);
        this.initialSettings.position.min.multiplyScalar(scale);
        this.initialSettings.position.max.multiplyScalar(scale);
        this.sphereRadiusRange.min *= scale;
        this.sphereRadiusRange.max *= scale;
        this.startLocationPolarRange.min.multiplyScalar(scale);
        this.startLocationPolarRange.max.multiplyScalar(scale);
        this.initialSettings.scale.min.multiplyScalar(scale);
        this.initialSettings.scale.max.multiplyScalar(scale);
        this.initialSettings.velocity.min.multiplyScalar(scale);
        this.initialSettings.velocity.max.multiplyScalar(scale);
    }
    public setStartLocationRangeXZ(x: number, z: number): void {
        this.initialSettings.position.min.x = this.initialSettings.position.max.x = x;
        this.initialSettings.position.min.z = this.initialSettings.position.max.z = z;
    }

    public constructor(config: EmitterConfig_T) {
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

        this.sizeScale = (config.changesOverLifetime.scale?.values ?? [])
            .map(([relTime, relSize]) => ({ relTime, relSize }));
        this.velocityScale = ((config.changesOverLifetime as any).velocity?.values ?? [])
            .map(([relTime, v]: [number, [number, number, number]]) => ({ relativeTime: relTime, relativeVelocity: new Vector3().fromArray(v) }));
        this.revolutionScale = (config.changesOverLifetime.revolution?.values ?? [])
            .map(([relTime, v]) => ({ relativeTime: relTime, relativeRevolution: new Vector3().fromArray(v) }));
        this.revolutionScaleRepeats = config.changesOverLifetime.revolution?.repeats ?? 0;
        this.colorScale = ((config.changesOverLifetime as any).color?.values ?? [])
            .map(([relTime, c]: [number, number[]]) => ({ relativeTime: relTime, color: new Vector4().fromArray(c.map(v => v / 255)) }));

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
        this.opacity = config.opacity ?? 1; // updateParticles' fade logic reads this.opacity, not generalSettings.opacity above
        this.sounds = config.sounds ?? [];

        Object.assign(this, config.settings);
        this.rotationOffset.fromArray(config.rotationOffset || [0, 0, 0, 1]);

        this.startLocationShape = this.startLocationShape ?? "box";
        this.meshSpawning = this.meshSpawning ?? "none";
        this.rotationSource = this.rotationSource ?? "none";
        this.coordinateSystem = this.coordinateSystem ?? "independent";
        this.effectAxis = this.effectAxis ?? "negativeX";
        this.getVelocityDirectionFrom = this.getVelocityDirectionFrom ?? "none";
        this.useSkeletalLocationAs = this.useSkeletalLocationAs ?? "none";
        this.spawningSound = this.spawningSound ?? "none";
        this.drawStyle = this.drawStyle ?? "normal";
        this.scaleSizeByVelocityMax = this.scaleSizeByVelocityMax ?? Infinity; // no cap unless the data provides one
        this.secondsBeforeInactive = this.secondsBeforeInactive ?? 0; // Lineage II overrides stock UE2's one-second default

        const vec3 = (v: any) => Array.isArray(v) ? new Vector3().fromArray(v) : v;
        const vec4 = (v: any) => Array.isArray(v) ? new Vector4().fromArray(v) : v;
        const range = (v: any) => Array.isArray(v) ? { min: v[0], max: v[1] } : v;
        const rangeVec3 = (v: any) => v && Array.isArray(v.min) ? { min: new Vector3().fromArray(v.min), max: new Vector3().fromArray(v.max) } : v;

        this.maxAbsVelocity = vec3(this.maxAbsVelocity) ?? new Vector3();
        this.meshNormal = vec3(this.meshNormal) ?? new Vector3(0, 0, 1);
        this.rotationNormal = vec3(this.rotationNormal);
        this.clockwiseSpinChance = vec3(this.clockwiseSpinChance) ?? new Vector3();
        this.skeletalScale = vec3(this.skeletalScale);
        this.scaleSizeByVelocityMultiplier = vec3(this.scaleSizeByVelocityMultiplier) ?? new Vector3(1, 1, 1);
        this.spawningSoundIndex = range(this.spawningSoundIndex) ?? { min: 0, max: 0 };
        this.spawningSoundProbability = range(this.spawningSoundProbability) ?? { min: 1, max: 1 };
        this.meshScaleRange = rangeVec3(this.meshScaleRange);
        this.startSpinRange = rangeVec3(this.startSpinRange);
        this.initialDelayRange = range(this.initialDelayRange) ?? { min: 0, max: 0 };
        this.startVelocityRadialRange = range(this.startVelocityRadialRange) ?? { min: 0, max: 0 };
        this.fadeInFactor = vec4(this.fadeInFactor);
        this.fadeOutFactor = vec4(this.fadeOutFactor);

        this.acceleration = new Vector3().fromArray(config.acceleration ?? [0, 0, 0]);
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

        this.forcedLifeTime = !!config.forcedLifeTime;
        this.forcedFade = !!config.forcedFade;
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

        this.maxParticles = this.maxParticles ?? this.generalSettings.maxParticles;

        const poolSize = this.forcedMaxParticles ? this.maxParticles : this.maxParticles * 2;

        this.particles = new Array(poolSize).fill(1).map(() => new Particle_T())
        this.realMeshNormal = new Vector3().copy(this.meshNormal).normalize();

        this.maxActiveParticles = this.maxParticles;

        // debugger;
    }

    protected finishConstruction(config: EmitterConfig_T): void {
        this.initSettings(config);

        const poolSize = this.forcedMaxParticles ? this.maxParticles : this.maxParticles * 2;

        this.particlePool = new Array(poolSize);

        if (this.isInstancedRendering) {
            this.instancedMesh = this.createInstancedMesh(poolSize);
        }

        if (this.instancedMesh) {
            this.add(this.instancedMesh);

            for (let i = 0; i < poolSize; i++) {
                this.particlePool[i] = Particle.init(this, null);
            }
        } else {
            for (let i = 0; i < poolSize; i++) {
                const particle = this.particlePool[i] = Particle.init(this, this.initParticleMesh());

                particle.name = this.name + "_" + i;
                if (particle.children[0]) particle.children[0].name = this.name + "_" + i + "_vis";

                this.add(particle);
            }
        }

        if (this.drawScale > 0) {
            this.scale.setScalar(1 / this.drawScale);
        }
    }

    protected applyVelocityDirection(particle: Particle_T): void {
        if (this.getVelocityDirectionFrom === "none") return;

        const direction = tmpPhysicsVector.copy(particle.position).normalize();

        // Engine.dll 0x89f1b7: relative/spray point outwards; other modes point to the owner (our particles are emitter-local).
        if (this.coordinateSystem !== "relative" && this.coordinateSystem !== "spray") direction.negate();

        switch (this.getVelocityDirectionFrom) {
            case "startPositionAndOwner":
                particle.velocity.negate().multiply(direction);
                break;
            case "ownerAndStartPosition":
                particle.velocity.multiply(direction);
                break;
            case "addRadial":
                // Engine.dll SpawnParticle 0x89f23d: scalar FRange sample times radial direction.
                particle.velocity.addScaledVector(direction, randRange(this.startVelocityRadialRange.min, this.startVelocityRadialRange.max));
                // randVector(this.tmpVec, this.startVelocityRadialRange.min, this.startVelocityRadialRange.max), particle.velocity.add(this.tmpVec.clone().multiply(Direction));
                break;
            default: throw new Error(`Unknown particle velocity direction '${this.getVelocityDirectionFrom}'.`);
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

    protected updateParticle(deltaTime: number, index: number) {
    }

    protected spawnParticle(index: number, spawnTime: number, flags: number = 0, spawnFlags: number = 0, localLocationOffset = ZERO_VECTOR3) {
        // debugger;
        const owner = this.parent || this;

        if (!this.maxParticles || this.killPending || (this.lifetimeRange.max <= 0))
            return;

        // Engine.dll AEmitter::Tick 0x8a538a / 0x8a53f9: SpawnSound follows the first particle, not actor registration.
        const spawnSound = (owner as any).spawnSound;

        if (spawnSound) {
            (owner as any).spawnSound = null;
            owner.getWorldPosition(tmpSoundWorldPos);
            this.pendingSounds.push({ soundName: spawnSound.soundName, dataUri: spawnSound.dataUri, position: [tmpSoundWorldPos.x, tmpSoundWorldPos.y, tmpSoundWorldPos.z], volume: spawnSound.volume / 255, pitch: 1, refDistance: spawnSound.radius, maxDistance: spawnSound.radius * 100 });
        }

        const ownerLocation = () => owner.position;

        const particle = this.particles[index];

        particle.position.copy(this.initialSettings.offset);
        randVector(particle.velocity, this.initialSettings.velocity.min, this.initialSettings.velocity.max);

        const applyAll = this.startLocationShape === "all";
        if (applyAll || this.startLocationShape === "box")
            randVector(this.tmpVec, this.initialSettings.position.min, this.initialSettings.position.max),
            particle.position.add(this.tmpVec);
        if (applyAll || this.startLocationShape === "sphere")
            particle.position.add(this.tmpVec.randomDirection().multiplyScalar(randRange(this.sphereRadiusRange.min, this.sphereRadiusRange.max)));
        if (applyAll || this.startLocationShape === "polar") {
            const polar = this.tmpVec;
            randVector(polar, this.startLocationPolarRange.min, this.startLocationPolarRange.max);
            // L2 authors polar ranges in degrees (azimuth 0..360, inclination 0..180) with Z as radius, polar axis along UE Z-up
            const azimuth = polar.x * Math.PI / 180;
            const inclination = polar.y * Math.PI / 180;
            let x, y, z;
            x = polar.z * Math.cos(azimuth) * Math.sin(inclination);
            y = polar.z * Math.sin(azimuth) * Math.sin(inclination);
            z = polar.z * Math.cos(inclination);
            particle.position.add(this.tmpVec.set(x, y, z));
        }

        particle.colorMultiplier.set(1, 1, 1);
        if ((this.meshSpawning !== "none") && this.meshSpawningStaticMesh) {
            __break__();
            let maxIndex = this.meshSpawningStaticMesh.geometry.getAttribute("position").count;
            if (maxIndex > 0) {
                let vertexIndex = (this.meshSpawning === "linear") ? this.currentMeshSpawningIndex++ : (Math.trunc(Math.random() * maxIndex));
                vertexIndex %= maxIndex;
                vertexIndex = clamp(vertexIndex, 0, maxIndex);

                let attrPositions = this.meshSpawningStaticMesh.geometry.getAttribute("position");
                let attrNormals = this.meshSpawningStaticMesh.geometry.getAttribute("normal");

                if (this.isSpawningTowardsNormal) {

                    let normal = new Vector3().fromBufferAttribute(attrNormals, vertexIndex);
                    if ((normal.dot(this.realMeshNormal)) < (1 - 2 * randRange(this.meshNormalThreshold.min, this.meshNormalThreshold.max))) {
                        particle.flags &= ~EParticleFlags_T.PTF_Active;
                        return;
                    }
                }


                let locationScale = randVector(new Vector3(), this.meshScaleRange.min, this.meshScaleRange.max);
                let location = new Vector3().fromBufferAttribute(attrPositions, vertexIndex);
                particle.position.add(this.uniformMeshScale ? location.multiplyScalar(locationScale.x) : location.multiply(locationScale));

                if (this.isVelocityFromMesh) {
                    let velocityScale = randVector(new Vector3(), this.velocityScaleRange.min, this.velocityScaleRange.max);
                    let meshVelocity = new Vector3().fromBufferAttribute(attrNormals, vertexIndex);
                    particle.velocity.add(this.uniformVelocityScale ? meshVelocity.multiplyScalar(velocityScale.x) : meshVelocity.multiply(velocityScale));
                }

                if (this.isUsingColorFromMesh) {
                    let attrColors = this.meshSpawningStaticMesh.geometry.getAttribute("color");

                    let meshColor = new Vector3().fromBufferAttribute(attrColors, vertexIndex);

                    if (attrColors.normalized) meshColor.multiplyScalar(255);

                    particle.colorMultiplier.x = meshColor.x;
                    particle.colorMultiplier.y = meshColor.y;
                    particle.colorMultiplier.z = meshColor.z;
                }
            }
        }

        // debugger;

        if (this.useSkeletalLocationAs && this.useSkeletalLocationAs !== "none" &&
            this.meshVertsAndNormals && this.meshVertsAndNormals.length > 0 &&
            this.relativeBoneIndexRange && this.skeletalScale) {
            const numBones = this.meshVertsAndNormals.length;
            const rangeMin = Array.isArray(this.relativeBoneIndexRange) ? this.relativeBoneIndexRange[0] : 0;
            const rangeMax = Array.isArray(this.relativeBoneIndexRange) ? this.relativeBoneIndexRange[1] : 1;
            const randValue = rangeMin + (rangeMax - rangeMin) * Math.random();
            const boneIndexFloat = randValue * numBones;
            particle.boneIndex = clamp(Math.trunc(boneIndexFloat), 0, numBones - 1);
            
            const vertexIndex = particle.boneIndex & ~1;
            if (vertexIndex < this.meshVertsAndNormals.length) {
                const scaleVec = Array.isArray(this.skeletalScale) 
                    ? new Vector3().fromArray(this.skeletalScale) 
                    : this.skeletalScale;
                particle.oldMeshLocation.copy(this.meshVertsAndNormals[vertexIndex].clone().multiply(scaleVec));
                particle.position.add(particle.oldMeshLocation);
            }
        }


        this.otherIndex++;
        if (this.addLocationFromOtherEmitter >= 0) {
            const otherEmitter = owner.children[this.addLocationFromOtherEmitter] as BaseEmitter;

            // Engine.dll 0x89eb62: sibling positions are already emitter-local here.
            if (otherEmitter.activeParticles > 0)
                particle.position.add(otherEmitter.particles[this.otherIndex % otherEmitter.activeParticles].position);
            // let OtherEmitter = owner.Emitters[this.addLocationFromOtherEmitter] as BaseEmitter;
            // if (OtherEmitter.activeParticles > 0)
            //     particle.position.add(OtherEmitter.particles[this.otherIndex % OtherEmitter.activeParticles].position.clone().sub(ownerLocation()));
        }

        switch (this.rotationSource) {
            case "actor":
                // Particle.Location = Particle.Location.TransformVectorBy(GMath.UnitCoords*RotationOffset*owner->Rotation);
                tmpParticleQuaternion.copy(owner.quaternion).multiply(this.rotationOffset);
                particle.position.applyQuaternion(tmpParticleQuaternion);
                break;
            case "offset":
                // Particle.Location = Particle.Location.TransformVectorBy(GMath.UnitCoords*RotationOffset);
                particle.position.applyQuaternion(this.rotationOffset);
                break;
            case "normal":
                __break__();
                // {
                //     let Rotator = this.rotationNormal.Rotation();
                //     // Map Z to -X if effect was created along the Z axis instead of negative X
                //     if (this.effectAxis === "positiveZ")
                //         Rotator.Pitch -= 16384;
                //     particle.position.copy(particle.position.TransformVectorBy(GMath.UnitCoords * Rotator));
                // }
                break;
        }

        randVector(particle.revolutionCenter, this.revolutionCenterOffsetRange.min, this.revolutionCenterOffsetRange.max);
        randVector(particle.revolutionsPerSecond, this.revolutionsPerSecondRange.min, this.revolutionsPerSecondRange.max);

        if (this.coordinateSystem === "independent") {
            // particle.revolutionCenter.add(ownerLocation());
        }

        if (!(spawnFlags & EParticleSpawnFlags_T.PSF_NoGlobalOffset))
            particle.position.add(this.globalOffset);

        particle.position.add(localLocationOffset);

        particle.oldLocation.copy(particle.position);
        particle.startLocation.copy(particle.position);
        randVector(particle.colorMultiplier, this.colorMultiplierRange.min, this.colorMultiplierRange.max);
        particle.maxLifetime = randRange(this.lifetimeRange.min, this.lifetimeRange.max);
        particle.time = spawnTime + randRange(this.initialTimeRange.min, this.initialTimeRange.max);
        particle.hitCount = 0;
        particle.flags = EParticleFlags_T.PTF_Active | flags;
        particle.mass = randRange(this.startMassRange.min, this.startMassRange.max);
        randVector(particle.startSize, this.initialSettings.scale.min, this.initialSettings.scale.max);
        if (this.isUniformScale) {
            particle.startSize.y = particle.startSize.x;
            particle.startSize.z = particle.startSize.x;
        }
        particle.scale.copy(particle.startSize);
        const currentAccel = tmpCurrentAcceleration.copy(this.acceleration);
        if (this.coordinateSystem === "independent") {
            this.parent.updateMatrixWorld();
            tmpWorldToLocal.copy(this.parent.matrixWorld).invert();
            tmpWorldRotation.extractRotation(tmpWorldToLocal);
            currentAccel.applyMatrix4(tmpWorldRotation);
        }
        particle.velocity.add(currentAccel.multiplyScalar(spawnTime));
        particle.velocityMultiplier.set(1, 1, 1);
        particle.revolutionsMultiplier.set(1, 1, 1);

        switch (this.rotationSource) {
            case "actor":
                // particle.velocity = particle.velocity.TransformVectorBy(GMath.UnitCoords*RotationOffset*owner->Rotation);
                tmpParticleQuaternion.copy(owner.quaternion).multiply(this.rotationOffset);
                particle.velocity.applyQuaternion(tmpParticleQuaternion);
                break;
            case "offset":
                // particle.velocity = particle.velocity.TransformVectorBy(GMath.UnitCoords*RotationOffset);
                particle.velocity.applyQuaternion(this.rotationOffset);
                break;
            case "normal":
                __break__();
                // particle.velocity.copy(particle.velocity.TransformVectorBy(GMath.UnitCoords * this.rotationNormal.Rotation()));
                break;
        }

        if (this.coordinateSystem === "spray") {
            const emitterRotation = (owner as any).emitterRotation as Quaternion;

            if (emitterRotation) {
                particle.position.applyQuaternion(emitterRotation);
                particle.velocity.applyQuaternion(emitterRotation);
            }
        }

        this.applyVelocityDirection(particle);


        if (this.addVelocityFromOwner && this.coordinateSystem !== "relative")
            __break__() && particle.velocity.add(randVector(this.tmpVec, this.addVelocityMultiplierRange.min, this.addVelocityMultiplierRange.max).clone().multiply(owner.AbsoluteVelocity));

        if (this.addVelocityFromOtherEmitter >= 0) {
            const otherEmitter = owner.children[this.addVelocityFromOtherEmitter] as BaseEmitter;

            // Engine.dll 0x89f2e8: use the same OtherIndex as sibling location.
            if (otherEmitter.activeParticles > 0)
                particle.velocity.add(randVector(this.tmpVec, this.addVelocityMultiplierRange.min, this.addVelocityMultiplierRange.max).multiply(otherEmitter.particles[this.otherIndex % otherEmitter.activeParticles].velocity));
            // let OtherEmitter = owner.Emitters[this.addVelocityFromOtherEmitter];
            // if (OtherEmitter.ActiveParticles > 0)
            //     particle.velocity.add(randVector(this.tmpVec, this.addVelocityMultiplierRange.min, this.addVelocityMultiplierRange.max).clone().multiply(OtherEmitter.Particles[this.otherIndex % OtherEmitter.ActiveParticles].Velocity));
        }

        if (this.coordinateSystem === "independent" && spawnTime > 0) {
            const ownerVelocity = tmpPhysicsVector.copy(ownerLocation()).sub(this.oldOwnerLocation).divideScalar(clamp(this.lastDeltaTime, 0.001, 1.0));
            particle.position.sub(ownerVelocity.multiplyScalar(spawnTime));
        }
        particle.position.add(tmpPhysicsVector.copy(particle.velocity).multiplyScalar(spawnTime));

        if (this.scaleSizeXByVelocity || this.scaleSizeYByVelocity || this.scaleSizeZByVelocity) {
            let VelocitySize = Math.min(particle.velocity.length(), this.scaleSizeByVelocityMax);
            if (this.scaleSizeXByVelocity)
                particle.scale.x *= VelocitySize * this.scaleSizeByVelocityMultiplier.x;
            if (this.scaleSizeYByVelocity)
                particle.scale.y *= VelocitySize * this.scaleSizeByVelocityMultiplier.y;
            if (this.scaleSizeZByVelocity)
                particle.scale.z *= VelocitySize * this.scaleSizeByVelocityMultiplier.z;
        }

        if (particle.mass)
            particle.mass = 1 / particle.mass;

        randVector(particle.startSpin, this.startSpinRange.min, this.startSpinRange.max);
        randVector(particle.spinsPerSecond, this.spinsPerSecondRange.min, this.spinsPerSecondRange.max);

        if (this.clockwiseSpinChance.x > Math.random())
            particle.spinsPerSecond.x *= -1;
        if (this.clockwiseSpinChance.y > Math.random())
            particle.spinsPerSecond.y *= -1;
        if (this.clockwiseSpinChance.z > Math.random())
            particle.spinsPerSecond.z *= -1;

        particle.startSpin.multiplyScalar(0xFFFF);
        particle.spinsPerSecond.multiplyScalar(0xFFFF);

        if (this.isUsingRandomSubdiv) {
            if (this.subdivEnd)
                particle.subdivision = Math.trunc((this.subdivEnd - this.subdivStart) * Math.random() + this.subdivStart);
            else
                particle.subdivision = Math.trunc(Math.random() * this.texSubdivU * this.texSubdivV);
        }
        else
            particle.subdivision = -1;


        if ((particle.time > particle.maxLifetime) && particle.maxLifetime)
            this.spawnParticle(index, (particle.time % particle.maxLifetime));

        if ((this.spawningSound !== "none") && this.sounds.length) {
            let soundIndex = 0;
            switch (this.spawningSound) {
                case "linearGlobal":
                case "linearLocal":
                    soundIndex = this.currentSpawningSoundIndex++;
                    break;
                case "random":
                    soundIndex = Math.trunc(1000 * Math.random());
                    break;
            }

            soundIndex %= Math.trunc((this.spawningSoundIndex.max - this.spawningSoundIndex.min) ? (this.spawningSoundIndex.max - this.spawningSoundIndex.min) + 1 : this.sounds.length);
            soundIndex += Math.trunc(this.spawningSoundIndex.min);
            soundIndex = clamp(soundIndex, 0, this.sounds.length - 1);

            const sound = this.sounds[soundIndex];

            if (Math.random() <= (randRange(sound.probability[0], sound.probability[1]) * randRange(this.spawningSoundProbability.min, this.spawningSoundProbability.max))) {
                tmpSoundWorldPos.copy(particle.position);
                this.localToWorld(tmpSoundWorldPos);

                const refDistance = randRange(sound.radius[0], sound.radius[1]);

                this.pendingSounds.push({
                    soundName: sound.soundName,
                    position: [tmpSoundWorldPos.x, tmpSoundWorldPos.y, tmpSoundWorldPos.z],
                    volume: randRange(sound.volume[0], sound.volume[1]), // UE2 also factors in owner.TransientSoundVolume, not tracked here
                    pitch: randRange(sound.pitch[0], sound.pitch[1]),
                    refDistance,
                    maxDistance: refDistance * 100 // GAudioMaxRadiusMultiplier = 100 in UE2
                });
            }
        }

        this.allParticlesDead = false;
    }

    protected spawnParticles(oldLeftover: number, rate: number, deltaTime: number) {
        const owner = this.parent || this; // Fallback to self (identity) for warmup

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

        let percent;
        const shouldInterpolate = this.oldOwnerLocation.distanceToSquared(owner.position) > 1;

        for (let i = 0; i < spawnCount; i++) {

            this.spawnParticle(this.particleIndex, startTime - i * increment, EParticleFlags_T.PTF_InitialSpawn);

            // Laurent -- location interpolation
            if (shouldInterpolate && this.coordinateSystem === "independent") {
                percent = 1 - (i + 1) / spawnCount;
                this.particles[this.particleIndex].position.add(tmpPhysicsVector.copy(this.oldOwnerLocation).sub(owner.position).multiplyScalar(percent));
            }

            this.activeParticles = Math.max(this.activeParticles, this.particleIndex + 1);
            this.activeCount++;
            this.particleIndex = (this.particleIndex + 1) % this.maxActiveParticles;
        }

        return newLeftover;
    }

    protected updateParticles(deltaTime: number) {
        const owner = this.parent || this; // Fallback to self (identity) for warmup

        // debugger;

        this.boundingBox.makeEmpty();
        let deadParticles = 0;
        let maxParticleExtent = 0;

        // Verify range of critical variables.
        if (owner) {
            if (this.addLocationFromOtherEmitter >= 0)
                this.addLocationFromOtherEmitter = Math.min(this.addLocationFromOtherEmitter, owner.children.length - 1);
            if (this.addVelocityFromOtherEmitter >= 0)
                this.addVelocityFromOtherEmitter = Math.min(this.addVelocityFromOtherEmitter, owner.children.length - 1);
            if (this.spawnFromOtherEmitter >= 0)
                this.spawnFromOtherEmitter = Math.min(this.spawnFromOtherEmitter, owner.children.length - 1);
        }
        else
            return 0;

        if (!this.rotateVelocityLossRange) {
            this.realVelocityLossRange = this.velocityLossRange;
        } else {
            __break__();
            tmpVelocityLossRange.min.copy(this.velocityLossRange.min);
            tmpVelocityLossRange.max.copy(this.velocityLossRange.max);

            // switch (this.rotationSource) {
            //     case "actor":
            //         tmpVelocityLossRange.min.copy(tmpVelocityLossRange.min.TransformVectorBy(GMath.UnitCoords * owner.Rotation * this.rotationOffset));
            //         tmpVelocityLossRange.max.copy(tmpVelocityLossRange.max.TransformVectorBy(GMath.UnitCoords * owner.Rotation * this.rotationOffset));
            //         break;
            //     case "offset":
            //         tmpVelocityLossRange.min.copy(tmpVelocityLossRange.min.TransformVectorBy(GMath.UnitCoords * this.rotationOffset));
            //         tmpVelocityLossRange.max.copy(tmpVelocityLossRange.max.TransformVectorBy(GMath.UnitCoords * this.rotationOffset));
            //         break;
            //     case "normal":
            //         tmpVelocityLossRange.min.copy(tmpVelocityLossRange.min.TransformVectorBy(GMath.UnitCoords * this.rotationNormal.Rotation()));
            //         tmpVelocityLossRange.max.copy(tmpVelocityLossRange.max.TransformVectorBy(GMath.UnitCoords * this.rotationNormal.Rotation()));
            //         break;
            // }

            this.realVelocityLossRange.min.copy(tmpVelocityLossRange.min);
            this.realVelocityLossRange.max.copy(tmpVelocityLossRange.max);
        }

        let numBones = 0;
        if (this.skeletalMeshActor && __break__() && this.useSkeletalLocationAs !== "none") {
            if (!this.skeletalMeshActor.bDeleteMe && this.skeletalMeshActor.Mesh && this.skeletalMeshActor.Mesh.IsA("USkeletalMesh")) {
                const SkeletalMeshInstance = this.skeletalMeshActor.Mesh.MeshGetInstance(this.skeletalMeshActor);
                if (SkeletalMeshInstance)
                    numBones = SkeletalMeshInstance.GetMeshJointsAndNormals(this.skeletalMeshActor, this.meshVertsAndNormals);
            }
        }

        let rate;
        // UE2 logic: Use initial/automatic rate while filling up to the TARGET count, then switch to PPS.
        // maxParticles is the target count, maxActiveParticles may be larger (soft limit buffer)
        if (this.activeParticles < this.maxParticles) {
            if (this.isAutomaticInitialSpawning) {
                rate = this.maxParticles / ((this.lifetimeRange.min + this.lifetimeRange.max) / 2);
            } else {
                rate = this.initialParticlesPerSecond;
            }
        } else {
            rate = this.generalSettings.particlesPerSecond;
        }

        if (this.currentSpawnOnTrigger)
            rate += this.spawnOnTriggerPPS;

        if (rate > 0 && !this.killPending)
            this.ppsFraction = this.spawnParticles(this.ppsFraction, rate, deltaTime);

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


        for (let index = 0; index < Math.min(this.maxActiveParticles, this.activeParticles); index++) {
            let particle = this.particles[index];

            if (!(particle.flags & EParticleFlags_T.PTF_Active)) {
                deadParticles++;
                continue;
            }

            // Don't tick particle if it just got spawned via initial spawning.
            if (!(particle.flags & EParticleFlags_T.PTF_InitialSpawn))
                particle.time += deltaTime;

            if (particle.time > particle.maxLifetime) {
                if (!this.isRespawningDeadParticles) {
                    particle.flags &= ~EParticleFlags_T.PTF_Active;
                    deadParticles++;
                    this.activeCount--;
                    continue;
                }

                // UE2 Spawn with NewTime randomization
                let newTime = particle.time - particle.maxLifetime + randRange(this.initialTimeRange.min, this.initialTimeRange.max);
                if (particle.maxLifetime > 0) {
                    newTime %= particle.maxLifetime;
                } else {
                    newTime = 0;
                }

                this.spawnParticle(index, newTime);
            }
        }

        let maxVelocityScale = 1;
        let oneOverDeltaTime = 1 / clamp(deltaTime, 0.001, 0.15);
        const coordinateSystem = this.coordinateSystem;
        const currentAcceleration = tmpCurrentAcceleration.copy(this.acceleration);
        const ownerOffset = tmpOwnerOffset.copy(owner.position).sub(this.oldOwnerLocation);

        if (coordinateSystem === "independent") {
            // Independent acceleration is emitter-wide, not per-particle.
            this.parent.updateMatrixWorld();
            tmpWorldToLocal.copy(this.parent.matrixWorld).invert();
            tmpWorldRotation.extractRotation(tmpWorldToLocal);
            currentAcceleration.applyMatrix4(tmpWorldRotation);
        }
        // Engine.dll SpawnParticle 0x89ee60 / UpdateParticles 0x8a03d5: acceleration is not divided by DrawScale.
        currentAcceleration.multiplyScalar(deltaTime);

        for (let index = 0; index < Math.min(this.maxActiveParticles, this.activeParticles); index++) {
            let particle = this.particles[index];

            if (!(particle.flags & EParticleFlags_T.PTF_Active))
                continue;

            // UE2: UBOOL tickParticle = !(particle.flags & PTF_NoTick) || (coordinateSystem == PTCS_Relative);
            let tickParticle = !(particle.flags & EParticleFlags_T.PTF_NoTick) || (coordinateSystem === "relative");

            // Don't tick particle if it just got spawned via initial spawning or respawn.
            if (particle.flags & EParticleFlags_T.PTF_InitialSpawn) {
                tickParticle = false;
                particle.flags &= ~EParticleFlags_T.PTF_InitialSpawn;
            }

            if (tickParticle) {
                particle.velocity.add(currentAcceleration);

                // Support Independent Coordinate System:
                if (coordinateSystem === "independent") {
                    particle.position.sub(ownerOffset);
                }

                particle.oldLocation.copy(particle.position);
                particle.position.add(tmpPhysicsVector.copy(particle.velocity).multiply(particle.velocityMultiplier).multiplyScalar(deltaTime));

                if (numBones && this.useSkeletalLocationAs === "location") {
                    const newMeshLocation = tmpPhysicsVector.copy(this.meshVertsAndNormals[particle.boneIndex * 2]).multiply(this.skeletalScale);
                    particle.position.add(tmpPhysicsVector2.copy(newMeshLocation).sub(particle.oldMeshLocation));
                    particle.oldMeshLocation.copy(newMeshLocation);
                }

                if (this.isUsingRevolution) {
                    // Engine.dll 0x8a05cd..0x8a0693; Core RotateAngleAxis 0x10110e3e quantizes the angle table index.
                    const revCenter = particle.revolutionCenter;
                    const loc = this.tmpVec.copy(particle.position).sub(revCenter);
                    const angleScale = deltaTime * 0xFFFF;

                    loc.applyAxisAngle(AXIS_X, ((particle.revolutionsPerSecond.x * particle.revolutionsMultiplier.x * angleScale >> 2) & 0x3FFF) * Math.PI / 8192);
                    loc.applyAxisAngle(AXIS_Y, ((particle.revolutionsPerSecond.y * particle.revolutionsMultiplier.y * angleScale >> 2) & 0x3FFF) * Math.PI / 8192);
                    loc.applyAxisAngle(AXIS_Z, ((particle.revolutionsPerSecond.z * particle.revolutionsMultiplier.z * angleScale >> 2) & 0x3FFF) * Math.PI / 8192);

                    particle.position.copy(loc.add(revCenter));
                }
            }

            let collided = false;

            if (tickParticle && (coordinateSystem !== "relative")) {
                if (this.isUsingCollision) {
                    __break__();
                }
            }

            if (collided) {
                __break__();
            }

            let relativeTime;
            let timeFactor = 1.0;
            let time = particle.time;
            const color = particle.color.set(1, 1, 1, 1);

            if (particle.maxLifetime)
                relativeTime = clamp(time / particle.maxLifetime, 0, 1);
            else
                relativeTime = 0;

            if (this.isUsingSizeScale) {
                if (this.isScaleSizeRegular)
                    timeFactor = timeFactor / (1 + particle.time);
                else {
                    let sizeRelativeTime = ((this.useAbsoluteTimeForSizeScale ? time : relativeTime) * (this.sizeScaleRepeats + 1)) % 1;
                    for (let n = 0; n < this.sizeScale.length; n++) {
                        if (this.sizeScale[n].relTime >= sizeRelativeTime) {
                            let s1, r1;
                            let s2 = this.sizeScale[n].relSize;
                            let r2 = this.sizeScale[n].relTime;
                            if (n) {
                                s1 = this.sizeScale[n - 1].relSize;
                                r1 = this.sizeScale[n - 1].relTime;
                            }
                            else {
                                s1 = 1;
                                r1 = 0;
                            }
                            let a;
                            if (r2)
                                a = (sizeRelativeTime - r1) / (r2 - r1);
                            else
                                a = 1;

                            // Interpolate between two scales.
                            timeFactor = lerp(s1, s2, a);
                            break;
                        }
                    }
                }
            }
            particle.scale.copy(particle.startSize).multiplyScalar(timeFactor);

            if (this.isUsingVelocityScale) {
                if (particle.maxLifetime) {
                    let velocityRelativeTime = (relativeTime * (this.velocityScaleRepeats + 1)) % 1;
                    for (let n = 0; n < this.velocityScale.length; n++) {
                        if (this.velocityScale[n].relativeTime >= velocityRelativeTime) {
                            let v1,
                                v2 = this.velocityScale[n].relativeVelocity;
                            let r1,
                                r2 = this.velocityScale[n].relativeTime;
                            if (n) {
                                v1 = this.velocityScale[n - 1].relativeVelocity;
                                r1 = this.velocityScale[n - 1].relativeTime;
                            }
                            else {
                                v1 = ONE_VECTOR3;
                                r1 = 0;
                            }
                            let a;
                            if (r2)
                                a = (velocityRelativeTime - r1) / (r2 - r1);
                            else
                                a = 1;

                            // Interpolate between two scales.
                            particle.velocityMultiplier.lerpVectors(v1, v2, a);
                            break;
                        }
                    }
                }
            }

            if (this.scaleSizeXByVelocity || this.scaleSizeYByVelocity || this.scaleSizeZByVelocity) {
                let velocitySize = this.determineVelocityByLocationDifference
                    ? tmpPhysicsVector.copy(particle.position).sub(particle.oldLocation).length() * oneOverDeltaTime
                    : tmpPhysicsVector.copy(particle.velocity).multiply(particle.velocityMultiplier).length();
                maxVelocityScale = Math.max(maxVelocityScale, velocitySize);
                if (this.scaleSizeXByVelocity)
                    particle.scale.x *= velocitySize * this.scaleSizeByVelocityMultiplier.x;
                if (this.scaleSizeYByVelocity)
                    particle.scale.y *= velocitySize * this.scaleSizeByVelocityMultiplier.y;
                if (this.scaleSizeZByVelocity)
                    particle.scale.z *= velocitySize * this.scaleSizeByVelocityMultiplier.z;
            }

            if (this.isUsingRevolutionScale) {
                __break__();
                if (particle.maxLifetime) {
                    let revolutionRelativeTime = (relativeTime * (this.revolutionScaleRepeats + 1)) % 1;
                    for (let n = 0; n < this.revolutionScale.length; n++) {
                        if (this.revolutionScale[n].relativeTime >= revolutionRelativeTime) {
                            let v1,
                                v2 = this.revolutionScale[n].relativeRevolution;
                            let r1,
                                r2 = this.revolutionScale[n].relativeTime;
                            if (n) {
                                v1 = this.revolutionScale[n - 1].relativeRevolution;
                                r1 = this.revolutionScale[n - 1].relativeTime;
                            }
                            else {
                                v1 = ONE_VECTOR3;
                                r1 = 0;
                            }
                            let a;
                            if (r2)
                                a = (revolutionRelativeTime - r1) / (r2 - r1);
                            else
                                a = 1;

                            // Interpolate between two scales.
                            particle.revolutionsMultiplier.lerpVectors(v1, v2, a);
                            break;
                        }
                    }
                }
            }

            if (this.isUsingColorScale && particle.maxLifetime) {
                let colorRelativeTime = (relativeTime * (this.colorScaleRepeats + 1)) % 1;
                for (let n = 0; n < this.colorScale.length; n++) {
                    if (this.colorScale[n].relativeTime >= colorRelativeTime) {
                        let r1;
                        let r2 = this.colorScale[n].relativeTime;
                        let c1;
                        let c2 = this.colorScale[n].color;
                        if (n) {
                            c1 = this.colorScale[n - 1].color;
                            r1 = this.colorScale[n - 1].relativeTime;
                        }
                        else {
                            c1 = ONE_VECTOR4;
                            r1 = 0;
                        }
                        let a;
                        if (r2)
                            a = (colorRelativeTime - r1) / (r2 - r1);
                        else
                            a = 1;

                        // Interpolate between two colors.
                        color.lerpVectors(c1, c2, a);
                        break;
                    }
                }
            }


            if (!this.isRespawningDeadParticles) {
                if (this.generalSettings.particlesPerSecond === 0 && this.initialParticlesPerSecond === 0) {
                    color.x *= this.opacity;
                    color.y *= this.opacity;
                    color.z *= this.opacity;
                }
            }

            color.x *= particle.colorMultiplier.x;
            color.y *= particle.colorMultiplier.y;
            color.z *= particle.colorMultiplier.z;

            if ((this.isFadingOut && (time > this.fadeOutStartTime) && (particle.maxLifetime != this.fadeOutStartTime))
                || (this.isFadingIn && (time < this.fadeInEndTime) && this.fadeInEndTime)
            ) {
                let fadeFactor;
                let maxFade: THREE.Vector4;

                if (this.isFadingOut && (time > this.fadeOutStartTime)) {
                    fadeFactor = time - this.fadeOutStartTime;
                    fadeFactor /= (particle.maxLifetime - this.fadeOutStartTime);
                    maxFade = this.fadeOutFactor;
                } else {
                    fadeFactor = this.fadeInEndTime - time;
                    fadeFactor /= this.fadeInEndTime;
                    maxFade = this.fadeInFactor;
                }

                if (this.drawStyle === "modulate") {
                    color.set(
                        0.5,
                        0.5,
                        0.5,
                        1 - fadeFactor * maxFade.w
                    );
                }
                else if (this.drawStyle === "alpha") {
                    color.w -= fadeFactor * maxFade.w;
                } else {
                    color.sub(tmpFadeColor.copy(maxFade).multiplyScalar(fadeFactor));
                }

                color.clampScalar(0, 1); // UnParticleEmitter.cpp clamps post-fade too, else color can go negative
            }

            // Laurent -- Global Opacity
            if (this.opacity < 1 && this.drawStyle !== "normal") //don't do Opacity for Regular blend mode
            {
                if (this.drawStyle === "alpha" ||
                    this.drawStyle === "modulate" ||
                    this.drawStyle === "alphaModulate") {
                    color.w *= this.opacity;
                }
                else {
                    color.x *= this.opacity;
                    color.y *= this.opacity;
                    color.z *= this.opacity;
                }
            }

            const particleExtent = Math.max(particle.scale.x, particle.scale.y, particle.scale.z) * this.particleGeometryRadius;
            this.boundingBox.expandByPoint(tmpBoxExpand.copy(particle.position).addScalar(particleExtent));
            this.boundingBox.expandByPoint(tmpBoxExpand.copy(particle.position).addScalar(-particleExtent));
            if (particleExtent > maxParticleExtent) maxParticleExtent = particleExtent;

            if (this.maxAbsVelocity.x)
                particle.velocity.x = clamp(particle.velocity.x, -this.maxAbsVelocity.x, this.maxAbsVelocity.x);
            if (this.maxAbsVelocity.y)
                particle.velocity.y = clamp(particle.velocity.y, -this.maxAbsVelocity.y, this.maxAbsVelocity.y);
            if (this.maxAbsVelocity.z)
                particle.velocity.z = clamp(particle.velocity.z, -this.maxAbsVelocity.z, this.maxAbsVelocity.z);

            particle.velocity.sub(tmpPhysicsVector.copy(particle.velocity).multiply(randVector(this.tmpVec, this.realVelocityLossRange.min, this.realVelocityLossRange.max)).multiplyScalar(deltaTime));

            if (collided && particle.velocity.lengthSq() < this.minSquaredVelocity)
                particle.flags |= EParticleFlags_T.PTF_NoTick;

            this.updateParticle(deltaTime, index);
        }

        let maxScale = 1;
        if (this.isUsingSizeScale && !this.isScaleSizeRegular) {
            for (let i = 0; i < this.sizeScale.length; i++)
                maxScale = Math.max(this.sizeScale[i].relSize, maxScale);
        }

        let maxScaleSizeByVelocityMultiplier = 1;
        if (this.scaleSizeXByVelocity || this.scaleSizeYByVelocity || this.scaleSizeZByVelocity) {
            maxScaleSizeByVelocityMultiplier = 0;
            if (this.scaleSizeXByVelocity)
                maxScaleSizeByVelocityMultiplier = Math.max(maxScaleSizeByVelocityMultiplier, this.scaleSizeByVelocityMultiplier.x);
            if (this.scaleSizeYByVelocity)
                maxScaleSizeByVelocityMultiplier = Math.max(maxScaleSizeByVelocityMultiplier, this.scaleSizeByVelocityMultiplier.y);
            if (this.scaleSizeZByVelocity)
                maxScaleSizeByVelocityMultiplier = Math.max(maxScaleSizeByVelocityMultiplier, this.scaleSizeByVelocityMultiplier.z);
        }

        this.maxSizeScale = maxScale * maxVelocityScale * maxScaleSizeByVelocityMultiplier;

        if (this.instancedMesh) this.worldParticleExtent = maxParticleExtent * this.maxSizeScale;

        if ((deadParticles >= this.maxActiveParticles || (this.activeParticles - deadParticles) <= 0) && (this.killPending || rate === 0 && !this.isRespawningDeadParticles))
            this.allParticlesDead = true;
        else
            this.allParticlesDead = false;

        this.activeCount = this.activeParticles - deadParticles;
        if (this.parent)
            this.oldOwnerLocation.copy(owner.position);
        return this.activeCount;
    }

    public update(currentTime: number) {
        if (currentTime === 0) return;

        const owner = this.parent as any;
        if (owner && owner.updateEmitterRotation) owner.updateEmitterRotation(currentTime);

        // if (this.name !== "SpriteEmitter3" || this.parent.name !== "Emitter7") return;

        if (this.isDisabled)
            return;

        if (this.currentTime === undefined) {
            this.currentTime = currentTime;
            this.initialDelay = randRange(this.initialDelayRange.min, this.initialDelayRange.max);

            return;
        }

        // Engine.dll AEmitter::Tick 0x8a4f88 scales emitter delta after the ordinary actor tick.
        const dt = clamp((currentTime - this.currentTime) / 1000, 0, 0.15) * (owner && owner.getSpeedRate ? owner.getSpeedRate() : 1);

        if (this.initialDelay > 0) {
            this.initialDelay -= dt;
            this.currentTime = currentTime;

            if (this.initialDelay > 0) return;

            this.initialDelay = 0;
        }


        if (!this.warmedUp && this.parent && this.warmupGate) {
            this.oldOwnerLocation.copy(this.parent.position);
            
            // Engine.dll AEmitter::Tick 0x8a5297..0x8a5322: only explicit warmup precedes normal emission.
            if (this.warmupTime > 0) this.warmUp(this.warmupTime, this.warmupTicksPerSecond);
            this.warmedUp = true;
        }

        this.lastDeltaTime = dt;
        this.updateParticles(dt);

        // freezeEmitterParticles only touches p.visible, not instancedMesh - every update() call implies "visible now"
        if (this.instancedMesh) this.instancedMesh.visible = true;

        // mirrors instanced-sprite-batcher's grouping test - whatever it rejects still has to fill its own mesh below
        if (this.instancedMesh?.isWorldBatchCandidate && this.activeCount > 0 && isOrderIndependentAdditive(this.instancedMesh.material)) {
            // Batched emitters write directly from simulation state.
            this.instancedMesh.clearInstances();
            if (this.instancedMesh.material.isUpdatable) this.instancedMesh.material.update(currentTime);
            this.currentTime = currentTime;
            return;
        }

        this.particlePool.forEach((p, i) => {
            const settings = this.particles[i];

            p.visible = (settings.flags & EParticleFlags_T.PTF_Active) !== 0;
            p.matrixAutoUpdate = p.visible; // hidden pool entries skip matrix composition

            // matrixAutoUpdate alone only skips composing this particle's own local
            // matrix - three's per-frame scene walk still recurses into it (and its
            // visualizer child) regardless. A pool is typically 2x oversized, so half
            // its entries are inactive at any moment; skip the walk into them
            // entirely while hidden. Active particles are untouched - restoring the
            // prototype method keeps onBeforeRender-driven behavior (billboarding,
            // beam meshes) exactly as before.
            p.updateMatrixWorld = p.visible ? Object3D.prototype.updateMatrixWorld : frozenUpdateMatrixWorld;

            if (this.instancedMesh) {
                if (!p.visible) { this.instancedMesh.setInactive(i); return; }
            } else if (!p.visible) {
                return;
            }

            p.position.copy(settings.position);
            p.oldLocation.copy(settings.oldLocation);
            if (this.isSpriteEmitter) p.scale.set(1, 1, 1);
            else p.scale.copy(settings.scale);
            p.setVelocity(settings.velocity);

            let spin = 0;

            if (this.isSpinning || this.spinParticles) {
                // Mapping from un-particle-emitter.ts: X=Pitch, Y=Yaw, Z=Roll
                const rotPitch = (settings.startSpin.x + settings.time * settings.spinsPerSecond.x) * (Math.PI * 2 / 65536);
                const rotYaw = (settings.startSpin.y + settings.time * settings.spinsPerSecond.y) * (Math.PI * 2 / 65536);
                const rotRoll = (settings.startSpin.z + settings.time * settings.spinsPerSecond.z) * (Math.PI * 2 / 65536);

                if (this.isSpriteEmitter) {
                    spin = rotRoll;
                    (p as any).spin = rotRoll;
                } else {
                    // Native-axis mapping for Mesh Emitters (Z up, no axis swap):
                    // X = Roll, Y = Yaw, Z = Pitch
                    p.rotation.set(rotRoll, rotYaw, rotPitch, "XYZ");
                }
            }

            this.computeSubdivUV(this.resolveSubdivision(settings), tmpSubdivUV);

            if (this.instancedMesh) {
                this.instancedMesh.setInstance(i, settings.position, settings.scale.x, settings.scale.y, spin, settings.color, tmpSubdivUV[0], tmpSubdivUV[1], tmpSubdivUV[2], tmpSubdivUV[3]);
                return;
            }

            const visualizer = p.children[0] as THREE.Mesh;
            if (!visualizer) return;

            if (this.isSpriteEmitter) visualizer.scale.copy(settings.scale);
            const mats = visualizer.material instanceof Array ? visualizer.material : [visualizer.material];
            for (const mat of mats) {
                if ((mat as any).isMeshEmitterMaterial) {
                    const emat = mat as any;
                    if (emat.isUpdatable) emat.update(settings.time * 1000);
                    emat.uniforms.diffuse.value.setRGB(settings.color.x, settings.color.y, settings.color.z);
                    emat.uniforms.opacity.value = settings.color.w;
                } else if ((mat as any).isStaticMeshMaterial) {
                    const smat = mat as any;
                    if (smat.isUpdatable) smat.update(settings.time * 1000);

                    smat.uniforms.diffuse.value.setRGB(settings.color.x, settings.color.y, settings.color.z);
                    smat.uniforms.opacity.value = settings.color.w;
                } else if ((mat as any).isParticleMaterial) {
                    const pmat = mat as any;
                    if (pmat.isUpdatable) pmat.update(settings.time * 1000);

                    pmat.uniforms.diffuse.value.setRGB(settings.color.x, settings.color.y, settings.color.z);
                    pmat.uniforms.opacity.value = settings.color.w;
                    if (pmat.uniforms.uvOffsetScale) pmat.uniforms.uvOffsetScale.value.set(tmpSubdivUV[0], tmpSubdivUV[1], tmpSubdivUV[2], tmpSubdivUV[3]);
                } else {
                    (mat as any).color.setRGB(settings.color.x, settings.color.y, settings.color.z);
                    mat.opacity = settings.color.w;
                }
            }

            if (i > 0) return;

        })

        if (this.instancedMesh) {
            // shared material for the whole pool - driven off the emitter's own clock, no per-particle Time
            if (this.instancedMesh.material.isUpdatable) this.instancedMesh.material.update(currentTime);
            this.instancedMesh.commit();
        }

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

    // Matches UnSpriteEmitter.cpp: V is the fast-varying index (cells stack downward within
    // a column before the next column), not U. Native assigns VMin to the quad's top vertices
    // and VMax to its bottom vertices; PlaneGeometry uses UV.y=1 at the top, so the atlas cell
    // needs a negative V scale. subdivision -1 = no cropping.
    protected computeSubdivUV(subdivision: number, out: [number, number, number, number]) {
        if (subdivision < 0 || !this.texSubdivU || !this.texSubdivV) {
            out[0] = 0; out[1] = 0; out[2] = 1; out[3] = 1;
            return out;
        }

        const vIndex = subdivision % this.texSubdivV;
        const uIndex = Math.floor(subdivision / this.texSubdivV);
        const scaleX = 1 / this.texSubdivU;
        const scaleY = 1 / this.texSubdivV;

        out[0] = uIndex * scaleX;
        out[1] = (vIndex + 1) * scaleY;
        out[2] = scaleX;
        out[3] = -scaleY;

        return out;
    }

    // Subdivision -1 (UseRandomSubdivision off) isn't a permanent "no cropping" signal -
    // UnSpriteEmitter.cpp derives the cell every frame from lifetime progress instead
    protected resolveSubdivision(settings: { subdivision: number, time: number, maxLifetime: number }): number {
        if (settings.subdivision !== -1) return settings.subdivision;
        if (!this.texSubdivU || !this.texSubdivV || !settings.maxLifetime) return -1;

        const relativeTime = clamp(settings.time / settings.maxLifetime, 0, 1);
        let subDivs = this.texSubdivU * this.texSubdivV;
        let section: number;

        if (this.subdivEnd) {
            subDivs = Math.max(1, this.subdivEnd - this.subdivStart);
            section = Math.floor(relativeTime * subDivs) + this.subdivStart;
        } else {
            section = Math.floor(relativeTime * subDivs);
        }

        return clamp(section, 0, this.texSubdivU * this.texSubdivV - 1);
    }

    protected abstract initSettings(info: EmitterConfig_T): void;
    protected abstract initParticleMesh(): THREE.Mesh<THREE.BufferGeometry, ParticleMaterial> | null;

    // Default: no instanced path. Subclasses that set isInstancedRendering=true
    // (from initSettings) must override this to build their own instanced mesh.
    protected createInstancedMesh(_capacity: number): InstancedSpriteMesh | null { return null; }
}

export default BaseEmitter;

class Particle extends Object3D {
    protected readonly particleSystem: BaseEmitter;
    // null for instanced-rendering emitters - there's no per-particle mesh/material,
    // rendering goes through the emitter's single shared InstancedSpriteMesh instead.
    protected readonly visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial> | null;

    public isAlive: boolean = false;
    public visible: boolean = false;
    public spin: number = 0;

    public bornTime: number;
    public deathTime: number;

    protected fadeIn: Fade_T;
    protected fadeOut: Fade_T;

    protected lastUpdate: number;

    protected _velocity = new Vector3();
    public get velocity(): Readonly<THREE.Vector3> { return this._velocity; }
    public setVelocity(velocity: THREE.Vector3) { this._velocity.copy(velocity); }

    protected _oldLocation = new Vector3();
    public get oldLocation(): Readonly<THREE.Vector3> { return this._oldLocation; }

    protected acceleration = new Vector3();
    protected changesOverLifetime: ChangesOverTime_T;



    protected initial = {
        scale: new Vector3(),
        color: new Vector4(),
    };


    private constructor(particleSystem: BaseEmitter, visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial> | null) {
        super();

        this.particleSystem = particleSystem;
        this.visualizer = visualizer;

        if (visualizer) {
            if ('particleRef' in visualizer) {
                (visualizer as any).particleRef = this;
            }

            this.add(visualizer);
        }
    }

    static init(particleSystem: BaseEmitter, visualizer: THREE.Mesh<THREE.BufferGeometry, ParticleMaterial> | null): Particle {
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

    // repeats comes straight from level data - garbage values would blow up the
    // arrays below (and the loop), so clamp to a sane whole number
    const repeats = Math.min(Math.max(Math.floor(ranges.repeats) || 1, 1), 1000);
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
type Fade_T = { time: number; color: THREE.Vector4; };
type FadeSettings_T = { fadeIn: Fade_T; fadeOut: Fade_T; };
type Range3_T = { min: THREE.Vector3, max: THREE.Vector3 };
type ChangesOverTime_T = { scale?: { times: number[], values: number[] }; };
type PendingEmitterSound_T = { soundName: string, dataUri?: string, position: [number, number, number], volume: number, pitch: number, refDistance: number, maxDistance: number };

const __warnedBreaks = new Set<string>();
function __break__(): boolean {
    const site = new Error().stack?.split("\n")[2]?.trim() ?? "unknown";

    if (!__warnedBreaks.has(site)) {
        __warnedBreaks.add(site);
        console.warn("[emitter] unimplemented particle feature hit at", site);
    }

    return false;
}
