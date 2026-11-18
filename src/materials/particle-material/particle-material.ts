import { Color, ClampToEdgeWrapping, DoubleSide, LinearFilter, ShaderMaterial, UniformsUtils, UniformsLib, Vector3, Vector4 } from "three";
import { getPartcileBlendingSettings } from "../particle-blending";
import { updateTextureFiltering } from "../texture-settings";
import VERTEX_SHADER from "./shader/shader-particle.vs";
import FRAGMENT_SHADER from "./shader/shader-particle.fs";
import { appendGlobalUniforms } from "../global-uniforms";
import type { ParticleBlendModes_T } from "@l2js/engine/contracts/emitter";
import type { IDecodedParameter } from "@l2js/engine/contracts/material";

// Atlas cells need clamping; cropped textures disable mips to avoid neighboring cells.
export function fixParticleTextureSampling(texture: any, disableMipmaps: boolean = false) {
    if (!texture) return;
    let changed = false;
    if (texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping) {
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        changed = true;
    }
    if (disableMipmaps && texture.minFilter !== LinearFilter && texture.mipmaps?.length > 1) {
        updateTextureFiltering(texture, LinearFilter);
        changed = true;
    }
    if (changed) texture.needsUpdate = true;
}

export class ParticleMaterial extends ShaderMaterial {
    public isUpdatable = false;

    public constructor({ map, blendingMode, opacity, name, usesSubdivision, blendBetweenSubdivisions, rangeFade }: ParticleMaterialInitSettings_T) {

        const uniforms = appendGlobalUniforms(UniformsUtils.merge([
            UniformsLib.common,
            UniformsLib.fog
        ]));

        uniforms.map.value = map?.uniforms.map.texture ?? null; // missing textures still simulate
        fixParticleTextureSampling(uniforms.map.value, usesSubdivision === true);
        if (opacity !== undefined) uniforms.opacity.value = opacity;
        uniforms.diffuse.value = new Color(0xffffff);
        uniforms.alphaTest.value = 1e-3;
        uniforms.uvOffsetScale = { value: new Vector4(0, 0, 1, 1) };
        uniforms.rangeFade = rangeFade ?? { value: 1 };

        const defines: Record<string, any> = { USE_FOG: "", USE_ALPHATEST: "" };

        if (blendBetweenSubdivisions) {
            defines.USE_SUBDIVISION_BLEND = "";
            uniforms.subdivisionBlend = { value: new Vector3() };
        }

        if (uniforms.map.value) {
            defines.USE_MAP = "";
        }
        const blendingSettings = getPartcileBlendingSettings(blendingMode, defines);

        super({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            uniforms,
            defines,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            ...blendingSettings
        });

        (this as any).isParticleMaterial = true;

        this.isUpdatable = (uniforms.map.value as any)?.isUpdatable === true;
        this.name = name;
    }

    public update(time: number) {
        (this.uniforms.map.value as any)?.update(time);
    }
}

export class AnimatedParticleMaterial extends ParticleMaterial {
    protected framerate: number;
    protected sprites: IDecodedParameter[];
    public readonly isUpdatable = true;

    public constructor(info: ParticleMaterialInitSettings_T) {
        if (!info.sprites.length) throw new Error(`Animated particle material '${info.name}' has no sprites.`);

        super({ ...info, map: info.sprites[0], usesSubdivision: false });
        this.defines.USE_MAP = "";
        this.framerate = info.framerate;
        this.sprites = info.sprites;
    }

    public update(time: number) {

        const frameCount = this.sprites.length;

        if (frameCount <= 1) return;

        const framerate = this.framerate;
        const activeFrameIndex = Math.floor(time / framerate) % frameCount;

        this.uniforms.map.value = this.sprites[activeFrameIndex].uniforms.map.texture;
        fixParticleTextureSampling(this.uniforms.map.value);
    }
}

export default ParticleMaterial;

export type ParticleMaterialInitSettings_T = {
    type: "sprite" | "texture",
    map?: any,
    sprites?: any[],
    framerate?: number,
    blendingMode: ParticleBlendModes_T,
    opacity: number,
    name: string,
    usesSubdivision?: boolean,
    blendBetweenSubdivisions?: boolean,
    rangeFade?: THREE.IUniform
};
