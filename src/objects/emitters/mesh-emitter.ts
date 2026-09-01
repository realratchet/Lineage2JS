import MeshEmitterMaterial from "../../materials/mesh-emitter-material/mesh-emitter-material";
import type { ParticleMaterialInitSettings_T } from "../../materials/particle-material/particle-material";
import { DoubleSide, Mesh } from "three";
import BaseEmitter from "./base-emitter";
import type { EmitterConfig_T } from "@l2js/engine/contracts/emitter";

class MeshEmitter extends BaseEmitter {
    protected materials: ParticleMaterialInitSettings_T | ParticleMaterialInitSettings_T[];
    protected geometry: THREE.BufferGeometry;

    public constructor(config: MeshEmitterConfig_T) {
        super(config);
        this.finishConstruction(config);
    }

    protected initSettings(config: MeshEmitterConfig_T): void {
        this.geometry = config.geometry;
        this.materials = config.materials;

        if (!this.geometry.boundingSphere) this.geometry.computeBoundingSphere();
        this.particleGeometryRadius = this.geometry.boundingSphere.radius;
    }

    protected initParticleMesh() {
        const materialConfigs = this.materials instanceof Array ? this.materials : [this.materials];
        const materials = materialConfigs.map(m => {
            const isSprite = m.type === "sprite";

            return new MeshEmitterMaterial({
                map: (isSprite ? m.sprites[0]?.uniforms.map.texture : m.map?.uniforms.map.texture) ?? null,
                sprites: isSprite ? m.sprites.map(s => s.uniforms.map.texture) : undefined,
                framerate: m.framerate,
                blendingMode: m.blendingMode as any,
                side: DoubleSide,
                transparent: true,
                depthWrite: false,
                depthTest: true
            });
        });

        return new ParticleMesh(
            this.geometry,
            materials.length === 1 ? materials[0] : materials
        ) as any;
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
