import { Object3D } from "three";
import { ObjectComponent } from "../../game/components";
import decodeObject3D from "../../assets/decoders/object3d-decoder";
import decodeMaterial from "../../assets/decoders/material-decoder";
import type { IObject } from "../../game/components";
import type { DecodeLibrary } from "@l2js/engine";
import type { ISkinnedMeshObjectDecodeInfo } from "@l2js/engine/contracts/skeletal-mesh";
import type LitSkinnedMesh from "../../objects/lit-skinned-mesh";
import type RenderManager from "../render-manager";

type MeshActor_T = Object3D & IObject & { scriptProperties: Map<string, any> };

export class ActorMeshComponent extends ObjectComponent<MeshActor_T> {
    public readonly componentName = "actorMesh";
    protected readonly library: DecodeLibrary;
    protected readonly renderManager: RenderManager;
    protected mesh: LitSkinnedMesh = null;
    protected meshPath: string = null;
    protected skins: string[] = null;

    public constructor(library: DecodeLibrary, renderManager: RenderManager) {
        super();

        this.library = library;
        this.renderManager = renderManager;
    }

    public onUpdate(): void {
        const parent = this.getParent();
        const properties = parent.scriptProperties;
        const meshPath = properties.get("Mesh") as string;
        const skins = properties.get("Skins") as string[];

        if (meshPath === this.meshPath && this.skins && skins.length === this.skins.length && skins.every((skin, index) => skin === this.skins[index])) return;

        if (this.mesh) {
            const materials = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];

            for (const material of materials) material.dispose();
            this.mesh.skeleton.dispose();
            this.mesh.removeFromParent();
            this.mesh = null;
        }

        this.meshPath = meshPath;
        this.skins = skins.slice();

        if (!meshPath || meshPath.toLowerCase() === "none") return;

        const info = this.library.scriptMeshes[meshPath.toLowerCase()] as ISkinnedMeshObjectDecodeInfo;

        if (!info) throw new Error(`Actor mesh '${meshPath}' has not been decoded.`);

        this.mesh = decodeObject3D(this.library, info) as LitSkinnedMesh;

        const materials = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
        const extended = this.mesh.geometry.getAttribute("skinWeight2") !== undefined;

        for (let i = 0; i < materials.length; i++) {
            const path = skins[i];

            if (!path || path.toLowerCase() === "none") continue;

            const uuid = this.library.scriptMaterials[path.toLowerCase()];

            if (!uuid) throw new Error(`Actor skin '${path}' has not been decoded.`);

            const material = decodeMaterial(this.library, this.library.materials[uuid]);

            if (!material || Array.isArray(material)) throw new Error(`Actor skin '${path}' is not a single material.`);

            if (extended) (material as any).setExtendedBoneInfluences();
            (material as any).setActorLit();
            materials[i].dispose();
            materials[i] = material;
        }

        this.mesh.material = materials;
        this.mesh.isUnlit = !!properties.get("bUnlit");
        this.mesh.ambientGlow = properties.get("AmbientGlow");
        this.mesh.scaledGlow = properties.get("ScaleGlow");
        parent.add(this.mesh);
        this.mesh.updateMatrixWorld(true);
        this.mesh.skeleton.update();
        this.renderManager.registerActorMesh(this);
    }

    public onDetach(): void {
        this.renderManager.unregisterActorMesh(this);
        if (this.mesh) this.mesh.skeleton.dispose();
    }
}

export default ActorMeshComponent;
