import { Object3D, Vector3 } from "three";
import { ObjectComponent } from "../../game/components";
import type Player from "../../player";
import type RenderManager from "../render-manager";

const ACTIVE_EFFECT = "LineageEffect.e_u093_a";
const COMPLETION_EFFECT = "LineageEffect.e_u093_b";
const COMPLETION_DISTANCE_SQ = 30 * 30;
const MIN_SURFACE_NORMAL_Z = 0.5; // FLandMark::AddLandMark 0x82a74b-0x82a785
const axisUp = new Vector3(0, 0, 1);
const tmpNormal = new Vector3();

type EffectFactory_T = (classPath: string) => Object3D;

class LandmarkComponent extends ObjectComponent<Player> {
    protected readonly renderManager: RenderManager;
    protected readonly createEffect: EffectFactory_T;
    protected readonly retiringEffects = new Set<Object3D>();
    protected activeEffect: Object3D = null;
    protected completionEffect: Object3D = null;
    protected hasOwnerMoved = false;

    public readonly componentName = "landmark";

    public constructor(renderManager: RenderManager, createEffect: EffectFactory_T) {
        super();

        this.renderManager = renderManager;
        this.createEffect = createEffect;
    }

    public addLandmark(position: Vector3, normal: Vector3): void {
        if (normal.z <= MIN_SURFACE_NORMAL_Z || normal.z > 1) return;

        this.deleteLandmark(true);

        const effect = this.activeEffect = this.createEffect(ACTIVE_EFFECT);

        effect.position.copy(position);

        effect.quaternion.setFromUnitVectors(axisUp, tmpNormal.copy(normal).normalize());

        this.hasOwnerMoved = false;
        this.renderManager.addTransientEffect(effect);
    }

    public onUpdate(_currentTime: number, _deltaTime: number): void {
        if (this.completionEffect && !this.completionEffect.parent) this.completionEffect = null;

        for (const effect of this.retiringEffects) {
            if (effect.parent) continue;

            this.retiringEffects.delete(effect);
        }

        if (!this.activeEffect) return;

        if (this.getParent().position.distanceToSquared(this.activeEffect.position) < COMPLETION_DISTANCE_SQ) {
            const effect = this.createEffect(COMPLETION_EFFECT);

            effect.position.copy(this.activeEffect.position);
            effect.quaternion.copy(this.activeEffect.quaternion);

            this.removeEffect(this.activeEffect);
            this.activeEffect = null;

            if (this.completionEffect) this.removeEffect(this.completionEffect);

            this.completionEffect = effect;
            this.renderManager.addTransientEffect(effect);
            return;
        }

        if (!this.getParent().isIdle()) this.hasOwnerMoved = true;

        if (!this.getParent().isLocomoting() || this.hasOwnerMoved && this.getParent().isIdle())
            this.deleteLandmark(false);
    }

    public deleteLandmark(immediate: boolean = true): void {
        if (this.activeEffect) {
            if (immediate) this.removeEffect(this.activeEffect);
            else {
                this.killEffect(this.activeEffect);
                this.retiringEffects.add(this.activeEffect);
            }

            this.activeEffect = null;
        }

        if (!immediate) return;

        if (this.completionEffect) {
            this.removeEffect(this.completionEffect);
            this.completionEffect = null;
        }

        for (const effect of this.retiringEffects) this.removeEffect(effect);
        this.retiringEffects.clear();
    }

    protected killEffect(effect: Object3D): void {
        effect.traverse(child => {
            const emitter = child as any;

            if (emitter.particlePool) emitter.kill();
        });
    }

    protected removeEffect(effect: Object3D): void {
        if (!effect || !effect.parent) return;

        this.renderManager.removeTransientEffect(effect);
    }
}

export default LandmarkComponent;
export { LandmarkComponent };
