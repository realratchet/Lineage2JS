import { Object3D, Vector3, Vector4 } from "three";

abstract class BaseEmitter extends Object3D {
    protected readonly isUpdatable = true;

    protected fadingSettings: FadeSettings_T;
    protected generalSettings: { maxParticles: number; acceleration: Vector3; lifetime: Lifetime_T; particlesPerSecond: number };
    protected initialSettings: { particlesPerSecond: number, scale: { min: Vector3; max: Vector3; }; velocity: { min: Vector3; max: Vector3; }; angularVelocity: { min: Vector3; max: Vector3; }; };

    protected particlePool: Array<Particle>;

    protected currentTime: number;
    protected lastSpawned: number;

    public getCurrentTime() { return this.currentTime; }

    constructor(config: EmitterConfig_T) {
        super();

        this.fadingSettings = {
            fadeIn: config.fadeIn ? { time: config.fadeIn.time, color: new Vector4().fromArray(config.fadeIn.color || [1, 1, 1, 1]) } : null,
            fadeOut: config.fadeOut ? { time: config.fadeOut.time, color: new Vector4().fromArray(config.fadeOut.color || [1, 1, 1, 1]) } : null
        };

        this.generalSettings = {
            maxParticles: config.maxParticles,
            acceleration: new Vector3().fromArray(config.acceleration || [0, 0, 0]),
            lifetime: { min: config.lifetime[0], max: config.lifetime[1] },
            particlesPerSecond: isFinite(config.particlesPerSecond) ? config.particlesPerSecond : 10000
        };

        this.initialSettings = {
            particlesPerSecond: isFinite(config.initial.particlesPerSecond) ? config.initial.particlesPerSecond : 10000,
            scale: {
                min: new Vector3().fromArray(config.initial.scale?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.scale?.max || [1, 1, 1])
            },
            velocity: {
                min: new Vector3().fromArray(config.initial.velocity?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.velocity?.max || [1, 1, 1])
            },
            angularVelocity: {
                min: new Vector3().fromArray(config.initial.angularVelocity?.min || [1, 1, 1]),
                max: new Vector3().fromArray(config.initial.angularVelocity?.max || [1, 1, 1])
            }
        };

        this.initSettings(config);

        this.particlePool = new Array(config.maxParticles);

        for (let i = 0; i < config.maxParticles; i++) {
            const particle = this.particlePool[i] = Particle.init(this);

            particle.add(this.initParticleMesh());
            randVector(particle.scale, this.initialSettings.scale.min, this.initialSettings.scale.max);


            this.add(particle);
        }
    }

    public update(currentTime: number) {
        if (currentTime === 0) return;

        this.currentTime = currentTime;

        let deadParticlesCount = 0;
        const deadParticlePool = new Array<Particle>(this.particlePool.length);

        for (const particle of this.particlePool) {
            if (!particle.isAlive) {
                deadParticlePool[deadParticlesCount++] = particle;
                continue;
            }

            particle.update(currentTime);

            if (!particle.isAlive) // particle has died after update
                deadParticlePool[deadParticlesCount++] = particle;
        }

        const needsToSpawn = !isFinite(this.lastSpawned) || currentTime < this.lastSpawned + this.generalSettings.particlesPerSecond;

        if (!needsToSpawn)
            return;

        const timePassed = isFinite(this.lastSpawned) ? currentTime - this.lastSpawned : 1000;
        const particlesToSpawn = Math.min((timePassed / 1000) * this.generalSettings.particlesPerSecond, deadParticlesCount);

        for (let i = 0; i < particlesToSpawn; i++)
            deadParticlePool[i].spawn(this.generalSettings.lifetime, this.fadingSettings);

        this.lastSpawned = currentTime;

        // debugger;


    }

    protected abstract initSettings(info: EmitterConfig_T): void;
    protected abstract initParticleMesh(): THREE.Mesh;
}

export default BaseEmitter;
export { BaseEmitter };

class Particle extends Object3D {
    private particleSystem: BaseEmitter;

    public isAlive: boolean = false;
    public visible: boolean = false;

    public bornTime: number;
    public deathTime: number;

    public fadeInTime: number;
    public fadeOutTime: number;

    private constructor(particleSystem: BaseEmitter) {
        super();

        this.particleSystem = particleSystem;
    }

    static init(particleSystem: BaseEmitter): Particle {
        return new Particle(particleSystem);
    }

    public update(currentTime: number) {
        if (!this.isAlive) return;

        if(currentTime >= this.deathTime) {
            this.kill();
            return;
        }
        

        // debugger;
    }

    public kill() {
        this.isAlive = false;
        this.visible = false;
    }

    public spawn(lifetime: Lifetime_T, fadeSettings: FadeSettings_T) {

        const now = this.bornTime = this.particleSystem.getCurrentTime();

        this.deathTime + randRange(lifetime.min, lifetime.max);
        this.fadeInTime = isFinite(fadeSettings.fadeIn?.time) ? (now + fadeSettings.fadeIn.time) : now;
        this.fadeOutTime = isFinite(fadeSettings.fadeOut?.time) ? (now + fadeSettings.fadeOut.time) : this.deathTime;


        this.visible = true;
        this.isAlive = true;
    }
}

function randRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function randVector(dst: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3) {
    dst.x = randRange(min.x, max.x);
    dst.y = randRange(min.y, max.y);
    dst.z = randRange(min.z, max.z);

    return dst;
}

type Lifetime_T = { min: number; max: number; };
type Fade_T = { time: number; color: Vector4; };
type FadeSettings_T = { fadeIn: Fade_T; fadeOut: Fade_T; };