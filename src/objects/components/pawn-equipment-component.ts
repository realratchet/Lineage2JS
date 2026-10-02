import { Mesh } from "three";
import { GameObject, ObjectComponent } from "../../game/components";
import type BaseActor from "../../base-actor";
import type { DecodeLibrary } from "@l2js/engine";
import ActorMeshComponent from "../../rendering/components/actor-mesh-component";
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
    protected item: EquippedItem = null;

    public constructor(library: DecodeLibrary, renderManager: RenderManager) {
        super();

        this.library = library;
        this.renderManager = renderManager;
    }

    public onAttach(): void {
        const parent = this.getParent();
        const bow = this.library.npcBow;

        if (!bow) return;

        const item = new EquippedItem();

        item.scriptProperties.set("Mesh", bow.weaponMesh);
        item.scriptProperties.set("Skins", bow.weaponSkins);
        item.scriptProperties.set("bUnlit", false);
        item.scriptProperties.set("AmbientGlow", parent.getUnrealScriptProperty("AmbientGlow"));
        item.scriptProperties.set("ScaleGlow", parent.getUnrealScriptProperty("ScaleGlow"));
        item.addComponent(new ActorMeshComponent(this.library, this.renderManager));
        item.getComponent<ActorMeshComponent>("actorMesh").onUpdate();

        if (!parent.attachObjectToBone(item, parent.getUnrealScriptProperty("LeftHandBone") as string, false)) {
            disposeMaterials(item);
            item.detachComponents();
            throw new Error(`Pawn '${parent.scriptClassId}' cannot attach its bow to LeftHandBone.`);
        }

        this.item = item;
    }

    public onDetach(): void {
        const item = this.item;

        if (!item) return;

        if (item.parent) this.renderManager.removeTransientEffect(item);
        this.item = null;
    }
}

export default PawnEquipmentComponent;
