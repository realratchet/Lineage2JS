import VERTEX_SHADER from "./shader/shader-mesh-static.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-static.fs";
import { appendGlobalUniforms } from "../global-uniforms";
import { ShaderMaterial, Uniform, Matrix3, Color, CustomBlending, SrcAlphaFactor, OneMinusSrcAlphaFactor, Vector3, UniformsLib, UniformsUtils, AdditiveBlending, NoBlending, NormalBlending, OneFactor, OneMinusSrcColorFactor } from "three";

type SupportedShaderParams_T = "shDiffuse" | "shOpacity" | "shSpecular" | "shSpecularMask";
type ApplyParams_T = {
    name: SupportedShaderParams_T,
    sprites: GenericObjectContainer_T<SpriteParam_T>,
    parameters: IDecodedParameter,
    uniforms: GenericObjectContainer_T<Uniform>,
    defines: GenericObjectContainer_T<any>
}

type SpriteParam_T = {
    framerate: number,
    sprites: any[]
}

function applyParameters({ name, parameters, uniforms, defines, sprites }: ApplyParams_T): void {

    let defName;

    switch (name) {
        case "shDiffuse": defName = "DIFFUSE"; break;
        case "shOpacity": defName = "OPACITY"; break;
        case "shSpecular": defName = "SPECULAR"; break;
        case "shSpecularMask": defName = "SPECULAR_MASK"; break;
    }

    defines[`USE_${defName}`] = "";

    Object.assign(uniforms[name].value = {}, parameters.uniforms);
    Object.assign(defines, parameters.defines);

    if (parameters.isUsingMap) {
        if ((parameters as IDecodedSpriteParameter).isSprite) {
            sprites[name] = {
                framerate: (parameters as IDecodedSpriteParameter).framerate,
                sprites: (parameters as IDecodedSpriteParameter).sprites,
            } as SpriteParam_T;
        }

        defines["USE_UV"] = "";
        defines[`USE_MAP_${defName}`] = "";

        if (parameters.transformType !== "none") {
            defines["PAN"] = 0;
            defines["ROTATE"] = 1;
            defines[`USE_MAP_${defName}_TRANSFORM`] = parameters.transformType.toUpperCase();
        }
    }
}

class MeshStaticMaterial extends ShaderMaterial {
    protected sprites: GenericObjectContainer_T<SpriteParam_T>;

    public readonly isStaticMeshMaterial = true;
    public readonly isUpdatable = true;

    // @ts-ignore
    constructor(info: MeshStaticMaterialParameters) {
        // const hasMapDiffuse = "mapDiffuse" in parameters && parameters.mapDiffuse !== null && parameters.mapDiffuse !== undefined;
        // const hasMapSpecularMask = "mapSpecularMask" in parameters && parameters.mapSpecularMask !== null && parameters.mapSpecularMask !== undefined;
        // const hasMapOpacity = "mapOpacity" in parameters && parameters.mapOpacity !== null && parameters.mapOpacity !== undefined;
        // const hasAlphaTest = "alphaTest" in parameters && parameters.alphaTest !== null && parameters.alphaTest !== undefined;
        // const hasSide = "side" in parameters && parameters.side !== null && parameters.side !== undefined;
        // const hasDepthWrite = "depthWrite" in parameters && parameters.depthWrite !== null && parameters.depthWrite !== undefined;
        // const hasTransparent = "transparent" in parameters && parameters.transparent !== null && parameters.transparent !== undefined;
        // const hasFadeColors = "fadeColors" in parameters && parameters.fadeColors !== null && parameters.fadeColors !== undefined;
        // const hasVisible = "visible" in parameters && parameters.visible !== null && parameters.visible !== undefined;
        // const hasTransformedTexture = "transformedTexture" in parameters && parameters.transformedTexture !== null && parameters.transformedTexture !== undefined;

        // debugger;

        const sprites = {};

        const defines: GenericObjectContainer_T<any> = { USE_FOG: "" };
        const uniforms: GenericObjectContainer_T<Uniform> = appendGlobalUniforms(UniformsUtils.merge([
            UniformsLib.lights,
            {
                alphaTest: new Uniform(1e-3),
                diffuse: new Uniform(new Color(0xffffff)),
                // diffuse: new Uniform(new Color(0x787878)),
                opacity: new Uniform(1),
                uvTransform: new Uniform(new Matrix3()),
                uv2Transform: new Uniform(new Matrix3()),
                transformSpecular: new Uniform(null),

                lightMap: new Uniform(null),
                lightMapIntensity: new Uniform(2.0),

                shDiffuse: new Uniform(null),
                shOpacity: new Uniform(null),
                shSpecular: new Uniform(null),
                shSpecularMask: new Uniform(null),

                ambient: new Uniform({
                    color: new Color(1, 1, 1),
                    brightness: 1
                }),

                directionalAmbient: new Uniform({
                    direction: new Vector3(),
                    color: new Color(1, 1, 1),
                    brightness: 1
                })
            }
        ]));

        function apply(name: SupportedShaderParams_T, parameters: IDecodedParameter) {
            if (!parameters) return;

            applyParameters({
                name,
                sprites,
                defines,
                uniforms,
                parameters
            });
        }

        apply("shDiffuse", info.diffuse);
        apply("shOpacity", info.opacity);
        apply("shSpecular", info.specular);
        apply("shSpecularMask", info.specularMask);

        if (info.opacity) defines["USE_ALPHATEST"] = "";

        // defines["USE_DIRECTIONAL_AMBIENT"] = "";

        // debugger;

        // debugger;

        // if (hasTransformedTexture) {
        //     defines["USE_GLOBAL_TIME"] = "";
        //     defines["USE_MAP_SPECULAR"] = "";
        //     defines["USE_TRANSFORMED_SPECULAR"] = "";

        //     if (parameters.transformedTexture.transformPan)
        //         defines["USE_SPECULAR_PAN"] = "";

        //     if (parameters.transformedTexture.transformRotate)
        //         defines["USE_SPECULAR_ROTATE"] = "";
        // }

        // if (hasMapDiffuse || hasMapSpecularMask || hasMapOpacity) {
        //     if (hasMapDiffuse) defines["USE_MAP_DIFFUSE"] = "";
        //     if (hasMapSpecularMask) {
        //         defines["USE_MAP_SPECULAR_MASK"] = "";

        //         if (hasFadeColors) {
        //             defines["USE_FADE"] = "";
        //             defines["USE_GLOBAL_TIME"] = "";
        //         }
        //     }

        //     if (hasMapOpacity) {
        //         // uniforms.diffuse.value.setHex(0xff00ff);
        //         defines["USE_MAP_OPACITY"] = "";
        //         defines["USE_ALPHATEST"] = "";
        //     }

        //     defines["USE_UV"] = "";
        // }

        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            defines,
            uniforms,
            side: info.side,
            transparent: info.transparent,
            depthWrite: info.depthWrite,
            visible: info.visible,
            // lights: true
            // wireframe: true
        });

        this.sprites = sprites;

        if (info.opacity) this.transparent = true;

        switch (info.blendingMode) {
            case "normal":
            case "masked":
                this.blending = NormalBlending;
                break;
            case "brighten":
                this.blending = AdditiveBlending;
                this.transparent = true;
                break;
            // case "masked":
            //     this.blending = CustomBlending;
            //     this.blendSrc = SrcAlphaFactor;
            //     this.blendDst = OneMinusSrcAlphaFactor;
            //     this.alphaTest = 0;
            //     break;
            case "translucent":
                this.blending = CustomBlending;
                this.blendSrc = OneFactor;
                this.blendDst = OneMinusSrcColorFactor;
                this.transparent = true;
                break;
            default: console.warn("Unknown blending mode:", info.blendingMode); break;
        }
    }

    public setLightmap(lightmap: MapData_T) {
        this.uniforms.lightMap.value = lightmap.texture;

        if (lightmap.texture) this.defines.USE_LIGHTMAP = "";
        else delete this.defines.USE_LIGHTMAP;

        this.needsUpdate = true;

        return this;
    }

    public disableDirectionalAmbient() {
        delete this.defines.USE_DIRECTIONAL_AMBIENT;

        this.needsUpdate = true;

        return this;
    }

    public enableAmbient({ color, brightness }: IAmbientLighting) {
        const u = this.uniforms.ambient.value;

        u.color.copy(color);
        u.brightness = brightness / 5;

        this.defines["USE_AMBIENT"] = "";

        this.needsUpdate = true;

        return this;
    }

    public enableDirectionalAmbient({ color, direction, brightness }: IDirectionalAmbientLighting) {
        const u = this.uniforms.directionalAmbient.value;

        u.color.copy(color);
        u.direction.copy(direction);
        u.brightness = brightness / 5;

        this.defines["USE_DIRECTIONAL_AMBIENT"] = "";

        this.needsUpdate = true;

        return this;
    }

    public setInstanced() {
        this.defines["USE_INSTANCED_ATTRIBUTES"] = "";

        this.needsUpdate = true;

        return this;
    }

    public update(time: number) {
        debugger;
    }
}

export default MeshStaticMaterial;
export { MeshStaticMaterial };

type IBaseLighting = {
    color: THREE.Color,
    brightness: number
};

type IAmbientLighting = IBaseLighting;
type IDirectionalAmbientLighting = IBaseLighting & { direction: THREE.Vector3 };

type MeshStaticMaterialParameters = {
    diffuse: IDecodedParameter,
    opacity: IDecodedParameter,
    specular: IDecodedParameter,
    specularMask: IDecodedParameter,
    side: THREE.Side,
    blendingMode: SupportedBlendingTypes_T,
    transparent: boolean,
    depthWrite: boolean,
    visible: boolean
};