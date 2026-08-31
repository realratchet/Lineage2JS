import UParticleEmitter from "./un-particle-emitter"
import type { UStaticMesh } from "../static-mesh/un-static-mesh";
import type { DecodeLibraryBuilder } from "../decode-library-builder";

abstract class UMeshEmitter extends UParticleEmitter {
    declare protected mesh: UStaticMesh;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
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
