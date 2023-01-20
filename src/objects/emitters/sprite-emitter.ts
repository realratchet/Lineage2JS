import { AdditiveBlending, BufferGeometry, CustomBlending, DoubleSide, Mesh, MeshBasicMaterial, NormalBlending, OneFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, PlaneBufferGeometry, SrcAlphaFactor } from "three";
import BaseEmitter from "./base-emitter";

const geometry = new PlaneBufferGeometry(1, 1);

class SpriteEmitter extends BaseEmitter {

    protected material: MeshBasicMaterial;

    constructor(config: SpriteEmitterConfig_T) {
        super(config);


        // debugger;
    }

    protected initSettings(config: SpriteEmitterConfig_T): void {
        this.material = createMaterial(config.texture, config.opacity, config.blendingMode);

    }

    protected initParticleMesh() {
        const particle = new ParticleMesh(this.material.clone());

        return particle;
    }
}

export default SpriteEmitter;
export { SpriteEmitter };

class ParticleMesh extends Mesh {
    constructor(material: THREE.Material) {
        super(geometry, material);
    }
}

type SpriteEmitterConfig_T = EmitterConfig_T & {
    texture: MapData_T
};

function createMaterial(mapData: MapData_T, opacity: number, blendingMode: ParticleBlendModes_T) {
    const material = new MeshBasicMaterial({
        transparent: true,
        map: mapData.texture,
        opacity,
        side: DoubleSide,
        depthWrite: false
    });

    switch (blendingMode) {
        case "normal":
            material.blending = NormalBlending;
            break;
        case "alpha":
            material.blending = CustomBlending
            material.blendSrc = SrcAlphaFactor;
            material.blendDst = OneMinusSrcAlphaFactor;
            break;
        case "brighten":
            material.blending = AdditiveBlending;
            break;
        case "translucent":
            material.blending = CustomBlending;
            material.blendSrc = OneFactor;
            material.blendDst = OneMinusSrcColorFactor;
            break;
        default: console.warn("Unknown blending mode:", blendingMode); break;
    }

    // debugger;

    return material;
}

