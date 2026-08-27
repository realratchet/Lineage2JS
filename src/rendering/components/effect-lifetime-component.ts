import { PhysicsComponent } from "@client/physics/components/physics-component";
import type { IObject } from "@client/game/components";
import type BaseActor from "@client/base-actor";
import type RenderManager from "@client/rendering/render-manager";

class EffectLifetimeComponent extends PhysicsComponent<IObject & THREE.Object3D> {
    public readonly componentName = "effectLifetime";
    protected readonly renderManager: RenderManager;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onPhysicsTick(_currentTime: number, _deltaTime: number, _actors: BaseActor[]): boolean {
        const effect = this.getParent();
        let root: THREE.Object3D = effect;

        while (root.parent) root = root.parent;

        if (root === this.renderManager.scene && !this.physicsManager.isEmitterEffectFinished(effect)) return false;

        this.renderManager.removeTransientEffect(effect);

        return true;
    }
}

export default EffectLifetimeComponent;
export { EffectLifetimeComponent };
