import { Vector3 } from "three";
import { sinRotator } from "../../assets/unreal/utils/rotator";
import type PhysicsManager from "../../physics/physics-manager";
import type { CollisionQuery_T } from "../../physics/collision-world";
import type { ScriptHost_T } from "../../ue-script/vm";

const tmpDirection = new Vector3();
const tmpInitialDirection = new Vector3();
const tmpIdeal = new Vector3();
const tmpTraceStart = new Vector3();
const tmpTraceDelta = new Vector3();
const tmpTraceEnd = new Vector3();
const tmpHit = new Vector3();
const tmpDifference = new Vector3();
const tmpRotation: Vector3Arr = [0, 0, 0];
const tmpCandidate: Vector3Arr = [0, 0, 0];

function wrapAngle(value: number): number {
    value %= 65536;
    if (value > 32768) value -= 65536;
    if (value < -32767) value += 65536;
    return value;
}

function direction(rotation: Vector3Arr, target: Vector3): Vector3 {
    const pitch = rotation[0], yaw = rotation[1], cosPitch = sinRotator(pitch + 16384);

    return target.set(Math.fround(cosPitch * sinRotator(yaw + 16384)), Math.fround(cosPitch * sinRotator(yaw)), sinRotator(pitch));
}

function location(rotation: Vector3Arr, target: Vector3, distance: number, output: Vector3): Vector3 {
    direction(rotation, tmpDirection);
    return output.set(Math.fround(target.x - tmpDirection.x * distance), Math.fround(target.y - tmpDirection.y * distance), Math.fround(target.z - Math.fround(tmpDirection.z * distance)));
}

function distanceFrom(point: Vector3, x: number, y: number, z: number): number {
    tmpDifference.set(Math.fround(point.x - x), Math.fround(point.y - y), Math.fround(point.z - z));
    return tmpDifference.length();
}

export class VolumeCamera {
    protected readonly query: CollisionQuery_T = { location: tmpTraceStart, delta: tmpTraceDelta, extent: new Vector3(), sourceIsPlayer: false, ignorePawns: true };

    public constructor(protected readonly physics: PhysicsManager) {}

    protected trace(start: Vector3, end: Vector3): boolean {
        tmpTraceStart.copy(start);
        tmpTraceDelta.subVectors(end, start);
        const hit = this.physics.singleLineCheck(this.query);

        tmpHit.copy(hit ? hit.location : end);
        return hit !== null && hit.actor !== null;
    }

    protected isBlockRotation(rotation: Vector3Arr, target: Vector3, distance: number, radius: number): boolean {
        tmpRotation[0] = rotation[0]; tmpRotation[1] = rotation[1]; tmpRotation[2] = rotation[2];
        for (let i = 0; i < 4; i++) {
            tmpRotation[0] = rotation[0] + (i === 3 ? radius : 0);
            tmpRotation[1] = rotation[1] + (i === 1 ? radius : i === 2 ? -radius : 0);
            location(tmpRotation, target, distance, tmpTraceEnd);
            if (this.trace(target, tmpTraceEnd)) return true;
        }
        return false;
    }

    public update(controller: ScriptHost_T, rotation: Vector3Arr, target: Vector3, output: Vector3): void { // ALineagePlayerController::CalcVolumeCamera 0x105372c0.
        const properties = controller.scriptProperties, oldRotation = properties.get("OldCameraRotation") as Vector3Arr, oldLocation = properties.get("OldCameraLocation") as number[];
        const distance = Math.fround((properties.get("CurZoomingDist") as number) + 250), radius = properties.get("CurVolumeCameraRadius") as number;

        direction(rotation, tmpInitialDirection);
        location(rotation, target, distance, tmpIdeal);
        if (!this.isBlockRotation(rotation, target, distance, radius - 10)) {
            output.copy(tmpIdeal);
            return;
        }

        location(rotation, target, distance, tmpTraceEnd);
        tmpTraceEnd.set(Math.fround(target.x - tmpTraceEnd.x), Math.fround(target.y - tmpTraceEnd.y), Math.fround(target.z - tmpTraceEnd.z));
        this.trace(target, tmpTraceEnd);
        if (distanceFrom(tmpIdeal, oldLocation[0], oldLocation[1], oldLocation[2]) > Math.fround(distanceFrom(tmpIdeal, tmpHit.x, tmpHit.y, tmpHit.z))) {
            const projected = (target.x - tmpHit.x) * tmpInitialDirection.x + (target.y - tmpHit.y) * tmpInitialDirection.y + (target.z - tmpHit.z) * tmpInitialDirection.z;
            const clipped = Math.fround(Math.min(distance, projected));

            output.set(Math.fround(target.x - tmpInitialDirection.x * clipped), Math.fround(target.y - tmpInitialDirection.y * clipped), Math.fround(target.z - Math.fround(tmpInitialDirection.z * clipped)));
            return;
        }

        tmpCandidate[0] = rotation[0]; tmpCandidate[1] = rotation[1]; tmpCandidate[2] = rotation[2];
        const shortened = Math.fround(distance - distanceFrom(tmpIdeal, oldLocation[0], oldLocation[1], oldLocation[2]));
        for (let i = 0; i < 2; i++) {
            tmpCandidate[0] += Math.trunc(wrapAngle(oldRotation[0] - tmpCandidate[0]) * 0.5);
            tmpCandidate[1] += Math.trunc(wrapAngle(oldRotation[1] - tmpCandidate[1]) * 0.5);
            tmpCandidate[2] += Math.trunc((oldRotation[2] - tmpCandidate[2]) * 0.5);
            if (this.isBlockRotation(tmpCandidate, target, shortened, radius - 10)) continue;

            location(tmpCandidate, target, shortened, output);
            rotation[0] = tmpCandidate[0]; rotation[1] = tmpCandidate[1]; rotation[2] = tmpCandidate[2];
            properties.set("CurZoomingDist", Math.fround(shortened - 250));
            properties.set("CurVolumeCameraRadius", Math.max(10, radius - Math.max(Math.abs(wrapAngle(oldRotation[0] - rotation[0])), Math.abs(wrapAngle(oldRotation[1] - rotation[1])))));
            return;
        }
        location(oldRotation, target, shortened, output);
        rotation[0] = oldRotation[0]; rotation[1] = oldRotation[1]; rotation[2] = oldRotation[2];
        properties.set("CurZoomingDist", Math.fround(shortened - 250));
    }
}

export default VolumeCamera;
