import UObject from "./un-object"
import ETextureFormat, { ETexturePixelFormat } from "./un-tex-format";
import UTexture from "./un-texture";
// import { Matrix4, Euler, Material, MeshBasicMaterial, DoubleSide, Color, BackSide, FrontSide, Texture, CustomBlending, SrcAlphaFactor, OneMinusSrcAlphaFactor, Matrix3, Vector2, Vector3 } from "three";
import FArray from "./un-array";
import BufferValue from "../buffer-value";
import FNumber from "./un-number";
import UMatrix from "./un-matrix";
// import MeshStaticMaterial from "../../materials/mesh-static-material/mesh-static-material";
import FColor from "./un-color";
import FRotator from "./un-rotator";

abstract class UBaseMaterial extends UObject {
    public abstract async decodeMaterial(): Promise<THREE.Material>;
}
abstract class UBaseModifier extends UBaseMaterial {
    public abstract getParameters(): Promise<{ [key: string]: any }>;
    public async decodeMipmap(level: number): Promise<THREE.Texture> { return await ((this as any).material as UTexture).decodeMipmap(level); };
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
    protected specular: UBaseModifier = null;
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

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        // debugger;

        await super.load(pkg, exp);

        // debugger;

        switch (this.outputBlending) {
            case OutputBlending_T.OB_Normal: break; // default
            case OutputBlending_T.OB_Masked: break; // default
            default:
                console.log("Unknown blending mode.");
                debugger;
                break;
        }

        // debugger;

        // console.assert((this.readTail - pkg.tell()) === 0);

        return this;
    }

    public async decodeMaterial(): Promise<Material> {
        const diffuse = await this.diffuse?.decodeMipmap(0) || null;
        const opacity = await this.opacity?.decodeMipmap(0) || null;
        const specular = await this.specularMask?.decodeMipmap(0) || null;
        const depthWrite = this.depthWrite;
        const side = this.doubleSide ? DoubleSide : FrontSide;
        const transparent = this.transparent;
        const alphaTest = this.alphaTest / 255;

        // if (this.specular && !(this.specular instanceof UFadeColor))
        //     throw new Error(`Unknown specular type.`);

        // debugger;

        const material = new MeshStaticMaterial(Object.assign({
            mapDiffuse: diffuse,
            // map: diffuse,
            mapOpacity: opacity,
            alphaTest,
            side,
            depthWrite,
            transparent,
            mapSpecularMask: specular,
            visible: true
            // wireframe: true,
            // color: Math.round(Math.random() * 0xffffff)
            // color: new Color(this.specular.color1.r / 255, this.specular.color1.g / 255, this.specular.color1.b / 255)
        }, await this.specular?.getParameters()));

        // debugger;

        switch (this.outputBlending) {
            case OutputBlending_T.OB_Normal:
            case OutputBlending_T.OB_Masked:
                material.blending = CustomBlending;
                material.blendSrc = SrcAlphaFactor;
                material.blendDst = OneMinusSrcAlphaFactor;
                material.alphaTest = 0;
                break;
            default: console.warn("Unknown blending mode:", this.outputBlending); break;
        }

        return material;
    }
}

class UFadeColor extends UBaseModifier {
    public color1: FColor = new FColor();
    public color2: FColor = new FColor();
    public period: number = 0;

    public async decodeMaterial(): Promise<Material> { return new MeshBasicMaterial({ color: new Color(this.color1.r, this.color1.g, this.color1.b) }); }

    public async getParameters() {
        return {
            fadeColors: {
                color1: new Color(this.color1.r / 255, this.color1.b / 255, this.color1.b / 255),
                color2: new Color(this.color2.r / 255, this.color2.b / 255, this.color2.b / 255),
                period: this.period
            }
        };
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

    public async decodeMaterial(): Promise<Material> {
        const material = await this.material?.decodeMaterial() as MeshBasicMaterial;

        material.uniforms.diffuse.value.setRGB(this.color.r / 255, this.color.g / 255, this.color.b / 255);
        material.uniforms.opacity.value = this.color.a / 255;

        if (this.doubleSide !== undefined) material.side = this.doubleSide ? DoubleSide : BackSide;

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
    protected type: TexRotationType_T;
    protected rotation: FRotator;
    protected offsetU: number;
    protected offsetV: number;
    protected material: UMaterial;

    public async decodeMaterial(): Promise<Material> { return await this.material?.decodeMaterial() as MeshBasicMaterial; }

    public async getParameters() {
        // const matrix = this.matrix.getMatrix3(new Matrix3());
        const matrix = new Matrix3();
        this.matrix.getMatrix3(matrix);
        const texture = await (this.material as UTexture).decodeMipmap(0);

        // console.log(matrix.elements.slice(0, 3));
        // console.log(matrix.elements.slice(3, 6));
        // console.log(matrix.elements.slice(6, 9));

        // debugger;

        return {
            transformedTexture: {
                transformRotate: true,
                texture,
                matrix
            }
        };
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

    public async getParameters() {
        // debugger;
        return {};
    }

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

    public async getParameters() {
        const matrix = this.matrix.getMatrix3(new Matrix3());
        const texture = await (this.material as UTexture).decodeMipmap(0);

        return {
            transformedTexture: {
                transformPan: true,
                texture,
                matrix,
                rate: this.rate
            }
        };
    }

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
    public static readonly typeSize: number = 14;

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

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + UMaterialContainer.typeSize;

        await this.readNamedProps(pkg);

        return this;
    }

    public async decodeMaterial(): Promise<Material> { return await this.material?.decodeMaterial(); }
}

export default UMaterial;
export { UMaterial, UMaterialContainer, UShader, ETexturePixelFormat, UFadeColor, UTexRotator, UTexPanner, UColorModifier, UTexOscillator };