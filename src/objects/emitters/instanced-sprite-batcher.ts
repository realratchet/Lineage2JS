import { Camera, CustomBlending, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, OneFactor, PlaneGeometry, ShaderMaterial, Vector3, ZeroFactor } from "three";

const baseGeometry = new PlaneGeometry(2, 2);
const DEPTH_BUCKET_SIZE = 2048;
const BATCH_IDLE_MS = 5000;

type BatchGroup_T = { material: ShaderMaterial; renderOrder: number; emitters: any[]; lastUsed: number };

const tmpAnchor = new Vector3();
const tmpViewPosition = new Vector3();
const cacheMaterialKey = new WeakMap<ShaderMaterial, { textureUuid: string; key: string }>();

function isOrderIndependentAdditive(material: any): material is ShaderMaterial {
    return material?.isInstancedParticleMaterial === true
        && material.blending === CustomBlending
        && material.blendSrc === OneFactor
        && material.blendDst === OneFactor
        && material.blendSrcAlpha === ZeroFactor
        && material.blendDstAlpha === OneFactor;
}

function materialKey(material: ShaderMaterial): string {
    const map = material.uniforms?.map?.value;
    const textureUuid = map?.uuid ?? "none";
    const cached = cacheMaterialKey.get(material);
    if (cached?.textureUuid === textureUuid) return cached.key;

    const defines = Object.keys(material.defines ?? {})
        .sort()
        .map(key => `${key}:${String(material.defines[key])}`)
        .join(",");

    const key = [
        textureUuid,
        material.blending,
        material.blendSrc,
        material.blendDst,
        material.blendEquation,
        material.blendSrcAlpha,
        material.blendDstAlpha,
        material.blendEquationAlpha,
        material.side,
        material.depthTest,
        material.depthWrite,
        material.alphaTest,
        defines
    ].join("|");

    cacheMaterialKey.set(material, { textureUuid, key });
    return key;
}

class SpriteParticleBatch {
    public readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
    protected capacity = 0;
    protected readonly fixedNormal: boolean;
    protected positionAttr: InstancedBufferAttribute;
    protected rightAttr: InstancedBufferAttribute;
    protected upAttr: InstancedBufferAttribute;
    protected scaleAttr: InstancedBufferAttribute;
    protected spinAttr: InstancedBufferAttribute;
    protected colorAttr: InstancedBufferAttribute;
    protected uvAttr: InstancedBufferAttribute;
    protected readonly anchor = new Vector3();
    protected readonly baseRight = new Vector3();
    protected readonly baseUp = new Vector3();
    protected readonly right = new Vector3();
    protected readonly up = new Vector3();
    protected readonly spinTemp = new Vector3();
    protected readonly direction = new Vector3();
    protected readonly nonParallel = new Vector3();
    protected readonly localUp = new Vector3();
    protected readonly localRight = new Vector3();
    protected readonly sortCenter = new Vector3();

    public constructor(sourceMaterial: ShaderMaterial, renderOrder: number) {
        const fixedNormal = sourceMaterial.defines?.USE_FIXED_NORMAL !== undefined;
        const geometry = new InstancedBufferGeometry();
        geometry.setIndex(baseGeometry.index);
        geometry.setAttribute("position", baseGeometry.attributes.position);
        geometry.setAttribute("uv", baseGeometry.attributes.uv);
        geometry.instanceCount = 0;

        const material = new ShaderMaterial();
        const sourceUniforms = sourceMaterial.uniforms;

        // ShaderMaterial.copy deep-clones uniforms, and cloneUniforms clones textures through a
        // bare `new this.constructor()` - WetWaterTexture can't survive that; uniforms are shared anyway
        sourceMaterial.uniforms = {};
        material.copy(sourceMaterial);
        sourceMaterial.uniforms = sourceUniforms;
        material.uniforms = sourceUniforms;
        material.defines = { ...(sourceMaterial.defines ?? {}), USE_WORLD_PARTICLE_BATCH: "" };
        material.visible = true;
        material.needsUpdate = true;
        material.name = `${sourceMaterial.name}_world_batch`;

        this.mesh = new Mesh(geometry, material);
        this.mesh.name = `ParticleBatch_${sourceMaterial.name}`;
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
        this.mesh.matrixAutoUpdate = true;
        this.mesh.renderOrder = renderOrder;
        this.fixedNormal = fixedNormal;

        this.ensureCapacity(1);
    }

    public reset() {
        this.mesh.visible = false;
        this.mesh.geometry.instanceCount = 0;
    }

    public dispose() {
        const geometry = this.mesh.geometry;

        // Drop shared attributes before dispose so other batches keep their buffers.
        geometry.deleteAttribute("position");
        geometry.deleteAttribute("uv");
        geometry.setIndex(null);
        geometry.dispose();
        this.mesh.material.dispose();
    }

    public update(emitters: any[]) {
        let required = 0;
        for (const emitter of emitters)
            required += Math.min(emitter.maxActiveParticles, emitter.activeParticles);

        this.ensureCapacity(Math.max(required, 1));

        const positions = this.positionAttr.array as Float32Array;
        const rights = this.fixedNormal ? this.rightAttr.array as Float32Array : null;
        const ups = this.fixedNormal ? this.upAttr.array as Float32Array : null;
        const scales = this.fixedNormal ? null : this.scaleAttr.array as Float32Array;
        const spins = this.fixedNormal ? null : this.spinAttr.array as Float32Array;
        const colors = this.colorAttr.array as Float32Array;
        const uvs = this.uvAttr.array as Float32Array;

        const anchor = this.anchor;
        const baseRight = this.baseRight;
        const baseUp = this.baseUp;
        const right = this.right;
        const up = this.up;
        const spinTemp = this.spinTemp;
        const direction = this.direction;
        const nonParallel = this.nonParallel;
        const localUp = this.localUp;
        const localRight = this.localRight;
        const sortCenter = this.sortCenter.set(0, 0, 0);
        let count = 0;

        for (const emitter of emitters) {
            const mesh = emitter.instancedMesh;
            const material = mesh.material;
            material.visible = false;

            if (this.fixedNormal) {
                direction.copy(emitter.projectionNormal).normalize();
                nonParallel.set(1, 0, 0);
                if (Math.abs(direction.x) >= 0.5) nonParallel.set(0, 1, 0);
                localUp.crossVectors(nonParallel, direction).normalize();
                localRight.crossVectors(localUp, direction).normalize();
                baseRight.copy(localRight).negate().transformDirection(mesh.matrixWorld);
                baseUp.copy(localUp).negate().transformDirection(mesh.matrixWorld);
            }

            const particleLimit = Math.min(emitter.maxActiveParticles, emitter.activeParticles);
            for (let i = 0; i < particleLimit; i++) {
                const settings = emitter.particles[i];
                if (!(settings.flags & 1)) continue;

                const scaleX = settings.scale.x;
                const scaleY = settings.scale.y;
                if (scaleX === 0 && scaleY === 0) continue;

                anchor.copy(settings.position).applyMatrix4(mesh.matrixWorld);

                let angle = 0;
                if (emitter.isSpinning || emitter.spinParticles)
                    angle = (settings.startSpin.z + settings.time * settings.spinsPerSecond.z) * (Math.PI * 2 / 65536);
                if (this.fixedNormal) {
                    const sin = Math.sin(angle);
                    const cos = Math.cos(angle);
                    right.copy(baseRight).multiplyScalar(cos).add(spinTemp.copy(baseUp).multiplyScalar(sin)).multiplyScalar(scaleX);
                    up.copy(baseUp).multiplyScalar(cos).sub(spinTemp.copy(baseRight).multiplyScalar(sin)).multiplyScalar(scaleY);
                }

                const subdivUV = emitter.computeSubdivUV(emitter.resolveSubdivision(settings), emitter.worldBatchSubdivUV);

                const p3 = count * 3;
                const p4 = count * 4;
                positions[p3] = anchor.x;
                positions[p3 + 1] = anchor.y;
                positions[p3 + 2] = anchor.z;
                if (this.fixedNormal) {
                    rights[p3] = right.x;
                    rights[p3 + 1] = right.y;
                    rights[p3 + 2] = right.z;
                    ups[p3] = up.x;
                    ups[p3 + 1] = up.y;
                    ups[p3 + 2] = up.z;
                } else {
                    const p2 = count * 2;
                    scales[p2] = scaleX;
                    scales[p2 + 1] = scaleY;
                    spins[count] = angle;
                }
                colors[p4] = settings.color.x;
                colors[p4 + 1] = settings.color.y;
                colors[p4 + 2] = settings.color.z;
                colors[p4 + 3] = settings.color.w;
                uvs[p4] = subdivUV[0];
                uvs[p4 + 1] = subdivUV[1];
                uvs[p4 + 2] = subdivUV[2];
                uvs[p4 + 3] = subdivUV[3];
                sortCenter.add(anchor);
                count++;
            }
        }

        this.mesh.geometry.instanceCount = count;
        this.mesh.visible = count > 0;

        if (count > 0) {
            this.mesh.position.copy(sortCenter.multiplyScalar(1 / count));
            this.mesh.updateMatrix();
            this.mesh.updateMatrixWorld(true);
        }

        if (count > 0) {
            this.markUpdated(this.positionAttr, count * 3);
            if (this.fixedNormal) {
                this.markUpdated(this.rightAttr, count * 3);
                this.markUpdated(this.upAttr, count * 3);
            } else {
                this.markUpdated(this.scaleAttr, count * 2);
                this.markUpdated(this.spinAttr, count);
            }
            this.markUpdated(this.colorAttr, count * 4);
            this.markUpdated(this.uvAttr, count * 4);
        }
    }

    protected markUpdated(attribute: InstancedBufferAttribute, count: number) {
        attribute.updateRange.offset = 0;
        attribute.updateRange.count = count;
        attribute.needsUpdate = true;
    }

    protected ensureCapacity(required: number) {
        if (required <= this.capacity) return;

        this.capacity = Math.pow(2, Math.ceil(Math.log2(required)));
        const geometry = this.mesh?.geometry;

        const make = (size: number) => new InstancedBufferAttribute(new Float32Array(this.capacity * size), size).setUsage(DynamicDrawUsage);
        this.positionAttr = make(3);
        if (this.fixedNormal) {
            this.rightAttr = make(3);
            this.upAttr = make(3);
        } else {
            this.scaleAttr = make(2);
            this.spinAttr = make(1);
        }
        this.colorAttr = make(4);
        this.uvAttr = make(4);

        if (geometry) {
            // WebGLBindingStates only computes _maxInstanceCount while it is undefined - a stale one clamps every later draw to the original capacity
            (geometry as any)._maxInstanceCount = undefined;

            geometry.setAttribute("instancePosition", this.positionAttr);
            if (this.fixedNormal) {
                geometry.setAttribute("instanceRight", this.rightAttr);
                geometry.setAttribute("instanceUp", this.upAttr);
            } else {
                geometry.setAttribute("instanceScale", this.scaleAttr);
                geometry.setAttribute("instanceSpin", this.spinAttr);
            }
            geometry.setAttribute("instanceColor", this.colorAttr);
            geometry.setAttribute("instanceUV", this.uvAttr);
        }
    }
}

class InstancedSpriteBatcher {
    public readonly root = new Group();
    protected readonly batches = new Map<string, SpriteParticleBatch>();
    protected readonly groups = new Map<string, BatchGroup_T>();

    public constructor() {
        this.root.name = "InstancedSpriteBatches";
    }

    public update(emitters: any[], camera: Camera) {
        const currentTime = performance.now();

        for (const group of this.groups.values()) group.emitters.length = 0;

        camera.updateMatrixWorld();

        for (const emitter of emitters) {
            const mesh = emitter.instancedMesh;
            const material = mesh?.material;

            // a batch takes this back below - whatever the grouping rejects has to draw itself again
            if (material) material.visible = true;

            if (!mesh?.visible || !mesh.isWorldBatchCandidate || !emitter.activeCount || !isOrderIndependentAdditive(material)) continue;

            if (!emitter.worldBatchSubdivUV) emitter.worldBatchSubdivUV = [0, 0, 1, 1];

            mesh.updateWorldMatrix(true, false);
            tmpAnchor.setFromMatrixPosition(mesh.matrixWorld);
            tmpViewPosition.copy(tmpAnchor).applyMatrix4(camera.matrixWorldInverse);
            const depthBucket = Math.max(0, Math.floor(-tmpViewPosition.z / DEPTH_BUCKET_SIZE));
            const key = `${materialKey(material)}|order:${mesh.renderOrder}|depth:${depthBucket}`;
            let group = this.groups.get(key);
            if (!group) {
                group = { material, renderOrder: mesh.renderOrder, emitters: [], lastUsed: currentTime };
                this.groups.set(key, group);
            }
            group.material = material;
            group.emitters.push(emitter);
        }

        for (const batch of this.batches.values()) batch.reset();

        for (const [key, group] of this.groups) {
            if (group.emitters.length === 0) {
                // Texture/depth keys churn, so retire idle batches instead of retaining every material.
                if (currentTime - group.lastUsed < BATCH_IDLE_MS) continue;

                const idle = this.batches.get(key);

                if (idle) {
                    this.root.remove(idle.mesh);
                    idle.dispose();
                    this.batches.delete(key);
                }

                this.groups.delete(key);
                continue;
            }

            group.lastUsed = currentTime;

            let batch = this.batches.get(key);
            if (!batch) {
                batch = new SpriteParticleBatch(group.material, group.renderOrder);
                this.batches.set(key, batch);
                this.root.add(batch.mesh);
            }
            batch.update(group.emitters);
        }
    }
}

export default InstancedSpriteBatcher;
export { InstancedSpriteBatcher, isOrderIndependentAdditive };
