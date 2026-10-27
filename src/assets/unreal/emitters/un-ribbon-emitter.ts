import type { FPrimitiveArray } from "@l2js/core";
import UParticleEmitter from "./un-particle-emitter";
import type FVector from "../un-vector";
import type { DecodeLibraryBuilder } from "../decode-library-builder";

export enum EGetPointAxis_T { PAXIS_OwnerX, PAXIS_OwnerY, PAXIS_OwnerZ, PAXIS_BoneNormal, PAXIS_StartBoneDirection, PAXIS_AxisNormal }
export enum EAccDrop_T { ADRP_NONE, ADRP_BYPOINT, ADRP_BYTIME, ADRP_BYTIME_DUAL }

export abstract class URibbonEmitter extends UParticleEmitter {
    declare protected sampleRate: number;
    declare protected decayRate: number;
    declare protected numPoints: number;
    declare protected accDrop: EAccDrop_T;
    declare protected pointsDropRate: number;
    declare protected thresholdTime: number;
    declare protected minPoints: number;
    declare protected thresholdTime2: number;
    declare protected ribbonWidth: number;
    declare protected getPointAxisFrom: EGetPointAxis_T;
    declare protected axisNormal: FVector;
    declare protected minSampleDist: number;
    declare protected minSampleDot: number;
    declare protected pointOriginOffset: number;
    declare protected ribbonTextureUScale: number;
    declare protected ribbonTextureVScale: number;
    declare protected numSheets: number;
    declare protected sheetScale: FPrimitiveArray<"float">;
    declare protected startBoneOffset: FVector;
    declare protected endBoneOffset: FVector;
    declare protected boneNameStart: string;
    declare protected boneNameEnd: string;
    declare protected isUsingInterpolation: boolean;
    declare protected cntrPoints: number;
    declare protected scaleRatio: number;
    declare protected isSamplingPoints: boolean;
    declare protected isDecayingPoints: boolean;
    declare protected isDecayingPointsWhenStopped: boolean;
    declare protected isDecaySyncedWhenKilled: boolean;
    declare protected isTextureULengthBased: boolean;
    declare protected isUsingSheetScale: boolean;
    declare protected isUsingBones: boolean;
    declare protected isUsingBoneDistance: boolean;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), { "SampleRate": "sampleRate", "DecayRate": "decayRate", "NumPoints": "numPoints", "AccDrop": "accDrop", "PointsDropRate": "pointsDropRate", "ThresholdTime": "thresholdTime", "MinPoints": "minPoints", "ThresholdTime2": "thresholdTime2", "RibbonWidth": "ribbonWidth", "GetPointAxisFrom": "getPointAxisFrom", "AxisNormal": "axisNormal", "MinSampleDist": "minSampleDist", "MinSampleDot": "minSampleDot", "PointOriginOffset": "pointOriginOffset", "RibbonTextureUScale": "ribbonTextureUScale", "RibbonTextureVScale": "ribbonTextureVScale", "NumSheets": "numSheets", "SheetScale": "sheetScale", "StartBoneOffset": "startBoneOffset", "EndBoneOffset": "endBoneOffset", "BoneNameStart": "boneNameStart", "BoneNameEnd": "boneNameEnd", "RibbonPoints": "ribbonPoints", "bUseInterpolation": "isUsingInterpolation", "CntrPoints": "cntrPoints", "ScaleRatio": "scaleRatio", "bSamplePoints": "isSamplingPoints", "bDecayPoints": "isDecayingPoints", "bDecayPointsWhenStopped": "isDecayingPointsWhenStopped", "bSyncDecayWhenKilled": "isDecaySyncedWhenKilled", "bLengthBasedTextureU": "isTextureULengthBased", "bUseSheetScale": "isUsingSheetScale", "bUseBones": "isUsingBones", "bUseBoneDistance": "isUsingBoneDistance", "SampleTimer": "sampleTimer", "DecayTimer": "decayTimer", "RealSampleRate": "realSampleRate", "RealDecayRate": "realDecayRate", "SheetsUsed": "sheetsUsed", "LastSampledPoint": "lastSampledPoint", "bKilled": "isKilled", "bDecaying": "isDecaying" });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        return Object.assign(super.getDecodeInfo(builder), {
            type: "RibbonEmitter" as const,
            texture: builder.pullMaterial(this.texture),
            ribbon: {
                sampleRate: this.sampleRate, decayRate: this.decayRate, numPoints: this.numPoints,
                accDrop: getAccDrop(this.accDrop.valueOf()), pointsDropRate: this.pointsDropRate, thresholdTime: this.thresholdTime, minPoints: this.minPoints, thresholdTime2: this.thresholdTime2,
                width: this.ribbonWidth, pointAxis: getPointAxis(this.getPointAxisFrom.valueOf()), axisNormal: this.axisNormal.getElements(), minSampleDist: this.minSampleDist, minSampleDot: this.minSampleDot, pointOriginOffset: this.pointOriginOffset,
                textureUScale: this.ribbonTextureUScale, textureVScale: this.ribbonTextureVScale, numSheets: this.numSheets, sheetScale: this.sheetScale ? Array.from(this.sheetScale.getTypedArray()) : [],
                startBoneOffset: this.startBoneOffset.getElements(), endBoneOffset: this.endBoneOffset.getElements(), boneNameStart: this.boneNameStart, boneNameEnd: this.boneNameEnd,
                useInterpolation: this.isUsingInterpolation, controlPoints: this.cntrPoints, scaleRatio: this.scaleRatio,
                samplePoints: this.isSamplingPoints, decayPoints: this.isDecayingPoints, decayPointsWhenStopped: this.isDecayingPointsWhenStopped, syncDecayWhenKilled: this.isDecaySyncedWhenKilled,
                lengthBasedTextureU: this.isTextureULengthBased, useSheetScale: this.isUsingSheetScale, useBones: this.isUsingBones, useBoneDistance: this.isUsingBoneDistance
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
