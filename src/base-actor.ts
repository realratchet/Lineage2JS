import { Object3D } from "three";
import RenderManager from "./rendering/render-manager";

class BaseActor extends Object3D {
    public readonly isActor = true;
    public readonly type: string = "Actor";

    protected lastUpdate: number;

    public update(renderManager: RenderManager, currentTime: number, deltaTime: number) {
        this.lastUpdate = currentTime;
    }
}

export default BaseActor;
export { BaseActor };