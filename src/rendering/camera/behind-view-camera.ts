import { Vector3 } from "three";
import { sinRotator } from "../../assets/unreal/utils/rotator";
import type PhysicsManager from "../../physics/physics-manager";
import type { CollisionQuery_T } from "../../physics/collision-world";
import type { ICollidable } from "../../objects/objects";
import type { ScriptHost_T } from "../../ue-script/vm";

const tmpDirection = new Vector3();
const tmpStart = new Vector3();
const tmpDelta = new Vector3();
const tmpEnd = new Vector3();
const tmpHit = new Vector3();
const tmpDifference = new Vector3();
const tmpTarget = new Vector3();

function location(target: Vector3, distance: number, output: Vector3, storedProduct = false): void {
    const x = tmpDirection.x * distance;

    output.set(Math.fround(target.x - (storedProduct ? Math.fround(x) : x)), Math.fround(target.y - Math.fround(tmpDirection.y * distance)), Math.fround(target.z - Math.fround(tmpDirection.z * distance)));
}

function projection(target: Vector3): number {
    return (target.z - tmpHit.z) * tmpDirection.z + (target.y - tmpHit.y) * tmpDirection.y + (target.x - tmpHit.x) * tmpDirection.x;
}

export class BehindViewCamera {
    protected readonly query: CollisionQuery_T = { location: tmpStart, delta: tmpDelta, extent: new Vector3(), sourceIsPlayer: false, ignorePawns: true };

    public constructor(protected readonly physics: PhysicsManager) {}

    protected trace(start: Vector3, end: Vector3, extent: number): ICollidable | null {
        tmpStart.copy(start);
        tmpDelta.subVectors(end, start);
        this.query.extent.setScalar(extent);
        const hit = this.physics.singleLineCheck(this.query);

        if (!hit || !hit.actor) return null;
        tmpHit.set(Math.fround(hit.location.x), Math.fround(hit.location.y), Math.fround(hit.location.z));
        return hit.actor;
    }

    public update(controller: ScriptHost_T, rotation: Vector3Arr, target: Vector3, output: Vector3): void { // ALineagePlayerController::CalcBehindView 0x105382a0..0x10538a84.
        const properties = controller.scriptProperties, pitch = rotation[0], yaw = rotation[1], cosPitch = sinRotator(pitch + 16384);
        let distance = Math.fround((properties.get("CurZoomingDist") as number) + 250);

        target = tmpTarget.set(Math.fround(target.x), Math.fround(target.y), Math.fround(target.z));
        tmpDirection.set(Math.fround(cosPitch * sinRotator(yaw + 16384)), Math.fround(cosPitch * sinRotator(yaw)), sinRotator(pitch));
        if (properties.get("bUseHitCheckCamera")) {
            location(target, Math.fround(distance + 30), tmpEnd, true);
            tmpEnd.z = Math.fround(target.z - Math.fround(Math.fround(tmpDirection.z * Math.fround(distance + 30)) + 10));
            if (this.trace(target, tmpEnd, Math.fround(0.1))) distance = Math.fround(Math.min(distance, projection(target)));
            location(target, distance - 30, output);
            return;
        }

        location(target, distance - 30, output);
        while (true) {
            location(target, distance, tmpEnd, true);
            const actor = this.trace(tmpEnd, target, 0);

            if (!actor) break;
            if ((actor as any).isTerrain) {
                distance = Math.fround(Math.min(distance, Math.fround(projection(target))));
                location(target, distance - 30, output, true);
                break;
            }
            tmpDifference.subVectors(tmpHit, output);
            if (tmpDifference.length() > (properties.get("HitCheckCameraMinDist") as number)) break;
            distance = Math.fround(Math.min(distance, projection(target) - 30));
            location(target, distance - 30, output);
        }
        location(target, distance, tmpEnd, true);
        const actor = this.trace(target, tmpEnd, 0);

        if (actor && (actor as any).isTerrain) location(target, Math.fround(Math.min(distance, Math.fround(projection(target)))) - 30, output, true);
    }
}

export default BehindViewCamera;
