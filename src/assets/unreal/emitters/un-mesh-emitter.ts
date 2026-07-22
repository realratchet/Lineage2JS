import UParticleEmitter from "./un-particle-emitter"

abstract class UMeshEmitter extends UParticleEmitter {
    declare protected mesh: GA.UStaticMesh;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh"
        });
    }

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder) {
        if (!this.mesh) {
            console.warn(`MeshEmitter '${this.objectName}' has no static mesh, skipping`);
            return null;
        }

        return Object.assign(super.getDecodeInfo(builder), {
            type: "MeshEmitter",
            mesh: builder.pullStaticMesh(this.mesh)
        });
    }
}

export default UMeshEmitter;
export { UParticleEmitter };
