import { DoubleSide, FrontSide } from "three";
import MeshEmitter from "./mesh-emitter";

class VertMeshEmitter extends MeshEmitter {
    declare protected framerate: number;
    declare protected animFrames: number[];
    declare protected ignoreParticleColor: boolean;
    declare protected renderTwoSided: boolean;

    protected initSettings(config: any): void {
        if (config.geometry) super.initSettings(config);
        else this.geometry = null;
        this.framerate = config.framerate;
        this.animFrames = [];
        this.ignoreParticleColor = config.useMeshBlendMode && !config.useParticleColor;
        this.renderTwoSided = config.renderTwoSided;
    }

    protected initParticleMesh() {
        if (!this.geometry) return null;

        const mesh = super.initParticleMesh();

        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
            material.side = this.renderTwoSided ? DoubleSide : FrontSide;

        return mesh;
    }

    protected spawnParticle(...args: Parameters<MeshEmitter["spawnParticle"]>) {
        super.spawnParticle(...args);
        if (!this.geometry) return;

        this.animFrames[args[0]] = 0;
        const mesh = this.particlePool[args[0]].children[0] as THREE.Mesh;

        mesh.morphTargetInfluences.fill(0);
        mesh.morphTargetInfluences[0] = 1;
    }

    protected updateParticles(deltaTime: number) {
        const result = super.updateParticles(deltaTime);

        // Engine.dll 0x9d98cc..0x9d98f0 simulates meshless emitters without vertex animation.
        if (!this.geometry) return 0;

        const count = this.geometry.morphAttributes.position.length;
        const rate = (this.parent as any).scriptProperties.get("SpeedRate");

        if (!Number.isFinite(rate) || rate < 0) throw new Error(`VertMeshEmitter '${this.name}' has invalid SpeedRate '${rate}'.`);

        for (let i = 0; i < this.particlePool.length; i++) {
            if (this.animFrames[i] === undefined) continue;

            const mesh = this.particlePool[i].children[0] as THREE.Mesh;
            const previous = Math.floor(this.animFrames[i]);
            const frame = (this.animFrames[i] + deltaTime * this.framerate * rate) % count;
            const first = Math.floor(frame);
            const alpha = frame - first;

            mesh.morphTargetInfluences[previous] = 0;
            mesh.morphTargetInfluences[(previous + 1) % count] = 0;
            mesh.morphTargetInfluences[first] = 1 - alpha;
            mesh.morphTargetInfluences[(first + 1) % count] += alpha;
            this.animFrames[i] = frame;
        }

        return result;
    }

    public update(currentTime: number): void {
        super.update(currentTime);
        if (!this.geometry || !this.ignoreParticleColor) return;

        for (const particle of this.particlePool) {
            if (!particle.visible) continue;

            const mesh = particle.children[0] as THREE.Mesh;
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

            materials.forEach((material: any, index: number) => {
                const source = (this.materials as THREE.ShaderMaterial[])[index];

                material.uniforms.diffuse.value.copy(source.uniforms.diffuse.value);
                material.uniforms.opacity.value = source.uniforms.opacity.value;
            });
        }
    }
}

export default VertMeshEmitter;
