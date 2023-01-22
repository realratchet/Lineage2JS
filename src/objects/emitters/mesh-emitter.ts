import ParticleMaterial from "@client/materials/particle-material";
import { Mesh } from "three";
import BaseEmitter from "./base-emitter";

class MeshEmitter extends BaseEmitter {
    protected materials: ParticleMaterialInitSettings_T | ParticleMaterialInitSettings_T[];
    protected geometry: THREE.BufferGeometry;

    protected initSettings(config: MeshEmitterConfig_T): void {
        this.geometry = config.geometry;
        this.materials = config.materials;
    }

    protected initParticleMesh() {
        return new ParticleMesh(
            this.geometry,
            this.materials instanceof Array ? this.materials.map(m => new ParticleMaterial(m)) : new ParticleMaterial(this.materials)
        );
    }
}

export default MeshEmitter;
export { MeshEmitter };

class ParticleMesh extends Mesh {
    constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) {
        super(geometry, material);
    }
}

type MeshEmitterConfig_T = EmitterConfig_T & {
    geometry: THREE.BufferGeometry,
    materials: ParticleMaterialInitSettings_T | ParticleMaterialInitSettings_T[]
};