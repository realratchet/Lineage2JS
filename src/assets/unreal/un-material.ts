import { type FPrimitiveArray, type UnserializedProperty_T } from "@l2js/core";
import UObject from "./un-object";
import type { FColor } from "./un-color";
import type { FMatrix } from "./un-matrix";
import type { FRotator } from "./un-rotator";
import type { DecodeLibraryBuilder } from "./decode-library-builder";
import type { ParticleBlendModes_T } from "./emitters/un-particle-emitter";
import type { ColorArr, Vector3Arr, EulerArr } from "./library-types";

export type IDecodedParameter = {
    uniforms: Record<string, any>,
    defines: Record<string, any>,
    isUsingMap: boolean,
    transformType: "none" | "pan" | "rotate" | "oscillate" | "envMap" | "envMapWorld",
    sprites?: any[],
    framerate?: number,
    uvIndex?: number
};

export type IDecodedSpriteParameter = IDecodedParameter & {
    isSprite: true,
    sprites: any[],
    framerate: number
};

export type DecodableMaterial_T = "modifier" | "texture" | "shader" | "group" | "terrain" | "lightmapped" | "instance" | "terrainSegment" | "sprite" | "solid" | "particle" | "combiner" | "empty";
export type DecodableMaterialModifier_T = "fadeColor" | "panTexture" | "rotateTexture" | "oscillateTexture" | "envMapTexture" | "colorModifier" | "finalBlend" | "texCoordSource";

export type IBaseMaterialDecodeInfo = { name?: string, materialType: DecodableMaterial_T, color?: boolean };
export type ISolidMaterialDecodeInfo = IBaseMaterialDecodeInfo & { materialType: "solid", solidColor: number };
export type ILightmappedDecodeInfo = IBaseMaterialDecodeInfo & { materialType: "lightmapped", material: string, lightmap: string | null };
export type IMaterialGroupDecodeInfo = IBaseMaterialDecodeInfo & { materialType: "group", materials: string[] };
export type IParticleMaterialDecodeInfo = IBaseMaterialDecodeInfo & { materialType: "particle", material: string | null, blendingMode: ParticleBlendModes_T, opacity: number };
export type IMaterialModifier = { type: string };
export type IBaseLightingMaterialModifier = IMaterialModifier & { type: "Lighting", mode: "Ambient" | "Directional" };
export type ILightAmbientMaterialModifier = IBaseLightingMaterialModifier & { mode: "Ambient", color: ColorArr, brightness: number };
export type ILightDirectionalMaterialModifier = IBaseLightingMaterialModifier & { mode: "Directional", color: ColorArr, brightness: number, direction: Vector3Arr };

export type IShaderDecodeInfo = IBaseMaterialDecodeInfo & {
    materialType: "shader",
    diffuse: string,
    opacity: string,
    specular: string,
    specularMask: string,
    selfIllumination: string,
    selfIlluminationMask: string,
    blendingMode: SupportedBlendingTypes_T,
    depthWrite: boolean,
    depthTest: boolean,
    doubleSide: boolean,
    transparent: boolean,
    alphaTest: number,
    modulateStaticLighting2X: boolean,
    visible: boolean
};

export type ITexPannerDecodeInfo = IBaseMaterialModifierDecodeInfo & {
    modifierType: "panTexture",
    transform: { matrix: number[], rate: number, map: string }
};

export type IBaseMaterialModifierDecodeInfo = IBaseMaterialDecodeInfo & { materialType: "modifier", modifierType: DecodableMaterialModifier_T };

export type IFadeColorDecodeInfo = IBaseMaterialModifierDecodeInfo & {
    modifierType: "fadeColor",
    fadeColors: {
        color1: number[],
        color2: number[],
        period: number,
        phase: number,
        fadeType: "linear" | "sinusoidal"
    }
};

export type ITexRotatorDecodeInfo = IBaseMaterialModifierDecodeInfo & {
    modifierType: "rotateTexture",
    transform: {
        matrix: number[],
        map: string,
        type: "fixed" | "rotating" | "oscillating",
        rotation: EulerArr,
        offsetU: number,
        offsetV: number,
        oscillationRate: [number, number, number],
        oscillationAmplitude: [number, number, number],
        oscillationPhase: [number, number, number]
    }
};

export type ITexOscillatorDecodeInfo = IBaseMaterialModifierDecodeInfo & {
    modifierType: "oscillateTexture",
    transform: {
        matrix: number[],
        map: string,
        rateU: number,
        rateV: number,
        phaseU: number,
        phaseV: number,
        amplitudeU: number,
        amplitudeV: number,
        typeU: "pan" | "stretch" | "stretchRepeat" | "jitter",
        typeV: "pan" | "stretch" | "stretchRepeat" | "jitter",
        offsetU: number,
        offsetV: number
    }
};

export type ITexEnvMapDecodeInfo = IBaseMaterialModifierDecodeInfo & { modifierType: "envMapTexture", envMapType: "world" | "camera", map: string };

export type IColorModifierDecodeInfo = IBaseMaterialModifierDecodeInfo & {
    modifierType: "colorModifier",
    material: string,
    modifierColor: ColorArr,
    doubleSide: boolean,
    alphaBlend: boolean
};

export type IFinalBlendDecodeInfo = IBaseMaterialModifierDecodeInfo & {
    modifierType: "finalBlend",
    material: string,
    blendingMode: SupportedBlendingTypes_T,
    doubleSide: boolean,
    alphaTest: boolean,
    alphaRef: number,
    transparent: boolean,
    depthWrite: boolean,
    depthTest: boolean
};

export type ITexCoordSourceDecodeInfo = IBaseMaterialModifierDecodeInfo & { modifierType: "texCoordSource", material: string, uvIndex: number };
export type ICombinerDecodeInfo = IBaseMaterialDecodeInfo & {
    materialType: "combiner",
    combineMode: number, // 0=material1 1=modulate 2=modulate2x 3=modulate4x 4=add 5=subtract 6=alphaBlend 7=material2 - see UCombiner.getDecodeInfo
    material1: string,
    material2: string,
    mask: string,
    invertMask: boolean,
    alphaFrom1: boolean,
    alphaFrom2: boolean
};

export type SupportedBlendingTypes_T = "normal" | "masked" | "modulate" | "alphaModulate" | "translucent" | "invisible" | "brighten" | "darken";

abstract class UBaseMaterial extends UObject {
    // public readonly skipRemaining = true;
    public abstract getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo | string;

    // protected _fallbackMaterial: any;
    // protected _useFallback: any;
    // protected _validated: any;
    // protected _reserved: any;
    // protected _lastUpdateTime: any;
    // protected _renderInterface: any;
    // protected _detail: any;

    // protected detailScale: number;
    // protected defaultMaterial: typeof this;

    declare protected depthWrite: boolean;
    declare protected depthTest: boolean;
    // protected isTreatingDoubleSided: boolean = false;

    declare protected material: UBaseMaterial;
    declare protected defaultMaterial: UBaseMaterial;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            //         "FallbackMaterial": "_fallbackMaterial",
            //         "UseFallback": "_useFallback",
            //         "Validated": "_validated",
            //         "Reserved": "_reserved",
            //         "__LastUpdateTime": "_lastUpdateTime",
            //         "RenderInterface": "_renderInterface",
            //         "DefaultMaterial": "defaultMaterial",
            //         "DetailScale": "detailScale",
            //         "Detail": "_detail",

            "ZWrite": "depthWrite",
            "ZTest": "depthTest",
            //         "TreatAsTwoSided": "isTreatingDoubleSided",

            "Material": "material",
            "DefaultMaterial": "defaultMaterial"
        });
    }

    public abstract getTextureSize(): { width: number, height: number } | null;
}

abstract class UBaseModifier extends UBaseMaterial {
    declare protected texCoordSource: number;
    // protected texCoordCount: number;
    // protected texCoordProjected: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "TexCoordSource": "texCoordSource",
            // "TexCoordCount": "texCoordCount",
            // "TexCoordProjected": "texCoordProjected",
        });
    }

    public getTextureSize(): { width: number; height: number; } | null {
        return this.material?.loadSelf?.().getTextureSize() || null;
    }
}
export abstract class UMaterial extends UBaseMaterial { }

export enum OutputBlending_T {
    OB_Normal,
    OB_Masked,
    OB_Modulate,
    OB_Translucent,
    OB_Invisible,
    OB_Brighten,
    OB_Darken
};

enum TexRotationType_T {
    TR_FixedRotation,
    TR_ConstantlyRotating,
    TR_OscillatingRotation,
};

enum ETexOscillationType_T {
    OT_Pan,
    OT_Stretch,
    OT_StretchRepeat,
    OT_Jitter
};

enum EColorFadeType_T {
    FC_Linear,
    FC_Sinusoidal
};

enum EColorOperation_T {
    CO_Use_Color_From_Material1,
    CO_Use_Color_From_Material2,
    CO_Multiply,
    CO_Add,
    CO_Subtract,
    CO_AlphaBlend_With_Mask,
    CO_Add_With_Mask_Modulation,
    CO_Use_Color_From_Mask,
};

enum EAlphaOperation_T {
    AO_Use_Mask,
    AO_Multiply,
    AO_Add,
    AO_Use_Alpha_From_Material1,
    AO_Use_Alpha_From_Material2,
};

/**
    // blending
    if (OutputBlending == OB_Normal && !Opacity)
        glDisable(GL_BLEND);
    else
        glEnable(GL_BLEND);
    switch (OutputBlending)
    {
    case OB_Normal:
        if (Opacity) glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
        break;
    case OB_Masked:
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
        glAlphaFunc(GL_GREATER, 0.0f);
        glEnable(GL_ALPHA_TEST);
        break;
    case OB_Modulate:
        glBlendFunc(GL_DST_COLOR, GL_SRC_COLOR);	// src*dst*2
        break;
    case OB_Translucent:
        glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_COLOR);
        break;
    case OB_Invisible:
        glBlendFunc(GL_ZERO, GL_ONE);				// dst
        break;
    case OB_Brighten:
        glBlendFunc(GL_SRC_ALPHA, GL_ONE);			// src*srcA + dst
        break;
    case OB_Darken:
        glBlendFunc(GL_ZERO, GL_ONE_MINUS_SRC_COLOR); // dst - src
        break;
    }
 */

export abstract class UTexEnvMap extends UBaseModifier {
    declare public readonly type: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "EnvMapType": "type"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "envMapTexture",
            envMapType: this.type === 0 ? "world" : "camera",
            map: builder.pullMaterial(this.material)
        } as ITexEnvMapDecodeInfo;
    }
}

export abstract class UCombiner extends UBaseModifier {
    declare protected combineOperation: EColorOperation_T;
    declare protected alphaOperation: EAlphaOperation_T;
    declare protected material1: UMaterial;
    declare protected material2: UMaterial;
    declare protected mask: UMaterial;
    declare protected invertMask: boolean;
    declare protected modulate2X: boolean;
    declare protected modulate4X: boolean;

    public getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        // shader-mesh-static.fs's USE_COMBINER block expects this flattened numbering, not
        // the raw CombineOperation ordinal (D3DMaterialState.cpp line 807-844 is ground truth
        // for the operations; Modulate2X/Modulate4X fold into the CO_Multiply case there)
        let combineMode: number;
        switch (this.combineOperation.valueOf()) {
            case EColorOperation_T.CO_Use_Color_From_Material1: combineMode = 0; break;
            case EColorOperation_T.CO_Multiply: combineMode = this.modulate4X ? 3 : this.modulate2X ? 2 : 1; break;
            case EColorOperation_T.CO_Add: combineMode = 4; break;
            case EColorOperation_T.CO_Subtract: combineMode = 5; break;
            case EColorOperation_T.CO_AlphaBlend_With_Mask: combineMode = 6; break;
            case EColorOperation_T.CO_Use_Color_From_Material2: combineMode = 7; break;
            default: combineMode = 0; break; // CO_Add_With_Mask_Modulation, CO_Use_Color_From_Mask: not yet implemented in the shader
        }

        return {
            name: this.uuid,
            materialType: "combiner",
            combineMode,
            material1: builder.pullMaterial(this.material1),
            material2: builder.pullMaterial(this.material2),
            mask: builder.pullMaterial(this.mask),
            invertMask: this.invertMask,
            alphaFrom1: this.alphaOperation.valueOf() === EAlphaOperation_T.AO_Use_Alpha_From_Material1,
            alphaFrom2: this.alphaOperation.valueOf() === EAlphaOperation_T.AO_Use_Alpha_From_Material2
        } as ICombinerDecodeInfo;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "CombineOperation": "combineOperation",
            "AlphaOperation": "alphaOperation",
            "Material1": "material1",
            "Material2": "material2",
            "Mask": "mask",
            "InvertMask": "invertMask",
            "Modulate2X": "modulate2X",
            "Modulate4X": "modulate4X"
        });
    }
}

// FinalBlend.uc (l2_editor_leak) - FB_Add=8 is an L2 addition over stock UT2003's FB_MAX=8
enum EFrameBufferBlending {
    FB_Overwrite,
    FB_Modulate,
    FB_AlphaBlend,
    FB_AlphaModulate_MightNotFogCorrectly,
    FB_Translucent,
    FB_Darken,
    FB_Brighten,
    FB_Invisible,
    FB_Add,
};

export abstract class UFinalBlend extends UBaseModifier {
    declare protected frameBufferBlending: EFrameBufferBlending;
    declare protected doubleSide: boolean;
    declare protected alphaTest: boolean;
    declare protected alphaRef: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "FrameBufferBlending": "frameBufferBlending",
            "TwoSided": "doubleSide",
            "AlphaTest": "alphaTest",
            "AlphaRef": "alphaRef",
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        const map = builder.pullMaterial(this.material);

        // D3DMaterialState.cpp ApplyFinalBlend (line 298-352) is the ground truth for the blend factors below
        let blendingMode: SupportedBlendingTypes_T = "normal";
        let transparent = false;
        switch (this.frameBufferBlending.valueOf()) {
            case EFrameBufferBlending.FB_Overwrite: blendingMode = "normal"; break;
            case EFrameBufferBlending.FB_Modulate: blendingMode = "modulate"; transparent = true; break;
            case EFrameBufferBlending.FB_AlphaBlend: blendingMode = "normal"; transparent = true; break;
            case EFrameBufferBlending.FB_AlphaModulate_MightNotFogCorrectly: blendingMode = "alphaModulate"; transparent = true; break;
            case EFrameBufferBlending.FB_Translucent: blendingMode = "translucent"; transparent = true; break;
            case EFrameBufferBlending.FB_Darken: blendingMode = "darken"; transparent = true; break;
            case EFrameBufferBlending.FB_Brighten: blendingMode = "brighten"; transparent = true; break;
            case EFrameBufferBlending.FB_Invisible: blendingMode = "invisible"; transparent = true; break;
            default: console.warn("Unknown FinalBlend blending mode:", this.frameBufferBlending); break;
        }

        if (this.alphaTest) transparent = true;

        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "finalBlend",
            material: map,
            blendingMode,
            doubleSide: this.doubleSide,
            alphaTest: this.alphaTest,
            alphaRef: this.alphaRef / 255,
            transparent,
            depthWrite: this.depthWrite,
            depthTest: this.depthTest
        } as IFinalBlendDecodeInfo;
    }
}

export abstract class UShader extends UMaterial {
    declare protected diffuse: UMaterial;
    declare protected opacity: UMaterial;
    declare protected doubleSide: boolean;
    declare protected specular: UMaterial;
    declare protected specularMask: UMaterial;
    declare protected outputBlending: OutputBlending_T;

    declare protected transparent: boolean;
    declare protected alphaTest: number;
    declare protected selfIllumination: UMaterial;
    declare protected selfIlluminationMask: UMaterial;

    declare protected modulateStaticLighting2X: boolean;

    // protected isPerformingLightingOnSpecularPass: boolean = false;
    // protected unkBytes: BufferValue<"buffer">;

    // protected _wireframe: any;

    // protected postLoad(pkg: UPackage): void {
    //     this.readHead = pkg.tell();

    //     this.unkBytes = pkg.read(BufferValue.allocBytes(this.readTail - this.readHead)) as any;

    //     this.readHead = pkg.tell();
    // }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Diffuse": "diffuse",
            "Opacity": "opacity",
            "TwoSided": "doubleSide",
            "Specular": "specular",
            "SpecularityMask": "specularMask",
            "OutputBlending": "outputBlending",

            "SelfIllumination": "selfIllumination",
            "SelfIlluminationMask": "selfIlluminationMask",

            "AlphaTest": "transparent",
            "AlphaRef": "alphaTest",

            "ModulateStaticLighting2X": "modulateStaticLighting2X",

            // "PerformLightingOnSpecularPass": "isPerformingLightingOnSpecularPass",
            // "Wireframe": "_wireframe",
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        // if (this.transparent)
        //     debugger;

        const diffuse = builder.pullMaterial(this.diffuse);
        const opacity = builder.pullMaterial(this.opacity);
        const specular = builder.pullMaterial(this.specular);
        const specularMask = builder.pullMaterial(this.specularMask);
        const selfIllumination = specular ? null : builder.pullMaterial(this.selfIllumination);
        const selfIlluminationMask = specular ? null : builder.pullMaterial(this.selfIlluminationMask);
        const depthWrite = this.depthWrite;
        const doubleSide = this.doubleSide;
        const transparent = this.transparent;
        const alphaTest = this.alphaTest / 255;
        const modulateStaticLighting2X = this.modulateStaticLighting2X;

        let blendingMode: SupportedBlendingTypes_T;

        switch (this.outputBlending.valueOf()) {
            case OutputBlending_T.OB_Normal: blendingMode = "normal"; break;
            case OutputBlending_T.OB_Masked: blendingMode = "masked"; break;
            case OutputBlending_T.OB_Modulate: blendingMode = "modulate"; break;
            case OutputBlending_T.OB_Translucent: blendingMode = "translucent"; break;
            case OutputBlending_T.OB_Invisible: blendingMode = "invisible"; break;
            case OutputBlending_T.OB_Brighten: blendingMode = "brighten"; break;
            case OutputBlending_T.OB_Darken: blendingMode = "darken"; break;
            default: console.warn("Unknown blending mode:", this.outputBlending); break;
        }

        // debugger;

        return {
            name: this.uuid,
            materialType: "shader",
            blendingMode,
            diffuse,
            opacity,
            specular,
            specularMask,
            selfIllumination,
            selfIlluminationMask,
            depthWrite,
            // depthTest: this.depthTest,
            doubleSide,
            transparent,
            alphaTest,
            modulateStaticLighting2X,
            visible: true,
        } as IShaderDecodeInfo;
    }

    public getTextureSize(): { width: number; height: number; } | null {
        return this.diffuse?.loadSelf?.().getTextureSize() || this.opacity?.loadSelf?.().getTextureSize() || null;
    }
}

export abstract class UFadeColor extends UBaseModifier {
    declare public readonly color1: FColor;
    declare public readonly color2: FColor;
    declare public readonly period: number;
    declare public readonly phase: number;
    declare public readonly fadeType: EColorFadeType_T;

    public getDecodeInfo(_builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        // UFadeColor::GetColor (UnMaterial.cpp line 332): Time = (TimeSeconds + FadePhase) / FadePeriod
        const fadeType = this.fadeType === EColorFadeType_T.FC_Sinusoidal ? "sinusoidal" : "linear";

        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "fadeColor",
            fadeColors: {
                color1: [this.color1.r / 255, this.color1.g / 255, this.color1.b / 255],
                color2: [this.color2.r / 255, this.color2.g / 255, this.color2.b / 255],
                period: this.period,
                phase: this.phase,
                fadeType
            }
        } as IFadeColorDecodeInfo;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Color1": "color1",
            "Color2": "color2",
            "FadePeriod": "period",
            "FadePhase": "phase",
            "ColorFadeType": "fadeType"
        });
    }
}

export abstract class UColorModifier extends UBaseMaterial {
    declare protected color: FColor;
    declare protected doubleSide: boolean;
    declare protected alphaBlend: boolean;

    public getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "colorModifier",
            material: builder.pullMaterial(this.material),
            modifierColor: [this.color.r / 255, this.color.g / 255, this.color.b / 255, this.color.a / 255],
            doubleSide: this.doubleSide,
            alphaBlend: this.alphaBlend
        } as IColorModifierDecodeInfo;
    }

    public getTextureSize(): { width: number; height: number; } | null {
        return this.material?.loadSelf?.().getTextureSize() || null;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Color": "color",
            "RenderTwoSided": "doubleSide",
            "AlphaBlend": "alphaBlend"
        });
    }
}

export abstract class UTexRotator extends UBaseModifier {
    declare public readonly matrix: FMatrix;
    declare public readonly type: TexRotationType_T;
    declare public readonly rotation: FRotator;
    declare public readonly offsetU: number;
    declare public readonly offsetV: number;
    declare public readonly oscillationRate: FRotator;
    declare public readonly oscillationAmplitude: FRotator;
    declare public readonly oscillationPhase: FRotator;

    // public async decodeMaterial(): Promise<THREE.Material> { return await this.material?.decodeMaterial() as MeshBasicMaterial; }

    // public async getParameters() {
    //     // const matrix = this.matrix.getMatrix3(new Matrix3());
    //     const matrix = new Matrix3();
    //     this.matrix.getMatrix3(matrix);
    //     const texture = await (this.material as UTexture).decodeMipmap(0);

    //     // console.log(matrix.elements.slice(0, 3));
    //     // console.log(matrix.elements.slice(3, 6));
    //     // console.log(matrix.elements.slice(6, 9));

    //     // debugger;

    //     return {
    //         transformedTexture: {
    //             transformRotate: true,
    //             texture,
    //             matrix
    //         }
    //     };
    // }

    public getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        let rotationType: "fixed" | "rotating" | "oscillating" = "fixed";
        switch (this.type.valueOf()) {
            case TexRotationType_T.TR_FixedRotation: rotationType = "fixed"; break;
            case TexRotationType_T.TR_ConstantlyRotating: rotationType = "rotating"; break;
            case TexRotationType_T.TR_OscillatingRotation: rotationType = "oscillating"; break;
        }

        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "rotateTexture",
            transform: {
                matrix: this.matrix.getElements3x3(),
                map: builder.pullMaterial(this.material),
                type: rotationType,
                rotation: [this.rotation.pitch, this.rotation.yaw, this.rotation.roll, "XYZ"],
                offsetU: this.offsetU,
                offsetV: this.offsetV,
                // UTexRotator::GetMatrix TR_OscillatingRotation (UnMaterial.cpp line 550-558)
                oscillationRate: [this.oscillationRate.pitch, this.oscillationRate.yaw, this.oscillationRate.roll],
                oscillationAmplitude: [this.oscillationAmplitude.pitch, this.oscillationAmplitude.yaw, this.oscillationAmplitude.roll],
                oscillationPhase: [this.oscillationPhase.pitch, this.oscillationPhase.yaw, this.oscillationPhase.roll]
            }
        } as ITexRotatorDecodeInfo;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "M": "matrix",
            "TexRotationType": "type",
            "Rotation": "rotation",
            "UOffset": "offsetU",
            "VOffset": "offsetV",
            "OscillationRate": "oscillationRate",
            "OscillationAmplitude": "oscillationAmplitude",
            "OscillationPhase": "oscillationPhase"
        });
    }
}



export abstract class UTexOscillator extends UBaseModifier {
    declare protected matrix: FMatrix;
    declare protected rateU: number;
    declare protected rateV: number;
    declare protected phaseU: number;
    declare protected phaseV: number;
    declare protected amplitudeU: number;
    declare protected amplitudeV: number;
    declare protected typeU: ETexOscillationType_T;
    declare protected typeV: ETexOscillationType_T;
    declare protected offsetU: number;
    declare protected offsetV: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "M": "matrix",
            "UOscillationRate": "rateU",
            "VOscillationRate": "rateV",
            "UOscillationPhase": "phaseU",
            "VOscillationPhase": "phaseV",
            "UOscillationAmplitude": "amplitudeU",
            "VOscillationAmplitude": "amplitudeV",
            "UOscillationType": "typeU",
            "VOscillationType": "typeV",
            "UOffset": "offsetU",
            "VOffset": "offsetV"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        const mapType = (type: ETexOscillationType_T): "pan" | "stretch" | "stretchRepeat" | "jitter" => {
            switch (type.valueOf()) {
                case ETexOscillationType_T.OT_Pan: return "pan";
                case ETexOscillationType_T.OT_Stretch: return "stretch";
                case ETexOscillationType_T.OT_StretchRepeat: return "stretchRepeat";
                case ETexOscillationType_T.OT_Jitter: return "jitter";
                default: return "pan";
            }
        };

        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "oscillateTexture",
            transform: {
                matrix: this.matrix.getElements3x3(),
                map: builder.pullMaterial(this.material),
                rateU: this.rateU,
                rateV: this.rateV,
                phaseU: this.phaseU,
                phaseV: this.phaseV,
                amplitudeU: this.amplitudeU,
                amplitudeV: this.amplitudeV,
                typeU: mapType(this.typeU),
                typeV: mapType(this.typeV),
                offsetU: this.offsetU,
                offsetV: this.offsetV
            }
        } as ITexOscillatorDecodeInfo;
    }
}

export abstract class UTexCoordSource extends UBaseModifier {
    public getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "texCoordSource",
            material: builder.pullMaterial(this.material),
            uvIndex: this.texCoordSource
        } as ITexCoordSourceDecodeInfo;
    }
}

export abstract class UVertexColor extends UBaseModifier {
    // vertex color modulation isn't supported - combiners treat a null material as absent
    public getDecodeInfo(builder: DecodeLibraryBuilder): string {
        return builder.pullMaterial(this.material);
    }
}

export abstract class UTexPanner extends UBaseModifier {
    declare public readonly rate: number;
    declare public readonly z: number;
    declare public readonly matrix: FMatrix;
    declare public readonly internalTime: FPrimitiveArray<"int32">;
    declare public readonly direction: FRotator;

    public getDecodeInfo(builder: DecodeLibraryBuilder): IBaseMaterialDecodeInfo {
        const D = this.direction.toVector();
        const rateU = (this.rate * D.x);
        const rateV = (this.rate * D.y);

        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "panTexture",
            transform: {
                matrix: this.matrix.getElements3x3(),
                map: builder.pullMaterial(this.material),
                rate: [rateU, rateV]
            }
        } as any as ITexPannerDecodeInfo;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "PanRate": "rate",
            "M": "matrix",
            "InternalTime": "internalTime",
            "Z": "z",
            "PanDirection": "direction"
        });
    }
}

export abstract class UStaticMeshMaterial extends UBaseMaterial {
    declare protected noDynamicShadowCast: boolean;
    declare protected collisionForShadow: boolean;
    declare protected enableCollision: boolean;

    public static getUnserializedProperties(): UnserializedProperty_T[] {
        return [
            ["EnableCollision", "BoolProperty"],
            ["EnableCollisionforShadow", "BoolProperty"],
            ["bNoDynamicShadowCast", "BoolProperty"]
        ];
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bNoDynamicShadowCast": "noDynamicShadowCast",
            "EnableCollisionforShadow": "collisionForShadow",
            "EnableCollision": "enableCollision",
        });
    }


    // protected doLoad(pkg: unknown, exp: unknown): void {
    //     debugger;
    //     super.doLoad(pkg as any, exp as any);
    //     debugger;
    // }

    public getDecodeInfo(builder: DecodeLibraryBuilder): string {
        return builder.pullMaterial(this.material || this.defaultMaterial);
    }
}

export default UMaterial;
