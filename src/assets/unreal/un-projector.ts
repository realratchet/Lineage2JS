import UAActor from "./un-aactor";
import type { UMaterial } from "./un-material";
import type { DecodeLibraryBuilder } from "./decode-library-builder";

export type ProjectorDecodeInfo_T = { uuid: string, material: string, size: [number, number] };

export enum EProjectorBlending_T {
    PB_None,
    PB_Modulate,
    PB_AlphaBlend,
    PB_Add
}

export abstract class UProjector extends UAActor {
    declare protected projTexture: UMaterial;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "ProjTexture": "projTexture" });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder): ProjectorDecodeInfo_T | null {
        if (!this.projTexture) return null;

        const material = builder.pullMaterial(this.projTexture);
        const size = builder.getMaterialTextureSize(this.projTexture);

        if (!material || !size || !(size.width > 0 && size.height > 0)) throw new Error(`Projector '${this.objectName}' has an invalid ProjTexture.`);
        return { uuid: this.uuid, material, size: [size.width, size.height] };
    }
}

export default UProjector;
