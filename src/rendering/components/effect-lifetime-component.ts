import { PhysicsComponent } from "../../physics/components/physics-component";
import type { IObject } from "../../game/components";
import type BaseActor from "../../base-actor";
import type RenderManager from "../render-manager";

export class EffectLifetimeComponent extends PhysicsComponent<IObject & THREE.Object3D> {
    public readonly componentName = "effectLifetime";
    protected readonly renderManager: RenderManager;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onPhysicsTick(_currentTime: number, deltaTime: number, _actors: BaseActor[]): boolean {
        const effect = this.getParent();
        const properties = (effect as any).scriptProperties;
        const lifeSpan = properties?.get("LifeSpan");
        let root: THREE.Object3D = effect;

        if (lifeSpan !== undefined && lifeSpan !== 0) {
            if (!Number.isFinite(lifeSpan)) throw new Error(`Invalid LifeSpan for '${effect.name}'.`);

            // Engine.dll TickAuthoritative 0x8651eb..0x865226: zero disables; expiry precedes physics.
            const remaining = lifeSpan - deltaTime * 0.001;

            properties.set("LifeSpan", remaining);
            if (remaining <= 0.0001) {
                this.renderManager.removeTransientEffect(effect);
                return true;
            }
        }

        while (root.parent) root = root.parent;

        if (root === this.renderManager.scene && !this.physicsManager.isEmitterEffectFinished(effect)) return false;

        this.renderManager.removeTransientEffect(effect);

        return true;
    }
}

export default EffectLifetimeComponent;
