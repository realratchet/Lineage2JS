import UObject from "./un-object"
import ETextureFormat, { ETexturePixelFormat } from "./un-tex-format";
import UTexture from "./un-texture";
import { Matrix4, Euler, Material, MeshBasicMaterial, DoubleSide, Color, BackSide, FrontSide, Texture } from "three";
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
abstract class UBaseModifier extends UBaseMaterial {
    public async decodeMipmap(level: number): Promise<Texture> { return null; }
}

abstract class UMaterial extends UBaseMaterial { }

enum OutputBlending_T
{
	OB_Normal,
	OB_Masked,
	OB_Modulate,
	OB_Translucent,
	OB_Invisible,
	OB_Brighten,
	OB_Darken
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

class UShader extends UMaterial {
    protected diffuse: UTexture = null;
    protected opacity: UTexture = null;
    protected doubleSide: boolean = false;
    protected specular: UFadeColor = null;
    protected specularMask: UTexture = null;
    protected outputBlending: OutputBlending_T = OutputBlending_T.OB_Normal;
    protected isTreatingDoubleSided: boolean = false;
    protected depthWrite: boolean = true;
    protected transparent: boolean = false;
    protected alphaTest: number = 0;
    protected isPerformingLightningOnSpecularPass: boolean = false;

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
            "AlphaRef": "alphaTest",
            "PerformLightingOnSpecularPass": "isPerformingLightningOnSpecularPass"
        });
    }

    public async decodeMaterial(): Promise<Material> {
        const diffuse = await this.diffuse?.decodeMipmap(0) || null;
        const opacity = await this.opacity?.decodeMipmap(0) || null;
        const specular = await this.specularMask?.decodeMipmap(0) || null;
        const depthWrite = this.depthWrite;
        const side = this.doubleSide ? DoubleSide : FrontSide;
        const transparent = this.transparent;
        const alphaTest = this.alphaTest / 255;

        const material = new MeshBasicMaterial({
            map: diffuse,
            alphaMap: opacity,
            alphaTest,
            side,
            depthWrite,
            transparent,
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

    public async decodeMaterial(): Promise<Material> {
        const material = await this.material?.decodeMaterial();

        if (!material) return null;

        material.color.setHex(0xff00ff);

        return material;
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