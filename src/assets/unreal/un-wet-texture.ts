import { UObject } from "@l2js/core";
import UTexture from "./un-texture";
import { convertDDSMaterialsToRGBA } from "@client/assets/decoders/dxt-decode";

// WetTexture: a WaterTexture whose simulated water field displaces SourceTexture
// horizontally each tick. The simulation itself runs client side
// (materials/wet-water-texture.ts), we only export the source bitmap, the wave
// parameters and the drop list.

// ADrop struct, bytes A-D are type-specific (speed/phase/age/size)
abstract class UADrop extends UObject {
    declare public type: number;
    declare public depth: number;
    declare public x: number;
    declare public y: number;
    declare public byteA: number;
    declare public byteB: number;
    declare public byteC: number;
    declare public byteD: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "Type": "type",
            "Depth": "depth",
            "X": "x",
            "Y": "y",
            "ByteA": "byteA",
            "ByteB": "byteB",
            "ByteC": "byteC",
            "ByteD": "byteD"
        });
    }
}

abstract class UWetTexture extends UTexture {
    declare protected sourceTexture: GA.UTexture;
    declare protected waveAmp: number;
    declare protected numDrops: number;
    declare protected drops: UADrop[];
    declare protected dropType: number;
    declare protected _oldSourceTex: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "SourceTexture": "sourceTexture",
            "OldSourceTex": "_oldSourceTex",
            "WaveAmp": "waveAmp",
            "NumDrops": "numDrops",
            "Drops": "drops",
            "DropType": "dropType"
        });
    }

    public getDecodeInfo(library: GD.DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        const source = this.sourceTexture?.loadSelf();
        const info = source ? (source as any).decodeTexture(library) as GD.IBaseMaterialDecodeInfo : null;

        // no usable source, draw it as a plain texture instead
        if (!info || info.materialType === "empty")
            return source ? source.getDecodeInfo(library) : super.getDecodeInfo(library);

        // the sim needs cpu-readable rgba of the top mip
        if ((info as any).textureType === "dds")
            convertDDSMaterialsToRGBA({ materials: { source: info } } as any);

        if ((info as any).textureType !== "rgba")
            return source.getDecodeInfo(library);

        const dataInfo = info as GD.IDataTextureDecodeInfo;

        // drops are in the wet texture's half resolution grid, the client scales them
        // when the source dimensions differ
        const drops = (this.drops ?? [])
            .slice(0, this.numDrops ?? 0)
            .filter(d => !!d)
            .map(d => ({
                type: d.type?.valueOf() ?? 0,
                depth: d.depth ?? 0,
                x: d.x ?? 0,
                y: d.y ?? 0,
                byteA: d.byteA ?? 0,
                byteB: d.byteB ?? 0,
                byteC: d.byteC ?? 0,
                byteD: d.byteD ?? 0
            }));

        library.materials[this.uuid] = {
            name: this.uuid,
            materialType: "texture",
            textureType: "wet",
            width: dataInfo.width,
            height: dataInfo.height,
            buffer: dataInfo.buffer,
            format: "rgba",
            wrapS: this.wrapS,
            wrapT: this.wrapT,
            waveAmp: this.waveAmp ?? 128,
            dropsX: this.width ? this.width >> 1 : dataInfo.width >> 1,
            dropsY: this.height ? this.height >> 1 : dataInfo.height >> 1,
            drops
        } as any;

        return this.uuid;
    }
}

export default UWetTexture;
export { UWetTexture, UADrop };
