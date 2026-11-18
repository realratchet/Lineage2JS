import RotatingObject from "./rotating-object";
import type { CollidingMeshProps_T } from "./colliding-mesh";
import { setScriptObjectProperty } from "./actor-properties";
import type { ISwayingDecodeInfo } from "@l2js/engine/contracts/mesh";
import type { Vector3Arr } from "@l2js/engine";

const axisOrder = [0, 2, 1];

type AttachedActor_T = { object: THREE.Object3D, relativeLocation: THREE.Vector3, relativeRotation: THREE.Quaternion };

function appRand(): number { return Math.floor(Math.random() * 32768); }

function setRelativeLocation(object: THREE.Object3D, base: THREE.Object3D): void {
    setScriptObjectProperty(object, "RelativeLocation", [
        Math.fround(object.position.x - base.position.x),
        Math.fround(object.position.y - base.position.y),
        Math.fround(object.position.z - base.position.z)
    ]);
}

export class SwayingObject extends RotatingObject {
    public readonly isSwayingObject: boolean = true;

    protected readonly swaying: ISwayingDecodeInfo;
    protected readonly currentMax: Vector3Arr = [-1, -1, -1];
    protected readonly cycleTime: Vector3Arr = [0, 0, 0];
    protected readonly cycleDeltaTime: Vector3Arr = [0, 0, 0];
    protected readonly arrRotation: Vector3Arr = [0, 0, 0];
    protected orgRotator: Vector3Arr = null;
    protected readonly attached: AttachedActor_T[] = [];

    public constructor(props: CollidingMeshProps_T & { swaying: ISwayingDecodeInfo }) {
        super({ ...props, rotating: { rotator: props.swaying.orgRotator, rate: [0, 0, 0] } });

        this.swaying = props.swaying;
    }

    // Actor.uc:398 Attached/RelativeLocation/RelativeRotation. Emitters retain their zone parent.
    public attachActor(object: THREE.Object3D): void {
        const inv = this.quaternion.clone().invert();

        setRelativeLocation(object, this);
        this.attached.push({
            object,
            relativeLocation: object.position.clone().sub(this.position).applyQuaternion(inv),
            relativeRotation: inv.clone().multiply(object.quaternion)
        });
    }

    public updateRotation(deltaTime: number): void {
        const dt = Math.fround(deltaTime / 1000);
        const { rate, max, accelRatio, maxRandom } = this.swaying;
        const rotation = this.arrRotation;

        if (!this.orgRotator) this.initMovement(dt);
        else for (const axis of axisOrder) {
            const amplitude = this.currentMax[axis];

            rotation[axis] = this.orgRotator[axis];
            if (amplitude < 0) continue;

            // AMovableStaticMeshActor::physL2Movement 0x8d3c67..0x8d4030.
            const time = this.cycleTime[axis] + dt;
            const cycle = this.cycleDeltaTime[axis];
            const speed = max[axis] / amplitude * accelRatio[axis];
            const period = cycle * 4 / speed;
            this.cycleTime[axis] = Math.fround(time);

            if (period <= time) {
                this.cycleTime[axis] = Math.fround(time - Math.fround(period));
                if (maxRandom) {
                    const low = Math.fround((appRand() % 100) * Math.fround(0.005));
                    const high = Math.fround((appRand() % 100) * Math.fround(0.005));
                    const ratio = Math.min(Math.fround(0.4), Math.max(Math.fround(0.2), low)) + high;

                    this.currentMax[axis] = Math.fround(max[axis] * ratio);
                } else this.currentMax[axis] = max[axis];
                this.cycleDeltaTime[axis] = Math.fround(this.currentMax[axis] * 4 / rate[axis]);
            } else {
                rotation[axis] = (rotation[axis] + Math.sin(time * speed * Math.PI / cycle) * amplitude) | 0;
            }
        }

        const [pitch, yaw, roll] = rotation;

        if (pitch === this.rotator.pitch && yaw === this.rotator.yaw && roll === this.rotator.roll) return;
        this.rotator.set(pitch, yaw, roll).toQuaternion(this.quaternion);
        setScriptObjectProperty(this, "Rotation", [pitch, yaw, roll]);
        if (this.isCollidable) this.syncCollisionTransform(false);
        for (const attachment of this.attached) {
            attachment.object.position.copy(attachment.relativeLocation).applyQuaternion(this.quaternion).add(this.position);
            attachment.object.quaternion.multiplyQuaternions(this.quaternion, attachment.relativeRotation);
            setRelativeLocation(attachment.object, this);
            attachment.object.updateMatrix(); // freezeStaticSubtree clears matrixAutoUpdate on emitter wrappers - recompose explicitly
        }
    }

    protected initMovement(dt: number): void {
        const { rate, max, maxRandom, randomStart } = this.swaying;
        const previous = this.getUnrealScriptProperty("L2OrgRotator") as Vector3Arr;
        this.orgRotator = this.getUnrealScriptProperty("Rotation") as Vector3Arr;

        for (const axis of axisOrder) {
            this.arrRotation[axis] = previous[axis];
            if (max[axis] <= 0 || rate[axis] <= 0) continue;

            const limit = max[axis];
            const amplitude = maxRandom ? Math.imul(appRand() % limit, appRand() % limit) % limit : limit;
            this.currentMax[axis] = Math.fround(amplitude);
            // 0x8d3c19 uses RollRate for the initial yaw cycle.
            this.cycleDeltaTime[axis] = Math.fround(this.currentMax[axis] * 4 / rate[axis === 1 ? 2 : axis]);
            this.cycleTime[axis] = randomStart ? Math.fround((appRand() % 1000) * Math.fround(0.001)) : dt;
        }
        setScriptObjectProperty(this, "L2OrgRotator", this.orgRotator);
        setScriptObjectProperty(this, "bL2InitMove", true);
    }
}

export default SwayingObject;
