import { Object3D, Scene, Vector3 } from "three";
import type Player from "@client/player";

const ACTIVE_EFFECT = "LineageEffect.e_u093_a";
const COMPLETION_EFFECT = "LineageEffect.e_u093_b";
const COMPLETION_DISTANCE_SQ = 30 * 30;
const MIN_SURFACE_NORMAL_Z = 0.5; // FLandMark::AddLandMark 0x82a74b-0x82a785
const axisUp = new Vector3(0, 0, 1);
const tmpNormal = new Vector3();

type EffectFactory_T = (classPath: string) => Object3D;

class Landmark {
    protected readonly owner: Player;
    protected readonly scene: Scene;
    protected readonly createEffect: EffectFactory_T;
    protected readonly retiringEffects = new Set<Object3D>();
    protected activeEffect: Object3D = null;
    protected completionEffect: Object3D = null;
    protected hasOwnerMoved = false;

    public constructor(owner: Player, scene: Scene, createEffect: EffectFactory_T) {

        this.owner = owner;
        this.scene = scene;
        this.createEffect = createEffect;
    }

    public addLandmark(position: Vector3, normal: Vector3): void {
        if (normal.z <= MIN_SURFACE_NORMAL_Z || normal.z > 1) return;

        this.deleteLandmark(true);

        const effect = this.activeEffect = this.createEffect(ACTIVE_EFFECT);

        effect.position.copy(position);

        effect.quaternion.setFromUnitVectors(axisUp, tmpNormal.copy(normal).normalize());

        this.hasOwnerMoved = false;
        this.scene.add(effect);
    }

    public update(): void {
        if (this.completionEffect && this.isEffectFinished(this.completionEffect)) {
            this.removeEffect(this.completionEffect);
            this.completionEffect = null;
        }

        for (const effect of this.retiringEffects) {
            if (!this.isEffectFinished(effect)) continue;

            this.removeEffect(effect);
            this.retiringEffects.delete(effect);
        }

        if (!this.activeEffect) return;

        if (this.owner.position.distanceToSquared(this.activeEffect.position) < COMPLETION_DISTANCE_SQ) {
            const effect = this.createEffect(COMPLETION_EFFECT);

            effect.position.copy(this.activeEffect.position);
            effect.quaternion.copy(this.activeEffect.quaternion);

            this.removeEffect(this.activeEffect);
            this.activeEffect = null;

            if (this.completionEffect) this.removeEffect(this.completionEffect);

            this.completionEffect = effect;
            this.scene.add(effect);
            return;
        }

        if (!this.owner.isIdle()) this.hasOwnerMoved = true;

        if (!this.owner.isLocomoting() || this.hasOwnerMoved && this.owner.isIdle())
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

    protected isEffectFinished(effect: Object3D): boolean {
        let hasEmitter = false;
        let isFinished = true;

        effect.traverse(child => {
            const emitter = child as any;

            if (!emitter.particlePool) return;

            hasEmitter = true;
            if (!emitter.isFinished()) isFinished = false;
        });

        return hasEmitter && isFinished;
    }

    protected removeEffect(effect: Object3D): void {
        if (!effect) return;

        effect.removeFromParent();
        effect.traverse(child => {
            const mesh = child as any;

            if (!mesh.isMesh) return;

            const materials = mesh.material instanceof Array ? mesh.material : [mesh.material];

            for (const material of materials) material.dispose();
            if (mesh.isInstancedSpriteMesh) mesh.geometry.dispose();
        });
    }
}

export default Landmark;
export { Landmark };
