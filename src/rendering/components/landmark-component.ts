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
const tmpLocation = new Vector3();

type EffectFactory_T = (classPath: string) => Object3D;

export class LandmarkComponent extends ObjectComponent<Player> {
    protected readonly renderManager: RenderManager;
    protected readonly createEffect: EffectFactory_T;
    protected activeEffect: Object3D = null;
    protected completionEffect: Object3D = null;

    public readonly componentName = "landmark";
    public isEnabled = true;

    public constructor(renderManager: RenderManager, createEffect: EffectFactory_T) {
        super();

        this.renderManager = renderManager;
        this.createEffect = createEffect;
    }

    public addLandmark(position: Vector3, normal: Vector3, base: Object3D = null): void {
        if (!this.isEnabled || normal.z <= MIN_SURFACE_NORMAL_Z || normal.z > 1) return;

        this.deleteLandmark(true);

        const effect = this.activeEffect = this.createEffect(ACTIVE_EFFECT);

        effect.position.copy(position);

        effect.quaternion.setFromUnitVectors(axisUp, tmpNormal.copy(normal).normalize());

        this.renderManager.addTransientEffect(effect);
        if (base) base.attach(effect);
    }

    public onUpdate(_currentTime: number, _deltaTime: number): void {
        if (this.completionEffect && !this.completionEffect.parent) this.completionEffect = null;

        if (!this.activeEffect) return;
        if (!this.activeEffect.parent) { this.activeEffect = null; return; }

        this.activeEffect.getWorldPosition(tmpLocation);

        if (this.getParent().position.distanceToSquared(tmpLocation) < COMPLETION_DISTANCE_SQ) {
            const effect = this.createEffect(COMPLETION_EFFECT), base = this.activeEffect.parent;

            effect.position.copy(tmpLocation);
            this.activeEffect.getWorldQuaternion(effect.quaternion);

            this.removeEffect(this.activeEffect);
            this.activeEffect = null;

            if (this.completionEffect) this.removeEffect(this.completionEffect);

            this.completionEffect = effect;
            this.renderManager.addTransientEffect(effect);
            if (base !== this.renderManager.scene) base.attach(effect);
            return;
        }

        // FLandMark::Update 0x10556de9..0x10556e03 waits until LifeSpan is below 29.
        if (this.getParent().isIdle() && (this.activeEffect as any).scriptProperties.get("LifeSpan") < 29)
            this.deleteLandmark(false);
    }

    public deleteLandmark(immediate: boolean = true): void {
        if (this.activeEffect) {
            this.removeEffect(this.activeEffect);
            this.activeEffect = null;
        }

        if (!immediate) return;

        if (this.completionEffect) {
            this.removeEffect(this.completionEffect);
            this.completionEffect = null;
        }

    }

    protected removeEffect(effect: Object3D): void {
        if (!effect || !effect.parent) return;

        this.renderManager.removeTransientEffect(effect);
    }
}

export default LandmarkComponent;
