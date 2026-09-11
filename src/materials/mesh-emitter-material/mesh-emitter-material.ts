import VERTEX_SHADER from "./shader/mesh-emitter.vs";
import FRAGMENT_SHADER from "./shader/mesh-emitter.fs";
import { ShaderMaterial, Uniform, Color, DoubleSide } from "three";
import { appendGlobalUniforms } from "../global-uniforms";
import { getPartcileBlendingSettings } from "../particle-material/particle-material";
import type { ParticleBlendModes_T } from "@l2js/engine/contracts/emitter";

export type MeshEmitterMaterialParameters = {
    map: THREE.Texture,
    diffuse?: THREE.Color,
    opacity?: number,
    blendingMode?: ParticleBlendModes_T,
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

    protected applyBlending(mode: ParticleBlendModes_T) {
        const { isAdditive, ...settings } = getPartcileBlendingSettings(mode);

        Object.assign(this, settings);
        delete this.defines.USE_ADDITIVE_FOG;
        if (isAdditive) this.defines.USE_ADDITIVE_FOG = "";
        this.needsUpdate = true;
    }

    public update(time: number) {
        if (!this.isUpdatable) return;

        const frameCount = this.sprites.length;
        const activeFrameIndex = Math.floor(time / this.framerate) % frameCount;
        this.uniforms.map.value = this.sprites[activeFrameIndex];
    }
}
