import ParticleMaterial from "@client/materials/particle-material";
import { Mesh, PlaneBufferGeometry } from "three";
import BaseEmitter from "./base-emitter";

const geometry = new PlaneBufferGeometry(1, 1);

class SpriteEmitter extends BaseEmitter {

    protected material: ParticleMaterialInitSettings_T;

    protected initSettings(config: SpriteEmitterConfig_T): void {
        this.material = config.material;
    }

    protected initParticleMesh() { return new ParticleMesh(new ParticleMaterial(this.material)); }
}

export default SpriteEmitter;
export { SpriteEmitter };

class ParticleMesh extends Mesh {
    constructor(material: THREE.Material) {
        super(geometry, material);
    }
}

type SpriteEmitterConfig_T = EmitterConfig_T & {
    material: ParticleMaterialInitSettings_T
};