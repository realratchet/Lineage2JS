import { PhysicsComponent } from "../../physics/components/physics-component";
import { EPhysics_T } from "../../assets/unreal/un-aactor";
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

    public onPhysicsTick(currentTime: number, deltaTime: number, _actors: BaseActor[]): boolean {
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

        effect.updateComponents(currentTime, deltaTime * 0.001);
        if (!effect.parent) return true;

        // Engine.dll physTrailer 0x8ce2f6..0x8ce31c: ownerless trailers destroy themselves only with this flag.
        if (properties?.get("Physics") === EPhysics_T.PHYS_Trailer && properties.get("bTrailerNoOwnerDestroy") && !(effect as any).scriptOwner) {
            this.renderManager.removeTransientEffect(effect);
            return true;
        }

        while (root.parent) root = root.parent;

        if (root === this.renderManager.scene && !this.physicsManager.isEmitterEffectFinished(effect)) return false;

        this.renderManager.removeTransientEffect(effect);

        return true;
    }
}

export default EffectLifetimeComponent;
