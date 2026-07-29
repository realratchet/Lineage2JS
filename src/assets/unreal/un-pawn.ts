import UAActor from "./un-aactor"

abstract class UPawn extends UAActor {
    declare protected mesh: GA.USkeletalMesh;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Mesh": "mesh"
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

        return meshInfo;
    }
}

export default UPawn;
export { UPawn };
