import MeshEmitterMaterial from "../../materials/mesh-emitter-material/mesh-emitter-material";
import type { ParticleMaterialInitSettings_T } from "../../materials/particle-material/particle-material";
import { DoubleSide, FrontSide, Mesh } from "three";
import BaseEmitter from "./base-emitter";
import type { EmitterConfig_T } from "@l2js/engine/contracts/emitter";

export class MeshEmitter extends BaseEmitter {
    declare protected materials: (ParticleMaterialInitSettings_T | THREE.Material)[];
    protected geometry: THREE.BufferGeometry;
    declare protected useMeshBlendMode: boolean;
    declare protected renderTwoSided: boolean;
    declare protected useParticleColor: boolean;
    declare protected isDepthTesting: boolean;
    declare protected isDepthWriting: boolean;

    public constructor(config: MeshEmitterConfig_T) {
        super(config);
        this.finishConstruction(config);
    }

    protected initSettings(config: MeshEmitterConfig_T): void {
        (this as any).isMeshEmitter = true;
        this.geometry = config.geometry;
        this.materials = Array.isArray(config.materials) ? config.materials : [config.materials];
        this.useMeshBlendMode = config.useMeshBlendMode;
        this.renderTwoSided = config.renderTwoSided;
        this.useParticleColor = config.useParticleColor;
        // Engine.dll 0x880bdf selects the original material even after UseParticleColor's wrapper at 0x880bae.
        this.ignoreParticleColor = config.useMeshBlendMode;

        if (!this.geometry.boundingSphere) this.geometry.computeBoundingSphere();
        this.particleGeometryRadius = this.geometry.boundingSphere.radius;
    }

    protected initParticleMesh() {
        const materials = this.materials.map(m => {
            if ((m as THREE.Material).isMaterial) return (m as THREE.Material).clone();

            const isSprite = m.type === "sprite";

            return new MeshEmitterMaterial({
                map: (isSprite ? m.sprites[0]?.uniforms.map.texture : m.map?.uniforms.map.texture) ?? null,
                sprites: isSprite ? m.sprites.map(s => s.uniforms.map.texture) : undefined,
                framerate: m.framerate,
                blendingMode: m.blendingMode as any,
                // Engine.dll 0x880929..0x8809d7: ParticleMaterial inherits emitter culling and depth flags.
                side: this.renderTwoSided ? DoubleSide : FrontSide,
                transparent: true,
                depthWrite: this.isDepthWriting,
                depthTest: this.isDepthTesting
            });
        });

        return new ParticleMesh(
            this.geometry,
            materials.length === 1 ? materials[0] : materials
        ) as any;
    }
}

export default MeshEmitter;

class ParticleMesh extends Mesh {
    constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) {
        super(geometry, material);
    }
}

type MeshEmitterConfig_T = EmitterConfig_T & {
    geometry: THREE.BufferGeometry,
    materials: ParticleMaterialInitSettings_T | THREE.Material | (ParticleMaterialInitSettings_T | THREE.Material)[],
    useMeshBlendMode: boolean,
    renderTwoSided: boolean,
    useParticleColor: boolean
};
