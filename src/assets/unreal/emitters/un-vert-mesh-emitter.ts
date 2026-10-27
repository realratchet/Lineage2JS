import UParticleEmitter from "./un-particle-emitter";
import type UVertMesh from "../un-vert-mesh";
import type { DecodeLibraryBuilder } from "../decode-library-builder";

abstract class UVertMeshEmitter extends UParticleEmitter {
    declare protected mesh: UVertMesh;
    declare protected isUsingMeshBlendMode: boolean;
    declare protected isRenderingTwoSided: boolean;
    declare protected isUsingParticleColor: boolean;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "VertexMesh": "mesh",
            "UseMeshBlendMode": "isUsingMeshBlendMode",
            "RenderTwoSided": "isRenderingTwoSided",
            "UseParticleColor": "isUsingParticleColor"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        const mesh = this.mesh ? this.mesh.loadSelf().getDecodeInfo(builder) : null;

        return Object.assign(super.getDecodeInfo(builder), { type: "VertMeshEmitter", mesh, useMeshBlendMode: this.isUsingMeshBlendMode, renderTwoSided: this.isRenderingTwoSided, useParticleColor: this.isUsingParticleColor });
    }
}

export default UVertMeshEmitter;
