import UAActor from "./un-aactor"

abstract class UPawn extends UAActor {
    declare protected mesh: GA.USkeletalMesh;
    declare protected isUnlit: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Mesh": "mesh",
            "bUnlit": "isUnlit"
        });
    }

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.ISkinnedMeshObjectDecodeInfo {
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
