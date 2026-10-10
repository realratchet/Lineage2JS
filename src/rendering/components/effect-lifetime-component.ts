import { Quaternion, Vector3 } from "three";
import { PhysicsComponent } from "../../physics/components/physics-component";
import { EPhysics_T } from "../../assets/unreal/un-aactor";
import type { IObject } from "../../game/components";
import type BaseActor from "../../base-actor";
import type RenderManager from "../render-manager";

const tmpTrailerOffset = new Vector3();
const tmpOwnerRotation = new Quaternion();

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

        if (properties?.get("Physics") === EPhysics_T.PHYS_Trailer) {
            const owner = (effect as any).scriptOwner as THREE.Object3D;

            if (!owner && properties.get("bTrailerNoOwnerDestroy")) {
                this.renderManager.removeTransientEffect(effect);
                return true;
            }
            if (owner && (properties.get("bSelfRotation") || !(effect as any).scriptBase)) { // Engine.dll physTrailer 0x8ce32e..0x8ce5ef.
                owner.getWorldPosition(effect.position);
                if (properties.get("bRelativeTrail")) {
                    owner.getWorldQuaternion(tmpOwnerRotation);
                    effect.position.add(tmpTrailerOffset.fromArray(properties.get("RelativeTrailOffset")).applyQuaternion(tmpOwnerRotation));
                } else if (properties.get("bTrailerPrePivot")) effect.position.add(tmpTrailerOffset.fromArray(properties.get("PrePivot")));
                if (!properties.get("bSelfRotation") && properties.get("bTrailerSameRotation")) owner.getWorldQuaternion(effect.quaternion);
                effect.updateMatrixWorld(true);
            }
        }

        while (root.parent) root = root.parent;

        if (root === this.renderManager.scene && ((effect as any).isEmitterActor || !this.physicsManager.isEmitterEffectFinished(effect))) return false;

        this.renderManager.removeTransientEffect(effect);

        return true;
    }
}

export default EffectLifetimeComponent;
