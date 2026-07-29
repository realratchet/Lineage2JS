import UObject from "@l2js/core";

abstract class UBaseMaterial extends UObject {
    // public readonly skipRemaining = true;
    public abstract getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo | string;

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
abstract class UMaterial extends UBaseMaterial { }

enum OutputBlending_T {
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

abstract class UTexEnvMap extends UBaseModifier {
    declare public readonly type: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "EnvMapType": "type"
        });
    }

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "envMapTexture",
            envMapType: this.type === 0 ? "world" : "camera",
            map: builder.pullMaterial(this.material)
        } as GD.ITexEnvMapDecodeInfo;
    }
}

abstract class UCombiner extends UBaseModifier {
    declare protected combineOperation: EColorOperation_T;
    declare protected alphaOperation: EAlphaOperation_T;
    declare protected material1: UMaterial;
    declare protected material2: UMaterial;
    declare protected mask: UMaterial;
    declare protected invertMask: boolean;
    declare protected modulate2X: boolean;
    declare protected modulate4X: boolean;

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
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
        } as GD.ICombinerDecodeInfo;
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

abstract class UFinalBlend extends UBaseModifier {
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

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
        const map = builder.pullMaterial(this.material);

        // D3DMaterialState.cpp ApplyFinalBlend (line 298-352) is the ground truth for the blend factors below
        let blendingMode: GA.SupportedBlendingTypes_T = "normal";
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
        } as GD.IFinalBlendDecodeInfo;
    }
}

abstract class UShader extends UMaterial {
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

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
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

        let blendingMode: GA.SupportedBlendingTypes_T;

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
        } as GD.IShaderDecodeInfo;
    }

    public getTextureSize(): { width: number; height: number; } | null {
        return this.diffuse?.loadSelf?.().getTextureSize() || this.opacity?.loadSelf?.().getTextureSize() || null;
    }
}

abstract class UFadeColor extends UBaseModifier {
    declare public readonly color1: GA.FColor;
    declare public readonly color2: GA.FColor;
    declare public readonly period: number;
    declare public readonly phase: number;
    declare public readonly fadeType: EColorFadeType_T;

    public getDecodeInfo(_builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
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
        } as GD.IFadeColorDecodeInfo;
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

abstract class UColorModifier extends UBaseMaterial {
    declare protected color: GA.FColor;
    declare protected doubleSide: boolean;
    declare protected alphaBlend: boolean;

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "colorModifier",
            material: builder.pullMaterial(this.material),
            modifierColor: [this.color.r / 255, this.color.g / 255, this.color.b / 255, this.color.a / 255],
            doubleSide: this.doubleSide,
            alphaBlend: this.alphaBlend
        } as GD.IColorModifierDecodeInfo;
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

abstract class UTexRotator extends UBaseModifier {
    declare public readonly matrix: GA.FMatrix;
    declare public readonly type: TexRotationType_T;
    declare public readonly rotation: GA.FRotator;
    declare public readonly offsetU: number;
    declare public readonly offsetV: number;
    declare public readonly oscillationRate: GA.FRotator;
    declare public readonly oscillationAmplitude: GA.FRotator;
    declare public readonly oscillationPhase: GA.FRotator;

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

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
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
        } as GD.ITexRotatorDecodeInfo;
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



abstract class UTexOscillator extends UBaseModifier {
    declare protected matrix: GA.FMatrix;
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

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
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
        } as GD.ITexOscillatorDecodeInfo;
    }
}

abstract class UTexCoordSource extends UBaseModifier {
    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
        return {
            name: this.uuid,
            materialType: "modifier",
            modifierType: "texCoordSource",
            material: builder.pullMaterial(this.material),
            uvIndex: this.texCoordSource
        } as GD.ITexCoordSourceDecodeInfo;
    }
}

abstract class UVertexColor extends UBaseModifier {
    // vertex color modulation isn't supported - combiners treat a null material as absent
    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): string {
        return builder.pullMaterial(this.material);
    }
}

abstract class UTexPanner extends UBaseModifier {
    declare public readonly rate: number;
    declare public readonly z: number;
    declare public readonly matrix: GA.FMatrix;
    declare public readonly internalTime: C.FPrimitiveArray<"int32">;
    declare public readonly direction: GA.FRotator;

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): GD.IBaseMaterialDecodeInfo {
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
        } as any as GD.ITexPannerDecodeInfo;
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

abstract class UStaticMeshMaterial extends UBaseMaterial {
    declare protected noDynamicShadowCast: boolean;
    declare protected collisionForShadow: boolean;
    declare protected enableCollision: boolean;

    public static getUnserializedProperties(): C.UnserializedProperty_T[] {
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

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): string {
        return builder.pullMaterial(this.material || this.defaultMaterial);
    }
}

export default UMaterial;
export { UMaterial, UStaticMeshMaterial, UShader, UFadeColor, UTexRotator, UTexPanner, UColorModifier, UTexOscillator, UFinalBlend, OutputBlending_T, UTexEnvMap, UTexCoordSource, UVertexColor, UCombiner };
