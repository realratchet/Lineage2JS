import { AdditiveBlending, CustomBlending, DoubleSide, MeshBasicMaterial, NormalBlending, OneFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, SrcAlphaFactor } from "three";


class ParticleMaterial extends MeshBasicMaterial {
    constructor({ map, blendingMode, opacity, name }: ParticleMaterialInitSettings_T) {

        super({
            map: map.uniforms.map.texture,
            opacity,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            ...getPartcileBlendingSettings(blendingMode)
        });

        this.name = name;
    }
}

class AnimatedParticleMaterial extends MeshBasicMaterial {
    protected framerate: number;
    protected sprites: IDecodedParameter[];
    protected readonly isUpdatable = true;

    constructor({ blendingMode, opacity, name, framerate, sprites }: ParticleMaterialInitSettings_T) {

        super({
            map: sprites[0].uniforms.map.texture,
            opacity,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
            ...getPartcileBlendingSettings(blendingMode)
        });

        this.framerate = framerate;
        this.name = name;
        this.sprites = sprites;
    }

    public update(time: number) {

        const frameCount = this.sprites.length;

        if (frameCount <= 1) return;

        const framerate = this.framerate;
        const activeFrameIndex = Math.floor(time / framerate) % frameCount;

        this.map = this.sprites[activeFrameIndex].uniforms.map.texture;
    }
}

export default ParticleMaterial;
export { ParticleMaterial, AnimatedParticleMaterial };

function getPartcileBlendingSettings(blendingMode: ParticleBlendModes_T) {
    switch (blendingMode) {
        case "normal": return { blending: NormalBlending };
        case "alpha": return {
            blending: CustomBlending,
            blendSrc: SrcAlphaFactor,
            blendDst: OneMinusSrcAlphaFactor,
        };
        case "brighten": return { blending: AdditiveBlending };
        case "translucent": return {
            blending: CustomBlending,
            blendSrc: OneFactor,
            blendDst: OneMinusSrcColorFactor
        }
        default: console.warn("Unknown blending mode:", blendingMode); return {};
    }
}