import { Mesh } from "three";
import { GameObject, ObjectComponent } from "../../game/components";
import type BaseActor from "../../base-actor";
import type { DecodeLibrary } from "@l2js/engine";
import ActorMeshComponent from "../../rendering/components/actor-mesh-component";
import decodeObject3D from "../../assets/decoders/object3d-decoder";
import type { IEmitterActorDecodeInfo, IEmitterDecodeInfo } from "@l2js/engine/contracts/emitter";
import type RenderManager from "../../rendering/render-manager";

class EquippedItem extends GameObject {
    public readonly scriptProperties = new Map<string, any>();
}

function disposeMaterials(item: EquippedItem): void {
    item.traverse(object => {
        if (!(object as any).isMesh) return;

        const mesh = object as Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        for (const material of materials) material.dispose();
    });
}

export class PawnEquipmentComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnEquipment";
    protected readonly library: DecodeLibrary;
    protected readonly renderManager: RenderManager;
    protected readonly items: { object: GameObject; bone: string | number }[] = [];
    protected hiddenAnimation: string = null;

    public constructor(library: DecodeLibrary, renderManager: RenderManager) {
        super();

        this.library = library;
        this.renderManager = renderManager;
    }

    public onAttach(): void {
        const bow = this.library.npcBow;
        const equipment = this.library.pawnEquipment;

        if (equipment) {
            for (const item of equipment.items) {
                this.attachItem(item.mesh, item.skins, item.bone);
                if (item.enchantMesh) this.attachEnchantMesh(item.enchantMesh, item.bone);
                if (item.enchantEffect) this.attachEnchantEffect(item.enchantEffect, typeof item.bone === "string" && item.bone.startsWith("Left") ? "LeftHandBone" : "RightHandBone");
            }
        } else if (bow) this.attachItem(bow.weaponMesh, bow.weaponSkins, "LeftHandBone");
    }

    protected attachItem(mesh: string, skins: string[], bone: string | number): EquippedItem {
        const parent = this.getParent();
        const item = new EquippedItem();

        item.scriptProperties.set("Mesh", mesh);
        item.scriptProperties.set("Skins", skins);
        item.scriptProperties.set("bUnlit", false);
        item.scriptProperties.set("AmbientGlow", parent.getUnrealScriptProperty("AmbientGlow"));
        item.scriptProperties.set("ScaleGlow", parent.getUnrealScriptProperty("ScaleGlow"));
        item.addComponent(new ActorMeshComponent(this.library, this.renderManager));
        item.getComponent<ActorMeshComponent>("actorMesh").onUpdate();

        const boneName = typeof bone === "number" ? bone : parent.getUnrealScriptProperty(bone) as string;

        if (!parent.attachObjectToBone(item, boneName, false)) {
            disposeMaterials(item);
            item.detachComponents();
            throw new Error(`Pawn '${parent.scriptClassId}' cannot attach '${mesh}' to ${bone}.`);
        }

        this.items.push({ object: item, bone });
        return item;
    }

    protected attachEnchantMesh(info: L2JS.Engine.IWeaponEnchantMesh, bone: string): void {
        const item = this.attachItem(info.mesh, [info.skin], bone);

        item.scriptProperties.set("bActorShadows", false);
        item.scale.fromArray(info.scale);
        item.position.fromArray(info.offset).multiply(item.scale);
        item.traverse((object: any) => {
            if (!object.isMesh) return;

            const materials = Array.isArray(object.material) ? object.material : [object.material];

            for (const material of materials) {
                const fade = material.uniforms.shDiffuse.value?.fadeColors;

                if (!fade) continue;

                fade.color1.fromArray(info.colors[0]);
                fade.color2.fromArray(info.colors[1]);
            }
        });
    }

    protected attachEnchantEffect(info: L2JS.Engine.IWeaponEnchantEffect, bone: string): void {
        const parent = this.getParent();
        const template = this.library.effectTemplates[info.path];
        // FNWeaponEffect::Init 0x763551 / 0x763796..0x763917.
        const scale = Math.sqrt(parent.getCollisionRadius() * parent.getCollisionHeight() / 207);
        const children = template.children.map(source => {
            const child = structuredClone(source) as IEmitterDecodeInfo;

            for (const side of ["min", "max"] as const) {
                child.initial.scale[side] = child.initial.scale[side].map(value => value * info.scale * scale) as [number, number, number];
                child.initial.velocity[side] = child.initial.velocity[side].map(value => value * info.velocityScale * scale) as [number, number, number];
            }

            child.initial.offset = child.initial.offset.map(value => value * scale) as [number, number, number];
            child.opacity *= info.opacity > 0 ? info.opacity : 0.001;

            // AEmitter::SetMaxParticles 0x8a3960 only scales nonzero initial spawning rates.
            if (info.num > 0 && child.initial.particlesPerSecond !== 0 && child.maxParticles !== 0) {
                child.settings.maxParticles = child.maxParticles = Math.trunc(child.maxParticles * info.num);
                child.settings.initialParticlesPerSecond = child.initial.particlesPerSecond *= info.num;
            }

            return child;
        });
        const effect = decodeObject3D(this.library, { ...template, children } as IEmitterActorDecodeInfo) as GameObject;

        this.renderManager.addTransientEffect(effect, parent);

        if (!parent.attachObjectToBone(effect, parent.getUnrealScriptProperty(bone) as string, false)) {
            this.renderManager.removeTransientEffect(effect);
            throw new Error(`Pawn '${parent.scriptClassId}' cannot attach '${info.path}' to ${bone}.`);
        }

        effect.position.fromArray(info.offset).multiplyScalar(scale);
        this.items.push({ object: effect, bone });
    }

    public hideForAnimation(animation: string, right: boolean, left: boolean): void {
        this.hiddenAnimation = animation;

        for (const { object, bone } of this.items)
            object.visible = !(typeof bone === "string" && (bone.startsWith("Right") && right || bone.startsWith("Left") && left));
    }

    public onUpdate(): void {
        if (!this.hiddenAnimation || this.getParent().isPlayingOneShotAnimation(this.hiddenAnimation)) return;

        for (const item of this.items) item.object.visible = true;
        this.hiddenAnimation = null;
    }

    public onDetach(): void {
        for (const item of this.items)
            if (item.object.parent) this.renderManager.removeTransientEffect(item.object);
        this.items.length = 0;
    }
}

export default PawnEquipmentComponent;
