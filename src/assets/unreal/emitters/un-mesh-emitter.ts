import UParticleEmitter from "./un-particle-emitter"

abstract class UMeshEmitter extends UParticleEmitter {
    declare protected mesh: GA.UStaticMesh;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh"
        });
    }

    public getDecodeInfo(library: GD.DecodeLibrary) {
        if (!this.mesh) {
            console.warn(`MeshEmitter '${this.objectName}' has no static mesh, skipping`);
            return null;
        }

        return Object.assign(super.getDecodeInfo(library), {
            type: "MeshEmitter",
            mesh: this.mesh.loadSelf().getDecodeInfo(library)
        });
    }
}

export default UMeshEmitter;
export { UParticleEmitter };