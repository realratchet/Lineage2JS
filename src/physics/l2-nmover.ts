import { Vector3 } from "three";

const tmpDirection = new Vector3();

// shortcut: one target and constant acceleration; extend when target arrays or acceleration ramps are used.
export class L2NMover {
    public readonly position: Vector3;
    protected readonly target: Vector3;
    protected readonly targetMover: L2NMover;
    protected readonly acceleration: number;
    protected speed: number;
    protected ended = false;

    public constructor(origin: Vector3, target: Vector3, speed: number, acceleration: number, targetMover: L2NMover = null) {
        this.position = origin.clone();
        this.target = target;
        this.speed = speed;
        this.acceleration = acceleration;
        this.targetMover = targetMover;
    }

    public isEnded(): boolean { return this.ended; }

    public tick(deltaTime: number): void {
        if (this.ended || deltaTime <= 0) return;

        if (this.targetMover) this.targetMover.tick(deltaTime);

        // AL2NMover::MoveTick 0x794502..0x7948bc; shipped L2NMover defaults bound speed to 1..2000.
        while (deltaTime > 0) {
            const step = Math.min(deltaTime, Math.fround(0.2));
            this.speed = Math.max(1, Math.min(2000, Math.fround(this.speed + step * this.acceleration)));
            tmpDirection.subVectors(this.target, this.position);
            const distance = tmpDirection.length(), travel = step * this.speed;

            if (distance <= travel) {
                this.position.copy(this.target);
                this.ended = !this.targetMover || this.targetMover.isEnded();
                return;
            }

            tmpDirection.multiplyScalar(travel / distance);
            this.position.set(Math.fround(this.position.x + tmpDirection.x), Math.fround(this.position.y + tmpDirection.y), Math.fround(this.position.z + tmpDirection.z));
            deltaTime -= step;
        }
    }
}

export default L2NMover;
