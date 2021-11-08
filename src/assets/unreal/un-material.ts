import UObject from "./un-object"
import ETextureFormat, { ETexturePixelFormat } from "./un-tex-format";
import UTexture from "./un-texture";
import { Matrix4, Euler } from "three";
import FArray from "./un-array";
import BufferValue from "../buffer-value";
import FNumber from "./un-number";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;
type FColor = import("./un-color").FColor;

class UMaterial extends UObject {
    protected internalTime: number[] = new Array(2);
    public width: number;
    public height: number;
    protected format: ETextureFormat;
    protected bitsW: number; // texture size log2 (number of bits in size value)
    protected bitsH: number;
    protected clampW: number;
    protected clampH: number;
    protected mipZero: FColor;
    protected maxColor: FColor;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "InternalTime": "internalTime",
            "VSize": "height",
            "USize": "width",
            "Format": "format",
            "UBits": "bitsW",
            "VBits": "bitsH",
            "UClamp": "clampW",
            "VClamp": "clampH",
            "MipZero": "mipZero",
            "MaxColor": "maxColor",
        });
    }

    protected getTexturePixelFormat(): ETexturePixelFormat {
        switch (this.format) {
            case ETextureFormat.TEXF_P8: return ETexturePixelFormat.TPF_P8;
            case ETextureFormat.TEXF_DXT1: return ETexturePixelFormat.TPF_DXT1;
            case ETextureFormat.TEXF_RGB8: return ETexturePixelFormat.TPF_RGB8;
            case ETextureFormat.TEXF_RGBA8: return ETexturePixelFormat.TPF_BGRA8;
            case ETextureFormat.TEXF_DXT3: return ETexturePixelFormat.TPF_DXT3;
            case ETextureFormat.TEXF_DXT5: return ETexturePixelFormat.TPF_DXT5;
            case ETextureFormat.TEXF_L8: return ETexturePixelFormat.TPF_G8;
            case ETextureFormat.TEXF_CxV8U8: return ETexturePixelFormat.TPF_V8U8_2;
            case ETextureFormat.TEXF_DXT5N: return ETexturePixelFormat.TPF_DXT5N;
            case ETextureFormat.TEXF_3DC: return ETexturePixelFormat.TPF_BC5;
            case ETextureFormat.TEXF_G16: return ETexturePixelFormat.TPF_G16;
            default: throw new Error(`Unknown UE2 pixel format: ${this.format}`);
        }
    }
}

class UShader extends UMaterial {
    protected diffuse: UTexture;
    protected opacity: UTexture;
    protected doubleSide: boolean;
    protected specular: UFadeColor;
    protected specularMask: UTexture;
    protected outputBlending: number;
    protected isTreatingDoubleSided: boolean;
    protected depthWrite: boolean;
    protected alphaTest: boolean;
    protected alphaRef: number;
    protected isPerformingLightningOnSpecularPass: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Diffuse": "diffuse",
            "Opacity": "opacity",
            "TwoSided": "doubleSide",
            "Specular": "specular",
            "SpecularityMask": "specularMask",
            "OutputBlending": "outputBlending",
            "TreatAsTwoSided": "isTreatingDoubleSided",
            "ZWrite": "depthWrite",
            "AlphaTest": "alphaTest",
            "AlphaRef": "alphaRef",
            "PerformLightingOnSpecularPass": "isPerformingLightningOnSpecularPass"
        });
    }
}

class UFadeColor extends UMaterial {
    protected color1: FColor;
    protected color2: FColor;
    protected fadePeriod: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Color1": "color1",
            "Color2": "color2",
            "FadePeriod": "fadePeriod"
        });
    }
}

class UColorModifier extends UMaterial {
    protected color: FColor;
    protected doubleSide: boolean;
    protected material: UShader;
    protected alphaBlend: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Color": "color",
            "RenderTwoSided": "doubleSide",
            "Material": "material",
            "AlphaBlend": "alphaBlend"
        });
    }
}

class UTexRotator extends UMaterial {
    protected matrix: Matrix4;
    protected type: number;
    protected rotation: Euler;
    protected offsetU: number;
    protected offsetV: number;
    protected material: UMaterial;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "M": "matrix",
            "TexRotationType": "type",
            "Rotation": "rotation",
            "UOffset": "offsetU",
            "VOffset": "offsetV",
            "Material": "material"
        });
    }
}

class UTexOscillator extends UMaterial {
    protected matrix: Matrix4;
    protected rateU: number;
    protected rateV: number;
    protected phaseU: number;
    protected phaseV: number;
    protected amplitudeU: number;
    protected amplitudeV: number;
    protected material: UMaterial;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "M": "matrix",
            "UOscillationRate": "rateU",
            "VOscillationRate": "rateV",
            "UOscillationPhase": "phaseU",
            "VOscillationPhase": "phaseV",
            "UOscillationAmplitude": "amplitudeU",
            "VOscillationAmplitude": "amplitudeV",
            "Material": "material"
        });
    }
}

class UTexPanner extends UMaterial {
    protected rate: number;
    protected z: number;
    protected matrix: Matrix4;
    protected material: UMaterial;

    constructor() {
        super(...arguments);
        this.internalTime = new FArray(FNumber.forType(BufferValue.int32) as any) as any;
    }


    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "PanRate": "rate",
            "M": "matrix",
            "Z": "z",
            "Material": "material"
        });
    }
}

class UMaterialContainer extends UObject {
    public static readonly typeSize: number = 16;

    protected noDynamicShadowCast: boolean;
    protected collisionforShadow: boolean;
    protected enableCollision: boolean;
    protected material: UMaterial;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bNoDynamicShadowCast": "noDynamicShadowCast",
            "EnableCollisionforShadow": "collisionforShadow",
            "EnableCollision": "enableCollision",
            "Material": "material"
        });
    }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + 14;

        await this.readNamedProps(pkg);

        // pkg.seek(this.readTail, "set");
        this.readTail = pkg.tell();

        return this;
    }
}

export default UMaterial;
export { UMaterial, UMaterialContainer, UShader, ETexturePixelFormat, UFadeColor, UTexRotator, UTexPanner, UColorModifier, UTexOscillator };