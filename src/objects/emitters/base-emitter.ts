import { Object3D, Vector3, Vector4 } from "three";
import { mapLinear } from "three/src/math/MathUtils";

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
            particlesPerSecond: isFinite(config.particlesPerSecond) ? config.particlesPerSecond : 0.5
        };

        this.changesOverLifetimeSettings = {
            scale: buildChangeRanges(config.changesOverLifetime.scale)
        };

        this.initialSettings = {
            particlesPerSecond: isFinite(config.initial.particlesPerSecond) ? config.initial.particlesPerSecond : 0.5,
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

        this.initSettings(config);

        this.particlePool = new Array(config.maxParticles);

        // console.log(this.generalSettings.acceleration);
        console.log(config);

        for (let i = 0; i < config.maxParticles; i++) {
            const particle = this.particlePool[i] = Particle.init(this, this.initParticleMesh());

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

        const needsToSpawn = !isFinite(this.lastSpawned) || ((currentTime - this.lastSpawned) > this.generalSettings.particlesPerSecond * 1000);

        if (!needsToSpawn)
            return;

        const timePassed = isFinite(this.lastSpawned) ? currentTime - this.lastSpawned : 1000;
        const particlesToSpawn = Math.min((timePassed / 1000) * this.generalSettings.particlesPerSecond, deadParticlesCount);

        for (let i = 0; i < particlesToSpawn; i++)
            deadParticlePool[i].spawn({
                lifetime: this.generalSettings.lifetime,
                fading: this.fadingSettings,
                acceleration: this.generalSettings.acceleration,
                velocity: this.initialSettings.velocity,
                scale: this.initialSettings.scale,
                position: this.initialSettings.position,
                changesOverLifetime: this.changesOverLifetimeSettings,
                opacity: this.generalSettings.opacity,
                colorMultiplierRange: this.generalSettings.colorMultiplierRange
            });

        this.lastSpawned = currentTime;
    }

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

        randVector(this.scale, scale.min, scale.max);
        randVector(this.velocity, velocity.min, velocity.max);
        randVector(this.position, position.min, position.max);
        randVector(this.initial.color as any as Vector3, colorMultiplierRange.min, colorMultiplierRange.max);

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