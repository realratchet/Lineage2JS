import { getRotatorQuaternionElements } from "../utils/rotator";
import type { SkillActor_T, SkillEffectHost_T } from "./skill-effect-host";
import type { NpcSkillAttack_T } from "../un-pawn";
import type { Vector3Arr } from "../library-types";

type FireCracker_T = { delay: number, velocity: number, height: number, offset: Vector3Arr, color: number, startTime: number, origin: Vector3Arr, seed: SkillActor_T, finished: boolean };

function random(count: number): number { return Math.floor(Math.random() * count); }

export class FireCrackerAction {
    protected readonly crackers: FireCracker_T[] = [];
    protected origin: Vector3Arr = null;
    protected lastTime: number;
    protected elapsed = 0;

    public constructor(protected readonly host: SkillEffectHost_T, protected readonly caster: SkillActor_T, protected readonly skill: NpcSkillAttack_T, protected readonly type: 1 | 2 | 3, currentTime: number) {
        this.lastTime = currentTime;

        // Engine.dll FireCrackerAction constructor 0x10471e90; slot defaults 0x1046c730.
        const delays = [1, 1.5, 2.5, 3, 4, 4.5, 5, 6], heights = [110, 130, 110, 80, 110, 130, 80, 110], velocities = [230, 170, 230, 170, 170, 230, 170, 170], colors = [0, 2, 1, 0, 3, 2, 1, 3];

        for (let i = 0; i < (type === 3 ? 8 : type); i++) {
            const cracker: FireCracker_T = { delay: random(5) * 0.4, velocity: 200 + random(50), height: (20 + random(15)) * 4.5, offset: [(random(7) - 3) * 8, (random(7) - 3) * 8, 0], color: random(4), startTime: 0, origin: null, seed: null, finished: false };

            cracker.delay = type === 3 ? delays[i] : 0;
            cracker.height = (type === 3 ? heights[i] : i ? 30 : 20) + random(10);
            cracker.velocity = (type === 3 ? velocities[i] : i ? 170 : 140) + random(10);
            cracker.color = type === 3 ? colors[i] : i ? 2 : 0;
            if (type !== 3) cracker.offset = [0, 0, 0];
            this.crackers.push(cracker);
        }
        if (type === 3) {
            const position = this.host.getPosition(caster, [0, 0, 0], true);
            const effect = this.spawn("LineageEffect.m_u015_b", position, 0);

            this.host.setParticleScale(effect, 0.6);
            this.host.adjustParticleLife(effect, 8);
        }
    }

    protected getOrigin(): Vector3Arr {
        if (!this.origin) {
            this.origin = this.host.getPosition(this.caster, [0, 0, 0], true);
            this.origin[2] += this.host.getCollisionHeight(this.caster);
        }
        return this.origin;
    }

    protected spawn(classId: string, position: Vector3Arr, yaw: number): SkillActor_T {
        const effect = this.host.createEffect(this.caster, classId, this.skill.assets);

        this.host.setPosition(effect, position);
        this.host.setRotation(effect, getRotatorQuaternionElements(0, yaw, 0, [0, 0, 0, 1]));
        this.host.addEffect(effect, null);
        return effect;
    }

    public update(currentTime: number): boolean {
        this.elapsed += (currentTime - this.lastTime) * 0.001;
        this.lastTime = currentTime;
        if (!this.host.isAlive(this.caster)) { this.clear(); return false; }

        let finished = 0;

        // Engine.dll FireCrackerAction tick 0x104970e0..0x104974cc.
        for (let i = 0; i < this.crackers.length; i++) {
            const cracker = this.crackers[i];

            if (cracker.finished) { finished++; continue; }
            if (!cracker.seed) {
                if (cracker.delay >= this.elapsed) continue;
                if (this.type === 2)
                    for (let j = i + 1; j < this.crackers.length; j++) this.crackers[j].delay = 100000;

                const origin = this.getOrigin();
                cracker.origin = [origin[0] + cracker.offset[0], origin[1] + cracker.offset[1], origin[2] + cracker.offset[2] + (this.type === 3 || this.type === 2 && i > 0 ? 0 : this.host.getCollisionHeight(this.caster))];
                cracker.height += cracker.origin[2];
                cracker.seed = this.spawn(`LineageEffect.e_u519_fireseed_${cracker.color}`, cracker.origin, random(65536));
                continue;
            }
            const time = this.elapsed - cracker.startTime - cracker.delay;
            const position = this.host.getPosition(cracker.seed, [0, 0, 0]);

            if (position[2] < cracker.height && cracker.velocity - 200 * time > 0 && time < 4) {
                position[2] = cracker.origin[2] + cracker.velocity * time - 100 * time * time;
                this.host.setPosition(cracker.seed, position);
                continue;
            }
            this.spawn(`LineageEffect.e_u519_firecracker_${cracker.color}`, position, 0);
            if (this.type === 2 && i + 1 < this.crackers.length) {
                const next = this.crackers[i + 1];
                next.startTime = this.elapsed;
                next.delay = 0;
                next.offset = [position[0] - this.getOrigin()[0], position[1] - this.getOrigin()[1], position[2] - this.getOrigin()[2]];
            }
            this.host.removeEffect(cracker.seed);
            cracker.seed = null;
            cracker.finished = true;
        }
        return finished !== this.crackers.length;
    }

    public clear(): void {
        for (const cracker of this.crackers)
            if (cracker.seed) this.host.removeEffect(cracker.seed);
        this.crackers.length = 0;
    }
}

export default FireCrackerAction;
