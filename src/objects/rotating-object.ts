import { RigidBodyDesc } from "@dimforge/rapier3d";
import CollidingMesh, { type CollidingMeshProps_T } from "./colliding-mesh";
import Rotator from "../utils/rotator";
import { RotatingComponent } from "../physics/components/physics-component";
import type { IRotatingDecodeInfo } from "@l2js/engine/contracts/mesh";

export class RotatingObject extends CollidingMesh {
    public readonly isRotatingObject: boolean = true;

    protected readonly rotator: Rotator;
    protected readonly ratePitch: number;
    protected readonly rateYaw: number;
    protected readonly rateRoll: number;

    public constructor(props: CollidingMeshProps_T & { rotating: IRotatingDecodeInfo }) {
        super(props);

        this.rotator = new Rotator(...props.rotating.rotator);
        [this.ratePitch, this.rateYaw, this.rateRoll] = props.rotating.rate;
        this.addComponent(new RotatingComponent());
    }

    public makeCollider(indices: Uint32Array, vertices: Float32Array) {
        super.makeCollider(indices, vertices);
        this.rigidbodyDesc = RigidBodyDesc.kinematicPositionBased();
    }

    // fixed-dir physicsRotation: Rotation += RotationRate * deltaTime per axis (fixedTurn, UnPhysic.cpp:460)
    public updateRotation(deltaTime: number): void {
        const dt = deltaTime / 1000;

        this.rotator.pitch += this.ratePitch * dt;
        this.rotator.yaw += this.rateYaw * dt;
        this.rotator.roll += this.rateRoll * dt;

        this.rotator.toQuaternion(this.quaternion);

        if (this.rigidbody) this.rigidbody.setRotation(this.quaternion, true);
    }
}

export default RotatingObject;
