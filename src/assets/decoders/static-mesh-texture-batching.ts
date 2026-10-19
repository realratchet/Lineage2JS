import { BufferAttribute, CompressedArrayTexture, CompressedTexture, Material } from "three";
import { getCanonicalStaticMaterialKey } from "./material-decoder";
import { copyTextureFiltering, copyTextureLOD, getTextureLODBounds } from "./texture-decoder";

type TextureEntry_T = { index: number; material: Material; texture: CompressedTexture };

export function batchStaticMeshTextures(object: any, indices: ArrayLike<number>): void {
    const materials = object.material as Material[];
    if (!Array.isArray(materials) || !indices) return;

    const geometry = object.geometry, owners = new Int32Array(geometry.attributes.position.count), bad = new Set<number>();
    owners.fill(-1);
    for (const element of object.batchElements) for (const group of element.groups) {
        for (let i = group.start; i < group.start + group.count; i++) {
            const vertex = indices[i];
            if (owners[vertex] >= 0 && owners[vertex] !== group.materialIndex) {
                bad.add(owners[vertex]);
                bad.add(group.materialIndex);
            }
            owners[vertex] = group.materialIndex;
        }
    }
    const buckets = new Map<string, TextureEntry_T[]>();
    for (let i = 0; i < materials.length; i++) {
        const material = materials[i] as any, data = material.uniforms?.shDiffuse?.value, texture = data?.map?.texture as CompressedTexture;
        if (bad.has(i) || !material.isStaticMeshMaterial || material.transparent || material.isUpdatable || material.defines.USE_ACTOR_LIGHTS !== undefined || !texture?.isCompressedTexture || (texture as any).isCubeTexture || (texture as any).isUpdatable || (texture as any).isCompressedArrayTexture) continue;

        const compare = Object.create(material);
        compare.name = "";
        compare.uniforms = { ...material.uniforms, shDiffuse: { value: { ...data, map: { ...data.map, texture: null } } } };
        const key = getCanonicalStaticMaterialKey(compare) + material.vertexShader + material.fragmentShader + JSON.stringify([texture.image.width, texture.image.height, texture.format, texture.type, texture.mipmaps.length, texture.wrapS, texture.wrapT, texture.minFilter, texture.magFilter, texture.anisotropy, texture.colorSpace, texture.flipY, texture.premultiplyAlpha, getTextureLODBounds(texture)]);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push({ index: i, material, texture });
    }
    const remap = new Map<number, number>(), layers = new Map<number, number>(), target = materials.slice();
    for (const entries of buckets.values()) {
        for (let start = 0; start < entries.length; start += 256) {
            const group = entries.slice(start, start + 256);
            if (group.length < 2) continue;

            const textures = Array.from(new Set(group.map(entry => entry.texture))), first = textures[0];
            const mipmaps = first.mipmaps.map((mip, level) => {
                const data = new Uint8Array(mip.data.byteLength * textures.length);
                textures.forEach((texture, layer) => {
                    const source = texture.mipmaps[level];
                    if (source.width !== mip.width || source.height !== mip.height || source.data.byteLength !== mip.data.byteLength) throw new Error(`Texture '${texture.name}' has incompatible mip ${level}.`);

                    data.set(source.data, layer * mip.data.byteLength);
                });
                return { width: mip.width, height: mip.height, data };
            });
            const texture = new CompressedArrayTexture(mipmaps, first.image.width, first.image.height, textures.length, first.format, first.type);
            texture.wrapS = first.wrapS;
            texture.wrapT = first.wrapT;
            copyTextureFiltering(first, texture);
            copyTextureLOD(first, texture);
            texture.anisotropy = first.anisotropy;
            texture.colorSpace = first.colorSpace;
            texture.flipY = first.flipY;
            texture.premultiplyAlpha = first.premultiplyAlpha;
            texture.needsUpdate = true;
            const material = group[0].material.clone() as any;
            if (!material.vertexShader.includes("void main() {") || !material.fragmentShader.includes("texture2D(shDiffuse.map.texture, UV_DIFFUSE)")) throw new Error(`Material '${material.name}' has no diffuse array shader path.`);

            material.uniforms.batchDiffuse = { value: texture };
            material.vertexShader = `attribute float batchLayer; flat varying float vBatchLayer;\n${material.vertexShader.replace("void main() {", "void main() { vBatchLayer=batchLayer;")}`;
            material.fragmentShader = `uniform highp sampler2DArray batchDiffuse; flat varying float vBatchLayer;\n${material.fragmentShader.replace("texture2D(shDiffuse.map.texture, UV_DIFFUSE)", "texture(batchDiffuse, vec3(UV_DIFFUSE, vBatchLayer))")}`;
            for (const entry of group) {
                remap.set(entry.index, group[0].index);
                layers.set(entry.index, textures.indexOf(entry.texture));
                target[entry.index] = material;
            }
        }
    }
    if (!remap.size) return;

    const layerValues = new Float32Array(owners.length);
    for (const element of object.batchElements) for (const group of element.groups) {
        const layer = layers.get(group.materialIndex);
        if (layer === undefined) continue;

        for (let i = group.start; i < group.start + group.count; i++) layerValues[indices[i]] = layer;
    }
    object.material = target;
    geometry.setAttribute("batchLayer", new BufferAttribute(layerValues, 1));
    object.batchElements = object.batchElements.map((element: any) => ({ ...element, groups: element.groups.map((group: any) => ({ ...group, materialIndex: remap.get(group.materialIndex) ?? group.materialIndex })) }));
    for (const group of object.allGroups) group.materialIndex = remap.get(group.materialIndex) ?? group.materialIndex;
    for (const group of geometry.groups) group.materialIndex = remap.get(group.materialIndex) ?? group.materialIndex;
}
