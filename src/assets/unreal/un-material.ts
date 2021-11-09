import UObject from "./un-object"
import ETextureFormat, { ETexturePixelFormat } from "./un-tex-format";
import UTexture from "./un-texture";
import { Matrix4, Euler, Material, MeshBasicMaterial, DoubleSide, Color, BackSide, FrontSide } from "three";
import FArray from "./un-array";
import BufferValue from "../buffer-value";
import FNumber from "./un-number";
import UMatrix from "./un-matrix";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;
type FColor = import("./un-color").FColor;

abstract class UBaseMaterial extends UObject {
    public abstract async decodeMaterial(): Promise<Material>;
}
abstract class UBaseModifier extends UBaseMaterial { }

abstract class UMaterial extends UBaseMaterial {
    // // protected internalTime: number[] = new Array(2);
    // // public width: number;
    // // public height: number;
    // // protected bitsW: number; // texture size log2 (number of bits in size value)
    // // protected bitsH: number;
    // // protected clampW: number;
    // // protected clampH: number;
    // // protected mipZero: FColor;
    // // protected maxColor: FColor;

    // protected getPropertyMap() {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         // "InternalTime": "internalTime",
    //         // "MipZero": "mipZero",
    //         // "MaxColor": "maxColor",
    //     });
    // }


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

    public async decodeMaterial(): Promise<Material> {
        const diffuse = await this.diffuse?.decodeMipmap(0) || null;
        const opacity = await this.opacity?.decodeMipmap(0) || null;
        const specular = await this.specularMask?.decodeMipmap(0) || null;
        // const side = this.doubleSide ? DoubleSide : FrontSide;
        // const side = DoubleSide;

        // debugger;

        const material = new MeshBasicMaterial({
            map: diffuse,
            alphaMap: opacity,
            side: DoubleSide,
            // side,
            transparent: true,
            specularMap: specular,
            // color: Math.round(Math.random() * 0xffffff)
        });

        return material;
    }
}

class UFadeColor extends UBaseMaterial {
    protected color1: FColor;
    protected color2: FColor;
    protected fadePeriod: number;

    public async decodeMaterial(): Promise<Material> { return new MeshBasicMaterial({ color: new Color(this.color1.r, this.color1.g, this.color1.b) }); }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Color1": "color1",
            "Color2": "color2",
            "FadePeriod": "fadePeriod"
        });
    }
}

class UColorModifier extends UBaseMaterial {
    protected color: FColor;
    protected doubleSide: boolean;
    protected material: UShader;
    protected alphaBlend: boolean;

    public async decodeMaterial(): Promise<Material> {
        const material = await this.material?.decodeMaterial() as MeshBasicMaterial;

        material.color.setRGB(this.color.r, this.color.g, this.color.b);
        material.opacity = this.color.a;

        return material;
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
    protected type: number;
    protected rotation: Euler;
    protected offsetU: number;
    protected offsetV: number;
    protected material: UMaterial;

    public async decodeMaterial(): Promise<Material> {
        const material = await this.material?.decodeMaterial() as MeshBasicMaterial;

        if (!material) return null;

        debugger;

        return material;
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

    public async decodeMaterial(): Promise<Material> { return await this.material?.decodeMaterial(); }

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

class UTexPanner extends UBaseModifier {
    protected rate: number;
    protected z: number;
    protected matrix: UMatrix;
    protected material: UMaterial;
    protected internalTime: number[] = new FArray(FNumber.forType(BufferValue.int32) as any) as any;

    public async decodeMaterial(): Promise<Material> { return await this.material?.decodeMaterial(); }

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

class UMaterialContainer extends UBaseMaterial {
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

    public async decodeMaterial(): Promise<Material> { return await this.material?.decodeMaterial(); }
}

export default UMaterial;
export { UMaterial, UMaterialContainer, UShader, ETexturePixelFormat, UFadeColor, UTexRotator, UTexPanner, UColorModifier, UTexOscillator };