import { GameObject, ObjectComponent } from "../../game/components";
import type { DecodeLibrary } from "@l2js/engine";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import ActorMeshComponent from "../../rendering/components/actor-mesh-component";
import type AnimationComponent from "./animation-component";

class HeroMesh extends GameObject {
    public readonly scriptProperties = new Map<string, any>();
}

export class PawnHeroComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnHero";
    protected library: DecodeLibrary = null;
    protected effect: GameObject = null;
    protected mesh: HeroMesh = null;
    protected radius = -1;
    protected height = -1;

    public constructor(protected readonly renderManager: RenderManager) { super(); }

    public onAttach(): void { void this.load(); }

    protected async load(): Promise<void> {
        const library = await this.renderManager.getParent().getComponent("asset").loadHeroEffects();

        if (this.isAttached()) this.library = library;
    }

    public onUpdate(): void {
        if (!this.library) return;
        const parent = this.getParent();

        if (!this.mesh) {
            if (!this.getComponent<AnimationComponent>("animation").getMeshes().length) return;

            const mesh = this.mesh = new HeroMesh();

            mesh.scriptProperties.set("Mesh", this.library.name);
            mesh.scriptProperties.set("Skins", []);
            mesh.scriptProperties.set("bUnlit", true);
            mesh.scriptProperties.set("bActorShadows", false);
            mesh.scriptProperties.set("AmbientGlow", 0);
            mesh.scriptProperties.set("ScaleGlow", 1);
            const component = mesh.addComponent(new ActorMeshComponent(this.library, this.renderManager));

            component.onUpdate();
            component.getMesh().position.set(0, 0, 0);
            component.getMesh().quaternion.identity();
            component.getMesh().scale.setScalar(1);
            if (!parent.attachObjectToBone(mesh, 0, true)) throw new Error(`Hero '${parent.name}' has no root bone.`);

            const effect = this.effect = this.renderManager.getParent().getComponent("asset").createScriptObject(this.renderManager, this.library, "LineageEffect.e_u091_aura") as GameObject;

            this.renderManager.addTransientEffect(effect, parent);
            // APawn::UpdateAbnormalState 0x10496407..0x1049642b: radius / 9, root attachment with absolute rotation.
            const scale = Math.fround(Math.fround(parent.getCollisionRadius()) * Math.fround(1 / 9));

            effect.traverse((emitter: any) => {
                if (emitter.particlePool) emitter.setSizeScale(scale);
            });
            if (!parent.attachObjectToBone(effect, 0, true)) throw new Error(`Hero '${parent.name}' cannot attach its aura.`);
            this.renderManager.invalidatePawnLighting(parent);
            this.renderManager.queueShaderCompile(mesh);
        }

        const radius = parent.getCollisionRadius(), height = parent.getCollisionHeight();

        if (radius === this.radius && height === this.height) return;
        this.radius = radius;
        this.height = height;
        // USkeletalMeshInstance::Render 0x1069c3d4..0x1069c5ad.
        this.mesh.scale.setScalar(Math.fround(Math.fround(Math.sqrt(Math.fround(radius) * Math.fround(height)) / Math.sqrt(207)) * 3));
    }

    public onDetach(): void {
        if (this.effect && this.effect.parent) this.renderManager.removeTransientEffect(this.effect);
        if (this.mesh) {
            this.getParent().detachBoneObject(this.mesh);
            this.mesh.detachComponents();
            this.mesh.removeFromParent();
        }
        this.effect = null;
        this.mesh = null;
    }
}

export default PawnHeroComponent;
