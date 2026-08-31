import UAActor from "./un-aactor"
import type { USkeletalMesh } from "./skeletal-mesh/un-skeletal-mesh";
import type { DecodeLibraryBuilder } from "./decode-library-builder";

abstract class UPawn extends UAActor {
    declare protected mesh: USkeletalMesh;
    declare protected isUnlit: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Mesh": "mesh",
            "bUnlit": "isUnlit"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder): GD.ISkinnedMeshObjectDecodeInfo {
        if (!this.mesh) {
            console.warn(`Pawn '${this.objectName}' has no mesh, skipping`);
            return null;
        }

        const meshInfo = Object.assign({}, builder.pullSkeletalMesh(this.mesh));

        meshInfo.name = this.objectName;
        meshInfo.position = this.location.getElements();
        meshInfo.scale = this.scale.getElements().map(v => v * this.drawScale) as GD.Vector3Arr;
        meshInfo.quaternion = this.rotation.getQuaternionElements();
        meshInfo.scaledGlow = this.scaleGlow ?? 1;
        meshInfo.ambient = { glow: this.getAmbientLightingActor().ambientGlow ?? 0, isUnlit: !!this.isUnlit };

        return meshInfo;
    }
}

export default UPawn;
export { UPawn };
