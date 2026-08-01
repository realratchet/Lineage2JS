import { Mesh, Vector3 } from "three";
import BaseActor from "./base-actor";

const tmpCameraTarget = new Vector3();

class Player extends BaseActor {
    public readonly isPlayer = true;
    public readonly type = "Player";

    protected cameraTargetHeight: number = 0;

    public setMeshes(meshes: Mesh[]) {
        super.setMeshes(meshes);

        this.getBoneWorldPosition("bip01_spine1", tmpCameraTarget);
        this.cameraTargetHeight = tmpCameraTarget.z - this.position.z;
    }

    public getCameraTargetPosition(target: Vector3): Vector3 {
        return target.copy(this.position).setZ(this.position.z + this.cameraTargetHeight);
    }
}

export default Player;
export { Player };
