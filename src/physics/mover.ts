import { Vector3 } from "three";

const tmpDirection = new Vector3();
const tmpOldPosition = new Vector3();

class NMover {
    protected readonly origin: Vector3;
    protected readonly position: Vector3;
    protected readonly arrPoints: Vector3[];
    protected readonly arrOffsets: readonly [number, number, number][];
    protected readonly acceleration: number;
    protected speed: number;
    protected index = 0;

    public constructor(origin: Vector3, target: Vector3, offsets: readonly [number, number, number][], speed: number, acceleration: number) {
        if (offsets.length < 2) throw new Error(`NMover needs at least two path points.`);

        this.origin = origin.clone();
        this.position = origin.clone();
        this.arrOffsets = offsets;
        this.arrPoints = offsets.map(() => new Vector3());
        this.speed = speed;
        this.acceleration = acceleration;

        // Engine.dll FNMover::AdjustPosition 0x794b90 changes the path origin, not the actor location.
        this.getOffsetPoints(target);
        this.position.copy(this.arrPoints[0]);
        this.origin.copy(this.position);
    }

    public getSpeed(): number { return this.speed; }

    public getVelocity(location: Vector3, target: Vector3, deltaTime: number, out: Vector3): Vector3 {
        if (this.index === this.arrPoints.length - 1) return out.subVectors(target, location).normalize().multiplyScalar(this.speed);

        const start = this.arrPoints[this.index], end = this.arrPoints[this.index + 1];
        const fraction = this.position.distanceTo(start) / end.distanceTo(start);

        if (!Number.isFinite(fraction)) throw new Error(`NMover has a zero-length path segment.`);

        // Engine.dll GetVelocity_NMT_USEPATH 0x794c34..0x794f38 rebuilds the path while retaining segment progress.
        this.getOffsetPoints(target);
        this.arrPoints[this.arrPoints.length - 1].copy(target);
        this.position.lerpVectors(start, end, fraction);
        tmpOldPosition.copy(this.position);
        tmpDirection.subVectors(end, start).normalize().multiplyScalar(this.speed + this.acceleration * deltaTime);
        this.position.addScaledVector(tmpDirection, deltaTime);

        if (tmpOldPosition.distanceTo(end) <= tmpOldPosition.distanceTo(this.position)) this.index++;

        this.speed = tmpDirection.length();
        return out.subVectors(this.position, location).normalize().multiplyScalar(this.speed);
    }

    protected getOffsetPoints(target: Vector3): void {
        for (let i = 0; i < this.arrPoints.length; i++) {
            const [fraction, offset, height] = this.arrOffsets[i];
            const point = this.arrPoints[i].lerpVectors(this.origin, target, fraction);
            let angle = Math.atan2(point.y - this.origin.y, point.x - this.origin.x);

            if (angle < 0) angle += Math.PI * 2;
            if (offset < 0) angle += Math.PI / 2;
            else if (offset > 0) angle -= Math.PI / 2;

            point.x += Math.cos(angle) * Math.abs(offset);
            point.y += Math.sin(angle) * Math.abs(offset);
            point.z += height;
        }
    }
}

export default NMover;
export { NMover };
