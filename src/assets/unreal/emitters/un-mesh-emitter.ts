import UParticleEmitter from "./un-particle-emitter"

class UMeshEmitter extends UParticleEmitter {
    protected mesh: UStaticMesh;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh"
        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        return Object.assign(super.getDecodeInfo(library), {
            type: "MeshEmitter",
            mesh: this.mesh.loadSelf().getDecodeInfo(library)
        });
    }
}

export default UMeshEmitter;
export { UParticleEmitter };