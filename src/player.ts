import { Mesh, Vector3 } from "three";
import BaseActor from "./base-actor";
import WaterEffectsComponent from "@client/physics/components/water-effects-component";
import type RenderManager from "@client/rendering/render-manager";
import LandmarkComponent from "@client/rendering/components/landmark-component";

const tmpCameraTarget = new Vector3();

class Player extends BaseActor {
    public readonly isPlayer = true;
    public readonly type = "Player";

    protected cameraTargetHeight: number = 0;

    public constructor(renderManager: RenderManager) {
        super(renderManager);

        this.movementComponent.setPhysicsTickRate(60);
        this.addComponent(new WaterEffectsComponent());
        this.addComponent(new LandmarkComponent(renderManager.scene, classPath => renderManager.getParent().getComponent("asset").createLandmarkEffect(classPath)));
    }

    public setMeshes(meshes: Mesh[]) {
        super.setMeshes(meshes);

        this.getBoneWorldPosition("bip01_spine1", tmpCameraTarget);
        this.cameraTargetHeight = tmpCameraTarget.z - this.position.z;
    }

    public getCameraTargetPosition(target: Vector3): Vector3 {
        return target.copy(this.position).setZ(this.position.z + this.cameraTargetHeight);
    }

    public addLandmark(position: Vector3, normal: Vector3): void { this.getComponent<LandmarkComponent>("landmark").addLandmark(position, normal); }
    public deleteLandmark(immediate: boolean = true): void { this.getComponent<LandmarkComponent>("landmark").deleteLandmark(immediate); }
}

export default Player;
export { Player };
