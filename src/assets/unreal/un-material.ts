import FColor from "./un-color";
import UObject from "./un-object"
import BufferValue from "../buffer-value";
import { FPrimitiveArray } from "./un-array";

abstract class UBaseMaterial extends UObject {
    public readonly skipRemaining = true;
    public abstract getDecodeInfo(library: IDecodeLibrary): Promise<string>;
}

abstract class UBaseModifier extends UBaseMaterial { }
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

class UFinalBlend extends UBaseModifier {
    protected material: UMaterial;
    protected frameBufferBlending: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Material": "material",
            "FrameBufferBlending": "frameBufferBlending"
        });
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.material.uuid;

        library.materials[this.uuid] = null;

        await this.onLoaded();

        await this.material.getDecodeInfo(library);

        return this.material.uuid;
    }
}

class UShader extends UMaterial {
    protected diffuse: UMaterial = null;
    protected opacity: UMaterial = null;
    protected doubleSide: boolean = false;
    protected specular: UMaterial = null;
    protected specularMask: UMaterial = null;
    protected outputBlending: OutputBlending_T = OutputBlending_T.OB_Normal;
    protected isTreatingDoubleSided: boolean = false;
    protected depthWrite: boolean = true;
    protected transparent: boolean = false;
    protected alphaTest: number = 0;
    protected isPerformingLightningOnSpecularPass: boolean = false;
    protected selfIllumination: UMaterial = null;
    protected selfIlluminationMask: UMaterial = null;
    protected unkBytes: BufferValue<"buffer">;

    protected postLoad(pkg: UPackage): void {
        this.readHead = pkg.tell();

        this.unkBytes = pkg.read(BufferValue.allocBytes(this.readTail - this.readHead)) as any;

        this.readHead = pkg.tell();
    }

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
            "AlphaTest": "transparent",
            "SelfIllumination": "selfIllumination",
            "SelfIlluminationMask": "selfIlluminationMask",
            "AlphaRef": "alphaTest",
            "PerformLightingOnSpecularPass": "isPerformingLightningOnSpecularPass"
        });
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = null;

        await this.onLoaded();

        const diffuse = await this.diffuse?.getDecodeInfo(library) || null;
        const opacity = await this.opacity?.getDecodeInfo(library) || null;
        const specular = await this.specular?.getDecodeInfo(library) || null;
        const specularMask = await this.specularMask?.getDecodeInfo(library) || null;
        const depthWrite = this.depthWrite;
        const doubleSide = this.doubleSide
        const transparent = this.transparent;
        const alphaTest = this.alphaTest / 255;

        let blendingMode: SupportedBlendingTypes_T;

        switch (this.outputBlending) {
            case OutputBlending_T.OB_Normal: blendingMode = "normal"; break;
            case OutputBlending_T.OB_Masked: blendingMode = "masked"; break;
            case OutputBlending_T.OB_Modulate: blendingMode = "modulate"; break;
            case OutputBlending_T.OB_Translucent: blendingMode = "translucent"; break;
            case OutputBlending_T.OB_Invisible: blendingMode = "invisible"; break;
            case OutputBlending_T.OB_Brighten: blendingMode = "brighten"; break;
            case OutputBlending_T.OB_Darken: blendingMode = "darken"; break;
            default: console.warn("Unknown blending mode:", this.outputBlending); break;
        }

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
        } as IShaderDecodeInfo;

        return this.uuid;
    }
}

class UFadeColor extends UBaseModifier {
    public color1: FColor = new FColor();
    public color2: FColor = new FColor();
    public period: number = 0;

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = null;

        await this.onLoaded();

        library.materials[this.uuid] = {
            materialType: "modifier",
            modifierType: "fadeColor",
            fadeColors: {
                color1: [this.color1.r / 255, this.color1.b / 255, this.color1.b / 255],
                color2: [this.color2.r / 255, this.color2.b / 255, this.color2.b / 255],
                period: this.period
            }
        } as IFadeColorDecodeInfo;

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

class UColorModifier extends UBaseMaterial {
    protected color: FColor;
    protected doubleSide: boolean;
    protected material: UShader;
    protected alphaBlend: boolean;

    // public async decodeMaterial(): Promise<THREE.Material> {
    //     const material = await this.material?.decodeMaterial() as THREE.ShaderMaterial;

    //     material.uniforms.diffuse.value.setRGB(this.color.r / 255, this.color.g / 255, this.color.b / 255);
    //     material.uniforms.opacity.value = this.color.a / 255;

    //     if (this.doubleSide !== undefined) material.side = this.doubleSide ? DoubleSide : BackSide;

    //     return material;
    // }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.material.uuid;

        library.materials[this.uuid] = null;

        debugger;

        await this.onLoaded();

        await this.material.getDecodeInfo(library);

        return this.material.uuid;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Color": "color",
            "RenderTwoSided": "doubleSide",
            "Material": "material",
            "AlphaBlend": "alphaBlend"
        });
    }
}

class UTexRotator extends UBaseModifier {
    protected matrix: UMatrix;
    protected type: TexRotationType_T;
    protected rotation: FRotator;
    protected offsetU: number;
    protected offsetV: number;
    protected material: UMaterial;

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

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.material.uuid;

        library.materials[this.uuid] = null;

        await this.onLoaded();

        await this.material.getDecodeInfo(library);

        return this.material.uuid;
    }

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

class UTexOscillator extends UBaseModifier {
    protected matrix: UMatrix;
    protected rateU: number;
    protected rateV: number;
    protected phaseU: number;
    protected phaseV: number;
    protected amplitudeU: number;
    protected amplitudeV: number;
    protected material: UMaterial;
    protected typeU: number;
    protected typeV: number;
    protected offsetU: number;
    protected offsetV: number;
    protected currentUJitter: number;
    protected currentVJitter: number;

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.material.uuid;

        library.materials[this.uuid] = null;

        await this.onLoaded();

        await this.material.getDecodeInfo(library);

        return this.material.uuid;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "M": "matrix",
            "UOscillationRate": "rateU",
            "VOscillationRate": "rateV",
            "UOscillationPhase": "phaseU",
            "VOscillationPhase": "phaseV",
            "UOscillationAmplitude": "amplitudeU",
            "VOscillationAmplitude": "amplitudeV",
            "Material": "material",
            "UOscillationType": "typeU",
            "VOscillationType": "typeV",
            "UOffset": "offsetU",
            "VOffset": "offsetV",
            "CurrentUJitter": "currentUJitter",
            "CurrentVJitter": "currentVJitter"
        });
    }
}

class UTexPanner extends UBaseModifier {
    protected rate: number;
    protected z: number;
    protected matrix: UMatrix;
    protected material: UTexture;
    protected internalTime = new FPrimitiveArray(BufferValue.int32);

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {
        if (this.uuid in library.materials) return this.uuid;

        library.materials[this.uuid] = null;

        await this.onLoaded();

        library.materials[this.uuid] = {
            materialType: "modifier",
            modifierType: "panTexture",
            transform: {
                matrix: this.matrix.getElements3x3(),
                map: await this.material?.getDecodeInfo(library) || null,
                rate: this.rate
            }
        } as ITexPannerDecodeInfo;

        return this.material.uuid;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "PanRate": "rate",
            "M": "matrix",
            "InternalTime": "internalTime",
            "Z": "z",
            "Material": "material"
        });
    }
}

class FStaticMeshMaterial extends UBaseMaterial {
    protected noDynamicShadowCast: boolean;
    protected collisionForShadow: boolean;
    protected enableCollision: boolean;
    protected material: UMaterial;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bNoDynamicShadowCast": "noDynamicShadowCast",
            "EnableCollisionforShadow": "collisionForShadow",
            "EnableCollision": "enableCollision",
            "Material": "material"
        });
    }

    protected preLoad(pkg: UPackage) {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + Infinity;
    }

    protected doLoad(pkg: UPackage): void {
        super.doLoad(pkg, null);
        this.readTail = pkg.tell();
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<string> {

        if (this.uuid in library.materials) return this.material?.uuid || null;

        library.materials[this.uuid] = null;

        await this.onLoaded();

        if (this.material)
            await this.material.getDecodeInfo(library);

        return this.material?.uuid || null;
    }
}

export default UMaterial;
export { UMaterial, FStaticMeshMaterial, UShader, UFadeColor, UTexRotator, UTexPanner, UColorModifier, UTexOscillator, UFinalBlend, OutputBlending_T };