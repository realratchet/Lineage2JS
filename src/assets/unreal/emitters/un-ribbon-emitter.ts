import type { FPrimitiveArray } from "@l2js/core";
import UParticleEmitter from "./un-particle-emitter";
import type FVector from "../un-vector";
import type { DecodeLibraryBuilder } from "../decode-library-builder";

export enum EGetPointAxis_T { PAXIS_OwnerX, PAXIS_OwnerY, PAXIS_OwnerZ, PAXIS_BoneNormal, PAXIS_StartBoneDirection, PAXIS_AxisNormal }
export enum EAccDrop_T { ADRP_NONE, ADRP_BYPOINT, ADRP_BYTIME, ADRP_BYTIME_DUAL }

export abstract class URibbonEmitter extends UParticleEmitter {
    declare protected SampleRate: number;
    declare protected DecayRate: number;
    declare protected NumPoints: number;
    declare protected AccDrop: EAccDrop_T;
    declare protected PointsDropRate: number;
    declare protected ThresholdTime: number;
    declare protected MinPoints: number;
    declare protected ThresholdTime2: number;
    declare protected RibbonWidth: number;
    declare protected GetPointAxisFrom: EGetPointAxis_T;
    declare protected AxisNormal: FVector;
    declare protected MinSampleDist: number;
    declare protected MinSampleDot: number;
    declare protected PointOriginOffset: number;
    declare protected RibbonTextureUScale: number;
    declare protected RibbonTextureVScale: number;
    declare protected NumSheets: number;
    declare protected SheetScale: FPrimitiveArray<"float">;
    declare protected StartBoneOffset: FVector;
    declare protected EndBoneOffset: FVector;
    declare protected BoneNameStart: string;
    declare protected BoneNameEnd: string;
    declare protected bUseInterpolation: boolean;
    declare protected CntrPoints: number;
    declare protected ScaleRatio: number;
    declare protected bSamplePoints: boolean;
    declare protected bDecayPoints: boolean;
    declare protected bDecayPointsWhenStopped: boolean;
    declare protected bSyncDecayWhenKilled: boolean;
    declare protected bLengthBasedTextureU: boolean;
    declare protected bUseSheetScale: boolean;
    declare protected bUseBones: boolean;
    declare protected bUseBoneDistance: boolean;

    public getPropertyMap(): Record<string, string> {
        const map = Object.assign({}, super.getPropertyMap());

        for (const name of ["SampleRate", "DecayRate", "NumPoints", "AccDrop", "PointsDropRate", "ThresholdTime", "MinPoints", "ThresholdTime2", "RibbonWidth", "GetPointAxisFrom", "AxisNormal", "MinSampleDist", "MinSampleDot", "PointOriginOffset", "RibbonTextureUScale", "RibbonTextureVScale", "NumSheets", "SheetScale", "StartBoneOffset", "EndBoneOffset", "BoneNameStart", "BoneNameEnd", "RibbonPoints", "bUseInterpolation", "CntrPoints", "ScaleRatio", "bSamplePoints", "bDecayPoints", "bDecayPointsWhenStopped", "bSyncDecayWhenKilled", "bLengthBasedTextureU", "bUseSheetScale", "bUseBones", "bUseBoneDistance", "SampleTimer", "DecayTimer", "RealSampleRate", "RealDecayRate", "SheetsUsed", "LastSampledPoint", "bKilled", "bDecaying"])
            map[name] = name;

        return map;
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        return Object.assign(super.getDecodeInfo(builder), {
            type: "RibbonEmitter" as const,
            texture: builder.pullMaterial(this.texture),
            ribbon: {
                sampleRate: this.SampleRate, decayRate: this.DecayRate, numPoints: this.NumPoints,
                accDrop: getAccDrop(this.AccDrop.valueOf()), pointsDropRate: this.PointsDropRate, thresholdTime: this.ThresholdTime, minPoints: this.MinPoints, thresholdTime2: this.ThresholdTime2,
                width: this.RibbonWidth, pointAxis: getPointAxis(this.GetPointAxisFrom.valueOf()), axisNormal: this.AxisNormal.getElements(), minSampleDist: this.MinSampleDist, minSampleDot: this.MinSampleDot, pointOriginOffset: this.PointOriginOffset,
                textureUScale: this.RibbonTextureUScale, textureVScale: this.RibbonTextureVScale, numSheets: this.NumSheets, sheetScale: this.SheetScale ? Array.from(this.SheetScale.getTypedArray()) : [],
                startBoneOffset: this.StartBoneOffset.getElements(), endBoneOffset: this.EndBoneOffset.getElements(), boneNameStart: this.BoneNameStart, boneNameEnd: this.BoneNameEnd,
                useInterpolation: this.bUseInterpolation, controlPoints: this.CntrPoints, scaleRatio: this.ScaleRatio,
                samplePoints: this.bSamplePoints, decayPoints: this.bDecayPoints, decayPointsWhenStopped: this.bDecayPointsWhenStopped, syncDecayWhenKilled: this.bSyncDecayWhenKilled,
                lengthBasedTextureU: this.bLengthBasedTextureU, useSheetScale: this.bUseSheetScale, useBones: this.bUseBones, useBoneDistance: this.bUseBoneDistance
            }
        });
    }
}

function getPointAxis(value: EGetPointAxis_T) {
    switch (value) {
        case EGetPointAxis_T.PAXIS_OwnerX: return "ownerX";
        case EGetPointAxis_T.PAXIS_OwnerY: return "ownerY";
        case EGetPointAxis_T.PAXIS_OwnerZ: return "ownerZ";
        case EGetPointAxis_T.PAXIS_BoneNormal: return "boneNormal";
        case EGetPointAxis_T.PAXIS_StartBoneDirection: return "startBoneDirection";
        case EGetPointAxis_T.PAXIS_AxisNormal: return "axisNormal";
        default: throw new Error(`Unknown ribbon point axis '${value}'.`);
    }
}

function getAccDrop(value: EAccDrop_T) {
    switch (value) {
        case EAccDrop_T.ADRP_NONE: return "none";
        case EAccDrop_T.ADRP_BYPOINT: return "byPoint";
        case EAccDrop_T.ADRP_BYTIME: return "byTime";
        case EAccDrop_T.ADRP_BYTIME_DUAL: return "byTimeDual";
        default: throw new Error(`Unknown ribbon acceleration drop '${value}'.`);
    }
}

export default URibbonEmitter;
