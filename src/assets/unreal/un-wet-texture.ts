import { UObject } from "@l2js/core";
import UTexture from "./un-texture";
import { convertDDSTextureInfo } from "./dds/dxt-decode";
import type { DecodeLibraryBuilder } from "./decode-library-builder";

// WetTexture: a WaterTexture whose simulated water field displaces SourceTexture
// horizontally each tick. The simulation itself runs client side
// (materials/wet-water-texture.ts), we only export the source bitmap, the wave
// parameters and the drop list.

// ADrop struct, bytes A-D are type-specific (speed/phase/age/size)
abstract class UADrop extends UObject {
    declare public type: EDropType_T;
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
    declare protected sourceTexture: UTexture;
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

    public getDecodeInfo(builder: DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo | string {
        const source = this.sourceTexture?.loadSelf();
        const sourceUuid = source ? builder.pullMaterial(source) : null;
        const info = sourceUuid ? builder.library.materials[sourceUuid] : null;

        // no usable source, draw it as a plain texture instead
        if (!info || info.materialType === "empty")
            return sourceUuid ?? super.getDecodeInfo(builder);

        if (!isTextureInfo(info)) return sourceUuid;

        // the sim needs cpu-readable rgba of the top mip
        if (info.textureType === "dds") convertDDSTextureInfo(info);

        if (info.textureType !== "rgba") return sourceUuid;

        // drops are in the wet texture's half resolution grid, the client scales them
        // when the source dimensions differ
        const drops = (this.drops ?? [])
            .slice(0, this.numDrops ?? 0)
            .filter(d => !!d)
            .map(d => ({
                type: DROP_TYPE_NAMES[(d.type?.valueOf() as EDropType_T) ?? EDropType_T.DROP_FixedDepth],
                depth: d.depth ?? 0,
                x: d.x ?? 0,
                y: d.y ?? 0,
                byteA: d.byteA ?? 0,
                byteB: d.byteB ?? 0,
                byteC: d.byteC ?? 0,
                byteD: d.byteD ?? 0
            }));

        const wetInfo: GD.IWetTextureDecodeInfo = {
            name: this.uuid,
            materialType: "texture",
            textureType: "wet",
            width: info.width,
            height: info.height,
            buffer: info.buffer,
            format: "rgba",
            wrapS: this.wrapS,
            wrapT: this.wrapT,
            waveAmp: this.waveAmp ?? 128,
            dropsX: this.width ? this.width >> 1 : info.width >> 1,
            dropsY: this.height ? this.height >> 1 : info.height >> 1,
            drops
        };

        return wetInfo;
    }
}

function isTextureInfo(info: GD.IBaseMaterialDecodeInfo): info is GD.ITextureDecodeInfo { return info.materialType === "texture"; }

// ADrop.Type (UnFractal.h)
enum EDropType_T {
    DROP_FixedDepth,
    DROP_PhaseSpot,
    DROP_ShallowSpot,
    DROP_HalfAmpl,
    DROP_RandomMover,
    DROP_FixedRandomSpot,
    DROP_WhirlyThing,
    DROP_BigWhirly,
    DROP_HorizontalLine,
    DROP_VerticalLine,
    DROP_DiagonalLine1,
    DROP_DiagonalLine2,
    DROP_HorizontalOsc,
    DROP_VerticalOsc,
    DROP_DiagonalOsc1,
    DROP_DiagonalOsc2,
    DROP_RainDrops,
    DROP_AreaClamp,
    DROP_LeakyTap,
    DROP_DrippyTap
}

// mapped to its camelCase name at the decode boundary so wet-water-texture.ts doesn't need this enum
const DROP_TYPE_NAMES: Record<EDropType_T, string> = {
    [EDropType_T.DROP_FixedDepth]: "fixedDepth",
    [EDropType_T.DROP_PhaseSpot]: "phaseSpot",
    [EDropType_T.DROP_ShallowSpot]: "shallowSpot",
    [EDropType_T.DROP_HalfAmpl]: "halfAmpl",
    [EDropType_T.DROP_RandomMover]: "randomMover",
    [EDropType_T.DROP_FixedRandomSpot]: "fixedRandomSpot",
    [EDropType_T.DROP_WhirlyThing]: "whirlyThing",
    [EDropType_T.DROP_BigWhirly]: "bigWhirly",
    [EDropType_T.DROP_HorizontalLine]: "horizontalLine",
    [EDropType_T.DROP_VerticalLine]: "verticalLine",
    [EDropType_T.DROP_DiagonalLine1]: "diagonalLine1",
    [EDropType_T.DROP_DiagonalLine2]: "diagonalLine2",
    [EDropType_T.DROP_HorizontalOsc]: "horizontalOsc",
    [EDropType_T.DROP_VerticalOsc]: "verticalOsc",
    [EDropType_T.DROP_DiagonalOsc1]: "diagonalOsc1",
    [EDropType_T.DROP_DiagonalOsc2]: "diagonalOsc2",
    [EDropType_T.DROP_RainDrops]: "rainDrops",
    [EDropType_T.DROP_AreaClamp]: "areaClamp",
    [EDropType_T.DROP_LeakyTap]: "leakyTap",
    [EDropType_T.DROP_DrippyTap]: "drippyTap"
};

export default UWetTexture;
export { UWetTexture, UADrop, EDropType_T };
