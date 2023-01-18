import UParticleEmitter from "./un-particle-emitter"

class UMeshEmitter extends UParticleEmitter {
    protected mesh: UStaticMesh;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh"
        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        const decodeInfo = super.getDecodeInfo(library);
        const meshInfo = this.mesh.loadSelf().getDecodeInfo(library);

        debugger;

        return Object.assign(decodeInfo, {
            type: "MeshEmitter",
            mesh: meshInfo
        });
    }
}

export default UMeshEmitter;
export { UParticleEmitter };