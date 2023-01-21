import { Mesh } from "three";
import BaseEmitter from "./base-emitter";

class MeshEmitter extends BaseEmitter {
    protected materials: THREE.Material | THREE.Material[];
    protected geometry: THREE.BufferGeometry;

    protected initSettings(config: MeshEmitterConfig_T): void {
        this.geometry = config.geometry;
        this.materials = config.materials;
    }

    protected initParticleMesh() {
        const particle = new ParticleMesh(
            this.geometry,
            this.materials// instanceof Array ? this.materials.map(m => m.clone()) : this.materials.clone()
        );

        return particle;
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
    materials: THREE.Material | THREE.Material[]
};