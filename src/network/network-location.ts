import { Vector3 } from "three";
import type * as GamePackets from "./game-packets";

export function setVector(target: Vector3, location: GamePackets.Location_T): Vector3 { return target.set(location.x, location.y, location.z); }

export function getDistance(a: Vector3, b: Vector3): number {
    const x = Math.fround(Math.fround(a.x) - Math.fround(b.x)), y = Math.fround(Math.fround(a.y) - Math.fround(b.y)), z = Math.fround(Math.fround(a.z) - Math.fround(b.z));

    return Math.fround(Math.sqrt(x * x + y * y + z * z));
}
