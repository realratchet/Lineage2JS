import VERTEX_SHADER from "./shader/shader-mesh-static.vs";
import FRAGMENT_SHADER from "./shader/shader-mesh-static.fs";
import { appendGlobalUniforms } from "../global-uniforms";
import { padTransformStages } from "./transform-stage";
import { ShaderMaterial, Uniform, Matrix3, Color, CustomBlending, Vector2, Vector3, UniformsUtils, NormalBlending, OneFactor, OneMinusSrcColorFactor, OneMinusSrcAlphaFactor, ZeroFactor, DstColorFactor, SrcColorFactor, SrcAlphaFactor } from "three";
import type { SupportedBlendingTypes_T, IDecodedParameter, IDecodedSpriteParameter } from "@l2js/engine/contracts/material";
import type { MapData_T } from "@l2js/engine/contracts/texture";

const TRANSFORM_CHAIN_SLOTS = new Set(["shDiffuse", "shOpacity", "shSpecular", "shSpecularMask"]);

// Actor.MaxLights - retail enables at most four per actor draw (L2.heine_fountain.trace call 192833)
export const NUM_ACTOR_LIGHTS = 4;

type SupportedShaderParams_T = "shDiffuse" | "shOpacity" | "shSpecular" | "shSpecularMask" | "shMaterial2";
type ApplyParams_T = {
    name: SupportedShaderParams_T,
    sprites: Record<string, SpriteParam_T>,
    parameters: IDecodedParameter,
    uniforms: Record<string, Uniform>,
    defines: Record<string, any>
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
        case "shMaterial2": defName = "MATERIAL2"; break;
    }

    defines[`USE_${defName}`] = "";

    const { diffuse, opacity, ...restUniforms } = parameters.uniforms;

    if (diffuse !== undefined) uniforms.diffuse.value.copy(diffuse);
    if (opacity !== undefined) uniforms.opacity.value = opacity;

    Object.assign(uniforms[name].value = {}, restUniforms);
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

        if (parameters.uvIndex === 1) {
            defines["USE_UV2"] = "";
            defines[`USE_MAP_${defName}_UV2`] = "";
        }

        if (parameters.transformType !== "none") {
            defines["PAN"] = 0;
            defines["ROTATE"] = 1;
            defines["OSCILLATE"] = 2;
            defines["ENVMAP"] = 3;
            defines["ENVMAPWORLD"] = 4;
            defines[`USE_MAP_${defName}_TRANSFORM`] = parameters.transformType.toUpperCase();

            // nested UV transforms for NMoon1
            const innerTransforms = (parameters.uniforms as any).innerTransforms;
            if (innerTransforms?.length > 0 && TRANSFORM_CHAIN_SLOTS.has(name)) {
                defines[`USE_MAP_${defName}_TRANSFORM_CHAIN`] = "";
                uniforms[name].value.innerTransforms = padTransformStages(innerTransforms);
            }
        }
    }
}

export default class MeshStaticMaterial extends ShaderMaterial {
    public readonly isStaticMeshMaterial = true;
    public sprites: Record<string, SpriteParam_T> = {};
    protected spriteEntries: [string, SpriteParam_T][] = [];
    protected proceduralMaps: any[] = [];

    public isUpdatable = false;

    // @ts-ignore
    public constructor(info: MeshStaticMaterialParameters_T = {}) {
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

        const defines: Record<string, any> = { USE_FOG: "" };
        // UniformsLib.lights dropped - NUM_DIR_LIGHTS/NUM_SPOT_LIGHTS/NUM_HEMI_LIGHTS are always
        // 0 here (DynamicLight isn't a THREE.Light), so those ~19 uniforms never compiled in
        const uniforms: Record<string, Uniform> = appendGlobalUniforms(UniformsUtils.merge([
            {
                alphaTest: new Uniform(1e-3),
                diffuse: new Uniform(new Color(0xffffff)),
                // diffuse: new Uniform(new Color(0x787878)),
                opacity: new Uniform(1),
                terrainDecorationFadeRange: new Uniform(new Vector2()),
                uvTransform: new Uniform(new Matrix3()),
                uv2Transform: new Uniform(new Matrix3()),
                transformSpecular: new Uniform(null),

                lightMap: new Uniform(null),
                lightMapIntensity: new Uniform(info.modulateStaticLighting2X === true ? 2 : 1),

                shDiffuse: new Uniform(null),
                shOpacity: new Uniform(null),
                shSpecular: new Uniform(null),
                shSpecularMask: new Uniform(null),
                shMaterial2: new Uniform(null),

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

        if (info.selfIllumination) defines["USE_SELF_ILLUMINATION"] = "";

        switch (info.blendingMode) {
            case "modulate": defines["USE_MODULATED_FOG"] = ""; break;
            case "alphaModulate":
            case "translucent":
            case "brighten":
            case "darken":
            case "invisible": defines["USE_ADDITIVE_FOG"] = ""; break;
        }

        if (info.alphaTest !== undefined) uniforms.alphaTest.value = info.alphaTest;

        if (info.opacity || info.alphaTest !== undefined) defines["USE_ALPHATEST"] = "";
        if (info.blendingMode === "masked") {
            defines["USE_MASKING"] = "";
            defines["USE_ALPHATEST"] = "";
        }

        if (info.transparent && !info.opacity) {
            defines["USE_MASKING"] = "";
            defines["USE_ALPHATEST"] = "";
        }

        if (info.combiner) {
            defines["USE_COMBINER"] = "";
            apply("shMaterial2", info.combiner.material2);
            uniforms["combiner"] = new Uniform({
                combineMode: info.combiner.combineMode,
                invertMask: info.combiner.invertMask,
                alphaFrom1: info.combiner.alphaFrom1 ?? true,
                alphaFrom2: info.combiner.alphaFrom2 ?? true
            });
        }

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

        // debugger

        // console.log(info);


        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            defines,
            uniforms,
            side: info.side,
            transparent: info.transparent,
            depthWrite: true,
            depthTest: true,
            visible: info.visible,
            // lights:true would write into uniforms.ambientLightColor/directionalLights/etc,
            // which no longer exist now that UniformsLib.lights isn't merged in above
            lights: false,
            wireframe: false
        });

        this.sprites = sprites;
        this.spriteEntries = Object.entries(sprites);

        // procedural maps (water) drive their own animation through update()
        this.proceduralMaps = Object.values(uniforms)
            .map((u: any) => u?.value)
            .filter((v: any) => v?.isTexture && v.isUpdatable);

        this.isUpdatable = this.spriteEntries.length > 0 || this.proceduralMaps.length > 0;

        if (info.opacity) this.transparent = true;

        switch (info.blendingMode) {
            case "normal":
                this.blending = NormalBlending;
                // UE2 OB_Normal: when opacity is present, forces ZWrite=0 and enables alpha blending
                if (info.opacity) this.depthWrite = false;
                break;
            case "masked":
                // UE2 OB_Masked: opaque rendering (ONE,ZERO) + alpha test, no blending - AlphaRef=127 (~0.498), ZWrite=1
                this.blending = NormalBlending;
                this.transparent = false;
                uniforms.alphaTest.value = 127 / 255;
                break;
            case "brighten":
                // UE2 FB_Brighten: SRC_ALPHA, ONE (alpha-weighted additive)
                this.blending = CustomBlending;
                this.blendSrc = SrcAlphaFactor;
                this.blendDst = OneFactor;
                this.transparent = true;
                this.depthWrite = false;
                break;
            case "translucent":
                // UE2 FB_Translucent: ONE, INVSRCCOLOR (screen blend)
                this.blending = CustomBlending;
                this.blendSrc = OneFactor;
                this.blendDst = OneMinusSrcColorFactor;
                this.transparent = true;
                this.depthWrite = false;
                break;
            case "modulate":
                this.blending = CustomBlending;
                this.blendSrc = DstColorFactor;
                this.blendDst = SrcColorFactor;
                this.transparent = true;
                this.depthWrite = false;
                break;
            case "alphaModulate":
                // UE2 FB_AlphaModulate_MightNotFogCorrectly: ONE, INVSRCALPHA (D3DMaterialState.cpp line 310-316)
                this.blending = CustomBlending;
                this.blendSrc = OneFactor;
                this.blendDst = OneMinusSrcAlphaFactor;
                this.transparent = true;
                this.depthWrite = false;
                break;
            case "invisible":
                // UE2 FB_Invisible: ZERO, ONE (D3DMaterialState.cpp line 345-350)
                this.blending = CustomBlending;
                this.blendSrc = ZeroFactor;
                this.blendDst = OneFactor;
                this.transparent = true;
                this.depthWrite = false;
                break;
            case "darken":
                this.blending = CustomBlending;
                this.blendSrc = ZeroFactor;
                this.blendDst = OneMinusSrcColorFactor;
                this.transparent = true;
                this.depthWrite = false;
                break;
            default: console.warn("Unknown blending mode:", info.blendingMode); break;
        }

        // ApplyFinalBlend runs for ZWrite per D3DMaterialState
        if (info.modifyFramebufferBlending) this.depthWrite = info.depthWrite;

        // Projector leaves bProjectOnAlpha False, so alpha-blended surfaces - ocean, glass - take no decal
        if (this.transparent) this.defines["NO_SHADOW_RECEIVE"] = "";
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

    public enableAmbient({ vector, brightness }: AmbientLighting_T) {
        const u = this.uniforms.ambient.value;

        u.color.copy(vector);
        u.brightness = brightness / 5;

        this.defines["USE_AMBIENT"] = "";

        this.needsUpdate = true;

        return this;
    }

    public enableDirectionalAmbient({ vector, direction, brightness }: DirectionalAmbientLighting_T) {
        const u = this.uniforms.directionalAmbient.value;

        u.color.copy(vector);
        u.direction.copy(direction);
        u.brightness = brightness;

        this.defines["USE_DIRECTIONAL_AMBIENT"] = "";

        this.needsUpdate = true;

        return this;
    }

    public setInstanced() {
        this.defines["USE_INSTANCED_ATTRIBUTES"] = "";

        this.needsUpdate = true;

        return this;
    }

    public setTerrainDecoration() {
        this.defines["USE_TERRAIN_DECORATION_FADE"] = "";
        this.transparent = true;
        this.depthWrite = false;

        this.needsUpdate = true;

        return this;
    }

    public setSway() {
        this.defines["USE_SWAY"] = "";

        if (this.transparent && this.blending === NormalBlending) this.depthWrite = true;

        this.needsUpdate = true;

        return this;
    }

    public setLit() {
        this.defines["USE_LIT_ATTRIBUTES"] = "";

        this.needsUpdate = true;

        return this;
    }

    public setExtendedBoneInfluences() {
        this.defines["USE_EXTENDED_BONE_INFLUENCES"] = "";

        this.needsUpdate = true;

        return this;
    }

    // per-vertex hardware lighting instead of a baked stream: EnableLighting(1,0,1) (UnSkeletalMesh.cpp line 4908)
    public setActorLit() {
        this.uniforms.actorAmbient = new Uniform(new Color(0, 0, 0));
        this.uniforms.actorScaledGlow = new Uniform(1);
        this.uniforms.numActorLights = new Uniform(0);
        this.uniforms.actorLights = new Uniform(Array.from({ length: NUM_ACTOR_LIGHTS }, () => ({
            position: new Vector3(),
            direction: new Vector3(),
            color: new Color(0, 0, 0),
            radius: 0,
            cone: 0,
            effect: 0
        })));

        this.defines["USE_ACTOR_LIGHTS"] = "";
        this.defines["NUM_ACTOR_LIGHTS"] = NUM_ACTOR_LIGHTS;

        this.needsUpdate = true;

        return this;
    }

    public setUnlit() {
        delete this.defines["USE_AMBIENT"];
        delete this.defines["USE_LIGHTMAP"];
        this.needsUpdate = true;
        return this;
    }

    public update(time: number) {
        if (!this.isUpdatable) return;

        for (const map of this.proceduralMaps)
            map.update(time);

        for (let i = 0; i < this.spriteEntries.length; i++) {
            const [k, { sprites, framerate }] = this.spriteEntries[i];
            const frameCount = sprites.length;

            if (frameCount <= 1) continue;

            const uniform = this.uniforms[k];
            const activeFrameIndex = Math.floor(time / framerate) % frameCount;
            const activeFrame = sprites[activeFrameIndex];

            uniform.value.map = activeFrame;
        }
    }
}

type BaseLighting_T = {
    vector: THREE.Color,
    brightness: number
};

type AmbientLighting_T = BaseLighting_T;
type DirectionalAmbientLighting_T = BaseLighting_T & { direction: THREE.Vector3 };

type MeshStaticMaterialParameters_T = {
    diffuse: IDecodedParameter,
    opacity: IDecodedParameter,
    specular: IDecodedParameter,
    specularMask: IDecodedParameter,
    side: THREE.Side,
    blendingMode: SupportedBlendingTypes_T,
    transparent: boolean,
    alphaTest?: number,
    depthWrite: boolean,
    depthTest: boolean,
    modifyFramebufferBlending?: boolean,
    visible: boolean,
    modulateStaticLighting2X?: boolean,
    selfIllumination?: boolean,
    combiner?: {
        combineMode: number,
        material1: IDecodedParameter,
        material2: IDecodedParameter,
        invertMask: boolean,
        alphaFrom1: boolean,
        alphaFrom2: boolean
    }
};

