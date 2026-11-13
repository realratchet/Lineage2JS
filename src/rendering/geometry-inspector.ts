import { AdditiveBlending, BackSide, BufferGeometry, CustomBlending, DoubleSide, DstAlphaFactor, DstColorFactor, Float32BufferAttribute, FloatType, FrontSide, Matrix4, Mesh, MeshBasicMaterial, MultiplyBlending, NoBlending, NormalBlending, OneFactor, OneMinusDstAlphaFactor, OneMinusDstColorFactor, OneMinusSrcAlphaFactor, OneMinusSrcColorFactor, OrthographicCamera, PlaneGeometry, Ray, Raycaster, RedFormat, RepeatWrapping, RGBAFormat, RGBA_S3TC_DXT1_Format, RGBA_S3TC_DXT3_Format, RGBA_S3TC_DXT5_Format, RGB_S3TC_DXT1_Format, RGFormat, ShaderMaterial, Sphere, SrcAlphaFactor, SrcColorFactor, SubtractiveBlending, Uint32BufferAttribute, Vector2, Vector3, WebGLRenderTarget, ZeroFactor } from "three";
import { getLocalUniforms } from "../materials/global-uniforms";
import type RenderManager from "./render-manager";
import type { SectorObject } from "../objects/zone-object";
import type CollidingMesh from "../objects/colliding-mesh";
import type Terrain from "../objects/terrain";
import type TerrainDecoration from "../objects/terrain-decoration";
import type LitSkinnedMesh from "../objects/lit-skinned-mesh";
import type PawnMesh from "../objects/pawn-mesh";
import type BaseActor from "../base-actor";
import type PawnRenderableComponent from "./components/pawn-renderable-component";
import type { DecodeLibrary } from "@l2js/engine";
import type { BatchElementGroup_T, IStaticMeshActorDecodeInfo, StaticMeshBatchManifest_T } from "@l2js/engine/contracts/mesh";

type MaterialSlot_T = { uuid: string, modifiers: string[] };
type InspectMap_T = { slot: string, name: string, texture: THREE.Texture, layer: number };
type HighlightGroup_T = { start: number, count: number, materialIndex: number };
type InspectMaterial_T = { title: string, isHit: boolean, graph: string[], lines: string[], uniforms: string[], maps: InspectMap_T[], groups: HighlightGroup_T[] };
type InspectHighlight_T = { object: THREE.Object3D, position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, index: THREE.BufferAttribute, groups: HighlightGroup_T[], local: Matrix4, skin?: LitSkinnedMesh, batch?: { start: number, count: number }[] };
type InspectPart_T = { title: string, isHit: boolean, lines: string[], materials: InspectMaterial_T[], groups: HighlightGroup_T[] };
type InspectSelection_T = { title: string, lines: string[], materials: InspectMaterial_T[], highlights: InspectHighlight_T[], parts?: InspectPart_T[] };
type InspectPanel_T = { root: HTMLElement, title: HTMLElement, body: HTMLElement, button: HTMLButtonElement, groups: HighlightGroup_T[] };
type SkinnedTarget_T = { pawn: BaseActor, mesh: LitSkinnedMesh };
type PawnHit_T = SkinnedTarget_T & { distance: number, materialIndex: number, point: Vector3 };
type Attachment_T = { object: THREE.Object3D, bone: THREE.Bone };

const PREVIEW_SIZE = 384;
const PREVIEW_VERTEX = "varying vec2 texCoord; void main() { texCoord = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
const BLENDING_NAMES = new Map<number, string>([[NoBlending, "none"], [NormalBlending, "normal"], [AdditiveBlending, "additive"], [SubtractiveBlending, "subtractive"], [MultiplyBlending, "multiply"]]);
const BLEND_FACTOR_NAMES = new Map<number, string>([[ZeroFactor, "zero"], [OneFactor, "one"], [SrcColorFactor, "srcColor"], [OneMinusSrcColorFactor, "invSrcColor"], [SrcAlphaFactor, "srcAlpha"], [OneMinusSrcAlphaFactor, "invSrcAlpha"], [DstAlphaFactor, "dstAlpha"], [OneMinusDstAlphaFactor, "invDstAlpha"], [DstColorFactor, "dstColor"], [OneMinusDstColorFactor, "invDstColor"]]);
const SIDE_NAMES = new Map<number, string>([[FrontSide, "front"], [BackSide, "back"], [DoubleSide, "double"]]);
const FORMAT_NAMES = new Map<number, string>([[RGB_S3TC_DXT1_Format, "DXT1"], [RGBA_S3TC_DXT1_Format, "DXT1"], [RGBA_S3TC_DXT3_Format, "DXT3"], [RGBA_S3TC_DXT5_Format, "DXT5"], [RGBAFormat, "RGBA"], [RGFormat, "RG"], [RedFormat, "R"]]);
const ALPHA_FORMATS = new Set<number>([RGBA_S3TC_DXT1_Format, RGBA_S3TC_DXT3_Format, RGBA_S3TC_DXT5_Format, RGBAFormat]);
const MAP_SLOT_NAMES: Record<string, string> = { shDiffuseMap: "Diffuse", shDiffuseCube: "Diffuse", batchDiffuse: "Diffuse", shOpacityMap: "Opacity", shSpecularMap: "Specular", shSpecularCube: "Specular", shSpecularMaskMap: "Specular mask", shDetailMap: "Detail", shMaterial2Map: "Material 2", shMaterial2Cube: "Material 2", lightMap: "Lightmap", uvsMap: "Layer UVs" };

const tmpScreenPosition = new Vector2();
const tmpDirection = new Vector3();
const tmpMatrix = new Matrix4();
const tmpInstanceMatrix = new Matrix4();
const tmpBoneMatrix = new Matrix4();
const tmpRay = new Ray();
const tmpSphere = new Sphere();
const tmpVertex = new Vector3();
const tmpBoneVertex = new Vector3();
const tmpSkinned = new Vector3();
const tmpVertexA = new Vector3();
const tmpVertexB = new Vector3();
const tmpVertexC = new Vector3();
const tmpPoint = new Vector3();
const arrIntersections: THREE.Intersection[] = [];
const arrMeshes: THREE.Object3D[] = [];
const arrSkinned: SkinnedTarget_T[] = [];
const cacheBatched = new Set<THREE.Object3D>();
const cacheSides = new Map<THREE.Material, THREE.Side>();

function row(label: string, value: string | number | boolean): string { return `${`${label}:`.padEnd(15)} ${value}`; }

function formatNumber(value: number): string { return typeof value !== "number" || Number.isInteger(value) ? String(value) : value.toFixed(Math.abs(value) < 100 ? 3 : 1); }

function formatVector(values: ArrayLike<number>): string { return Array.from(values, value => formatNumber(value)).join(", "); }

function findAncestor(object: THREE.Object3D, flag: string): any {
    for (let node = object; node; node = node.parent)
        if ((node as any)[flag]) return node;

    return null;
}

function isVisible(object: THREE.Object3D): boolean {
    for (let node = object; node; node = node.parent)
        if (!node.visible) return false;

    return true;
}

function getTextureImage(texture: any): { width: number, height: number, depth?: number } {
    const image = texture.isCubeTexture ? texture.image[0] : texture.image;

    return image.isTexture ? image.image : image;
}

function describeTexture(texture: any): string {
    const image = getTextureImage(texture), mipmaps = texture.isCubeTexture && texture.image[0].mipmaps || texture.mipmaps;

    return `${image.width}x${image.height}${texture.isCompressedArrayTexture ? `x${image.depth}` : ""} ${FORMAT_NAMES.get(texture.format) || `format ${texture.format}`}${texture.type === FloatType ? " float" : ""}, ${mipmaps.length || 1} mips, ${texture.wrapS === RepeatWrapping ? "wrap" : "clamp"}/${texture.wrapT === RepeatWrapping ? "wrap" : "clamp"}`;
}

function getMapSlotName(name: string): string {
    const layer = /^layer(\d+)(Alpha)?Map$/.exec(name);

    if (layer) return `Layer ${layer[1]}${layer[2] ? " mask" : ""}`;

    return MAP_SLOT_NAMES[name] || name;
}

function getMaterialSlots(library: DecodeLibrary, uuid: string, modifiers: string[] = []): MaterialSlot_T[] {
    const info = library.materials[uuid] as any;

    if (info && info.materialType === "group") return info.materials.flatMap((uuid: string) => getMaterialSlots(library, uuid, modifiers));
    if (info && info.materialType === "instance") return getMaterialSlots(library, info.baseMaterial, [...modifiers, ...info.modifiers]);

    return [{ uuid, modifiers }];
}

function getDiffuseTextureName(library: DecodeLibrary, uuid: string): string {
    const info = library.materials[uuid] as any;

    if (!info) return null;

    switch (info.materialType) {
        case "texture":
        case "cubemap":
        case "sprite": return info.name;
        case "shader": return getDiffuseTextureName(library, info.diffuse);
        case "combiner": return getDiffuseTextureName(library, info.material1);
        case "instance": return getDiffuseTextureName(library, info.baseMaterial);
        case "lightmapped": return getDiffuseTextureName(library, info.material);
        case "modifier": return getDiffuseTextureName(library, info.material || info.map || info.transform?.map);
        default: return null;
    }
}

function describeModifiers(library: DecodeLibrary, modifiers: string[], indent: string, lines: string[]): void {
    for (const uuid of modifiers) {
        const modifier = library.materialModifiers[uuid] as any;

        lines.push(`${indent}${modifier.type} ${modifier.mode}: color ${formatVector(modifier.color || [1, 1, 1])}, brightness ${formatNumber(modifier.brightness)}${modifier.direction ? `, direction ${formatVector(modifier.direction)}` : ""}`);
    }
}

function describeModifierInfo(library: DecodeLibrary, info: any, prefix: string, depth: number, lines: string[]): void {
    switch (info.modifierType) {
        case "fadeColor":
            lines.push(`${prefix}FadeColor ${info.fadeColors.fadeType}: ${formatVector(info.fadeColors.color1)} / ${formatVector(info.fadeColors.color2)}, period ${formatNumber(info.fadeColors.period)}, phase ${formatNumber(info.fadeColors.phase)}`);
            break;
        case "panTexture":
            lines.push(`${prefix}TexPanner rate ${formatVector(info.transform.rate)}`);
            describeMaterialInfo(library, info.transform.map, "material", depth + 1, lines);
            break;
        case "rotateTexture":
            lines.push(`${prefix}TexRotator ${info.transform.type}: rotation ${formatVector(info.transform.rotation)}, offset ${formatNumber(info.transform.offsetU)}, ${formatNumber(info.transform.offsetV)}`);
            describeMaterialInfo(library, info.transform.map, "material", depth + 1, lines);
            break;
        case "oscillateTexture":
            lines.push(`${prefix}TexOscillator U ${info.transform.typeU} rate ${formatNumber(info.transform.rateU)} amplitude ${formatNumber(info.transform.amplitudeU)}, V ${info.transform.typeV} rate ${formatNumber(info.transform.rateV)} amplitude ${formatNumber(info.transform.amplitudeV)}`);
            describeMaterialInfo(library, info.transform.map, "material", depth + 1, lines);
            break;
        case "envMapTexture":
            lines.push(`${prefix}TexEnvMap ${info.envMapType}`);
            describeMaterialInfo(library, info.map, "material", depth + 1, lines);
            break;
        case "colorModifier":
            lines.push(`${prefix}ColorModifier ${formatVector(info.modifierColor)}${info.doubleSide ? ", two-sided" : ""}${info.alphaBlend ? ", alpha blend" : ""}`);
            describeMaterialInfo(library, info.material, "material", depth + 1, lines);
            break;
        case "finalBlend":
            lines.push(`${prefix}FinalBlend ${info.blendingMode}${info.alphaTest ? `, alpha ref ${formatNumber(info.alphaRef)}` : ""}${info.doubleSide ? ", two-sided" : ""}${info.depthWrite ? "" : ", no zwrite"}${info.depthTest ? "" : ", no ztest"}`);
            describeMaterialInfo(library, info.material, "material", depth + 1, lines);
            break;
        case "texCoordSource":
            lines.push(`${prefix}TexCoordSource uv ${info.uvIndex}`);
            describeMaterialInfo(library, info.material, "material", depth + 1, lines);
            break;
        default: throw new Error(`Unknown material modifier '${info.modifierType}'.`);
    }
}

function describeMaterialInfo(library: DecodeLibrary, uuid: string, label: string, depth: number, lines: string[]): void {
    if (!uuid) return;

    const info = library.materials[uuid] as any, indent = "  ".repeat(depth), prefix = `${indent}${label ? `${label}: ` : ""}`;

    if (!info) throw new Error(`Material '${uuid}' not found.`);

    const name = info.name && info.name !== uuid ? ` ${info.name}` : "";

    switch (info.materialType) {
        case "texture":
            lines.push(`${prefix}Texture${name} (${info.textureType} ${info.width}x${info.height}${info.isMasked ? ", masked" : ""}${info.isAlphaTexture ? ", alpha" : ""}${info.twoSided ? ", two-sided" : ""})`);
            describeMaterialInfo(library, info.detail, `detail x${formatNumber(info.detailScale)}`, depth + 1, lines);
            break;
        case "shader":
            lines.push(`${prefix}Shader${name} (${info.blendingMode}${info.transparent ? ", transparent" : ""}${info.alphaTest ? `, alpha ref ${formatNumber(info.alphaTest)}` : ""}${info.doubleSide ? ", two-sided" : ""}${info.visible ? "" : ", invisible"}${info.modulateStaticLighting2X ? ", lighting 2x" : ""}${info.modulateSpecular2X ? ", specular 2x" : ""})`);
            describeMaterialInfo(library, info.diffuse, "diffuse", depth + 1, lines);
            describeMaterialInfo(library, info.opacity, "opacity", depth + 1, lines);
            describeMaterialInfo(library, info.specular, "specular", depth + 1, lines);
            describeMaterialInfo(library, info.specularMask, "specularMask", depth + 1, lines);
            describeMaterialInfo(library, info.selfIllumination, "selfIllumination", depth + 1, lines);
            describeMaterialInfo(library, info.selfIlluminationMask, "selfIlluminationMask", depth + 1, lines);
            describeMaterialInfo(library, info.detail, `detail x${formatNumber(info.detailScale)}`, depth + 1, lines);
            break;
        case "modifier": describeModifierInfo(library, info, prefix, depth, lines); break;
        case "combiner":
            lines.push(`${prefix}Combiner mode ${info.combineMode}${info.invertMask ? ", inverted mask" : ""}${info.maskIsVertexColor ? ", vertex colour mask" : ""}${info.alphaFrom1 ? ", alpha from 1" : ""}${info.alphaFrom2 ? ", alpha from 2" : ""}`);
            describeMaterialInfo(library, info.material1, "material1", depth + 1, lines);
            describeMaterialInfo(library, info.material2, "material2", depth + 1, lines);
            describeMaterialInfo(library, info.mask, "mask", depth + 1, lines);
            break;
        case "lightmapped":
            lines.push(`${prefix}Lightmapped (${info.lightmaps.length} lightmaps)`);
            describeMaterialInfo(library, info.material, "material", depth + 1, lines);
            break;
        case "instance":
            lines.push(`${prefix}Instance`);
            describeModifiers(library, info.modifiers, `${indent}  `, lines);
            describeMaterialInfo(library, info.baseMaterial, "material", depth + 1, lines);
            break;
        case "group":
            lines.push(`${prefix}Group`);
            info.materials.forEach((uuid: string, index: number) => describeMaterialInfo(library, uuid, String(index), depth + 1, lines));
            break;
        case "cubemap":
            lines.push(`${prefix}Cubemap${name}`);
            info.faces.forEach((uuid: string, index: number) => describeMaterialInfo(library, uuid, `face ${index}`, depth + 1, lines));
            break;
        case "sprite": lines.push(`${prefix}Sprite${name} (${info.sprites.length} frames, ${formatNumber(info.framerate)} ms)`); break;
        case "solid": lines.push(`${prefix}Solid #${info.solidColor.toString(16).padStart(6, "0")}`); break;
        case "terrainSegment": describeMaterialInfo(library, info.terrainMaterial, label, depth, lines); break;
        case "terrain":
            lines.push(`${prefix}Terrain (${info.layers.length} layers)`);
            info.layers.forEach((layer: { map: string, alphaMap: string }, index: number) => {
                describeMaterialInfo(library, layer.map, `layer ${index}`, depth + 1, lines);
                describeMaterialInfo(library, layer.alphaMap, `layer ${index} mask`, depth + 1, lines);
            });
            break;
        case "particle":
            lines.push(`${prefix}Particle ${info.blendingMode}, opacity ${formatNumber(info.opacity)}`);
            describeMaterialInfo(library, info.material, "material", depth + 1, lines);
            break;
        case "empty": lines.push(`${prefix}Empty`); break;
        default: throw new Error(`Unknown material type '${info.materialType}'.`);
    }
}

function describeUniform(name: string, value: any, lines: string[], isNested: boolean): void {
    if (typeof value === "number") lines.push(row(name, formatNumber(value)));
    else if (typeof value === "boolean") lines.push(row(name, value));
    else if (!value || value.isTexture) return;
    else if (value.isColor || value.isVector2 || value.isVector3 || value.isVector4) lines.push(row(name, formatVector(value.toArray())));
    else if (!isNested && value.constructor === Object)
        for (const key of Object.keys(value)) describeUniform(`${name}.${key}`, value[key], lines, true);
}

function getMaterialName(library: DecodeLibrary, material: THREE.Material, slot: MaterialSlot_T): string {
    const info = slot && library.materials[slot.uuid];

    if (info && info.name && info.name !== slot.uuid) return info.name;

    return slot && (Object.keys(library.scriptMaterials).find(path => library.scriptMaterials[path] === slot.uuid) || getDiffuseTextureName(library, slot.uuid)) || material.name || "unnamed";
}

function describeMaterial(library: DecodeLibrary, material: any, slot: MaterialSlot_T, title: string, isHit: boolean, groups: HighlightGroup_T[], layer: number = 0): InspectMaterial_T {
    const graph: string[] = [], lines: string[] = [], uniforms: string[] = [], maps: InspectMap_T[] = [], flags: string[] = [];

    if (slot && library.materials[slot.uuid]) {
        describeModifiers(library, slot.modifiers, "", graph);
        describeMaterialInfo(library, slot.uuid, "", 0, graph);
    }

    if (material.requiresSorting) flags.push("sorted");
    if (material.isUpdatable) flags.push("animated");
    if (material.vertexColors) flags.push("vertex colours");
    if (material.arrLightmaps && material.arrLightmaps.length) flags.push(`${material.arrLightmaps.length} lightmaps`);

    lines.push(row("Type", material.isStaticMeshMaterial ? "MeshStaticMaterial" : material.isTerrainMaterial ? "MeshTerrainMaterial" : material.type));
    lines.push(row("Blending", material.blending === CustomBlending ? `${BLEND_FACTOR_NAMES.get(material.blendSrc)} / ${BLEND_FACTOR_NAMES.get(material.blendDst)}` : BLENDING_NAMES.get(material.blending)));
    lines.push(row("Transparent", material.transparent));
    lines.push(row("Side", SIDE_NAMES.get(material.side)));
    lines.push(row("Depth", `${material.depthTest ? "test" : "no test"}, ${material.depthWrite ? "write" : "no write"}`));
    if (material.uniforms && material.uniforms.alphaTest && material.defines.USE_ALPHATEST !== undefined) lines.push(row("Alpha test", formatNumber(material.uniforms.alphaTest.value)));
    if (flags.length) lines.push(row("Flags", flags.join(", ")));

    if (material.uniforms) {
        const local = getLocalUniforms(material.uniforms);

        for (const name of Object.keys(local)) {
            const value = local[name].value;

            if (!value || !value.isTexture) describeUniform(name, value, uniforms, false);
            else if (name === "batchDiffuse") maps.push({ slot: getMapSlotName(name), name: `${slot && getDiffuseTextureName(library, slot.uuid) || "batch"} (layer ${layer})`, texture: value, layer });
            else if (name !== "shDiffuseMap" || !local.batchDiffuse) maps.push({ slot: getMapSlotName(name), name: value.name, texture: value, layer: 0 });
        }

        uniforms.push(row("Defines", Object.keys(material.defines).map(key => material.defines[key] === "" ? key : `${key}=${material.defines[key]}`).join(" ")));
    } else if (material.map) maps.push({ slot: "Map", name: material.map.name, texture: material.map, layer: 0 });

    return { title, isHit, graph, lines, uniforms, maps, groups };
}

function describeActor(actor: IStaticMeshActorDecodeInfo, lines: string[]): void {
    const info = actor as any, flags: string[] = [], collision = Object.keys(info.collision || {}).filter(key => info.collision[key] === true);

    if (actor.isSunAffected ?? true) flags.push("sun affected");
    if (actor.isSpecialLit) flags.push("special lit");
    if (info.isRangeIgnored) flags.push("range ignored");
    if (actor.dontBatch) flags.push("unbatchable");
    if (actor.mover) flags.push("mover");
    if (actor.rotating) flags.push("rotating");
    if (actor.swaying) flags.push("swaying");
    if (actor.agit) flags.push("agit");

    lines.push(row("Actor", actor.name), row("Mesh", actor.instance.mesh.name));
    lines.push(row("Position", formatVector(info.position || [0, 0, 0])), row("Scale", formatVector(info.scale || [1, 1, 1])));
    if (actor.bounds && actor.bounds.isValid) lines.push(row("Bounds min", formatVector(actor.bounds.min)), row("Bounds max", formatVector(actor.bounds.max)));
    if (actor.ambient) lines.push(row("Ambient", `${formatVector(actor.ambient.vector)}, glow ${formatNumber(actor.ambient.glow)}${actor.ambient.isUnlit ? ", unlit" : ""}${actor.ambient.hardwareLighting ? ", hardware lit" : ""}`));
    lines.push(row("Scaled glow", formatNumber(actor.scaledGlow)));
    lines.push(row("Lights", actor.instance.lights ? `${actor.instance.lights.scene.length} scene, ${actor.instance.lights.environment.length} environment` : "none"));
    if (flags.length) lines.push(row("Flags", flags.join(", ")));
    if (collision.length) lines.push(row("Collision", collision.join(", ")));
}

function findElementGroup(indices: ArrayLike<number>, groups: BatchElementGroup_T[], face: THREE.Face): number {
    if (indices) for (let i = 0; i < groups.length; i++) {
        const group = groups[i];

        if (group.materialIndex !== face.materialIndex) continue;

        for (let offset = group.start, end = group.start + group.count; offset < end; offset += 3)
            if (indices[offset] === face.a && indices[offset + 1] === face.b && indices[offset + 2] === face.c) return i;
    }

    return groups.findIndex(group => group.materialIndex === face.materialIndex);
}

function getMeshHighlight(mesh: THREE.Mesh, local: Matrix4 = new Matrix4()): InspectHighlight_T {
    const geometry = mesh.geometry, count = geometry.index ? geometry.index.count : geometry.getAttribute("position").count;
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];

    return { object: mesh, position: geometry.getAttribute("position"), index: geometry.index, groups: groups.map(group => ({ start: group.start, count: Math.min(group.count, count - group.start), materialIndex: group.materialIndex })), local };
}

function countTriangles(highlight: InspectHighlight_T): number { return highlight.groups.reduce((total, group) => total + group.count, 0) / 3; }

function findMaterialSlot(library: DecodeLibrary, material: THREE.Material): MaterialSlot_T {
    if (!library) return null;

    const uuid = library.materials[material.name] ? material.name : Object.keys(library.materials).find(uuid => library.materials[uuid].name === material.name);

    return uuid ? { uuid, modifiers: [] } : null;
}

function collectTargets(object: any, pawn: BaseActor): void {
    if (!object.visible) return;
    if (object.isActor && object.isGameObject && object.findComponent("pawnRenderable")) pawn = object;

    if (object.isPawnMesh) for (const source of (object as PawnMesh).sources) cacheBatched.add(source);
    else if (object.isLitSkinnedMesh && pawn) arrSkinned.push({ pawn, mesh: object });
    else if (object.material && !pawn) arrMeshes.push(object);

    for (const child of object.children) collectTargets(child, pawn);
}

function collectAttachments(object: THREE.Object3D, bone: THREE.Bone, arrAttachments: Attachment_T[]): void {
    for (const child of object.children as any[]) {
        if (child.isBone) collectAttachments(child, child, arrAttachments);
        else if (!bone) continue;
        else if (child.isGameObject || child.type !== "Object3D") arrAttachments.push({ object: child, bone });
        else collectAttachments(child, bone, arrAttachments);
    }
}

function skinPositions(mesh: LitSkinnedMesh, target: Float32Array): Float32Array {
    const geometry = mesh.geometry, position = geometry.getAttribute("position"), bones = mesh.skeleton.boneMatrices;
    const influences = ["", "2"].filter(suffix => geometry.hasAttribute(`skinIndex${suffix}`)).map(suffix => ({ index: geometry.getAttribute(`skinIndex${suffix}`), weight: geometry.getAttribute(`skinWeight${suffix}`) }));

    mesh.skeleton.resolveMatrices();

    for (let i = 0; i < position.count; i++) {
        tmpVertex.fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix);
        tmpSkinned.set(0, 0, 0);

        for (const { index, weight } of influences)
            for (let j = 0; j < 4; j++) {
                const value = weight.getComponent(i, j);

                if (value !== 0) tmpSkinned.addScaledVector(tmpBoneVertex.copy(tmpVertex).applyMatrix4(tmpBoneMatrix.fromArray(bones, index.getComponent(i, j) * 16)), value);
            }

        tmpSkinned.applyMatrix4(mesh.bindMatrixInverse).toArray(target, i * 3);
    }

    return target;
}

function raycastSkinned(target: SkinnedTarget_T, ray: THREE.Ray, hit: PawnHit_T): PawnHit_T {
    const mesh = target.mesh, geometry = mesh.geometry, index = geometry.index.array, materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = geometry.groups.length ? geometry.groups : [{ start: 0, count: index.length, materialIndex: 0 }];

    if (!geometry.boundingSphere) geometry.computeBoundingSphere();

    tmpSphere.copy(geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
    tmpSphere.radius *= 3; // reference pose bounds, an animated pawn reaches outside them

    if (!ray.intersectsSphere(tmpSphere)) return hit;

    const positions = skinPositions(mesh, new Float32Array(geometry.getAttribute("position").count * 3));

    tmpRay.copy(ray).applyMatrix4(tmpMatrix.copy(mesh.matrixWorld).invert());

    for (const group of groups) {
        const material = materials[group.materialIndex];

        if (!material || !material.visible) continue;

        for (let offset = group.start, end = Math.min(group.start + group.count, index.length); offset < end; offset += 3) {
            tmpVertexA.fromArray(positions, index[offset] * 3);
            tmpVertexB.fromArray(positions, index[offset + 1] * 3);
            tmpVertexC.fromArray(positions, index[offset + 2] * 3);

            if (!tmpRay.intersectTriangle(tmpVertexA, tmpVertexB, tmpVertexC, false, tmpPoint)) continue;
            if (material.side !== DoubleSide && tmpVertexC.sub(tmpVertexB).cross(tmpVertexA.sub(tmpVertexB)).dot(tmpRay.direction) > 0 === (material.side === BackSide)) continue;

            const distance = tmpPoint.applyMatrix4(mesh.matrixWorld).distanceTo(ray.origin);

            if (hit && distance >= hit.distance) continue;

            hit = { pawn: target.pawn, mesh, distance, materialIndex: group.materialIndex, point: tmpPoint.clone() };
        }
    }

    return hit;
}

function makePreviewMaterial(sampler: string, lookup: string): ShaderMaterial {
    return new ShaderMaterial({
        uniforms: { map: { value: null }, layer: { value: 0 }, isAlpha: { value: 0 } }, blending: NoBlending, depthTest: false, depthWrite: false,
        vertexShader: PREVIEW_VERTEX,
        fragmentShader: `uniform highp ${sampler} map; uniform float layer; uniform float isAlpha; varying vec2 texCoord; void main() { vec4 texel = ${lookup}; gl_FragColor = vec4(mix(texel.rgb, texel.aaa, isAlpha), 1.0); }`
    });
}

export class GeometryInspector {
    public readonly element = document.createElement("div");

    protected readonly render: RenderManager;
    protected readonly raycaster = new Raycaster();
    protected readonly highlightMaterials = [
        new MeshBasicMaterial({ color: 0x33ccff, opacity: 0.25, transparent: true, side: DoubleSide, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
        new MeshBasicMaterial({ color: 0xffaa00, opacity: 0.4, transparent: true, side: DoubleSide, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
        new MeshBasicMaterial({ color: 0xff33cc, opacity: 0.25, transparent: true, side: DoubleSide, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    ];
    protected readonly highlights: THREE.Mesh[] = [];
    protected readonly previewTarget = new WebGLRenderTarget(1, 1, { depthBuffer: false });
    protected readonly previewCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    protected readonly previewQuad = new Mesh(new PlaneGeometry(2, 2));
    protected readonly previewMap = makePreviewMaterial("sampler2D", "texture2D(map, texCoord)");
    protected readonly previewArray = makePreviewMaterial("sampler2DArray", "texture(map, vec3(texCoord, layer))");
    protected readonly previewCube = makePreviewMaterial("samplerCube", "textureCube(map, vec3(cos(texCoord.x * 6.2831853) * sin(texCoord.y * 3.1415927), sin(texCoord.x * 6.2831853) * sin(texCoord.y * 3.1415927), cos(texCoord.y * 3.1415927)))");
    protected readonly views = document.createElement("div");
    protected readonly panels: InspectPanel_T[] = [];
    protected current: InspectSelection_T = null;
    protected isSelecting = false;

    public constructor(render: RenderManager) {

        this.render = render;

        this.element.className = "debug-inspect";
        this.views.className = "debug-inspect-views";
        for (let depth = 0; depth < 3; depth++) this.panels.push(this.makePanel(depth));
        document.body.appendChild(this.views);

        this.previewQuad.frustumCulled = false;

        this.clear();
    }

    public pick(clientX: number, clientY: number): void {
        const render = this.render, bounds = render.renderer.domElement.getBoundingClientRect();

        tmpScreenPosition.set((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2);
        this.raycaster.setFromCamera(tmpScreenPosition, render.camera);

        collectTargets(render.objectGroup, null);
        for (const child of render.scene.children)
            if ((child as any).isActor) collectTargets(child, null);

        for (const mesh of arrMeshes) {
            const material = (mesh as THREE.Mesh).material;

            for (const entry of Array.isArray(material) ? material : [material]) {
                if (!entry || cacheSides.has(entry)) continue;

                cacheSides.set(entry, entry.side);
                entry.side = DoubleSide;
            }
        }

        let selection: InspectSelection_T = null, pawnHit: PawnHit_T = null;

        try {
            this.raycaster.intersectObjects(arrMeshes, false, arrIntersections);

            for (const target of arrSkinned)
                if (target.mesh.layers.mask !== 0 || cacheBatched.has(target.mesh)) pawnHit = raycastSkinned(target, this.raycaster.ray, pawnHit);

            for (const hit of arrIntersections) {
                if (pawnHit && pawnHit.distance < hit.distance) break;

                selection = this.describeHit(hit);
                if (selection) break;
            }

            if (!selection && pawnHit) selection = this.describePawn(pawnHit);
        } finally {
            cacheSides.forEach((side, material) => material.side = side);
            cacheSides.clear();
            cacheBatched.clear();
            arrIntersections.length = arrMeshes.length = arrSkinned.length = 0;
        }

        this.select(selection);
    }

    public update(): void {
        if (!this.current) return;

        for (let i = 0; i < this.current.highlights.length; i++) {
            let root = this.current.highlights[i].object;

            while (root.parent) root = root.parent;

            if (root !== this.render.scene) {
                this.clear();
                return;
            }
        }

        this.current.highlights.forEach((highlight, index) => {
            const mesh = this.highlights[index];

            if (highlight.skin) {
                const position = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;

                skinPositions(highlight.skin, position.array as Float32Array);
                position.needsUpdate = true;
            }

            mesh.visible = isVisible(highlight.object);
            mesh.matrix.multiplyMatrices(highlight.object.matrixWorld, highlight.local);
            mesh.matrixWorldNeedsUpdate = true;
        });
    }

    public clear(): void { this.select(null); }

    protected describeHit(hit: THREE.Intersection): InspectSelection_T {
        const object = hit.object as any, sector = findAncestor(object, "isSectorObject") as SectorObject;

        if (!hit.face || !sector || !isVisible(object)) return null;

        const material = Array.isArray(object.material) ? object.material[hit.face.materialIndex] : object.material;

        if (!material || !material.visible || material.blending === CustomBlending && material.blendSrc === ZeroFactor && material.blendDst === OneFactor) return null;

        if (material.side !== DoubleSide) { // ue2-conventions.ts mirrors the projection, the drawn side is the one three's raycaster culls
            tmpMatrix.copy(object.matrixWorld);
            if (object.isInstancedMesh) {
                object.getMatrixAt(hit.instanceId, tmpInstanceMatrix);
                tmpMatrix.multiply(tmpInstanceMatrix);
            }
            tmpDirection.copy(this.raycaster.ray.direction).transformDirection(tmpMatrix.invert());

            if (hit.face.normal.dot(tmpDirection) > 0 === (material.side === BackSide)) return null;
        }

        const actor = findAncestor(object, "isStaticMeshActor") as CollidingMesh;
        let selection: InspectSelection_T = null;

        if (object.isBatch) selection = this.describeBatch(sector, object, hit);
        else if (object.isTerrainBatch || object.isTerrain) selection = this.describeTerrain(sector, object, hit);
        else if (object.isTerrainDecoration) selection = this.describeDecoration(sector, object, hit);
        else if (object.isBSPSection) selection = this.describeBSP(sector, object, hit);
        else if (actor) selection = this.describeStaticMesh(sector, actor, hit);

        if (!selection) return null;

        selection.lines.push(row("Sector", sector.name), row("Zone", sector.findPositionZone(hit.point) ?? "---"), row("Hit", `${formatVector(hit.point.toArray())} at ${formatNumber(hit.distance)}`));

        return selection;
    }

    protected describeBatch(sector: SectorObject, object: CollidingMesh, hit: THREE.Intersection): InspectSelection_T {
        const library = (sector as any).decodeLibrary as DecodeLibrary;
        const batch = ((library as any).staticMeshBatches as StaticMeshBatchManifest_T).batches.find(batch => sector.staticMeshMap.get(batch.uuid) === object);

        if (!batch) throw new Error(`Batch '${object.name}' is not in the sector manifest.`);

        const elementIndex = object.perActorAmbient.findIndex(actor => hit.face.a >= actor.startVertex && hit.face.a < actor.startVertex + actor.count);
        const groups = (object.batchElements[elementIndex].groups as BatchElementGroup_T[]).map((group, index) => ({ group, slot: batch.batchElements[elementIndex].groups[index].materialIndex })).filter(({ group }) => group.count > 0);
        const hitGroup = findElementGroup(object.batchIndices, groups.map(({ group }) => group), hit.face);
        const slots = getMaterialSlots(library, batch.materials), layers = object.geometry.getAttribute("batchLayer");
        const materials = Array.isArray(object.material) ? object.material : [object.material], actor = batch.actors[elementIndex];
        const others = (object.batchElements as { groups: BatchElementGroup_T[] }[]).filter((_, index) => index !== elementIndex).flatMap(element => element.groups);
        const elementCount = groups.reduce((count, { group }) => count + group.count, 0);
        const indices = new Uint32Array(others.reduce((count, group) => count + group.count, elementCount)), highlight: HighlightGroup_T[] = [];
        const lines = [row("Kind", "Static mesh (batched)")];
        let offset = 0;

        groups.forEach(({ group }, index) => {
            indices.set(object.batchIndices.subarray(group.start, group.start + group.count), offset);
            highlight.push({ start: offset, count: group.count, materialIndex: index });
            offset += group.count;
        });

        for (const group of others) {
            indices.set(object.batchIndices.subarray(group.start, group.start + group.count), offset);
            offset += group.count;
        }

        describeActor(actor, lines);
        lines.push(row("Batch", `${object.name}, element ${elementIndex} of ${object.batchElements.length}`), row("Triangles", elementCount / 3), row("Vertices", object.perActorAmbient[elementIndex].count));

        return {
            title: `${actor.name} (${actor.instance.mesh.name})`, lines,
            highlights: [{ object, position: object.geometry.getAttribute("position"), index: new Uint32BufferAttribute(indices, 1), groups: highlight, local: new Matrix4(), batch: [{ start: elementCount, count: indices.length - elementCount }] }],
            materials: groups.map(({ group, slot }, index) => describeMaterial(library, materials[group.materialIndex], slots[slot], `Material ${index + 1}/${groups.length}: ${getMaterialName(library, materials[group.materialIndex], slots[slot])}`, index === hitGroup, [highlight[index]], layers ? layers.getX(object.batchIndices[group.start]) : 0))
        };
    }

    protected describeStaticMesh(sector: SectorObject, object: CollidingMesh, hit: THREE.Intersection): InspectSelection_T {
        const library = (sector as any).decodeLibrary as DecodeLibrary, mesh = hit.object as THREE.Mesh;
        const actor = ((library as any).staticMeshBatches as StaticMeshBatchManifest_T).unbatchable.find(actor => actor.uuid === object.actorUuid);
        const slots = actor && mesh === object ? getMaterialSlots(library, actor.instance.mesh.materials) : [];
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const lines = [row("Kind", "Static mesh")], highlight = getMeshHighlight(mesh);

        if (actor) describeActor(actor, lines);
        else lines.push(row("Object", object.name));
        if (mesh !== object) lines.push(row("Part", mesh.name || mesh.type));
        lines.push(row("Triangles", countTriangles(highlight)), row("Vertices", mesh.geometry.getAttribute("position").count));

        return {
            title: actor ? `${actor.name} (${actor.instance.mesh.name})` : object.name, lines, highlights: [highlight],
            materials: materials.map((material, index) => describeMaterial(library, material, slots[index], `Material ${index + 1}/${materials.length}: ${getMaterialName(library, material, slots[index])}`, index === hit.face.materialIndex, highlight.groups.filter(group => group.materialIndex === index)))
        };
    }

    protected describeBSP(sector: SectorObject, object: THREE.Mesh, hit: THREE.Intersection): InspectSelection_T {
        const library = (sector as any).decodeLibrary as DecodeLibrary, section = sector.bspSections[(object as any).sectionIndex];
        const slots = getMaterialSlots(library, section.material), materials = Array.isArray(object.material) ? object.material : [object.material];
        const nodes = object.geometry.getAttribute("nodeIndex"), node = nodes ? nodes.getX(hit.face.a) : -1, highlight = getMeshHighlight(object);
        const lines = [row("Kind", "BSP section"), row("Section", `${(object as any).sectionIndex} of ${sector.bspSections.length}`), row("Name", section.sectionName), row("Priority", section.priority), row("Outdoor", !!section.isOutdoor), row("Unlit", !!section.isUnlit)];

        if (section.blendingMode) lines.push(row("Blending", section.blendingMode));
        if (node >= 0) lines.push(row("Node", `${node}, zones ${sector.bspNodes[node].zones.join("/")}`));

        lines.push(row("Nodes", section.nodeIndices.length), row("Triangles", countTriangles(highlight)));

        if (node >= 0) {
            const index = object.geometry.index;
            let start = 0, count = 0;

            while (nodes.getX(index.getX(start)) !== node) start += 3;
            while (start + count < index.count && nodes.getX(index.getX(start + count)) === node) count += 3;

            highlight.groups = [{ start, count, materialIndex: hit.face.materialIndex }];
            highlight.batch = [{ start: 0, count: start }, { start: start + count, count: index.count - start - count }];
        }

        return {
            title: `BSP section ${(object as any).sectionIndex}`, lines, highlights: [highlight],
            materials: materials.map((material, index) => describeMaterial(library, material, slots[index], `Material ${index + 1}/${materials.length}: ${getMaterialName(library, material, slots[index])}`, index === hit.face.materialIndex, highlight.groups.filter(group => group.materialIndex === index)))
        };
    }

    protected describeTerrain(sector: SectorObject, object: THREE.Mesh, hit: THREE.Intersection): InspectSelection_T {
        const library = (sector as any).decodeLibrary as DecodeLibrary, isBatch = !!(object as any).isTerrainBatch;
        const segment: Terrain = isBatch ? (object as any).sectors.find((segment: Terrain) => hit.face.a >= segment.batchVertexOffset && hit.face.a < segment.batchVertexOffset + segment.geometry.getAttribute("position").count) : object as Terrain;
        const index = segment.geometry.index, materials = Array.isArray(segment.material) ? segment.material : [segment.material];
        const passes = materials.flatMap(material => [material, ...((material as any).passes || [])]);
        const lines = [row("Kind", isBatch ? "Terrain (batched)" : "Terrain"), row("Segment", segment.name), row("Map", `${segment.mapX}, ${segment.mapY}`), row("Offset", `${segment.offsetX}, ${segment.offsetY}`), row("Heightmap", `${segment.heightmapX}, ${segment.heightmapY}`)];

        lines.push(row("Bounds min", formatVector(segment.bounds.min.toArray())), row("Bounds max", formatVector(segment.bounds.max.toArray())));
        if (isBatch) lines.push(row("Batch", `${object.name}, segment ${segment.batchSectorIndex} of ${(object as any).sectors.length}`));
        lines.push(row("Triangles", index.count / 3), row("Vertices", segment.geometry.getAttribute("position").count));

        const groups: HighlightGroup_T[] = [{ start: isBatch ? segment.batchIndexOffset : 0, count: index.count, materialIndex: 0 }];

        return {
            title: `Terrain ${segment.name}`, lines,
            highlights: [{ object, position: object.geometry.getAttribute("position"), index: object.geometry.index, groups, local: new Matrix4() }],
            materials: passes.map((material, index) => describeMaterial(library, material, index ? null : { uuid: segment.terrainSegmentUuid, modifiers: [] }, index ? `Layers, pass ${index + 1}/${passes.length}` : "Layers", true, groups))
        };
    }

    protected describeDecoration(sector: SectorObject, object: TerrainDecoration, hit: THREE.Intersection): InspectSelection_T {
        if (!object.forceRender && hit.point.distanceTo(this.render.camera.position) > object.fadeoutRadius[1]) return null;

        const library = (sector as any).decodeLibrary as DecodeLibrary, materials = Array.isArray(object.material) ? object.material : [object.material];
        const lines = [row("Kind", "Terrain decoration"), row("Name", object.name), row("Instance", `${hit.instanceId} of ${object.count}`), row("Segment", object.terrainSegment), row("Fade range", formatVector(object.fadeoutRadius)), row("Force render", object.forceRender), row("Draw order", object.renderOrder)];
        const highlight = getMeshHighlight(object);

        object.getMatrixAt(hit.instanceId, highlight.local);
        lines.push(row("Position", formatVector(highlight.local.elements.slice(12, 15))));
        lines.push(row("Triangles", countTriangles(highlight)), row("Vertices", object.geometry.getAttribute("position").count));

        return {
            title: `${object.name} #${hit.instanceId}`, lines, highlights: [highlight],
            materials: materials.map((material, index) => {
                const slot = findMaterialSlot(library, material);

                return describeMaterial(library, material, slot, `Material ${index + 1}/${materials.length}: ${getMaterialName(library, material, slot)}`, index === hit.face.materialIndex, highlight.groups.filter(group => group.materialIndex === index));
            })
        };
    }

    protected describePawn(hit: PawnHit_T): InspectSelection_T {
        const render = this.render, pawn = hit.pawn as any, library = render.getParent().getComponent("asset").getPawnLibrary(hit.pawn);
        const meshes = pawn.getComponent("animation").getMeshes() as LitSkinnedMesh[], batches = pawn.children.filter((child: any) => child.isPawnMesh) as PawnMesh[];
        const action = pawn.getAnimationAction() as THREE.AnimationAction, sector = render.getSector(hit.point);
        const arrAttachments: Attachment_T[] = [], highlights: InspectHighlight_T[] = [];
        const lines = [row("Kind", pawn.isPlayer ? "Player" : "Pawn"), row("Name", pawn.name || "---"), row("Class", pawn.scriptClassId || "---"), row("Position", formatVector(pawn.getWorldPosition(tmpVertex).toArray())), row("Yaw", formatNumber(pawn.getRotationYaw()))];

        for (const mesh of meshes) collectAttachments(mesh, null, arrAttachments);

        lines.push(row("Collision", `radius ${formatNumber(pawn.getCollisionRadius())}, height ${formatNumber(pawn.getCollisionHeight())}`));
        lines.push(row("Physics", `${pawn.getComponent("pawnMovement").getPhysicsMode()}, speed ${formatNumber(pawn.getSpeed())}`));
        lines.push(row("Animation", action ? `${action.getClip().name} at ${formatNumber(action.time)} of ${formatNumber(action.getClip().duration)}` : "none"));
        if (pawn.scriptClassId) lines.push(row("Draw scale", formatNumber(pawn.getUnrealScriptProperty("DrawScale"))));

        if (sector && sector.staticMeshGroup && pawn.findComponent("script")) {
            const zone = (pawn.getComponent("pawnRenderable") as PawnRenderableComponent).getAmbientZone(sector);

            lines.push(row("Lighting", `${zone.isSunAffected ? "sun affected" : `zone ambient ${formatVector(zone.ambient)}`}, ${zone.permeatingLights.length} permeating lights, ${zone.leaves.length} leaves`));
        }

        lines.push(row("Parts", `${meshes.length} body, ${arrAttachments.length} attached`));
        lines.push(row("Draws", batches.length ? `${batches.length} batched (${batches.map(batch => batch.parts.length).join(" + ")} parts)${batches.some(batch => batch.crowdEntry) ? ", crowd" : ""}` : "unbatched"));
        lines.push(row("Sector", sector ? sector.name : "---"), row("Zone", sector ? sector.findPositionZone(hit.point) ?? "---" : "---"), row("Hit", `${formatVector(hit.point.toArray())} at ${formatNumber(hit.distance)}`));

        const parts = meshes.map(mesh => this.describePawnPart(library, `Body: ${mesh.name}`, mesh, batches, hit, [], highlights));

        for (const attachment of arrAttachments) parts.push(this.describeAttachment(library, attachment, batches, hit, highlights));
        if (!parts.some(part => part.isHit)) parts.unshift(this.describePawnPart(library, `Mesh: ${hit.mesh.name}`, hit.mesh, batches, hit, [], highlights));

        return { title: `${pawn.name || pawn.type}${pawn.scriptClassId ? ` (${pawn.scriptClassId})` : ""}`, lines, materials: [], parts, highlights };
    }

    protected describePawnPart(library: DecodeLibrary, title: string, mesh: LitSkinnedMesh, batches: PawnMesh[], hit: PawnHit_T, lines: string[], highlights: InspectHighlight_T[]): InspectPart_T {
        const geometry = mesh.geometry, materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material], batch = batches.find(batch => batch.sources.includes(mesh));
        const isHit = mesh === hit.mesh, isDrawn = !!batch || mesh.layers.mask !== 0, highlight = getMeshHighlight(mesh), groups = isDrawn ? highlight.groups : [];

        if (isDrawn) {
            highlight.position = new Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 3), 3);
            highlight.skin = mesh;
            highlights.push(highlight);
        }

        lines.push(row("Mesh", mesh.name || "---"), row("Triangles", geometry.index.count / 3), row("Vertices", geometry.getAttribute("position").count));
        lines.push(row("Bones", `${mesh.skeleton.bones.length}${geometry.hasAttribute("skinWeight2") ? ", 8 influences" : ""}`), row("Scale", formatVector(mesh.scale.toArray())));
        lines.push(row("Glow", `ambient ${formatNumber(mesh.ambientGlow)}, scaled ${formatNumber(mesh.scaledGlow)}${mesh.isUnlit ? ", unlit" : ""}`));
        lines.push(row("Draw", batch ? `batched with ${batch.parts.length} parts, ${batch.textures.length} textures${batch.crowdEntry ? ", crowd" : ""}` : mesh.layers.mask !== 0 && isVisible(mesh) ? "unbatched" : "hidden"));

        return {
            title, isHit, lines, groups,
            materials: materials.flatMap((material, index) => {
                if (!material) return [];

                const slot = findMaterialSlot(library, material);

                return [describeMaterial(library, material, slot, `Material ${index + 1}/${materials.length}: ${getMaterialName(library, material, slot)}`, isHit && index === hit.materialIndex, groups.filter(group => group.materialIndex === index))];
            })
        };
    }

    protected describeAttachment(library: DecodeLibrary, attachment: Attachment_T, batches: PawnMesh[], hit: PawnHit_T, highlights: InspectHighlight_T[]): InspectPart_T {
        const object = attachment.object as any, properties = object.scriptProperties as Map<string, any>, meshes: LitSkinnedMesh[] = [];
        const path = properties && properties.get("Mesh"), skins = properties && properties.get("Skins") as string[];
        const title = `Attachment: ${path || object.name || object.scriptClassId || object.type} on ${attachment.bone.name}`;
        const lines = [row("Type", object.isActor ? "Pawn" : object.isEmitterActor ? "Emitter" : path ? "Mesh" : object.type), row("Bone", attachment.bone.name), row("Visible", isVisible(object)), row("Offset", formatVector(object.position.toArray()))];

        object.traverse((child: any) => { if (child.isLitSkinnedMesh) meshes.push(child); });

        if (skins && skins.length) lines.push(row("Skins", skins.join(", ")));
        if (!object.isActor && meshes.length) return this.describePawnPart(library, title, meshes[0], batches, hit, lines, highlights);
        if (object.children.length) lines.push(row("Children", object.children.map((child: THREE.Object3D) => child.name || child.type).join(", ")));

        return { title, isHit: false, lines, materials: [], groups: [] };
    }

    protected select(selection: InspectSelection_T): void {
        const title = document.createElement(selection ? "strong" : "p"), count = selection ? selection.highlights.length : 0;

        this.closePanels(0);
        this.current = selection;
        this.render.needsUpdate = true;

        while (this.highlights.length < count) this.highlights.push(this.makeHighlight());

        this.highlights.forEach((mesh, index) => {
            if (index >= count) {
                this.render.scene.remove(mesh);
                mesh.geometry.deleteAttribute("position");
                mesh.geometry.setIndex(null);
                return;
            }

            mesh.geometry.setAttribute("position", selection.highlights[index].position);
            mesh.geometry.setIndex(selection.highlights[index].index);
            this.render.scene.add(mesh);
        });

        if (!selection) {
            title.textContent = "Click geometry in the viewport to inspect it.";
            this.element.replaceChildren(title);
            return;
        }

        title.textContent = selection.title;

        this.isSelecting = true;
        this.fill(this.element, [title, this.makeInfo(selection.lines), ...selection.materials.map(material => this.makeMaterialItem(material, 0)), ...(selection.parts || []).map(part => this.makePartItem(part))]);
        this.isSelecting = false;
        this.updateGroups();
        this.update();
    }

    protected updateGroups(): void {
        let active: HighlightGroup_T[] = [];

        for (const panel of this.panels)
            if (panel.groups) active = panel.groups;

        const highlights = this.current.highlights, hasOthers = highlights.some(highlight => highlight.groups.some(group => !active.includes(group)));

        highlights.forEach((highlight, index) => {
            const geometry = this.highlights[index].geometry;

            geometry.clearGroups();
            for (const group of highlight.groups) geometry.addGroup(group.start, group.count, hasOthers && active.includes(group) ? 1 : 0);
            for (const range of highlight.batch || []) geometry.addGroup(range.start, range.count, 2);
        });

        this.render.needsUpdate = true;
    }

    protected makeHighlight(): THREE.Mesh {
        const mesh = new Mesh(new BufferGeometry(), this.highlightMaterials);

        mesh.name = "InspectHighlight";
        mesh.matrixAutoUpdate = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 999;

        return mesh;
    }

    protected fill(body: HTMLElement, children: HTMLElement[]): void {
        body.replaceChildren(...children);

        const hit = this.isSelecting && children.find(child => child.classList.contains("hit"));

        if (hit) hit.click();
    }

    protected openPanel(depth: number, button: HTMLButtonElement, title: string, groups: HighlightGroup_T[], children: HTMLElement[]): void {
        const panel = this.panels[depth], isOpen = panel.button === button;

        this.closePanels(depth);

        if (!isOpen) {
            panel.button = button;
            panel.groups = groups;
            panel.title.textContent = title;
            panel.root.hidden = false;
            button.classList.add("active");
            this.fill(panel.body, children);
        }

        this.updateGroups();
    }

    protected closePanels(depth: number): void {
        for (let i = depth; i < this.panels.length; i++) {
            const panel = this.panels[i];

            if (panel.button) panel.button.classList.remove("active");

            panel.button = null;
            panel.groups = null;
            panel.body.replaceChildren();
            panel.root.hidden = true;
        }
    }

    protected makePanel(depth: number): InspectPanel_T {
        const root = document.createElement("aside"), header = document.createElement("header"), title = document.createElement("strong");
        const close = document.createElement("button"), content = document.createElement("div"), body = document.createElement("div");

        root.className = "debug-view";
        root.hidden = true;
        content.className = "debug-content";
        body.className = "debug-inspect";
        close.type = "button";
        close.textContent = "x";
        close.onclick = () => {
            this.closePanels(depth);
            this.updateGroups();
        };
        header.append(title, close);
        content.appendChild(body);
        root.append(header, content);
        this.views.appendChild(root);

        return { root, title, body, button: null, groups: null };
    }

    protected makeInfo(lines: string[]): HTMLElement {
        const info = document.createElement("pre");

        info.className = "debug-info";
        info.textContent = lines.join("\n");

        return info;
    }

    protected makeItem(title: string, isHit: boolean, depth: number, groups: HighlightGroup_T[], fill: () => HTMLElement[]): HTMLButtonElement {
        const item = document.createElement("button");

        item.type = "button";
        item.className = isHit ? "debug-item hit" : "debug-item";
        item.textContent = title;
        item.onclick = () => this.openPanel(depth, item, title, groups, fill());

        return item;
    }

    protected makePartItem(part: InspectPart_T): HTMLButtonElement {
        return this.makeItem(part.title, part.isHit, 0, part.groups, () => [this.makeInfo(part.lines), ...part.materials.map(material => this.makeMaterialItem(material, 1))]);
    }

    protected makeMaterialItem(material: InspectMaterial_T, depth: number): HTMLButtonElement {
        return this.makeItem(material.title, material.isHit, depth, material.groups, () => {
            const maps = document.createElement("div"), children = [this.makeInfo(material.lines), maps];

            maps.className = "debug-maps";
            for (const map of material.maps) {
                maps.appendChild(this.makeMap(map, false));
                if (ALPHA_FORMATS.has(map.texture.format)) maps.appendChild(this.makeMap(map, true));
            }

            if (material.graph.length) children.unshift(this.makeInfo(material.graph));
            if (material.uniforms.length) children.push(this.makeItem("Uniforms", false, depth + 1, null, () => [this.makeInfo(material.uniforms)]));

            return children;
        });
    }

    protected makeMap(map: InspectMap_T, isAlpha: boolean): HTMLElement {
        const figure = document.createElement("figure"), canvas = document.createElement("canvas"), caption = document.createElement("figcaption");
        const texture = map.texture as any, image = getTextureImage(texture), scale = Math.min(1, PREVIEW_SIZE / Math.max(image.width, image.height));

        figure.className = "debug-map";
        canvas.width = texture.isCubeTexture ? PREVIEW_SIZE : Math.max(1, Math.round(image.width * scale));
        canvas.height = texture.isCubeTexture ? PREVIEW_SIZE / 2 : Math.max(1, Math.round(image.height * scale));
        canvas.onclick = () => figure.classList.toggle("expanded");
        caption.textContent = `${map.slot}${isAlpha ? ", alpha channel" : ""}\n${map.name || "unnamed"}\n${describeTexture(texture)}`;
        figure.append(canvas, caption);

        void this.drawPreview(figure, canvas, map, isAlpha);

        return figure;
    }

    protected async drawPreview(figure: HTMLElement, canvas: HTMLCanvasElement, map: InspectMap_T, isAlpha: boolean): Promise<void> {
        let pixels = this.renderPreview(canvas, map, isAlpha);

        while (!pixels) {
            await new Promise(resolve => setTimeout(resolve, 50));
            if (!canvas.isConnected) return;

            pixels = this.renderPreview(canvas, map, isAlpha);
        }

        figure.hidden = isAlpha && pixels.every(value => value === 255);
    }

    protected renderPreview(canvas: HTMLCanvasElement, map: InspectMap_T, isAlpha: boolean): Uint8ClampedArray {
        const renderer = this.render.renderer, texture = map.texture as any, depth = renderer.state.buffers.depth, isReversed = depth.getReversed();
        const material = texture.isCubeTexture ? this.previewCube : texture.isCompressedArrayTexture || texture.isDataArrayTexture ? this.previewArray : this.previewMap;
        const target = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel(), calls = renderer.info.render.calls;
        const pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);

        material.uniforms.map.value = texture;
        material.uniforms.layer.value = map.layer;
        material.uniforms.isAlpha.value = isAlpha ? 1 : 0;
        this.previewQuad.material = material;
        this.previewTarget.setSize(canvas.width, canvas.height);

        try {
            renderer.setRenderTarget(this.previewTarget);
            renderer.render(this.previewQuad, this.previewCamera);
            if (renderer.info.render.calls === calls) return null; // a program that is still linking skips its draw
            renderer.readRenderTargetPixels(this.previewTarget, 0, 0, canvas.width, canvas.height, pixels);
        } finally {
            renderer.setRenderTarget(target, face, mip);
            depth.setReversed(isReversed);
            material.uniforms.map.value = null;
        }

        canvas.getContext("2d").putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0);

        return pixels;
    }
}

export default GeometryInspector;
