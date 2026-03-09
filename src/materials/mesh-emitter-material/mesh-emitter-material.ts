import VERTEX_SHADER from "./shader/mesh-emitter.vs";
import FRAGMENT_SHADER from "./shader/mesh-emitter.fs";
import { ShaderMaterial, Uniform, Color, NormalBlending, CustomBlending, SrcAlphaFactor, OneFactor, OneMinusSrcColorFactor, DstColorFactor, SrcColorFactor, ZeroFactor, DoubleSide } from "three";
import { appendGlobalUniforms } from "../global-uniforms";

export type MeshEmitterMaterialParameters = {
    map: THREE.Texture,
    diffuse?: THREE.Color,
    opacity?: number,
    blendingMode?: "normal" | "brighten" | "translucent" | "modulate" | "modulated" | "darken" | "alpha",
    side?: THREE.Side,
    transparent?: boolean,
    depthWrite?: boolean,
    depthTest?: boolean,
    sprites?: THREE.Texture[],
    framerate?: number
};

export default class MeshEmitterMaterial extends ShaderMaterial {
    public readonly isMeshEmitterMaterial = true;
    public isUpdatable = false;
    protected sprites: THREE.Texture[] = [];
    protected framerate: number = 0;

    constructor(info: MeshEmitterMaterialParameters) {
        const uniforms = appendGlobalUniforms({
            diffuse: new Uniform(info.diffuse || new Color(1, 1, 1)),
            opacity: new Uniform(info.opacity !== undefined ? info.opacity : 1),
            map: new Uniform(info.map || null)
        });

        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            uniforms,
            side: info.side !== undefined ? info.side : DoubleSide,
            transparent: info.transparent !== undefined ? info.transparent : true,
            depthWrite: info.depthWrite !== undefined ? info.depthWrite : false,
            depthTest: info.depthTest !== undefined ? info.depthTest : true,
            defines: { USE_FOG: "" }
        });

        if (info.sprites && info.sprites.length > 1) {
            this.sprites = info.sprites;
            this.framerate = info.framerate || 30;
            this.isUpdatable = true;
        }

        this.applyBlending(info.blendingMode || "normal");
    }

    protected applyBlending(mode: string) {
        delete this.defines.USE_ADDITIVE_FOG;
        switch (mode) {
            case "normal":
            case "alpha":
                this.blending = NormalBlending;
                break;
            case "brighten":
                this.blending = CustomBlending;
                this.blendSrc = SrcAlphaFactor;
                this.blendDst = OneFactor;
                this.defines.USE_ADDITIVE_FOG = "";
                break;
            case "translucent":
                this.blending = CustomBlending;
                this.blendSrc = OneFactor;
                this.blendDst = OneMinusSrcColorFactor;
                this.defines.USE_ADDITIVE_FOG = "";
                break;
            case "modulate":
            case "modulated":
                this.blending = CustomBlending;
                this.blendSrc = DstColorFactor;
                this.blendDst = SrcColorFactor;
                break;
            case "darken":
                this.blending = CustomBlending;
                this.blendSrc = ZeroFactor;
                this.blendDst = OneMinusSrcColorFactor;
                break;
            default:
                this.blending = NormalBlending;
                break;
        }
        this.needsUpdate = true;
    }

    public update(time: number) {
        if (!this.isUpdatable) return;

        const frameCount = this.sprites.length;
        const activeFrameIndex = Math.floor(time / this.framerate) % frameCount;
        this.uniforms.map.value = this.sprites[activeFrameIndex];
    }
}
