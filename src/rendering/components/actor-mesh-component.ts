import { Object3D } from "three";
import { ObjectComponent } from "../../game/components";
import { decodeSkinnedMesh } from "../../assets/decoders/object3d-decoder";
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

        this.mesh = decodeSkinnedMesh(this.library, info, skins);

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
