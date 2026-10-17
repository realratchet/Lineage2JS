import { Vector3 } from "three";
import BaseActor from "./base-actor";
import WaterEffectsComponent from "./physics/components/water-effects-component";
import type RenderManager from "./rendering/render-manager";
import LandmarkComponent from "./rendering/components/landmark-component";

export class Player extends BaseActor {
    public readonly isPlayer = true;
    public readonly type = "Player";

    public constructor(renderManager: RenderManager) {
        super(renderManager);

        this.movementComponent.setPhysicsTickRate(60);
        this.addComponent(new WaterEffectsComponent());
        this.addComponent(new LandmarkComponent(renderManager, classPath => renderManager.getParent().getComponent("asset").createLandmarkEffect(classPath)));
    }

    public getCameraTargetPosition(target: Vector3): Vector3 {
        this.getWorldPosition(target);
        // CalcBehindView 0x807ceb..0x807d1b uses ViewTarget.Location + CameraViewHeightAdjust.
        target.z += this.getCollisionHeight() + (this.renderManager.getParent().getComponent("asset").playerController.scriptProperties.get("CameraViewHeightAdjust") as number);
        return target;
    }

    public addLandmark(position: Vector3, normal: Vector3): void { this.getComponent<LandmarkComponent>("landmark").addLandmark(position, normal); }
    public deleteLandmark(immediate: boolean = true): void { this.getComponent<LandmarkComponent>("landmark").deleteLandmark(immediate); }
}

export default Player;
