import { BackSide, BufferAttribute, BufferGeometry, DataTexture, DoubleSide, FloatType, NormalBlending, Matrix4, Object3D, RGBAFormat, Sphere, Texture, WebGLRenderer } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils";
import LitSkinnedMesh from "./lit-skinned-mesh";
import LocalSpaceSkeleton from "./local-space-skeleton";
import MeshStaticMaterial from "../materials/mesh-static-material/mesh-static-material";

const BONE_ATLAS_WIDTH = 1024;
const cacheGeometry = new WeakMap<BufferGeometry, Map<string, WeakRef<BufferGeometry>>>();
const supportedDefines = new Set(["USE_FOG", "USE_STATIC_LIGHTING_2X", "USE_DIFFUSE", "USE_UV", "USE_MAP_DIFFUSE", "USE_ACTOR_LIGHTS", "NUM_ACTOR_LIGHTS", "USE_MASKING", "USE_ALPHATEST", "NO_SHADOW_RECEIVE", "USE_EXTENDED_BONE_INFLUENCES", "USE_SPECULAR", "USE_ENVMAP", "ENVMAP_MODE_REFLECTION", "USE_ENVMAP_CAMERA", "USE_MAP_SPECULAR", "PAN", "ROTATE", "OSCILLATE", "ENVMAP", "ENVMAPWORLD", "USE_MAP_SPECULAR_TRANSFORM", "USE_SPECULAR_MASK", "USE_MAP_SPECULAR_MASK", "USE_OPACITY", "USE_MAP_OPACITY", "USE_SELF_ILLUMINATION", "USE_MODULATE_SPECULAR_2X"]);

type PawnPart_T = { mesh: LitSkinnedMesh, materialIndex: number, start: number, count: number };

function getMaterial(mesh: LitSkinnedMesh, index: number = 0): MeshStaticMaterial {
    return (Array.isArray(mesh.material) ? mesh.material[index] : mesh.material) as MeshStaticMaterial;
}

function getTextures(material: MeshStaticMaterial): Texture[] {
    return ["shDiffuse", "shSpecular", "shSpecularMask", "shOpacity"].map(name => material.uniforms[name].value?.map?.texture || null);
}

function isVisibleUnder(object: Object3D, root: Object3D): boolean {
    for (let node = object; node && node !== root; node = node.parent) if (!node.visible) return false;
    return true;
}

function canBatch(material: MeshStaticMaterial): boolean {
    if (!material.isStaticMeshMaterial || material.transparent || material.shadowOpacity || !material.depthTest || !material.depthWrite || material.blending !== NormalBlending || material.isUpdatable || material.side === BackSide) return false;
    if (!("USE_MAP_DIFFUSE" in material.defines)) return false;
    if (Object.keys(material.defines).some(name => !supportedDefines.has(name))) return false;
    if ("USE_SPECULAR" in material.defines && !["ENVMAP", "ENVMAPWORLD"].includes(material.defines.USE_MAP_SPECULAR_TRANSFORM)) return false;
    const textures = getTextures(material);
    if (!textures[0] || "USE_SPECULAR" in material.defines && !textures[1]) return false;
    return true;
}

function getGeometry(sources: PawnPart_T[]): BufferGeometry {
    const meshes = sources.map(part => part.mesh);
    const key = sources.map(part => `${part.mesh.geometry.uuid}/${part.start}`).join(":");
    let cache = cacheGeometry.get(meshes[0].geometry);
    let geometry = cache?.get(key)?.deref();

    if (geometry) return geometry;
    if (!cache) cacheGeometry.set(meshes[0].geometry, cache = new Map());

    const extended = meshes.find(mesh => mesh.geometry.hasAttribute("skinWeight2"));
    const ArrayIndex2 = extended ? extended.geometry.getAttribute("skinIndex2").array.constructor as Uint8ArrayConstructor : null;
    const parts = meshes.map((mesh, index) => {
        const part = new BufferGeometry(), source = mesh.geometry;
        const count = source.getAttribute("position").count;

        if (sources[index].start === 0 && sources[index].count === source.index.count) part.setIndex(source.index);
        else part.setIndex(new BufferAttribute(source.index.array.slice(sources[index].start, sources[index].start + sources[index].count), 1)); // one material group, its vertices get their own pawnPart copy
        for (const name of Object.keys(source.attributes)) part.setAttribute(name, source.getAttribute(name));
        part.setAttribute("pawnPart", new BufferAttribute(new Float32Array(count).fill(index), 1));
        if (extended && !part.hasAttribute("skinWeight2")) {
            part.setAttribute("skinIndex2", new BufferAttribute(new ArrayIndex2(count * 4), 4));
            part.setAttribute("skinWeight2", new BufferAttribute(new Float32Array(count * 4), 4));
        }
        return part;
    });

    geometry = mergeGeometries(parts);
    if (!geometry) throw new Error(`Pawn geometry could not be merged.`);
    cache.set(key, new WeakRef(geometry));
    return geometry;
}

function packMatrices(matrices: Matrix4[]): Float32Array {
    const packed = new Float32Array(matrices.length * 16);

    for (let i = 0; i < matrices.length; i++) matrices[i].toArray(packed, i * 16);
    return packed;
}

function createBoneAtlas(skeletons: LocalSpaceSkeleton[]): DataTexture {
    const count = skeletons.reduce((total, skeleton) => total + skeleton.bones.length, 0);
    const data = new Float32Array(BONE_ATLAS_WIDTH * Math.ceil(count * 4 / BONE_ATLAS_WIDTH) * 4);
    let offset = 0;

    for (const skeleton of skeletons) {
        if (skeleton.isAtlasPacked) throw new Error(`Skeleton of '${skeleton.mesh?.name}' is already packed into another pawn bone atlas.`);

        const length = skeleton.bones.length * 16, matrices = data.subarray(offset, offset + length);

        matrices.set(skeleton.boneMatrices.subarray(0, length));
        skeleton.boneMatrices = matrices;
        if (skeleton.boneTexture) skeleton.boneTexture.dispose();
        skeleton.boneTexture = new DataTexture(matrices, skeleton.bones.length * 4, 1, RGBAFormat, FloatType); // unbatched parts and shadow casters still sample their own slice
        skeleton.boneTexture.needsUpdate = true;
        skeleton.isAtlasPacked = true;
        offset += length;
    }

    const atlas = new DataTexture(data, BONE_ATLAS_WIDTH, data.length / 4 / BONE_ATLAS_WIDTH, RGBAFormat, FloatType);

    atlas.needsUpdate = true;
    return atlas;
}

export class PawnMesh extends LitSkinnedMesh {
    declare public readonly isPawnMesh: boolean;
    public readonly sources: LitSkinnedMesh[];
    protected readonly materialIndices: number[];
    protected readonly sourceLayers: number[];
    protected readonly skeletons: LocalSpaceSkeleton[];
    protected readonly boneAtlas: DataTexture;
    protected readonly textures: Texture[];
    protected readonly materials: MeshStaticMaterial[];

    public constructor(parts: PawnPart_T[], textures: Texture[]) {
        const material = new MeshStaticMaterial();
        const sources = parts.map(part => part.mesh);
        super(getGeometry(parts), material);

        (this as any).isPawnMesh = true;
        this.name = "PawnMesh";
        this.sources = sources;
        this.materialIndices = parts.map(part => part.materialIndex);
        this.sourceLayers = sources.map(mesh => mesh.layers.mask);
        this.layers.mask = sources[0].layers.mask;
        this.skeletons = Array.from(new Set(sources.map(mesh => mesh.skeleton as LocalSpaceSkeleton)));
        this.skeleton = this.skeletons[0];
        this.boneAtlas = createBoneAtlas(this.skeletons);
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
            pawnBones: { value: this.boneAtlas },
            pawnBoneOffsets: { value: Int32Array.from(sources, mesh => this.skeletons.slice(0, this.skeletons.indexOf(mesh.skeleton as LocalSpaceSkeleton)).reduce((total, skeleton) => total + skeleton.bones.length, 0)) },
            pawnBindMatrices: { value: packMatrices(sources.map(mesh => mesh.bindMatrix)) },
            pawnBindInverses: { value: packMatrices(sources.map(mesh => mesh.bindMatrixInverse)) },
            pawnWorldMatrices: { value: sources.map(mesh => mesh.matrixWorld) },
            pawnViewMatrices: { value: sources.map(mesh => mesh.modelViewMatrix) },
            pawnNormalMatrices: { value: sources.map(mesh => mesh.normalMatrix) },
            pawnSilhouette: { value: false },
            pawnMaterialData: { value: new Float32Array(sources.length * 16).map((_value, i) => i % 16 === 14 ? 1 : 0) } // per part: color, maps, parameters, (operation, envMode, visible)
        });

        material.vertexShader = material.vertexShader.replace("#include <skinning_pars_vertex>", `
            uniform highp sampler2D pawnBones;
            uniform int pawnBoneOffsets[NUM_PAWN_PARTS];
            uniform mat4 pawnBindMatrices[NUM_PAWN_PARTS];
            uniform mat4 pawnBindInverses[NUM_PAWN_PARTS];
            mat4 bindMatrix;
            mat4 bindMatrixInverse;
            mat4 getBoneMatrix(float index) {
                int size = textureSize(pawnBones, 0).x;
                int j = (pawnBoneOffsets[int(pawnPart)] + int(index)) * 4;
                int x = j % size;
                int y = j / size;
                return mat4(texelFetch(pawnBones, ivec2(x, y), 0), texelFetch(pawnBones, ivec2(x + 1, y), 0), texelFetch(pawnBones, ivec2(x + 2, y), 0), texelFetch(pawnBones, ivec2(x + 3, y), 0));
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

    public setSilhouette(enabled: boolean): void { (this.material as MeshStaticMaterial).uniforms.pawnSilhouette.value = enabled; }

    public updateBatch(camera: THREE.Camera): void {
        if (LocalSpaceSkeleton.updateEnabled) {
            for (let i = 1; i < this.skeletons.length; i++) this.skeletons[i].update();
            this.boneAtlas.needsUpdate = true;
            for (let i = 0; i < this.sources.length; i++) {
                const source = this.sources[i], previous = i > 0 ? this.sources[i - 1] : null;

                if (previous && source.matrixWorld.equals(previous.matrixWorld)) { // most parts share the pawn's placement
                    source.modelViewMatrix.copy(previous.modelViewMatrix);
                    source.normalMatrix.copy(previous.normalMatrix);
                    continue;
                }

                source.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, source.matrixWorld);
                source.normalMatrix.getNormalMatrix(source.modelViewMatrix);
            }
        }
        this.updateMaterials();
    }

    protected updateMaterials(): void {
        const material = this.material as MeshStaticMaterial;

        for (let i = 0; i < this.sources.length; i++) {
            const source = this.sources[i], current = getMaterial(source, this.materialIndices[i]);
            const data = material.uniforms.pawnMaterialData.value as Float32Array, offset = i * 16;
            const visible = isVisibleUnder(source, this.parent) && current.visible ? 1 : 0;

            if (data[offset + 14] !== visible) { data[offset + 14] = visible; material.uniformsNeedUpdate = true; }
            if (this.materials[i] === current) continue;

            const uniforms = current.uniforms, defines = current.defines;
            const color = uniforms.diffuse.value;
            data.set([color.r, color.g, color.b, uniforms.opacity.value], offset);
            data.set(getTextures(current).map(texture => texture ? this.textures.indexOf(texture) : -1), offset + 4);
            data.set(["USE_ALPHATEST" in defines ? uniforms.alphaTest.value : -1, "USE_MASKING" in defines ? 1 : 0, "USE_SPECULAR" in defines ? 1 : 0, current.side], offset + 8);
            data[offset + 12] = "USE_SELF_ILLUMINATION" in defines ? 2 : "USE_MODULATE_SPECULAR_2X" in defines ? 1 : 0;
            data[offset + 13] = defines.USE_MAP_SPECULAR_TRANSFORM === "ENVMAPWORLD" ? 1 : 0;
            this.materials[i] = current;
            material.uniformsNeedUpdate = true;
        }
    }

    public raycast(raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void {
        for (let i = 0; i < this.sources.length; i++)
            if (this.sources[i].visible && this.sources[i] !== this.sources[i - 1]) this.sources[i].raycast(raycaster, intersects);
    }

    public release(): void {
        this.setEnabled(false);
        for (const skeleton of this.skeletons) skeleton.isAtlasPacked = false;
        this.boneAtlas.dispose();
        (this.material as MeshStaticMaterial).dispose();
        this.removeFromParent();
    }
}

export function createPawnMeshes(meshes: THREE.Mesh[], renderer: WebGLRenderer): PawnMesh[] {
    const groups: PawnPart_T[][] = [], textures: Set<Texture>[] = [];
    const layouts: string[] = [];
    const maxParts = Math.min(16, Math.floor((renderer.capabilities.maxVertexUniforms - 96) / 19));

    for (const mesh of meshes as LitSkinnedMesh[]) {
        if (!mesh.isLitSkinnedMesh || !mesh.skeleton) continue;
        if (!mesh.geometry.index || Object.keys(mesh.geometry.morphAttributes).length > 0) continue;
        if (mesh.geometry.drawRange.start !== 0 || mesh.geometry.drawRange.count < mesh.geometry.index.count) continue;
        if (!Array.isArray(mesh.material) && mesh.geometry.groups.some(group => group.start !== 0 || group.count !== mesh.geometry.index.count)) continue;
        if (Array.isArray(mesh.material) && (mesh.geometry.groups.length === 0 || mesh.geometry.groups.some(group => !(mesh.material as any[])[group.materialIndex]))) continue;
        const indexCount = mesh.geometry.index.count;
        const parts: PawnPart_T[] = Array.isArray(mesh.material)
            ? mesh.geometry.groups.map(group => ({ mesh, materialIndex: group.materialIndex, start: group.start, count: Math.min(group.count, indexCount - group.start) }))
            : [{ mesh, materialIndex: 0, start: 0, count: indexCount }];
        const materials = [...parts.map(part => getMaterial(mesh, part.materialIndex)), ...Object.values((mesh as any).skinMaterials || {}) as MeshStaticMaterial[]];
        if (!materials.every(canBatch)) continue;
        const maps = materials.flatMap(getTextures).filter(texture => texture);
        if (new Set(maps).size > renderer.capabilities.maxTextures) continue;
        const layout = Object.keys(mesh.geometry.attributes).filter(name => name !== "skinIndex2" && name !== "skinWeight2").sort().map(name => {
            const attribute = mesh.geometry.getAttribute(name);
            return `${name}:${attribute.itemSize}:${attribute.array.constructor.name}:${attribute.normalized}`;
        }).join(";");
        if (parts.length > maxParts) continue;
        const owner = groups.findIndex(group => group.some(part => part.mesh.skeleton === mesh.skeleton));
        const groupIndex = groups.findIndex((group, i) => (owner < 0 || i === owner) && layouts[i] === layout && group.length + parts.length <= maxParts && group[0].mesh.layers.mask === mesh.layers.mask && group[0].mesh.scaledGlow === mesh.scaledGlow && group[0].mesh.ambientGlow === mesh.ambientGlow && group[0].mesh.isUnlit === mesh.isUnlit && new Set([...textures[i], ...maps]).size <= renderer.capabilities.maxTextures && new Set([...group.map(part => part.mesh.skeleton), mesh.skeleton]).size <= renderer.capabilities.maxVertexTextures);

        if (owner >= 0 && groupIndex < 0) continue; // a skeleton packs into one bone atlas only
        if (groupIndex < 0) { groups.push(parts); textures.push(new Set(maps)); layouts.push(layout); }
        else { groups[groupIndex].push(...parts); for (const texture of maps) textures[groupIndex].add(texture); }
    }

    return groups.flatMap((group, i) => group.length > 1 ? [new PawnMesh(group, Array.from(textures[i]))] : []);
}

export default PawnMesh;
