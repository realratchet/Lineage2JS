import { BackSide, BufferAttribute, BufferGeometry, DoubleSide, NormalBlending, Sphere, Texture, Vector4, WebGLRenderer } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import LitSkinnedMesh from "./lit-skinned-mesh";
import LocalSpaceSkeleton from "./local-space-skeleton";
import MeshStaticMaterial from "../materials/mesh-static-material/mesh-static-material";

const cacheGeometry = new WeakMap<BufferGeometry, Map<string, WeakRef<BufferGeometry>>>();
const supportedDefines = new Set(["USE_FOG", "USE_STATIC_LIGHTING_2X", "USE_DIFFUSE", "USE_UV", "USE_MAP_DIFFUSE", "USE_ACTOR_LIGHTS", "NUM_ACTOR_LIGHTS", "USE_MASKING", "USE_ALPHATEST", "NO_SHADOW_RECEIVE", "USE_EXTENDED_BONE_INFLUENCES", "USE_SPECULAR", "USE_ENVMAP", "ENVMAP_MODE_REFLECTION", "USE_ENVMAP_CAMERA", "USE_MAP_SPECULAR", "PAN", "ROTATE", "OSCILLATE", "ENVMAP", "ENVMAPWORLD", "USE_MAP_SPECULAR_TRANSFORM", "USE_SPECULAR_MASK", "USE_MAP_SPECULAR_MASK", "USE_OPACITY", "USE_MAP_OPACITY", "USE_SELF_ILLUMINATION", "USE_MODULATE_SPECULAR_2X"]);

type PawnMaterial_T = { color: Vector4, maps: Vector4, parameters: Vector4, operation: number, envMode: number, visible: boolean };

function getMaterial(mesh: LitSkinnedMesh): MeshStaticMaterial {
    return (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStaticMaterial;
}

function getTextures(material: MeshStaticMaterial): Texture[] {
    return ["shDiffuse", "shSpecular", "shSpecularMask", "shOpacity"].map(name => material.uniforms[name].value?.map?.texture || null);
}

function canBatch(material: MeshStaticMaterial): boolean {
    if (!material.isStaticMeshMaterial || material.transparent || !material.depthTest || !material.depthWrite || material.blending !== NormalBlending || material.isUpdatable || material.side === BackSide) return false;
    if (!("USE_MAP_DIFFUSE" in material.defines)) return false;
    if (Object.keys(material.defines).some(name => !supportedDefines.has(name))) return false;
    if ("USE_SPECULAR" in material.defines && !["ENVMAP", "ENVMAPWORLD"].includes(material.defines.USE_MAP_SPECULAR_TRANSFORM)) return false;
    const textures = getTextures(material);
    if (!textures[0] || "USE_SPECULAR" in material.defines && !textures[1]) return false;
    return true;
}

function getGeometry(meshes: LitSkinnedMesh[]): BufferGeometry {
    const key = meshes.map(mesh => mesh.geometry.uuid).join(":");
    let cache = cacheGeometry.get(meshes[0].geometry);
    let geometry = cache?.get(key)?.deref();

    if (geometry) return geometry;
    if (!cache) cacheGeometry.set(meshes[0].geometry, cache = new Map());

    const extended = meshes.some(mesh => mesh.geometry.hasAttribute("skinWeight2"));
    const parts = meshes.map((mesh, index) => {
        const part = new BufferGeometry(), source = mesh.geometry;
        const count = source.getAttribute("position").count;

        part.setIndex(source.index);
        for (const name of Object.keys(source.attributes)) part.setAttribute(name, source.getAttribute(name));
        part.setAttribute("pawnPart", new BufferAttribute(new Float32Array(count).fill(index), 1));
        if (extended && !part.hasAttribute("skinWeight2")) {
            part.setAttribute("skinIndex2", new BufferAttribute(new Uint16Array(count * 4), 4));
            part.setAttribute("skinWeight2", new BufferAttribute(new Float32Array(count * 4), 4));
        }
        return part;
    });

    geometry = mergeGeometries(parts);
    if (!geometry) throw new Error(`Pawn geometry could not be merged.`);
    cache.set(key, new WeakRef(geometry));
    return geometry;
}

export class PawnMesh extends LitSkinnedMesh {
    declare public readonly isPawnMesh: boolean;
    public readonly sources: LitSkinnedMesh[];
    protected readonly sourceLayers: number[];
    protected readonly skeletons: LocalSpaceSkeleton[];
    protected readonly textures: Texture[];
    protected readonly materials: MeshStaticMaterial[];

    public constructor(sources: LitSkinnedMesh[], textures: Texture[]) {
        const material = new MeshStaticMaterial();
        super(getGeometry(sources), material);

        (this as any).isPawnMesh = true;
        this.name = "PawnMesh";
        this.sources = sources;
        this.sourceLayers = sources.map(mesh => mesh.layers.mask);
        this.layers.mask = sources[0].layers.mask;
        this.skeletons = Array.from(new Set(sources.map(mesh => mesh.skeleton as LocalSpaceSkeleton)));
        this.skeleton = this.skeletons[0];
        this.textures = textures;
        this.materials = [];
        this.frustumCulled = false;
        this.boundingSphere = new Sphere();
        this.boundingSphere.makeEmpty();
        for (const source of sources) {
            source.updateMatrix();
            if (!source.geometry.boundingSphere) source.geometry.computeBoundingSphere();
            this.boundingSphere.union(source.geometry.boundingSphere.clone().applyMatrix4(source.matrix));
        }
        this.matrixAutoUpdate = false;
        this.scaledGlow = sources[0].scaledGlow;
        this.ambientGlow = sources[0].ambientGlow;
        this.isUnlit = sources[0].isUnlit;

        material.side = DoubleSide;
        material.setActorLit();
        if (this.geometry.hasAttribute("skinWeight2")) material.setExtendedBoneInfluences();
        Object.assign(material.defines, { USE_PAWN_MATERIALS: "", USE_UV: "", USE_ENVMAP: "", ENVMAP_MODE_REFLECTION: "", NUM_PAWN_PARTS: sources.length });
        Object.assign(material.uniforms, {
            pawnTextures: { value: textures },
            pawnBones: { value: this.skeletons.map(() => null) },
            pawnSkeletons: { value: sources.map(mesh => this.skeletons.indexOf(mesh.skeleton as LocalSpaceSkeleton)) },
            pawnBindMatrices: { value: sources.map(mesh => mesh.bindMatrix) },
            pawnBindInverses: { value: sources.map(mesh => mesh.bindMatrixInverse) },
            pawnWorldMatrices: { value: sources.map(mesh => mesh.matrixWorld) },
            pawnViewMatrices: { value: sources.map(mesh => mesh.modelViewMatrix) },
            pawnNormalMatrices: { value: sources.map(mesh => mesh.normalMatrix) },
            pawnMaterials: { value: sources.map(() => ({ color: new Vector4(), maps: new Vector4(), parameters: new Vector4(), operation: 0, envMode: 0, visible: true } as PawnMaterial_T)) }
        });

        material.vertexShader = material.vertexShader.replace("#include <skinning_pars_vertex>", `
            uniform sampler2D pawnBones[${this.skeletons.length}];
            uniform int pawnSkeletons[NUM_PAWN_PARTS];
            uniform mat4 pawnBindMatrices[NUM_PAWN_PARTS];
            uniform mat4 pawnBindInverses[NUM_PAWN_PARTS];
            mat4 bindMatrix;
            mat4 bindMatrixInverse;
            mat4 getBoneMatrix(float index) {
                int source = pawnSkeletons[int(pawnPart)];
                ${this.skeletons.map((_skeleton, i) => `if (source == ${i}) {
                    int size = textureSize(pawnBones[${i}], 0).x;
                    int j = int(index) * 4;
                    int x = j % size;
                    int y = j / size;
                    return mat4(texelFetch(pawnBones[${i}], ivec2(x, y), 0), texelFetch(pawnBones[${i}], ivec2(x + 1, y), 0), texelFetch(pawnBones[${i}], ivec2(x + 2, y), 0), texelFetch(pawnBones[${i}], ivec2(x + 3, y), 0));
                }`).join("\n")}
                return mat4(1.0);
            }
        `);
        material.fragmentShader = `
            uniform sampler2D pawnTextures[${textures.length}];
            vec4 samplePawnTexture(int index, vec2 uv) {
                ${textures.map((_texture, i) => `if (index == ${i}) return texture2D(pawnTextures[${i}], uv);`).join("\n")}
                return vec4(1.0);
            }
        ` + material.fragmentShader;

        this.setEnabled(true);
        this.updateMaterials();
    }

    public setEnabled(enabled: boolean): void {
        this.visible = enabled;
        for (let i = 0; i < this.sources.length; i++) this.sources[i].layers.mask = enabled ? 0 : this.sourceLayers[i];
    }

    public updateBatch(camera: THREE.Camera): void {
        const material = this.material as MeshStaticMaterial;

        if (LocalSpaceSkeleton.updateEnabled) {
            for (let i = 0; i < this.skeletons.length; i++) {
                const skeleton = this.skeletons[i];
                if (!skeleton.boneTexture) skeleton.computeBoneTexture();
                if (i > 0) skeleton.update();
                material.uniforms.pawnBones.value[i] = skeleton.boneTexture;
            }
            for (const source of this.sources) {
                source.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, source.matrixWorld);
                source.normalMatrix.getNormalMatrix(source.modelViewMatrix);
            }
        }
        this.updateMaterials();
    }

    protected updateMaterials(): void {
        const material = this.material as MeshStaticMaterial;

        for (let i = 0; i < this.sources.length; i++) {
            const source = this.sources[i], current = getMaterial(source);
            const target = material.uniforms.pawnMaterials.value[i] as PawnMaterial_T;
            const visible = source.visible && current.visible;

            if (target.visible !== visible) { target.visible = visible; material.uniformsNeedUpdate = true; }
            if (this.materials[i] === current) continue;

            const uniforms = current.uniforms, defines = current.defines;
            const color = uniforms.diffuse.value;
            target.color.set(color.r, color.g, color.b, uniforms.opacity.value);
            target.maps.fromArray(getTextures(current).map(texture => texture ? this.textures.indexOf(texture) : -1));
            target.parameters.set("USE_ALPHATEST" in defines ? uniforms.alphaTest.value : -1, "USE_MASKING" in defines ? 1 : 0, "USE_SPECULAR" in defines ? 1 : 0, current.side);
            target.operation = "USE_SELF_ILLUMINATION" in defines ? 2 : "USE_MODULATE_SPECULAR_2X" in defines ? 1 : 0;
            target.envMode = defines.USE_MAP_SPECULAR_TRANSFORM === "ENVMAPWORLD" ? 1 : 0;
            this.materials[i] = current;
            material.uniformsNeedUpdate = true;
        }
    }

    public raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void {
        for (const mesh of this.sources) if (mesh.visible) mesh.raycast(raycaster, intersects);
    }

    public release(): void {
        this.setEnabled(false);
        (this.material as MeshStaticMaterial).dispose();
        this.removeFromParent();
    }
}

export function createPawnMeshes(meshes: THREE.Mesh[], renderer: WebGLRenderer): PawnMesh[] {
    const groups: LitSkinnedMesh[][] = [], textures: Set<Texture>[] = [];
    const layouts: string[] = [];
    const maxParts = Math.min(16, Math.floor((renderer.capabilities.maxVertexUniforms - 96) / 19));

    for (const mesh of meshes as LitSkinnedMesh[]) {
        if (!mesh.isLitSkinnedMesh || !mesh.skeleton || Array.isArray(mesh.material) && mesh.material.length !== 1) continue;
        if (!mesh.geometry.index || Object.keys(mesh.geometry.morphAttributes).length > 0) continue;
        if (mesh.geometry.drawRange.start !== 0 || mesh.geometry.drawRange.count < mesh.geometry.index.count) continue;
        if (Array.isArray(mesh.material) && mesh.geometry.groups.length !== 1) continue;
        if (mesh.geometry.groups.some(group => group.start !== 0 || group.count !== mesh.geometry.index.count)) continue;
        const materials = [getMaterial(mesh), ...Object.values((mesh as any).skinMaterials || {}) as MeshStaticMaterial[]];
        if (!materials.every(canBatch)) continue;
        const maps = materials.flatMap(getTextures).filter(texture => texture);
        if (new Set(maps).size > renderer.capabilities.maxTextures) continue;
        const layout = Object.keys(mesh.geometry.attributes).filter(name => name !== "skinIndex2" && name !== "skinWeight2").sort().map(name => {
            const attribute = mesh.geometry.getAttribute(name);
            return `${name}:${attribute.itemSize}:${attribute.array.constructor.name}:${attribute.normalized}`;
        }).join(";");
        const groupIndex = groups.findIndex((group, i) => layouts[i] === layout && group.length < maxParts && group[0].layers.mask === mesh.layers.mask && group[0].scaledGlow === mesh.scaledGlow && group[0].ambientGlow === mesh.ambientGlow && group[0].isUnlit === mesh.isUnlit && new Set([...textures[i], ...maps]).size <= renderer.capabilities.maxTextures && new Set([...group.map(mesh => mesh.skeleton), mesh.skeleton]).size <= renderer.capabilities.maxVertexTextures);

        if (groupIndex < 0) { groups.push([mesh]); textures.push(new Set(maps)); layouts.push(layout); }
        else { groups[groupIndex].push(mesh); for (const texture of maps) textures[groupIndex].add(texture); }
    }

    return groups.flatMap((group, i) => group.length > 1 ? [new PawnMesh(group, Array.from(textures[i]))] : []);
}

export default PawnMesh;
