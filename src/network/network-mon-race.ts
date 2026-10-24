import type NetworkManager from "./network-manager";
import type PawnMovementComponent from "../physics/components/pawn-movement-component";
import { Vector3 } from "three";
import * as GamePackets from "./game-packets";
import { setVector } from "./network-location";

type Racer_T = { objectId: number, origin: Vector3, destination: Vector3, arrRatios: number[], groundSpeed: number, totalTime: number, segment: number, isFinished: boolean, isStartPending: boolean };

const SEGMENT_LENGTH = 100;
const FINAL_RATIO_SCALE = 1.5;
const FINISH_EXTENSION = 50;
const tmpLocation = new Vector3();

function getYaw(from: GamePackets.Location_T, to: GamePackets.Location_T) { return Math.trunc(Math.atan2(to.y - from.y, to.x - from.x) * 32768 / Math.PI) & 0xffff; } // FVector::Rotation

export class NetworkMonRace { // race manager singleton 0x10ac419c: SetTime 0x10498930, AddRacer 0x1049ad00, Tick 0x1049aee0
    protected arrRacers: Racer_T[] = [];
    protected time = 0;
    protected endTime = 0;
    protected hasEndTime = false;

    public constructor(protected readonly network: NetworkManager) {}

    public onMonRaceInfo(info: GamePackets.MonRaceInfo_T) { // Engine 0x1041f2c0
        if (info.unknown2 !== -1) for (const runner of info.runners) {
            const heading = getYaw(runner.origin, runner.destination);

            if (!this.network.actors.objects.has(runner.objectId)) this.network.actors.setNpc({ objectId: runner.objectId, npcId: runner.npcId, x: runner.origin.x, y: runner.origin.y, z: runner.origin.z, heading, name: "", title: "", isRunning: true, isInCombat: false, isAlikeDead: false, karma: 0, pvpFlag: 0, recommendations: 0, nameColor: 0, abnormalState: 0, runSpd: runner.unknown, walkSpd: runner.unknown, swimRunSpd: runner.unknown, swimWalkSpd: runner.unknown, moveMultiplier: 1, attackSpeedMultiplier: 1, collisionRadius: runner.collisionRadius, collisionHeight: runner.collisionHeight, isAttackable: false, rightHand: 0, chest: 0, leftHand: 0, spawnType: 0, isSummon: false });

            this.setRacer(runner, heading);
        }

        this.setTime(Math.fround(info.unknown1 * 0.001), Math.fround(info.unknown2 * 0.001));
    }

    public removeRacer(objectId: number) { this.arrRacers = this.arrRacers.filter(racer => racer.objectId !== objectId); } // 0x104994f0 caller on pawn destroy

    public reset() {
        this.arrRacers = [];
        this.time = 0;
        this.endTime = 0;
        this.hasEndTime = false;
    }

    public tick(deltaTime: number) { // 0x1049aee0
        if (deltaTime <= 0.0005) deltaTime = Math.fround(0.0005);
        else if (deltaTime > 0.4) deltaTime = Math.fround(0.4);

        if (!this.arrRacers.length || this.time < 0) return;

        if (this.hasEndTime && this.endTime <= this.time) {
            debugger; // controller vtable +0x318 on every racer; Lisvus clears the end time with its (13765, -1) packet before it can elapse
            throw new Error("Monster race end-time cutoff is not implemented.");
        }

        for (const racer of this.arrRacers) {
            const object = this.network.actors.objects.get(racer.objectId);

            if (!object || !object.actor) continue;
            if (racer.isStartPending) this.startRacer(racer);

            this.updateSegment(racer, object.actor.position);
            object.actor.setUnrealScriptProperty("NonAttackSpeedRate", racer.segment < racer.arrRatios.length ? racer.arrRatios[racer.segment] : 0); // 0x103fce40: Pawn+0x5fc
        }

        this.time = Math.fround(this.time + deltaTime);
        if (this.isRaceFinished()) this.finishRace();
    }

    protected setRacer(runner: GamePackets.MonRaceRunner_T, heading: number) { // SetRace 0x105e58b0 -> AddRacer 0x1049ad00 / reinit 0x104994f0
        const yaw = heading * Math.PI / 32768, groundSpeed = runner.unknown;
        const racer = this.arrRacers.find(entry => entry.objectId === runner.objectId) || { objectId: runner.objectId, origin: new Vector3(), destination: new Vector3(), arrRatios: [], groundSpeed: 0, totalTime: 0, segment: 0, isFinished: false, isStartPending: false };

        setVector(racer.origin, runner.origin);
        setVector(racer.destination, runner.destination);
        racer.groundSpeed = groundSpeed;
        racer.totalTime = 0;
        racer.segment = 0;
        racer.arrRatios = [];

        if (groundSpeed > 0) {
            for (const speed of runner.speeds) {
                racer.arrRatios.push(Math.fround(speed / groundSpeed));
                racer.totalTime = Math.fround(racer.totalTime + SEGMENT_LENGTH / speed);
            }

            racer.arrRatios.push(Math.fround(SEGMENT_LENGTH / groundSpeed * FINAL_RATIO_SCALE));
            racer.destination.x = Math.fround(racer.destination.x + Math.fround(Math.cos(yaw) * FINISH_EXTENSION));
            racer.destination.y = Math.fround(racer.destination.y + Math.fround(Math.sin(yaw) * FINISH_EXTENSION));
        }

        this.arrRacers = this.arrRacers.filter(entry => entry !== racer);

        let index = this.arrRacers.length - 1;

        while (index >= 0 && racer.totalTime > this.arrRacers[index].totalTime) index--;
        this.arrRacers.splice(index + 1, 0, racer);
    }

    protected setTime(time: number, endTime: number) { // 0x10498930
        this.time = time;

        if (endTime === Math.fround(-0.001)) {
            if (time < 0) return;

            this.hasEndTime = false;
            for (const racer of this.arrRacers) {
                if (this.network.actors.objects.get(racer.objectId)?.actor) this.moveRacer(racer);
                else racer.isStartPending = true;
            }
            return;
        }

        if (time < 0) return;

        this.hasEndTime = time < endTime;
        if (this.hasEndTime) this.endTime = endTime;
        for (const racer of this.arrRacers) racer.isStartPending = true;
        for (const racer of this.arrRacers) if (this.network.actors.objects.get(racer.objectId)?.actor) this.startRacer(racer);
    }

    protected startRacer(racer: Racer_T) { // 0x10498470
        const object = this.network.actors.objects.get(racer.objectId), yaw = object.heading * Math.PI / 32768;

        racer.isStartPending = false;
        if (this.time > 0) {
            let elapsed = 0, distance = 0, segment = 0;

            while (true) {
                const ratio = segment < racer.arrRatios.length ? racer.arrRatios[segment] : 0;
                const segmentEnd = Math.fround(elapsed + SEGMENT_LENGTH / (ratio * racer.groundSpeed));

                if (segmentEnd > this.time) {
                    distance = Math.fround(distance + (this.time - elapsed) * ratio * racer.groundSpeed);
                    break;
                }

                elapsed = segmentEnd;
                segment++;
                distance = Math.fround(distance + SEGMENT_LENGTH);
                if (this.time <= elapsed || segment > racer.arrRatios.length) break;
            }

            racer.segment = segment;
            tmpLocation.set(racer.origin.x + Math.cos(yaw) * distance, racer.origin.y + Math.sin(yaw) * distance, racer.origin.z);
        } else tmpLocation.copy(racer.origin);

        setVector(object.position, tmpLocation);
        this.network.movement.adjustPawnLocation(object, object.position);
        if (this.time !== -1) this.moveRacer(racer);
    }

    protected moveRacer(racer: Racer_T) { // controller 0x10534120 toward the extended destination
        const object = this.network.actors.objects.get(racer.objectId);

        if (!object || !object.actor) return;

        object.destination = racer.destination.clone();
        object.actor.getComponent<PawnMovementComponent>("pawnMovement").addMoveTo(object.actor.position, object.destination);
    }

    protected updateSegment(racer: Racer_T, position: Vector3) { // 0x103fcc70: one boundary per tick, next ratio re-timed to absorb the overshoot
        const distance = racer.origin.distanceTo(position), boundary = (racer.segment + 1) * SEGMENT_LENGTH;

        if (boundary > distance) return;

        const overshoot = Math.fround(distance - boundary), count = racer.arrRatios.length;
        const current = racer.segment < count ? racer.arrRatios[racer.segment] : 0, next = racer.segment + 1 < count ? racer.arrRatios[racer.segment + 1] : 0;

        if (racer.segment + 1 < count) {
            const overshootTime = Math.fround(overshoot / (racer.groundSpeed * current)), remainingTime = (SEGMENT_LENGTH - overshoot) / (racer.groundSpeed * next);

            racer.arrRatios[racer.segment + 1] = Math.fround(SEGMENT_LENGTH / (remainingTime + overshootTime) / racer.groundSpeed);
        }

        racer.segment++;
    }

    protected isRaceFinished() { // 0x10498820
        for (const racer of this.arrRacers) {
            const object = this.network.actors.objects.get(racer.objectId);

            if (!object || !object.actor) continue;
            if (racer.segment !== racer.arrRatios.length - 1 || object.actor.isLocomoting() || racer.isFinished) return false;
        }

        return true;
    }

    protected finishRace() { // 0x104997e0: fastest gets s_u007_b + race_end, second is only marked, the rest stop in their wait animation
        this.arrRacers.forEach((racer, index) => {
            const object = this.network.actors.objects.get(racer.objectId);

            if (!object || !object.actor || racer.isFinished) return;

            racer.isFinished = true;
            if (index === this.arrRacers.length - 1) void this.network.combat.spawnRaceWinnerEffect(object.actor);
            else if (index !== this.arrRacers.length - 2) {
                object.destination = null;
                object.actor.stopMoving();
                this.network.combat.setIdleAnimation(object);
            }
        });
    }
}

export default NetworkMonRace;
