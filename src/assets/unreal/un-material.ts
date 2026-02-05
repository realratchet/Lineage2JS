import UObject from "@l2js/core";
import DecodeLibrary from "./decode-library";

abstract class UBaseMaterial extends UObject {
    // public readonly skipRemaining = true;
    // public abstract getDecodeInfo(library: DecodeLibrary): string;

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
}

abstract class UBaseModifier extends UBaseMaterial {
    // protected texCoordSource: number;
    // protected texCoordCount: number;
    // protected texCoordProjected: number;

    // protected getPropertyMap() {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         "TexCoordSource": "texCoordSource",
    //         "TexCoordCount": "texCoordCount",
    //         "TexCoordProjected": "texCoordProjected",
    //     });
    // }
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

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = {
            materialType: "modifier",
            modifierType: "envMapTexture",
            envMapType: this.type === 0 ? "world" : "camera",
            map: this.material?.loadSelf().getDecodeInfo(library) || null
        } as GD.ITexEnvMapDecodeInfo;

        return this.uuid;
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

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = {
            materialType: "combiner",
            combineMode: this.combineOperation.valueOf(),
            material1: this.material1?.loadSelf().getDecodeInfo(library) || null,
            material2: this.material2?.loadSelf().getDecodeInfo(library) || null,
            mask: this.mask?.loadSelf().getDecodeInfo(library) || null,
            invertMask: this.invertMask,
            alphaFrom1: this.alphaOperation.valueOf() === EAlphaOperation_T.AO_Use_Alpha_From_Material1,
            alphaFrom2: this.alphaOperation.valueOf() === EAlphaOperation_T.AO_Use_Alpha_From_Material2
        } as GD.ICombinerDecodeInfo;

        return this.uuid;
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

abstract class UFinalBlend extends UBaseModifier {
    // protected frameBufferBlending: number;
    // protected doubleSide: boolean;
    // protected alphaTest: boolean;
    // protected alphaRef: number;

    // protected getPropertyMap() {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         "FrameBufferBlending": "frameBufferBlending",
    //         "TwoSided": "doubleSide",
    //         "AlphaTest": "alphaTest",
    //         "AlphaRef": "alphaRef",
    //     });
    // }

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.material.uuid;

        library.materials[this.uuid] = null;


        this.material.loadSelf().getDecodeInfo(library);

        return this.material.uuid;
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

    // protected isPerformingLightingOnSpecularPass: boolean = false;
    // protected unkBytes: BufferValue<"buffer">;

    // protected _wireframe: any;
    // protected _modulateStaticLighting2X: any;

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

            // "PerformLightingOnSpecularPass": "isPerformingLightingOnSpecularPass",
            // "Wireframe": "_wireframe",
            // "ModulateStaticLighting2X": "_modulateStaticLighting2X"
        });
    }

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        // if (this.transparent)
        //     debugger;

        library.materials[this.uuid] = null;

        const diffuse = this.diffuse?.loadSelf().getDecodeInfo(library) || null;
        const opacity = this.opacity?.loadSelf().getDecodeInfo(library) || null;
        const specular = this.specular?.loadSelf().getDecodeInfo(library) || null;
        const specularMask = this.specularMask?.loadSelf().getDecodeInfo(library) || null;
        const depthWrite = this.depthWrite;
        const doubleSide = this.doubleSide;
        const transparent = this.transparent;
        const alphaTest = this.alphaTest / 255;

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

        library.materials[this.uuid] = {
            materialType: "shader",
            blendingMode,
            diffuse,
            opacity,
            specular,
            specularMask,
            depthWrite,
            doubleSide,
            transparent,
            alphaTest,
            visible: true,
        } as GD.IShaderDecodeInfo;

        return this.uuid;
    }
}

abstract class UFadeColor extends UBaseModifier {
    declare public readonly color1: GA.FColor;
    declare public readonly color2: GA.FColor;
    declare public readonly period: number;

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = null;

        library.materials[this.uuid] = {
            materialType: "modifier",
            modifierType: "fadeColor",
            fadeColors: {
                color1: [this.color1.r / 255, this.color1.b / 255, this.color1.b / 255],
                color2: [this.color2.r / 255, this.color2.b / 255, this.color2.b / 255],
                period: this.period
            }
        } as GD.IFadeColorDecodeInfo;

        return this.uuid;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Color1": "color1",
            "Color2": "color2",
            "FadePeriod": "period"
        });
    }
}

abstract class UColorModifier extends UBaseMaterial {
    declare protected color: GA.FColor;
    declare protected doubleSide: boolean;
    declare protected alphaBlend: boolean;

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = {
            materialType: "modifier",
            modifierType: "colorModifier",
            material: this.material?.loadSelf().getDecodeInfo(library) || null,
            modifierColor: [this.color.r / 255, this.color.g / 255, this.color.b / 255, this.color.a / 255],
            doubleSide: this.doubleSide,
            alphaBlend: this.alphaBlend
        } as GD.IColorModifierDecodeInfo;

        return this.uuid;
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

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        let rotationType: "fixed" | "rotating" | "oscillating" = "fixed";
        switch (this.type.valueOf()) {
            case TexRotationType_T.TR_FixedRotation: rotationType = "fixed"; break;
            case TexRotationType_T.TR_ConstantlyRotating: rotationType = "rotating"; break;
            case TexRotationType_T.TR_OscillatingRotation: rotationType = "oscillating"; break;
        }

        library.materials[this.uuid] = {
            materialType: "modifier",
            modifierType: "rotateTexture",
            transform: {
                matrix: this.matrix.getElements3x3(),
                map: this.material?.loadSelf().getDecodeInfo(library) || null,
                type: rotationType,
                rotation: [this.rotation.pitch, this.rotation.yaw, this.rotation.roll, "XYZ"],
                offsetU: this.offsetU,
                offsetV: this.offsetV
            }
        } as GD.ITexRotatorDecodeInfo;

        return this.uuid;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "M": "matrix",
            "TexRotationType": "type",
            "Rotation": "rotation",
            "UOffset": "offsetU",
            "VOffset": "offsetV"
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

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        const mapType = (type: ETexOscillationType_T): "pan" | "stretch" | "stretchRepeat" | "jitter" => {
            switch (type.valueOf()) {
                case ETexOscillationType_T.OT_Pan: return "pan";
                case ETexOscillationType_T.OT_Stretch: return "stretch";
                case ETexOscillationType_T.OT_StretchRepeat: return "stretchRepeat";
                case ETexOscillationType_T.OT_Jitter: return "jitter";
                default: return "pan";
            }
        };

        library.materials[this.uuid] = {
            materialType: "modifier",
            modifierType: "oscillateTexture",
            transform: {
                matrix: this.matrix.getElements3x3(),
                map: this.material?.loadSelf().getDecodeInfo(library) || null,
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

        return this.uuid;
    }
}

abstract class UTexCoordSource extends UBaseModifier {
    // public getDecodeInfo(library: DecodeLibrary): string {
    //     if (this.uuid in library.materials) return this.material.uuid;

    //     library.materials[this.uuid] = null;


    //     this.material.loadSelf().getDecodeInfo(library);

    //     return this.material.uuid;
    // }
}

abstract class UTexPanner extends UBaseModifier {
    declare public readonly rate: number;
    declare public readonly z: number;
    declare public readonly matrix: GA.FMatrix;
    declare public readonly internalTime: C.FPrimitiveArray<"int32">;
    declare public readonly direction: GA.FRotator;

    public getDecodeInfo(library: DecodeLibrary): string {
        if (this.uuid in library.materials) return this.uuid;

        const D = this.direction.toVector();
        const rateU = (this.rate * D.x) / 1024.0;
        const rateV = (this.rate * D.y) / 1024.0;

        library.materials[this.uuid] = {
            materialType: "modifier",
            modifierType: "panTexture",
            transform: {
                matrix: this.matrix.getElements3x3(),
                map: this.material?.loadSelf().getDecodeInfo(library) || null,
                rate: [rateU, rateV]
            }
        } as any as GD.ITexPannerDecodeInfo;

        return this.uuid;
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

    public getDecodeInfo(library: DecodeLibrary): string {

        if (this.uuid in library.materials) return this.material?.uuid ?? this.defaultMaterial?.uuid ?? null;

        library.materials[this.uuid] = null;

        if (this.material)
            this.material.loadSelf().getDecodeInfo(library);
        else if (this.defaultMaterial)
            this.defaultMaterial.loadSelf().getDecodeInfo(library);

        return this.material?.uuid ?? this.defaultMaterial?.uuid ?? null;
    }
}

export default UMaterial;
export { UMaterial, UStaticMeshMaterial, UShader, UFadeColor, UTexRotator, UTexPanner, UColorModifier, UTexOscillator, UFinalBlend, OutputBlending_T, UTexEnvMap, UTexCoordSource, UCombiner };