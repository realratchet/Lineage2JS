import UTexture from "./un-texture";
import type { DecodeLibraryBuilder } from "./decode-library-builder";
import type { ICubemapDecodeInfo } from "./un-material";

export abstract class UCubemap extends UTexture {
    declare protected faces: [UTexture, UTexture, UTexture, UTexture, UTexture, UTexture];

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Faces": "faces"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder): ICubemapDecodeInfo {
        const faces = this.faces ?? [];

        if (faces.length > 6)
            throw new Error(`Cubemap '${this.uuid}' has ${faces.length} faces.`);

        return {
            name: this.uuid,
            materialType: "cubemap",
            // FStaticCubemap::GetFace returns NULL for an absent face (UnTex.cpp:2135).
            faces: Array.from({ length: 6 }, (_, index) => faces[index] ? builder.pullMaterial(faces[index]) : null)
        };
    }
}

export default UCubemap;
