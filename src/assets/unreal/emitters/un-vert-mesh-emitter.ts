import UParticleEmitter from "./un-particle-emitter";
import type UVertMesh from "../un-vert-mesh";
import type { DecodeLibraryBuilder } from "../decode-library-builder";

abstract class UVertMeshEmitter extends UParticleEmitter {
    declare protected mesh: UVertMesh;
    declare protected useMeshBlendMode: boolean;
    declare protected renderTwoSided: boolean;
    declare protected useParticleColor: boolean;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "VertexMesh": "mesh",
            "UseMeshBlendMode": "useMeshBlendMode",
            "RenderTwoSided": "renderTwoSided",
            "UseParticleColor": "useParticleColor"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        const mesh = this.mesh ? this.mesh.loadSelf().getDecodeInfo(builder) : null;

        return Object.assign(super.getDecodeInfo(builder), { type: "VertMeshEmitter", mesh, useMeshBlendMode: this.useMeshBlendMode, renderTwoSided: this.renderTwoSided, useParticleColor: this.useParticleColor });
    }
}

export default UVertMeshEmitter;
