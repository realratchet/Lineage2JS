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
        if (!this.mesh) throw new Error(`VertMeshEmitter '${this.objectName}' has no vertex mesh.`);

        const mesh = this.mesh.loadSelf().getDecodeInfo(builder);

        return Object.assign(super.getDecodeInfo(builder), { type: "VertMeshEmitter", mesh, useMeshBlendMode: this.useMeshBlendMode, renderTwoSided: this.renderTwoSided, useParticleColor: this.useParticleColor });
    }
}

export default UVertMeshEmitter;
