import { Box3, BufferGeometry, Color, CustomBlending, DstColorFactor, EqualDepth, FrontSide, Group, LessEqualDepth, Matrix3, Mesh, MeshBasicMaterial, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, SrcAlphaFactor, SrcColorFactor, Uniform, Vector3, Vector4, ZeroFactor, type Camera, type Scene, type Texture, type WebGLRenderer } from "three";
import { EProjectorBlending_T } from "../assets/unreal/un-projector";
import type { BatchElement_T } from "../assets/unreal/static-mesh-batch";
import { appendGlobalUniforms } from "../materials/global-uniforms";
import type MeshStaticMaterial from "../materials/mesh-static-material/mesh-static-material";
import type CollidingMesh from "../objects/colliding-mesh";
import type Projector from "../objects/projector";
import type ShadowProjector from "../objects/shadow-projector";
import type { SectorObject } from "../objects/zone-object";

const VERTEX_SHADER = `
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
uniform mat4 projectorMatrix;
uniform mat3 projectorNormalMatrix;
uniform vec4 clippingSphere;
uniform float clippingFade;
varying vec4 vProjection;
#ifdef PROJECTOR_BSP
    uniform vec4 projectorPlanes[6];
    uniform vec3 projectorDirection;
    varying vec3 vClip0;
    varying vec3 vClip1;
    varying vec3 vRangeOffset;
    varying float vFacing;
#else
    varying vec3 vFacing;
    varying vec3 vDiffuse;
    varying float vRangeAlpha;
#endif

void main() {
    #include <begin_vertex>
    #include <project_vertex>
    #include <fog_vertex>
    #include <logdepthbuf_vertex>
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vProjection = projectorMatrix * worldPosition;
    vec3 rangeOffset = mvPosition.xyz - (viewMatrix * vec4(clippingSphere.xyz, 1.0)).xyz;
    #ifdef PROJECTOR_BSP
        vClip0 = vec3(dot(projectorPlanes[0], worldPosition), dot(projectorPlanes[1], worldPosition), dot(projectorPlanes[2], worldPosition));
        vClip1 = vec3(dot(projectorPlanes[3], worldPosition), dot(projectorPlanes[4], worldPosition), dot(projectorPlanes[5], worldPosition));
        vFacing = floor(clamp(-dot((modelMatrix * vec4(normal, 0.0)).xyz, projectorDirection), 0.0, 1.0) * 255.0) / 255.0;
        vRangeOffset = rangeOffset;
    #else
        vFacing = projectorNormalMatrix * normalize(normalMatrix * normal);
        vDiffuse = color;
        vRangeAlpha = (clippingSphere.w - length(rangeOffset)) / clippingFade;
    #endif
}`;

const FRAGMENT_SHADER = `
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <projector_fragment>
uniform samplerCube projectorAttenuation;
uniform bool projectOnBackfaces;
uniform float sectorFade;
varying vec4 vProjection;
#ifdef PROJECTOR_BSP
    uniform sampler2D baseMap;
    uniform bool useBaseMap;
    uniform bool useIndoorRangeIgnored;
    uniform vec3 baseColor;
    uniform float indoorRangeIgnored;
    uniform vec4 clippingSphere;
    uniform float clippingFade;
    varying vec3 vClip0;
    varying vec3 vClip1;
    varying vec3 vRangeOffset;
    varying float vFacing;
#else
    varying vec3 vFacing;
    varying vec3 vDiffuse;
    varying float vRangeAlpha;
#endif

void main() {
    #include <logdepthbuf_fragment>
    #ifdef PROJECTOR_BSP
        if (any(greaterThan(vClip0, vec3(0.0))) || any(greaterThan(vClip1, vec3(0.0)))) discard;
        float rangeAlpha = (clippingSphere.w - length(vRangeOffset)) / clippingFade;
        if (useIndoorRangeIgnored) rangeAlpha = max(indoorRangeIgnored, rangeAlpha);
        vec3 diffuse = baseColor;
        // FBspProjector vertex stream 0x8F7A88: base material UVs are zero.
        if (useBaseMap) diffuse *= texture2D(baseMap, vec2(0.0)).rgb;
        float facing = projectOnBackfaces ? 1.0 : vFacing;
    #else
        float rangeAlpha = vRangeAlpha;
        vec3 diffuse = vDiffuse;
        float facing = projectOnBackfaces ? 1.0 : textureCube(projectorAttenuation, vFacing).a;
    #endif
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (min(sectorFade, rangeAlpha) <= noise) discard;
    gl_FragColor = getProjectorColor(vProjection, diffuse, facing);
}`;

type GeometryGroup_T = THREE.BufferGeometry["groups"][number];
type TerrainProjection_T = { revision: number, positionVersion: number, indexVersion: number, geometry: BufferGeometry, sourceTriangles: number[] };
type BspProjection_T = { revision: number, geometry: BufferGeometry };
type StaticMaterials_T = { version: number, blends: Map<EProjectorBlending_T, ShaderMaterial>, dispose: () => void };
type SectorReceivers_T = { terrain: Mesh[], bsp: Mesh[] };

const BLEND_DEFINES = { PB_Modulate: EProjectorBlending_T.PB_Modulate, PB_AlphaBlend: EProjectorBlending_T.PB_AlphaBlend };
const tmpBounds = new Box3();
const tmpGroupBounds = new Box3();
const tmpPoint = new Vector3();
const tmpViewToWorld = new Matrix3();
const drawGroup = { start: 0, count: 0, materialIndex: 0 };

export class ProjectorRenderer {
    protected readonly receivers = new WeakMap<SectorObject, SectorReceivers_T>();
    protected readonly uploadGroup = new Group();
    protected readonly uploadMaterial = new MeshBasicMaterial({ visible: false });
    protected uploaded = new WeakSet<BufferGeometry>();
    protected readonly cacheTerrain = new WeakMap<BufferGeometry, Map<Projector, TerrainProjection_T>>();
    protected readonly cacheBsp = new WeakMap<BufferGeometry, Map<Projector, BspProjection_T>>();
    protected readonly terrainMaterials = new Map<EProjectorBlending_T, ShaderMaterial>();
    protected readonly bspMaterials = new Map<EProjectorBlending_T, ShaderMaterial>();
    protected readonly staticMeshes = new WeakSet<CollidingMesh>();
    protected readonly staticMaterials = new Map<MeshStaticMaterial, StaticMaterials_T>();

    public constructor(protected readonly shadows: ShadowProjector) {}

    public attach(sector: SectorObject, world: Scene): void {
        if (!sector.projectors.length || this.receivers.has(sector)) return;

        const receivers: SectorReceivers_T = { terrain: [], bsp: [] };
        this.receivers.set(sector, receivers);
        if (sector.projectors.some(projector => projector.getUnrealScriptProperty("bProjectTerrain"))) sector.zones.traverse(object => {
            const mesh = object as Mesh;
            if (!(mesh as any).isTerrainBatch && !(mesh as any).isTerrain) return;

            const after = mesh.onAfterRender;
            mesh.onAfterRender = (renderer, scene, camera, geometry, source, group) => {
                after.call(mesh, renderer, scene, camera, geometry, source, group);
                if (scene === world && (source as any).isTerrainMaterial && source.colorWrite && sector.hasFinishedLoading)
                    this.drawTerrain(renderer, scene, camera, mesh, sector, group as unknown as GeometryGroup_T);
            };
            receivers.terrain.push(mesh);
        });

        if (!sector.bspGroup || !sector.projectors.some(projector => projector.getUnrealScriptProperty("bProjectBSP"))) return;

        for (const mesh of sector.bspGroup.children as Mesh[]) {
            if (!(mesh as any).isBSPSection) continue;

            const after = mesh.onAfterRender;
            mesh.onAfterRender = (renderer, scene, camera, geometry, source, group) => {
                after.call(mesh, renderer, scene, camera, geometry, source, group);
                if (scene === world && (source as MeshStaticMaterial).isStaticMeshMaterial && source.colorWrite && source.depthWrite && sector.hasFinishedLoading)
                    this.drawBsp(renderer, scene, camera, mesh, sector, source as MeshStaticMaterial);
            };
            receivers.bsp.push(mesh);
        }
    }

    public prepare(sectors: readonly SectorObject[], world: Scene): void {
        for (const sector of sectors) {
            const receivers = this.receivers.get(sector);
            if (!receivers || !sector.visible || !sector.hasFinishedLoading) continue;

            for (const mesh of receivers.terrain) this.prepareReceiver(mesh, sector, false);
            for (const mesh of receivers.bsp) this.prepareReceiver(mesh, sector, true);
        }
        if (this.uploadGroup.children.length) world.add(this.uploadGroup);
    }

    public attachStaticMeshes(sector: SectorObject, world: Scene): void {
        if (!sector.staticMeshGroup || !sector.projectors.some(projector => projector.getUnrealScriptProperty("bProjectStaticMesh"))) return;

        sector.staticMeshGroup.traverse(object => {
            const mesh = object as CollidingMesh;
            if (!mesh.isStaticMeshActor || this.staticMeshes.has(mesh)) return;

            const after = mesh.onAfterRender;
            mesh.onAfterRender = (renderer, scene, camera, geometry, source, group) => {
                after.call(mesh, renderer, scene, camera, geometry, source, group);
                if (scene === world && (source as MeshStaticMaterial).isStaticMeshMaterial && source.colorWrite && sector.hasFinishedLoading)
                    this.drawStaticMesh(renderer, scene, camera, mesh, sector, source as MeshStaticMaterial, group as unknown as GeometryGroup_T);
            };
            this.staticMeshes.add(mesh);
        });
    }

    public finish(): void {
        this.uploadGroup.removeFromParent();
        this.uploadGroup.clear();
    }

    public resetUploads(): void { this.uploaded = new WeakSet(); }

    public dispose(): void {
        this.finish();
        this.uploadMaterial.dispose();
        for (const material of this.terrainMaterials.values()) material.dispose();
        this.terrainMaterials.clear();
        for (const material of this.bspMaterials.values()) material.dispose();
        this.bspMaterials.clear();
        for (const cache of this.staticMaterials.values()) cache.dispose();
    }

    protected prepareReceiver(mesh: Mesh, sector: SectorObject, bsp: boolean): void {
        if (!mesh.visible) return;

        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        tmpBounds.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        const field = bsp ? "bProjectBSP" : "bProjectTerrain";
        const section = bsp ? sector.bspSections[(mesh as any).sectionIndex] : null;
        for (const projector of sector.projectors) {
            if (!projectsOn(projector, field, tmpBounds) || section && !projectsOnSection(projector, section)) continue;

            const projection = bsp ? this.getBspProjection(mesh, projector) : this.getTerrainProjection(mesh, projector);
            const receiver = projection.geometry;
            if (!receiver.index.count || this.uploaded.has(receiver)) continue;

            // renderBufferDirect assumes the geometry has already passed through WebGLObjects.update.
            const upload = new Mesh(receiver, this.uploadMaterial);
            upload.frustumCulled = false;
            upload.layers.enableAll();
            this.uploadGroup.add(upload);
            this.uploaded.add(receiver);
        }
    }

    protected drawBsp(renderer: WebGLRenderer, scene: Scene, camera: Camera, mesh: Mesh, sector: SectorObject, source: MeshStaticMaterial): void {
        const section = sector.bspSections[(mesh as any).sectionIndex];
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        tmpBounds.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        for (let i = sector.projectors.length - 1; i >= 0; i--) {
            const projector = sector.projectors[i];

            if (!projectsOn(projector, "bProjectBSP", tmpBounds) || !projectsOnSection(projector, section)) continue;
            const receiver = this.cacheBsp.get(geometry)?.get(projector)?.geometry;
            if (!receiver?.index.count) continue;

            const material = this.getMaterial(projector.getUnrealScriptProperty("FrameBufferBlendingOp") as EProjectorBlending_T, true);
            const uniforms = bindProjector(material, projector);
            material.side = source.side;
            uniforms.projectorDirection.value = projector.direction;
            uniforms.baseMap.value = source.uniforms.shDiffuseMap?.value || null;
            uniforms.useBaseMap.value = uniforms.baseMap.value !== null;
            uniforms.baseColor.value.copy(source.uniforms.diffuse.value);
            uniforms.useIndoorRangeIgnored.value = !section.isOutdoor;
            const fade = geometry.getAttribute("sectorFade");
            uniforms.sectorFade.value = fade ? fade.getX(0) : 1;
            setPlanes(uniforms.projectorPlanes.value, projector);
            renderer.renderBufferDirect(camera, scene, receiver, material, mesh, null);
            uniforms.projectorMap.value = null;
            uniforms.baseMap.value = null;
        }
    }

    protected drawTerrain(renderer: WebGLRenderer, scene: Scene, camera: Camera, mesh: Mesh, sector: SectorObject, group: GeometryGroup_T): void {
        const geometry = mesh.geometry;
        if (group) {
            const next = geometry.groups[geometry.groups.indexOf(group) + 1];
            if (next && next.start === group.start && next.count === group.count) return;
        }
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        tmpBounds.copy(group ? this.shadows.getReceiverBounds(geometry, group) : geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        const start = group ? group.start : 0, end = group ? start + group.count : geometry.index.count;
        for (let i = sector.projectors.length - 1; i >= 0; i--) {
            const projector = sector.projectors[i];

            if (!projectsOn(projector, "bProjectTerrain", tmpBounds)) continue;
            const projection = this.cacheTerrain.get(geometry)?.get(projector);
            if (!projection) continue;
            const triangles = projection.sourceTriangles;
            const first = findTriangle(triangles, start), last = findTriangle(triangles, end);
            if (first === last) continue;

            const material = this.getMaterial(projector.getUnrealScriptProperty("FrameBufferBlendingOp") as EProjectorBlending_T, false);
            const uniforms = bindProjector(material, projector);
            uniforms.projectorNormalMatrix.value.multiplyMatrices(projector.projectorNormalMatrix, tmpViewToWorld.setFromMatrix4(camera.matrixWorld));
            const fade = geometry.getAttribute("sectorFade");
            uniforms.sectorFade.value = fade ? fade.getX(0) : 1;
            drawGroup.start = first * 3;
            drawGroup.count = (last - first) * 3;
            renderer.renderBufferDirect(camera, scene, projection.geometry, material, mesh, drawGroup);
            uniforms.projectorMap.value = null;
        }
    }

    protected drawStaticMesh(renderer: WebGLRenderer, scene: Scene, camera: Camera, mesh: CollidingMesh, sector: SectorObject, source: MeshStaticMaterial, group: GeometryGroup_T): void {
        const geometry = mesh.geometry;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        tmpBounds.copy(group ? this.shadows.getReceiverBounds(geometry, group) : geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        for (let i = sector.projectors.length - 1; i >= 0; i--) {
            const projector = sector.projectors[i];
            if (!projectsOn(projector, "bProjectStaticMesh", tmpBounds)) continue;
            if (source.transparent && !projector.getUnrealScriptProperty("bProjectOnAlpha")) continue;

            const projectOnUnlit = !!projector.getUnrealScriptProperty("bProjectOnUnlit");
            const rawTag = String(projector.getUnrealScriptProperty("ProjectTag")).toLowerCase();
            const tag = rawTag === "none" ? "" : rawTag;
            const material = this.getStaticMaterial(source, projector.getUnrealScriptProperty("FrameBufferBlendingOp") as EProjectorBlending_T);
            const uniforms = bindProjector(material, projector);
            material.side = source.side;
            uniforms.projectorNormalMatrix.value.multiplyMatrices(projector.projectorNormalMatrix, tmpViewToWorld.setFromMatrix4(camera.matrixWorld));
            setPlanes(uniforms.projectorPlanes.value, projector);
            if (mesh.isBatch) {
                const entries = mesh.visibleBatchGroups;
                if (entries) {
                    let offset = 0;
                    for (const entry of entries) {
                        const start = mesh.batchIndices ? offset : entry.start;
                        offset += entry.count;
                        this.drawStaticElement(renderer, scene, camera, mesh, material, projector, mesh.batchElements[entry.elementIndex], group, entry.materialIndex, start, entry.count, projectOnUnlit, tag);
                    }
                } else for (const element of mesh.batchElements)
                    for (const entry of element.groups)
                        this.drawStaticElement(renderer, scene, camera, mesh, material, projector, element, group, entry.materialIndex, entry.start, entry.count, projectOnUnlit, tag);
            } else if (mesh.getUnrealScriptProperty("bAcceptsProjectors") && (projectOnUnlit || !mesh.getUnrealScriptProperty("bUnlit")) &&
                (!tag || String(mesh.getUnrealScriptProperty("Tag")).toLowerCase() === tag) && intersectsPlanes(projector, tmpBounds.min, tmpBounds.max))
                renderer.renderBufferDirect(camera, scene, geometry, material, mesh, group);
            uniforms.projectorMap.value = null;
        }
    }

    protected drawStaticElement(renderer: WebGLRenderer, scene: Scene, camera: Camera, mesh: CollidingMesh, material: ShaderMaterial, projector: Projector, element: BatchElement_T, group: GeometryGroup_T, materialIndex: number, start: number, count: number, projectOnUnlit: boolean, tag: string): void {
        if (!count || group && (materialIndex !== group.materialIndex || start >= group.start + group.count || start + count <= group.start)) return;
        const receiver = element.projector;
        if (!receiver?.accepts || !projectOnUnlit && receiver.isUnlit || tag && receiver.tag.toLowerCase() !== tag) return;
        tmpGroupBounds.min.fromArray(element.boundsMin);
        tmpGroupBounds.max.fromArray(element.boundsMax);
        if (!projector.bounds.intersectsBox(tmpGroupBounds) || !intersectsPlanes(projector, tmpGroupBounds.min, tmpGroupBounds.max)) return;

        drawGroup.start = group ? Math.max(group.start, start) : start;
        drawGroup.count = (group ? Math.min(group.start + group.count, start + count) : start + count) - drawGroup.start;
        drawGroup.materialIndex = materialIndex;
        renderer.renderBufferDirect(camera, scene, mesh.geometry, material, mesh, drawGroup);
    }

    protected getStaticMaterial(source: MeshStaticMaterial, blend: EProjectorBlending_T): ShaderMaterial {
        let cache = this.staticMaterials.get(source);
        if (cache && cache.version !== source.version) {
            cache.dispose();
            cache = null;
        }
        if (!cache) {
            const blends = new Map<EProjectorBlending_T, ShaderMaterial>();
            const dispose = () => {
                for (const material of blends.values()) material.dispose();
                this.staticMaterials.delete(source);
                source.removeEventListener("dispose", dispose);
            };
            cache = { version: source.version, blends, dispose };
            this.staticMaterials.set(source, cache);
            source.addEventListener("dispose", dispose);
        }
        if (cache.blends.has(blend)) return cache.blends.get(blend);

        const defines = { ...source.defines, ...projectorDefines(blend), USE_AUTHORED_PROJECTOR: "" };
        const material = new ShaderMaterial({
            vertexShader: source.vertexShader, fragmentShader: source.fragmentShader, defines,
            uniforms: { ...source.uniforms, projectorMap: new Uniform<Texture>(null),
                projectorMatrix: new Uniform(null), projectorNormalMatrix: new Uniform(new Matrix3()),
                projectorAttenuation: new Uniform(this.shadows.attenuation), projectOnBackfaces: new Uniform(false),
                materialBlending: new Uniform(0), projectorPlanes: new Uniform(Array.from({ length: 6 }, () => new Vector4()))
            },
            side: source.side, vertexColors: source.vertexColors, glslVersion: source.glslVersion, fog: source.fog,
            ...projectorBlending(blend)
        });
        material.defaultAttributeValues = source.defaultAttributeValues;
        cache.blends.set(blend, material);
        return material;
    }

    protected getMaterial(blend: EProjectorBlending_T, bsp: boolean): ShaderMaterial {
        const cache = bsp ? this.bspMaterials : this.terrainMaterials;
        if (cache.has(blend)) return cache.get(blend);

        const defines = projectorDefines(blend);
        defines.USE_FOG = "";
        if (bsp) defines.PROJECTOR_BSP = "";
        const material = new ShaderMaterial({
            vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER, defines,
            uniforms: appendGlobalUniforms({
                projectorMap: new Uniform<Texture>(null), projectorMatrix: new Uniform(null),
                projectorNormalMatrix: new Uniform(new Matrix3()), projectorAttenuation: new Uniform(this.shadows.attenuation),
                projectOnBackfaces: new Uniform(false), materialBlending: new Uniform(0), sectorFade: new Uniform(1),
                ...(bsp ? {
                    baseMap: new Uniform<Texture>(null), baseColor: new Uniform(new Color()), useBaseMap: new Uniform(false),
                    projectorDirection: new Uniform(null), projectorPlanes: new Uniform(Array.from({ length: 6 }, () => new Vector4())),
                    useIndoorRangeIgnored: new Uniform(false)
                } : {})
            }),
            side: FrontSide, vertexColors: !bsp, ...projectorBlending(blend),
            depthFunc: bsp ? EqualDepth : LessEqualDepth
        });
        cache.set(blend, material);
        return material;
    }

    protected getBspProjection(mesh: Mesh, projector: Projector): BspProjection_T {
        const geometry = mesh.geometry;
        const cache = getProjectionCache(this.cacheBsp, geometry);
        const previous = cache.get(projector);
        if (previous?.revision === projector.projectionRevision) return previous;
        if (previous) disposeReceiver(previous.geometry);

        const position = geometry.getAttribute("position"), nodes = geometry.getAttribute("nodeIndex"), planes = projector.planes;
        const planeMask = (1 << planes.length) - 1;
        const indices: number[] = [];
        for (let first = 0; first < position.count;) {
            const node = nodes.getX(first);
            let end = first, outside = planeMask;
            do {
                if (outside) {
                    tmpPoint.fromBufferAttribute(position, end).applyMatrix4(mesh.matrixWorld);
                    for (let plane = 0; plane < planes.length; plane++)
                        if (outside & (1 << plane) && planes[plane].distanceToPoint(tmpPoint) <= 0) outside &= ~(1 << plane);
                }
                end++;
            } while (end < position.count && nodes.getX(end) === node);

            if (!outside)
                for (let v = first + 1; v < end - 1; v++) indices.push(first, v + 1, v);
            first = end;
        }

        const projection = { revision: projector.projectionRevision, geometry: makeReceiver(geometry, indices) };
        cache.set(projector, projection);
        return projection;
    }

    protected getTerrainProjection(mesh: Mesh, projector: Projector): TerrainProjection_T {
        const geometry = mesh.geometry, index = geometry.index;
        const position = geometry.getAttribute("position") as THREE.BufferAttribute;
        const cache = getProjectionCache(this.cacheTerrain, geometry);
        let projection = cache.get(projector);
        if (!projection || projection.revision !== projector.projectionRevision || projection.positionVersion !== position.version || projection.indexVersion !== index.version) {
            if (projection) disposeReceiver(projection.geometry);

            const vertices = new Uint8Array(position.count), sourceTriangles: number[] = [], indices: number[] = [];
            const planes = projector.planes, visited = 1 << planes.length, planeMask = visited - 1;
            const groups = (mesh as any).originalGroups as GeometryGroup_T[] || [{ start: 0, count: index.count, materialIndex: 0 }];
            let previous = -1;
            for (const group of groups) {
                if (group.start === previous) continue;
                previous = group.start;
                if (!projector.bounds.intersectsBox(tmpGroupBounds.copy(this.shadows.getReceiverBounds(geometry, group)).applyMatrix4(mesh.matrixWorld))) continue;

                for (let i = group.start, end = i + group.count; i < end; i += 3) {
                    for (let j = i; j < i + 3; j++) {
                        const vertex = index.getX(j);
                        if (vertices[vertex]) continue;
                        tmpPoint.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld);
                        let outcode = visited;
                        for (let plane = 0; plane < planes.length; plane++) {
                            if (planes[plane].distanceToPoint(tmpPoint) > 0) outcode |= 1 << plane;
                        }
                        vertices[vertex] = outcode;
                    }
                    // FDynamicTerrainProjector drops triangles sharing a frustum outcode.
                    if (vertices[index.getX(i)] & vertices[index.getX(i + 1)] & vertices[index.getX(i + 2)] & planeMask) continue;
                    sourceTriangles.push(i);
                    indices.push(index.getX(i), index.getX(i + 1), index.getX(i + 2));
                }
            }

            projection = { revision: projector.projectionRevision, positionVersion: position.version, indexVersion: index.version, geometry: makeReceiver(geometry, indices), sourceTriangles };
            cache.set(projector, projection);
        }

        return projection;
    }
}

function projectsOn(projector: Projector, field: string, bounds: Box3): boolean {
    return projector.isAttached && projector.bounds.intersectsBox(bounds) && !!projector.getUnrealScriptProperty(field);
}

function projectsOnSection(projector: Projector, section: SectorObject["bspSections"][number]): boolean {
    return (!section.isUnlit || !!projector.getUnrealScriptProperty("bProjectOnUnlit")) &&
        (section.priority !== "transparent" || !!projector.getUnrealScriptProperty("bProjectOnAlpha"));
}

function bindProjector(material: ShaderMaterial, projector: Projector) {
    const uniforms = material.uniforms;
    uniforms.projectorMap.value = projector.texture;
    uniforms.projectorMatrix.value = projector.projectorMatrix;
    uniforms.projectOnBackfaces.value = !!projector.getUnrealScriptProperty("bProjectOnBackfaces");
    uniforms.materialBlending.value = projector.getUnrealScriptProperty("MaterialBlendingOp");
    material.uniformsNeedUpdate = true;
    return uniforms;
}

function projectorDefines(blend: EProjectorBlending_T): Record<string, string | number> {
    const defines: Record<string, string | number> = { ...BLEND_DEFINES };
    if (blend === EProjectorBlending_T.PB_AlphaBlend) defines.PROJECTOR_ALPHA = "";
    else if (blend === EProjectorBlending_T.PB_Add) defines.PROJECTOR_ADD = "";
    return defines;
}

function projectorBlending(blend: EProjectorBlending_T) {
    const alpha = blend === EProjectorBlending_T.PB_AlphaBlend, add = blend === EProjectorBlending_T.PB_Add;
    return { transparent: true, depthFunc: EqualDepth, depthWrite: false, blending: CustomBlending,
        blendSrc: alpha ? SrcAlphaFactor : add ? OneFactor : DstColorFactor,
        blendDst: alpha ? OneMinusSrcAlphaFactor : add ? OneFactor : SrcColorFactor,
        blendSrcAlpha: ZeroFactor, blendDstAlpha: OneFactor };
}

function setPlanes(planes: Vector4[], projector: Projector): void {
    for (let plane = 0; plane < 6; plane++) {
        const { normal, constant } = projector.planes[plane];
        planes[plane].set(normal.x, normal.y, normal.z, constant);
    }
}

function intersectsPlanes(projector: Projector, min: Vector3, max: Vector3): boolean {
    for (const { normal, constant } of projector.planes)
        if (normal.x * (normal.x < 0 ? max.x : min.x) + normal.y * (normal.y < 0 ? max.y : min.y) + normal.z * (normal.z < 0 ? max.z : min.z) + constant > 0) return false;
    return true;
}

function getProjectionCache<T extends BspProjection_T>(receivers: WeakMap<BufferGeometry, Map<Projector, T>>, geometry: BufferGeometry): Map<Projector, T> {
    let cache = receivers.get(geometry);
    if (!cache) {
        cache = new Map();
        receivers.set(geometry, cache);
        const dispose = () => {
            for (const projection of cache.values()) disposeReceiver(projection.geometry);
            receivers.delete(geometry);
            geometry.removeEventListener("dispose", dispose);
        };
        geometry.addEventListener("dispose", dispose);
    }
    return cache;
}

function makeReceiver(source: BufferGeometry, indices: number[]): BufferGeometry {
    const receiver = new BufferGeometry();
    receiver.setIndex(indices);
    receiver.setAttribute("position", source.getAttribute("position"));
    receiver.setAttribute("normal", source.getAttribute("normal"));
    if (source.hasAttribute("color")) receiver.setAttribute("color", source.getAttribute("color"));
    if (!source.boundingSphere) source.computeBoundingSphere();
    receiver.boundingSphere = source.boundingSphere;
    return receiver;
}

function disposeReceiver(receiver: BufferGeometry): void {
    receiver.deleteAttribute("position");
    receiver.deleteAttribute("normal");
    receiver.deleteAttribute("color");
    receiver.dispose();
}

function findTriangle(triangles: number[], offset: number): number {
    let low = 0, high = triangles.length;
    while (low < high) {
        const mid = (low + high) >>> 1;
        if (triangles[mid] < offset) low = mid + 1;
        else high = mid;
    }
    return low;
}

export default ProjectorRenderer;
