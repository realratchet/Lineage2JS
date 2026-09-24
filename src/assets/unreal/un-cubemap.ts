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
        if (!this.faces || this.faces.length !== 6 || this.faces.some(face => !face))
            throw new Error(`Cubemap '${this.uuid}' must have six faces.`);

        return {
            name: this.uuid,
            materialType: "cubemap",
            faces: this.faces.map(face => builder.pullMaterial(face))
        };
    }
}

export default UCubemap;
