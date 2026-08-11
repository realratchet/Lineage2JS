import DynamicLight from "@client/objects/dynamic-light";
import type { L2Environment } from "@client/rendering/l2-env";
import { Box3, Color, Fog, Object3D, Sphere, Vector3, Vector4, Mesh, Quaternion, BufferGeometry, Material } from "three";
import type { Terrain } from "@client/objects/terrain";
import type { TerrainDecoration } from "@client/objects/terrain-decoration";
import { encompassesVolume } from "@client/physics/volume-bsp";

import { ColorByte } from "@client/utils/color-byte";

const tmpColor = new Color();
const tmpColorByte = new ColorByte();
const tmpColorByte2 = new ColorByte();
const tmpVec3 = new Vector3();
const tmpVec4 = new Vector4();
const tmpSphere = new Sphere();
const tmpActorBox = new Box3();
const tmpEmitterBox = new Box3();
const arrLightSortKeys = new Float64Array(8);
const EMPTY_EMITTER_LIST: THREE.Object3D[] = [];
const TRANSPARENT_SORT_DISTANCE_SQ = 128 * 128;

// Portal recursion depth limit (matches UE2's MAX_RECURSION_DEPTH)
const MAX_RECURSION_DEPTH = 4;

type StaticMeshVisibilityEntry_T = { object: THREE.Object3D; uuid: string };
type BatchGroup_T = { start: number; count: number; materialIndex: number; distance: number; transparent: number };

function getTransparentLookup(object: any, transparentMaterials: Set<number>): Uint8Array {
    let lookup = object.transparentLookup as Uint8Array;
    if (lookup) return lookup;

    const allTransparent = (object.transparentMaterialIndexes as Set<number>) ?? transparentMaterials;

    lookup = object.transparentLookup = new Uint8Array(Array.isArray(object.material) ? object.material.length : 1);
    allTransparent.forEach(materialIndex => lookup[materialIndex] = 1);

    return lookup;
}

function rebuildBatchGroups(object: any, geometry: BufferGeometry, visibleGroups: BatchGroup_T[], transparentMaterials: Set<number>) {
    // same-object render items draw in insertion order, so transparent groups must interleave material indexes far->near
    const transparentLookup = getTransparentLookup(object, transparentMaterials);

    for (let i = 0, len = visibleGroups.length; i < len; i++) {
        const group = visibleGroups[i];
        group.transparent = transparentLookup[group.materialIndex];
    }

    visibleGroups.sort((a, b) => {
        if (a.transparent !== b.transparent) return a.transparent - b.transparent;
        if (a.transparent) return (b.distance - a.distance) || (a.materialIndex - b.materialIndex);

        return (a.materialIndex - b.materialIndex) || (a.start - b.start);
    });
    geometry.clearGroups();

    const index = geometry.index;
    const source = (object as any).batchIndices as Uint8Array | Uint16Array | Uint32Array | null;

    if (!index || !source) {
        let run: BatchGroup_T = null;

        for (const group of visibleGroups) {
            if (run && run.materialIndex === group.materialIndex && run.start + run.count === group.start) {
                run.count += group.count;
            } else {
                if (run) geometry.addGroup(run.start, run.count, run.materialIndex);
                run = { ...group };
            }
        }

        if (run) geometry.addGroup(run.start, run.count, run.materialIndex);
        return;
    }

    const target = index.array as Uint8Array | Uint16Array | Uint32Array;
    let offset = 0;
    let run: BatchGroup_T = null;

    for (const group of visibleGroups) {
        target.set(source.subarray(group.start, group.start + group.count), offset);

        if (run && run.materialIndex === group.materialIndex) {
            run.count += group.count;
        } else {
            if (run) geometry.addGroup(run.start, run.count, run.materialIndex);
            run = { start: offset, count: group.count, materialIndex: group.materialIndex, distance: group.distance, transparent: group.transparent };
        }

        offset += group.count;
    }

    if (run) geometry.addGroup(run.start, run.count, run.materialIndex);

    index.updateRange.offset = 0;
    index.updateRange.count = offset;
    index.needsUpdate = true;
}

export class FogInfoObject extends Object3D {
    public readonly isFogInfo = true;
    public affectRange: { A: number, B: number };
    public fogRange1: { A: number, B: number };
    public fogRange2: { A: number, B: number };
    public fogRange3: { A: number, B: number };
    public fogRange4: { A: number, B: number };
    public fogRange5: { A: number, B: number };
    public colors: any[];
    public zoneMask: bigint = 0n;
}


interface IStaticMeshActorDecodeInfo {
    uuid: string;
    type: "StaticMeshActor";
    zoneMask: bigint; // Added for conservative culling
    dontBatch?: boolean;
    bounds: {
        min: number[];
        max: number[];
    };
}

class ZoneObject extends Object3D {
    public fog: Fog = null;
    public isFogZone: boolean = false;
    public isSunAffected: boolean = false;
    public isSkyZoneInfo: boolean = false;

    public readonly boundsRender = new Box3();
    public readonly boundsRenderSphere = new Sphere();

    public readonly isCullable: boolean = true;
    public readonly isZoneObject = true;
    public readonly type: "Zone" | "Sector" | "Sky" = "Zone";

    public setRenderBounds(min: GD.Vector3Arr, max: GD.Vector3Arr): this {

        this.boundsRender.min.fromArray(min);
        this.boundsRender.max.fromArray(max);
        this.boundsRender.getBoundingSphere(this.boundsRenderSphere);

        return this;
    }

    public setFogInfo(start: number, end: number, color: GD.ColorArr): this {
        this.fog = new Fog(tmpColor.fromArray(color), start, end);

        return this;
    }

    // public update(enableZoneCulling: boolean, frustum: THREE.Frustum) {
    //     if (this.isCullable && enableZoneCulling && !frustum.intersectsSphere(this.boundsRenderSphere)) {
    //         this.children = [];
    //         return false;
    //     }

    //     this.children = this.childObjects;
    //     this.childZones.forEach(z => z.update(enableZoneCulling, frustum));

    //     return true;
    // }
}

export interface ILightInfo {
    uuid: string;
    type: "Light" | "Sunlight";
    name: string;



    position: Vector3,
    quaternion: Quaternion,

    isDynamic: boolean,
    color: Color,
    radius: number,
    isDirectional: boolean,
    lightType: GA.LightType_T,
    lightEffect: GA.LightEffect_T,
    cone: number
}

class SectorObject extends Object3D {
    public readonly isSectorObject = true;
    public readonly type = "Sector";
    public neverUnload = false; // exempt from distance-based unloading (setAlwaysLoaded)
    public scriptVM: import("@client/assets/unreal/un-script-vm").default;
    public readonly zones = new Object3D();
    public readonly helpers = new Object3D();
    public readonly pawns = new Object3D(); // players/mobs - scene-graph home only, visibility resolved live (RenderManager.updatePawnVisibility)
    public readonly fogInfos: FogInfoObject[] = [];

    public bspZones: BSPZoneData[];
    public bspNodes: BSPNodeData[];
    public bspLeaves: BSPLeafData[];
    public index: THREE.Vector2;
    public sunTexture: any; // MapData_T - texture with size info
    public celestials: { type: string; sprite: any; material: Material | Material[]; data: any }[] = []; // Decoded celestial data with textures
    public brightness: number = 1.0;
    public lastZoneMask: bigint = 0n;
    public readonly worldBounds = new Box3();
    public readonly gridBounds = new Box3();

    // NEW: Precise Geometric volumes for runtime intersection
    public musicVolumes?: GD.IMusicVolumeDecodeInfo[];
    public waterVolumes?: GD.IWaterVolumeDecodeInfo[];
    public ambientSounds?: GD.IAmbientSoundObjectDecodeInfo[];

    // NEW: BSP rendering data
    public bspSections?: GD.IBSPSectionDecodeInfo_T[];
    public nodeToSection?: number[];
    public nodeZoneMasks?: bigint[];
    public bspGroup?: THREE.Group;
    public staticMeshGroup?: THREE.Group;
    public staticMeshMap: Map<string, THREE.Object3D> = new Map();
    // rebuilt each updateVisibility call; render-manager's Pass 2 checks membership directly
    public visibleEmitterUuids: Set<string> = new Set();
    // rebuilt each updateVisibility call; render-manager's Pass 2 leaf-checks live pawn positions against it
    public visibleLeaves: Set<number> = new Set();
    public readonly lights: Record<string, DynamicLight> = {};
    public readonly lightList: DynamicLight[] = [];
    // everything this sector counts a reference on, see RenderManager's retainSectorResources
    public readonly retainedResources = new Set<{ dispose(): void }>();

    public outdoorZoneMask: bigint = 1n << 1n; // sun-affected zones, visible from outside the sector

    // per-frame caches, both derive from data that is static after decode
    protected terrainRenderables?: { batches: THREE.Mesh[], standalone: any[], decorations: Map<string, TerrainDecoration[]> };
    protected staticMeshVisibilityEntries?: StaticMeshVisibilityEntry_T[];
    protected readonly candidateStaticActorUuids = new Set<string>();
    protected readonly visibleStaticActorUuids = new Set<string>();
    protected readonly visibleStaticActorDistances = new Map<string, number>();
    protected topLevelBSPResult?: { visibleNodes: Set<number>, visibleLeaves: Set<number>, finalZoneMask: bigint, zonesAddedThroughPortals: Set<number> };
    protected visibilityCacheInitialized = false;
    protected readonly visibilityCachePosition = new Vector3();
    protected readonly visibilityCachePlanes = new Float64Array(24);
    protected visibilityCacheFrustumCulling = true;
    protected visibilityCacheTopLevelOnly = false;
    protected visibilityCacheDistanceSq = Infinity;
    protected visibilityCacheEmitterDistanceSq = Infinity;
    protected visibilityCacheEnvVersion = -1;
    protected visibilityCacheTimeStep = -1;
    protected _lastLoggedStaticMeshLeaf: number | null = null;

    // Internal state for zone/leaf change tracking
    private _lastLoggedZone: number | null = null;
    private _lastLoggedLeaf: number | null = null;

    public setLights(lights: DynamicLight[]): this {
        for (const light of lights) {
            this.lights[light.name] = light;
            this.lightList.push(light);
        }

        return this;
    }

    // Resolve session-scoped blob URLs here instead of baking stale decode-time URLs.
    public getSoundUri(soundName: string): string {
        const entry = (this as any).decodeLibrary?.soundBlobCache?.get(soundName);

        if (!entry?.uri) throw new Error(`Sector '${this.name}' has no decoded sound '${soundName}'.`);

        return entry.uri;
    }

    // GetRelevantLights, UnRenderVisibility.cpp line 439: Consider only contains zone-relevant lights.
    public getRelevantLights(position: THREE.Vector3, radius: number, target: DynamicLight[], maxLights: number, allowSunlight: boolean): DynamicLight[] {
        target.length = 0;

        for (const light of this.lightList) {
            if (light.isSunlight && !allowSunlight) continue;

            const key = light.getSortKey(position, radius);

            if (key <= 0) continue;
            if (target.length === maxLights && key <= arrLightSortKeys[maxLights - 1]) continue;

            let index = Math.min(target.length, maxLights - 1);

            while (index > 0 && arrLightSortKeys[index - 1] < key) {
                target[index] = target[index - 1];
                arrLightSortKeys[index] = arrLightSortKeys[index - 1];
                index--;
            }

            target[index] = light;
            arrLightSortKeys[index] = key;

            if (target.length > maxLights) target.length = maxLights;
        }

        return target;
    }

    public constructor() {
        super();

        this.helpers.name = "SectorHelpers";
        this.zones.name = "SectorZones";
        this.pawns.name = "SectorPawns";

        this.add(this.helpers, this.zones, this.pawns);
    }

    public setBSPInfo(bspZones: GD.IBSPZoneDecodeInfo_T[], bspNodes: GD.IBSPNodeDecodeInfo_T[], bspLeaves: GD.IBSPLeafDecodeInfo_T[]) {
        this.bspZones = bspZones.map(BSPZoneData.fromInfo);
        this.bspNodes = bspNodes.map(BSPNodeData.fromInfo);
        this.bspLeaves = bspLeaves.map(BSPLeafData.fromInfo);

        // outdoor = sun-affected zone (zone 0 is the LevelInfo zone), this is what a
        // camera standing outside the sector can see into
        let outdoorMask = 1n << 0n;

        this.bspZones.forEach((zone, index) => {
            if (index === 0 || zone.zoneInfo?.isSunAffected) outdoorMask |= 1n << BigInt(index);
        });

        // no flags at all -> fall back to the old zone 1 heuristic
        if (outdoorMask === (1n << 0n)) outdoorMask |= 1n << 1n;

        this.outdoorZoneMask = outdoorMask;
    }

    protected cacheSectionZoneAmbient = new Map<number, ColorByte | null>();

    // retail clears BSP lightmaps to zone ambient * 0.5 before accumulating light (0x908c80, zone FGetHSV bytes at [zone+0x3E0])
    public getSectionZoneAmbient(sectionIndex: number): ColorByte | null {
        if (this.cacheSectionZoneAmbient.has(sectionIndex)) return this.cacheSectionZoneAmbient.get(sectionIndex);

        let r = 0, g = 0, b = 0;
        const nodeIndices = (this.bspSections?.[sectionIndex] as any)?.nodeIndices;

        if (nodeIndices && this.bspZones) {
            for (const ni of nodeIndices) {
                const node = this.bspNodes[ni];
                if (!node) continue;

                for (const zi of node.zones) {
                    if (!zi) continue;

                    const amb = this.bspZones[zi]?.zoneInfo?.ambient;
                    if (!amb) continue;

                    r = Math.max(r, amb[0]);
                    g = Math.max(g, amb[1]);
                    b = Math.max(b, amb[2]);
                }
            }
        }

        const color = r || g || b ? new ColorByte(r >> 1, g >> 1, b >> 1) : null;
        this.cacheSectionZoneAmbient.set(sectionIndex, color);
        return color;
    }

    public findPositionZone(position: THREE.Vector3) {
        if (this.bspNodes.length === 0) return null;

        const findZonePosition = tmpVec4.set(position.x, position.y, position.z, -1);

        let nodeIndex = 0;
        let node: BSPNodeData;
        let side = 0;

        while (true) {
            node = this.bspNodes[nodeIndex];
            const plane = node.plane;
            side = findZonePosition.dot(plane);

            if (node.front >= 0 && side >= 0) nodeIndex = node.front;
            else if (node.back >= 0 && side < 0) nodeIndex = node.back;
            else {
                break;
            }
        }

        const foundZone = side >= 0 ? node.zones[1] : node.zones[0];

        return foundZone;
    }

    /**
     * Find the leaf index for a given position (used for PVS lookup)
     */
    public findPositionLeaf(position: THREE.Vector3): number | null {
        if (this.bspNodes.length === 0) return null;

        const findZonePosition = tmpVec4.set(position.x, position.y, position.z, -1);

        let nodeIndex = 0;
        let node: BSPNodeData;

        while (true) {
            node = this.bspNodes[nodeIndex];
            const plane = node.plane;
            const side = findZonePosition.dot(plane);

            if (node.front >= 0 && side >= 0) {
                nodeIndex = node.front;
            } else if (node.back >= 0 && side <= 0) {
                nodeIndex = node.back;
            } else {
                // We've reached a leaf node
                const candidateLeaf = side >= 0 ? node.leaves[1] : node.leaves[0];
                if (candidateLeaf >= 0 && candidateLeaf < this.bspLeaves.length) {
                    return candidateLeaf;
                } else {
                    // Try the other leaf as fallback
                    const fallbackLeaf = side >= 0 ? node.leaves[0] : node.leaves[1];
                    if (fallbackLeaf >= 0 && fallbackLeaf < this.bspLeaves.length) {
                        return fallbackLeaf;
                    }
                }
                return null;
            }
        }
    }

    public setSun(sunMaterial: any) { this.sunTexture = sunMaterial; }

    public getMusicIdAt(cameraPosition: THREE.Vector3): { musicId: number | null, isLooped: boolean, isForced: boolean } {
        let highestPriority = -9999;
        let selectedMusicId: number | null = null;
        let isLooped = false, isForced = false;
        
        if (this.musicVolumes) {
            for (const vol of this.musicVolumes) {
                if (vol.priority < highestPriority) continue;

                if (encompassesVolume(cameraPosition, vol.bsp)) {
                    highestPriority = vol.priority;
                    selectedMusicId = vol.musicId;
                    isLooped = vol.isMusicLooped;
                    isForced = vol.isMusicForced;
                }
            }
        }

        return { musicId: selectedMusicId, isLooped, isForced };
    }

    public getWaterVolumeAt(position: THREE.Vector3): GD.IWaterVolumeDecodeInfo | null {
        let selected: GD.IWaterVolumeDecodeInfo = null;

        if (!this.waterVolumes) return selected;

        for (const volume of this.waterVolumes) {
            if (selected && volume.priority < selected.priority) continue;
            if (encompassesVolume(position, volume.bsp)) selected = volume;
        }

        return selected;
    }

    /**
     * Find camera leaf and build active zone mask.
     * Uses connectivity to constrain PVS - only zones that are both visible (PVS) AND connected are included.
     * Returns the active zone mask bitmask.
     */
    public getActiveZoneMask(cameraPosition: THREE.Vector3): bigint {
        if (this.bspNodes.length === 0 || !this.bspLeaves) {
            // Default to all zones if we can't determine
            return (1n << 64n) - 1n;
        }

        const findZonePosition = tmpVec4.set(cameraPosition.x, cameraPosition.y, cameraPosition.z, -1);
        let nodeIndex = 0;
        let leafIndex: number | null = null;
        let node: BSPNodeData;

        // Traverse BSP to find camera leaf
        while (true) {
            node = this.bspNodes[nodeIndex];
            const plane = node.plane;
            const side = findZonePosition.dot(plane);

            if (node.front >= 0 && side >= 0) {
                nodeIndex = node.front;
            } else if (node.back >= 0 && side <= 0) {
                nodeIndex = node.back;
            } else {
                // We've reached a leaf node
                const candidateLeaf = side >= 0 ? node.leaves[1] : node.leaves[0];
                if (candidateLeaf >= 0 && candidateLeaf < this.bspLeaves.length) {
                    leafIndex = candidateLeaf;
                } else {
                    // Try the other leaf as fallback
                    const fallbackLeaf = side >= 0 ? node.leaves[0] : node.leaves[1];
                    if (fallbackLeaf >= 0 && fallbackLeaf < this.bspLeaves.length) {
                        leafIndex = fallbackLeaf;
                    }
                }
                break;
            }
        }

        // Get camera zone
        const cameraZone = leafIndex !== null && leafIndex >= 0 && leafIndex < this.bspLeaves.length
            ? this.bspLeaves[leafIndex].zone
            : this.findPositionZone(cameraPosition);

        if (cameraZone === null || cameraZone < 0) {
            return (1n << 64n) - 1n; // All zones if we can't determine
        }

        // Start with just the camera zone (matches UE2 behavior when PVS isn't usable)
        const cameraZoneBit = 1n << BigInt(cameraZone);
        let activeZoneMask = cameraZoneBit;

        // Get connectivity for camera zone to constrain visibility
        let cameraConnectivity: bigint | null = null;
        if (this.bspZones && cameraZone >= 0 && cameraZone < this.bspZones.length) {
            const zoneData = this.bspZones[cameraZone];
            if (zoneData && zoneData.connectivity) {
                cameraConnectivity = zoneData.connectivity;
            }
        }

        // intersect PVS with connectivity, but invalid PVS (all zones or zero) must not fall back to connectivity - reachability is not visibility
        if (leafIndex !== null && leafIndex >= 0 && leafIndex < this.bspLeaves.length) {
            const leaf = this.bspLeaves[leafIndex];
            const pvsMask = leaf.visibleZones;

            // If PVS is valid (not all zones or zero), intersect with connectivity
            if (pvsMask && pvsMask !== 0n && pvsMask !== (1n << 64n) - 1n) {
                if (cameraConnectivity !== null) {
                    // Only include zones that are both in PVS AND connected
                    activeZoneMask = pvsMask & cameraConnectivity;
                } else {
                    // No connectivity data, use PVS as-is
                    activeZoneMask = pvsMask;
                }
                // Always ensure camera zone is included
                activeZoneMask |= cameraZoneBit;
            }
        }

        // portals add more zones during traverseBSP, expansion is also constrained to connectivity

        return activeZoneMask;
    }

    /**
     * Recursively process a coplanar node (matching UE2's ProcessNode recursion for iPlane).
     * This processes the coplanar node immediately during PASS_Plane, after portals have expanded.
     */

    /**
     * Traverse BSP tree from camera position using Unified Traversal (Near -> Plane -> Far).
     * Used for both Geometry and Actor visibility.
     * 
     * Logic matches UE2's RenderBSPNode + ProcessNode:
     * - Traverses Front-to-Back (Near child first, then Node, then Far child)
     * - Node pass handles Portals and Coplanar nodes
     * - Collects visible nodes (for geometry sections)
     * - Collects visible leaves (for actors)
     * - Updates Zone Mask dynamically based on Portals
     * - Limits portal recursion depth to MAX_RECURSION_DEPTH (matches UE2)
     * 
     * @param leafOnlyMode If true, only render leaf 1 (no portal expansion, no traversal)
     */
    public traverseBSP(
        cameraPosition: THREE.Vector3,
        activeZoneMask: bigint,
        cameraFrustum: THREE.Frustum,
        frustumCullingEnabled: boolean = true,
        recursionDepth: number = 0,
        leafOnlyMode: boolean = false,
        topLevelOnly: boolean = false
    ): { visibleNodes: Set<number>, visibleLeaves: Set<number>, finalZoneMask: bigint, zonesAddedThroughPortals: Set<number> } {
        const visibleNodes = new Set<number>();
        const visibleLeaves = new Set<number>();

        if (this.bspNodes.length === 0 || !this.nodeZoneMasks) {
            this.lastZoneMask = activeZoneMask;
            return { visibleNodes, visibleLeaves, finalZoneMask: activeZoneMask, zonesAddedThroughPortals: new Set<number>() };
        }

        // top-level only mode: only render outdoor zones/sections
        if (topLevelOnly) {
            // camera-independent, cache it - consumers never mutate the sets
            if (this.topLevelBSPResult) return this.topLevelBSPResult;

            // Find nodes that belong to outdoor sections
            for (let nodeIndex = 0; nodeIndex < this.bspNodes.length; nodeIndex++) {
                const sectionIndex = this.nodeToSection ? this.nodeToSection[nodeIndex] : -1;
                if (sectionIndex >= 0) {
                    const sectionInfo = this.bspSections ? this.bspSections[sectionIndex] as any : null;
                    if (sectionInfo?.isOutdoor) {
                        visibleNodes.add(nodeIndex);
                    }
                } else if (this.nodeZoneMasks) {
                    // Fallback to the outdoor zones if section info is missing
                    if (this.nodeZoneMasks[nodeIndex] & this.outdoorZoneMask) {
                        visibleNodes.add(nodeIndex);
                    }
                }
            }

            // leaves in any sun-affected zone count as outdoor, zone 1 alone hides
            // actors of the other outdoor zones (e.g. bee hives of 20_23 seen from dion)
            if (this.bspLeaves) {
                for (let leafIndex = 0; leafIndex < this.bspLeaves.length; leafIndex++) {
                    const zone = this.bspLeaves[leafIndex].zone;

                    if (zone >= 0 && (this.outdoorZoneMask & (1n << BigInt(zone))))
                        visibleLeaves.add(leafIndex);
                }
            }
            return this.topLevelBSPResult = { visibleNodes, visibleLeaves, finalZoneMask: this.outdoorZoneMask, zonesAddedThroughPortals: new Set<number>() };
        }

        // Leaf-only mode: only render leaf 1 (no portal expansion, no traversal)
        if (leafOnlyMode) {
            if (this.bspLeaves && this.bspLeaves.length > 1) {
                const leaf1 = this.bspLeaves[1];
                if (leaf1 && leaf1.zone >= 0) {
                    visibleLeaves.add(1);
                    // Find nodes that reference leaf 1 for geometry visibility
                    for (let nodeIndex = 0; nodeIndex < this.bspNodes.length; nodeIndex++) {
                        const node = this.bspNodes[nodeIndex];
                        if ((node.leaves[0] === 1 || node.leaves[1] === 1) && this.nodeToSection && this.nodeToSection[nodeIndex] !== undefined && this.nodeToSection[nodeIndex] >= 0) {
                            visibleNodes.add(nodeIndex);
                        }
                    }
                }
            }
            return { visibleNodes, visibleLeaves, finalZoneMask: activeZoneMask, zonesAddedThroughPortals: new Set<number>() };
        }

        const cameraPos = tmpVec4.set(cameraPosition.x, cameraPosition.y, cameraPosition.z, -1);
        let currentZoneMask = activeZoneMask;

        const cameraZone = this.findPositionZone(cameraPosition);
        const hasViewZone = cameraZone !== null && cameraZone >= 0;

        // Track which zones were added at which recursion depth (for portal limiting)
        const zoneDepthMap = new Map<number, number>();
        // Track which zones were added through portals (not in initial mask)
        const zonesAddedThroughPortals = new Set<number>();
        // Initialize with starting zones at depth 0
        for (let i = 0; i < 64; i++) {
            if (currentZoneMask & (1n << BigInt(i))) {
                zoneDepthMap.set(i, recursionDepth);
            }
        }

        // Stack-based traversal
        // Order we want to PROCESS: Near -> Plane -> Far
        // Order we must PUSH to stack (LIFO): Far -> Plane -> Near
        const nodeStack: { nodeIndex: number; pass: "front" | "plane" }[] = [];
        nodeStack.push({ nodeIndex: 0, pass: "front" });

        while (nodeStack.length > 0) {
            const { nodeIndex, pass } = nodeStack.pop()!;
            const node = this.bspNodes[nodeIndex];

            if (pass === "front") {
                // zone mask culling
                const nodeZoneMask = this.nodeZoneMasks[nodeIndex];
                if (hasViewZone && nodeZoneMask && nodeZoneMask !== 0n && currentZoneMask !== 0n) {
                    if (!(nodeZoneMask & currentZoneMask)) {
                        continue;
                    }
                }

                // bounding box portal visibility (UE2: UnRenderVisibility.cpp lines 1800-1819)
                // UE2: Model->Bounds(Node.iRenderBound), precomputed bounds come from library.bspRenderBounds (populated from this.bounds in un-model.ts)
                // requires bspGroup - section-free sectors only get the degenerate world-hull box, which would wrongly cull every leaf
                const library = (this as any).decodeLibrary as GD.DecodeLibrary;
                if (hasViewZone && this.bspGroup && node.iRenderBound !== undefined && node.iRenderBound >= 0 && library?.bspRenderBounds) {
                    const renderBound = library.bspRenderBounds[node.iRenderBound];
                    if (renderBound && renderBound.isValid) {
                        // UE2: Check if bounding box is visible through portals for any active zone
                        // UE2 logic: (Node.ZoneMask & ZoneBit) && RenderState.Zones[Zone->Element].Visible(BoundingBox)
                        let boxVisible = false;
                        for (let zoneIndex = 0; zoneIndex < 64; zoneIndex++) {
                            const zoneBit = 1n << BigInt(zoneIndex);
                            if (currentZoneMask & zoneBit) {
                                // Check if this zone is in the node's zone mask (UE2: Node.ZoneMask & ZoneBit)
                                if (nodeZoneMask && (nodeZoneMask & zoneBit)) {
                                    // UE2: RenderState.Zones[Zone->Element].Visible(BoundingBox)
                                    // This checks if bounding box intersects portal volumes for this zone
                                    // For now, use frustum check as proxy (TODO: implement proper portal volume checks)
                                    // Create Box3 from precomputed bounds (bounds are already swizzled to Three.js coords)
                                    const box = new Box3(
                                        new Vector3(...renderBound.min),
                                        new Vector3(...renderBound.max)
                                    );
                                    if (!frustumCullingEnabled || cameraFrustum.intersectsBox(box)) {
                                        boxVisible = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (!boxVisible) {
                            continue; // Cull this subtree - bounding box not visible through portals (matches UE2)
                        }
                    }
                }

                const planeDot = cameraPos.dot(node.plane);
                const isFront = planeDot >= 0;

                const farChild = isFront ? node.back : node.front;
                const nearChild = isFront ? node.front : node.back;

                // Leaves: [0]=Back, [1]=Front
                const farLeafIndex = isFront ? node.leaves[0] : node.leaves[1];
                const nearLeafIndex = isFront ? node.leaves[1] : node.leaves[0];

                // --- PUSH Far (Processed Last) ---
                if (farChild >= 0) {
                    nodeStack.push({ nodeIndex: farChild, pass: "front" });
                } else {
                    // Add leaf as candidate - will be filtered at end based on finalZoneMask
                    // We can't check zone mask here because portals update the mask during traversal
                    if (farLeafIndex >= 0 && farLeafIndex < (this.bspLeaves?.length || 0)) {
                        const leaf = this.bspLeaves[farLeafIndex];
                        // Add as candidate - filtering happens at end based on finalZoneMask
                        if (leaf && leaf.zone >= 0) {
                            visibleLeaves.add(farLeafIndex);
                        }
                    }
                }

                // --- PUSH Plane (Processed Middle) ---
                nodeStack.push({ nodeIndex: nodeIndex, pass: "plane" });

                // --- PUSH Near (Processed First) ---
                if (nearChild >= 0) {
                    nodeStack.push({ nodeIndex: nearChild, pass: "front" });
                } else {
                    // Add leaf as candidate - will be filtered at end based on finalZoneMask
                    // We can't check zone mask here because portals update the mask during traversal
                    if (nearLeafIndex >= 0 && nearLeafIndex < (this.bspLeaves?.length || 0)) {
                        const leaf = this.bspLeaves[nearLeafIndex];
                        // Add as candidate - filtering happens at end based on finalZoneMask
                        if (leaf && leaf.zone >= 0) {
                            visibleLeaves.add(nearLeafIndex);
                        }
                    }
                }

            } else { // pass === "plane"
                // Process Node and its Coplanar chain
                let current: number = nodeIndex;

                // Iterate through coplanar list (ProcessNode recursion in UE2)
                while (current >= 0) {
                    const currentNode = this.bspNodes[current];

                    // Portal Processing
                    const PF_Portal = 0x04000000;

                    const nodeZone0 = currentNode.zones[0];
                    const nodeZone1 = currentNode.zones[1];
                    const hasPortalFlag = currentNode.surfFlags !== undefined && (currentNode.surfFlags & PF_Portal) !== 0;

                    if (hasViewZone && hasPortalFlag && nodeZone0 >= 0 && nodeZone1 >= 0 && nodeZone0 !== nodeZone1) {
                        // Determine side for this specific node (coplanar nodes share plane, so same dot sign usually)
                        // But standard says use the node's own plane slightly? No, they are coplanar.
                        // However, we just need to know which zone is "opposite".
                        // For portal nodes, usually the "Front" or "Back" zone logic applies.
                        // In traverseBSP we re-calculated dot.
                        const planeDot = cameraPos.dot(currentNode.plane);
                        const isFront = planeDot >= 0;

                        const currentZone = isFront ? nodeZone1 : nodeZone0; // Zone we're currently in
                        const oppositeZone = isFront ? nodeZone0 : nodeZone1; // [0]=Back, [1]=Front

                        // CRITICAL: Only process portal if its current zone is in the active zone mask
                        // This ensures portals are only considered when their zone is actually visible
                        const currentZoneBit = 1n << BigInt(currentZone);
                        const isCurrentZoneActive = !!(currentZoneBit & currentZoneMask);

                        // UE2 portal recursion limit: Recursion < MAX_RECURSION_DEPTH - 1
                        // This means we can see through portals up to depth 3 (0-indexed: 0, 1, 2, 3)
                        // Total of 4 levels: initial zone (0) + 3 portal hops (1, 2, 3)

                        // Distance-based portal culling: don't expand through portals that are too far away
                        // This prevents performance issues when hub zones (like zone 2) connect to many distant zones
                        // Portal sphere radius is typically 200-400 units, so 5000 units is a reasonable limit
                        const PORTAL_MAX_DISTANCE = 5000;
                        const portalSphere = currentNode.exclusiveSphereBound;
                        const portalDistance = cameraPosition.distanceTo(portalSphere.center);
                        const isPortalInRange = portalDistance <= (PORTAL_MAX_DISTANCE + portalSphere.radius);

                        const portalVisible = isCurrentZoneActive &&
                            isPortalInRange &&
                            (!frustumCullingEnabled || cameraFrustum.intersectsSphere(portalSphere));

                        // Skip portal expansion in leaf-only mode
                        if (leafOnlyMode) {
                            // Don't expand portals when camera is outside sector
                        } else if (portalVisible && oppositeZone >= 0 && oppositeZone < 64) {
                            // Check if opposite zone is already in the mask (avoid redundant work)
                            const alreadyAdded = !!(currentZoneMask & (1n << BigInt(oppositeZone)));

                            if (!alreadyAdded) {
                                // ue2 bases new-zone recursion depth on the *current* zone's depth, min-depth across active zones would flatten multi-portal chains to depth 1
                                const sourceDepth = zoneDepthMap.get(currentZone) ?? recursionDepth;

                                // connectivity is per-zone, expand only into connected zones
                                let isConnected = true;
                                if (this.bspZones && currentZone >= 0 && currentZone < this.bspZones.length) {
                                    const zoneData = this.bspZones[currentZone];
                                    if (zoneData && zoneData.connectivity) {
                                        isConnected = !!(zoneData.connectivity & (1n << BigInt(oppositeZone)));
                                    }
                                }

                                if (isConnected) {
                                    // Calculate new recursion depth for the portal expansion
                                    const newDepth = sourceDepth + 1;

                                    // UE2 check: Recursion < MAX_RECURSION_DEPTH - 1
                                    // This means newDepth must be < MAX_RECURSION_DEPTH (i.e., <= MAX_RECURSION_DEPTH - 1)
                                    if (newDepth < MAX_RECURSION_DEPTH) {
                                        currentZoneMask |= (1n << BigInt(oppositeZone));
                                        zoneDepthMap.set(oppositeZone, newDepth);
                                        // Track that this zone was added through a portal
                                        zonesAddedThroughPortals.add(oppositeZone);
                                    }
                                }
                            }
                        }
                    }

                    // Frustum Culling & Visibility
                    let isInFrustum = true;
                    if (frustumCullingEnabled) {
                        isInFrustum = cameraFrustum.intersectsSphere(currentNode.exclusiveSphereBound);
                    }

                    if (isInFrustum && this.nodeToSection && this.nodeToSection[current] !== undefined && this.nodeToSection[current] >= 0) {
                        visibleNodes.add(current);
                    }

                    // Next coplanar node
                    current = currentNode.iPlane;
                }
            }
        }

        // CRITICAL FIX: Filter visibleLeaves to only include leaves whose zones are in the final zone mask.
        // Additionally, for zones added through portals, we need to ensure the portal is still visible.
        // This ensures that leaves behind portals that became invisible are properly culled.
        // In UE2, this check happens during ProcessLeaf via RenderState.Zones[iZone].Visible(),
        // but we need to do it here since we collect leaves during traversal.
        const filteredVisibleLeaves = new Set<number>();
        for (const leafIndex of visibleLeaves) {
            if (leafIndex >= 0 && leafIndex < (this.bspLeaves?.length || 0)) {
                const leaf = this.bspLeaves[leafIndex];
                if (leaf && leaf.zone >= 0) {
                    const leafZoneBit = 1n << BigInt(leaf.zone);
                    const isZoneInMask = !!(leafZoneBit & currentZoneMask);

                    // Only include leaf if its zone is in the final zone mask
                    // If the zone was added through a portal, it's already been validated as visible
                    // (zonesAddedThroughPortals only contains zones added through visible portals)
                    if (isZoneInMask) {
                        // Zone is in mask - check if it was added through a portal
                        // If it was, it's already validated. If not, it's the camera zone (always visible)
                        filteredVisibleLeaves.add(leafIndex);
                    }
                }
            }
        }

        this.lastZoneMask = currentZoneMask;
        return { visibleNodes, visibleLeaves: filteredVisibleLeaves, finalZoneMask: currentZoneMask, zonesAddedThroughPortals };
    }



    /**
     * Update visible BSP sections based on camera position.
     * Only sections containing visible nodes will be rendered.
     */
    public updateVisibleBSPSections(cameraPosition: THREE.Vector3, cameraFrustum: THREE.Frustum, frustumCullingEnabled: boolean = true) {
        if (!this.bspGroup || !this.bspSections || !this.nodeToSection) return;

        // Check if camera is within this sector (by finding valid leaf)
        const cameraLeaf = this.findPositionLeaf(cameraPosition);
        const isCameraInSector = cameraLeaf !== null && cameraLeaf >= 0;

        // Hide helpers when camera is outside sector
        this.helpers.visible = isCameraInSector;

        // If camera is outside sector, only render leaf 1 (no portal expansion)
        const leafOnlyMode = !isCameraInSector;

        // Find active zone mask and camera zone (from leaf for reliability)
        const activeZoneMask = leafOnlyMode ? this.outdoorZoneMask : this.getActiveZoneMask(cameraPosition); // outdoor zones if camera is outside the bsp

        // Get camera zone from leaf (more reliable than findPositionZone)
        let currentZone: number | null = null;
        const leafIndex = this.findPositionLeaf(cameraPosition);
        if (leafIndex !== null && leafIndex >= 0 && leafIndex < this.bspLeaves.length) {
            currentZone = this.bspLeaves[leafIndex].zone;
        }
        // Fallback to findPositionZone if leaf lookup fails
        if (currentZone === null || currentZone < 0) {
            currentZone = this.findPositionZone(cameraPosition);
        }

        // Log zone/leaf changes (only when they actually change)
        const zoneChanged = currentZone !== null && currentZone >= 0 && (this._lastLoggedZone === null || this._lastLoggedZone !== currentZone);
        const leafChanged = leafIndex !== null && leafIndex >= 0 && (this._lastLoggedLeaf === null || this._lastLoggedLeaf !== leafIndex);

        if (zoneChanged || leafChanged) {
            if (zoneChanged) {
                const previousZone = this._lastLoggedZone !== null ? this._lastLoggedZone : "unknown";
                console.log(`[Zone Change] Zone: ${previousZone} -> ${currentZone}`);
                this._lastLoggedZone = currentZone;
            }
            if (leafChanged) {
                const previousLeaf = this._lastLoggedLeaf !== null ? this._lastLoggedLeaf : "unknown";
                console.log(`[Leaf Change] Leaf: ${previousLeaf} -> ${leafIndex}`);
                this._lastLoggedLeaf = leafIndex;
            }
        }

        // Traverse BSP to find visible nodes (with optional frustum culling)
        // Traverse BSP to find visible nodes (with optional frustum culling)
        const { visibleNodes, finalZoneMask } = this.traverseBSP(cameraPosition, activeZoneMask, cameraFrustum, frustumCullingEnabled, 0, leafOnlyMode);


        // Find which sections contain visible nodes (UE2-style: sections can span multiple zones)
        // UE2: If ANY node in a section is visible, the entire section is rendered
        // This is because sections are batched draw calls - all nodes in a section are drawn together
        const visibleSections = new Set<number>();
        visibleNodes.forEach(nodeIndex => {
            const sectionIndex = this.nodeToSection![nodeIndex];
            if (sectionIndex !== undefined && sectionIndex >= 0) {
                visibleSections.add(sectionIndex);
            }
        });



        // Update mesh visibility
        let visibleMeshCount = 0;
        const visibleMeshNames: string[] = [];
        const hiddenMeshNames: string[] = [];
        this.bspGroup.children.forEach((child) => {
            if (child instanceof Mesh && (child as any).sectionIndex !== undefined) {
                const sectionIndex = (child as any).sectionIndex;
                const wasVisible = child.visible;
                child.visible = visibleSections.has(sectionIndex);
                if (child.visible) {
                    visibleMeshCount++;
                    if (!wasVisible) visibleMeshNames.push(`${child.name || `Section_${sectionIndex}`}`);
                } else {
                    if (wasVisible) hiddenMeshNames.push(`${child.name || `Section_${sectionIndex}`}`);
                }
            }
        });

        // Log visibility stats when zone changes
        if (zoneChanged && currentZone !== null && currentZone >= 0) {
            const finalActiveZones: number[] = [];
            for (let i = 0; i < 64; i++) {
                if (finalZoneMask & (1n << BigInt(i))) {
                    finalActiveZones.push(i);
                }
            }
            console.log(`[BSP Visibility] Zone: ${currentZone}, Active zones: [${finalActiveZones.join(', ')}], Visible nodes: ${visibleNodes.size}, Visible sections: ${visibleSections.size}/${this.bspSections!.length}, Visible meshes: ${visibleMeshCount}`);
        }
    }

    protected _animatedLights?: DynamicLight[];
    protected _lastLightEnvVersion = -1;

    protected updateLights(environment: L2Environment) {
        // static lights only need one pass to settle needsUpdate (and another when the
        // environment switches), only animated ones re-evaluate per frame
        const envVersion = environment.getEnvVersion();

        if (this._lastLightEnvVersion !== envVersion || !this._animatedLights) {
            this._lastLightEnvVersion = envVersion;
            this._animatedLights = [];

            for (const light of Object.values(this.lights)) {
                light.update(environment, this.brightness);

                if (light.isDynamic || light.isTimeBased) {
                    this._animatedLights.push(light);
                } else {
                    // a light's first update always reports needsUpdate (nothing to
                    // diff against) and static lights never get a second call to clear
                    // it - actors handle env switches through their own envVersion check
                    light.needsUpdate = false;
                }
            }
            return;
        }

        for (const light of this._animatedLights) light.update(environment, this.brightness);
    }

    protected isVisibilityCacheValid(environment: L2Environment, cameraPosition: Vector3, cameraFrustum: THREE.Frustum, frustumCullingEnabled: boolean, topLevelOnly: boolean, staticMeshCullDistanceSq: number, emitterCullDistanceSq: number) {
        const envVersion = environment.getEnvVersion();
        const timeStep = Math.floor(environment.getTimeOfDay() * 600);
        let unchanged = this.visibilityCacheInitialized
            && this.visibilityCachePosition.equals(cameraPosition)
            && this.visibilityCacheFrustumCulling === frustumCullingEnabled
            && this.visibilityCacheTopLevelOnly === topLevelOnly
            && this.visibilityCacheDistanceSq === staticMeshCullDistanceSq
            && this.visibilityCacheEmitterDistanceSq === emitterCullDistanceSq
            && this.visibilityCacheEnvVersion === envVersion
            && this.visibilityCacheTimeStep === timeStep;

        for (let i = 0, offset = 0; unchanged && i < cameraFrustum.planes.length; i++) {
            const plane = cameraFrustum.planes[i];
            unchanged = this.visibilityCachePlanes[offset++] === plane.normal.x
                && this.visibilityCachePlanes[offset++] === plane.normal.y
                && this.visibilityCachePlanes[offset++] === plane.normal.z
                && this.visibilityCachePlanes[offset++] === plane.constant;
        }

        if (unchanged) return true;

        this.visibilityCacheInitialized = true;
        this.visibilityCachePosition.copy(cameraPosition);
        this.visibilityCacheFrustumCulling = frustumCullingEnabled;
        this.visibilityCacheTopLevelOnly = topLevelOnly;
        this.visibilityCacheDistanceSq = staticMeshCullDistanceSq;
        this.visibilityCacheEmitterDistanceSq = emitterCullDistanceSq;
        this.visibilityCacheEnvVersion = envVersion;
        this.visibilityCacheTimeStep = timeStep;

        for (let i = 0, offset = 0; i < cameraFrustum.planes.length; i++) {
            const plane = cameraFrustum.planes[i];
            this.visibilityCachePlanes[offset++] = plane.normal.x;
            this.visibilityCachePlanes[offset++] = plane.normal.y;
            this.visibilityCachePlanes[offset++] = plane.normal.z;
            this.visibilityCachePlanes[offset++] = plane.constant;
        }

        return false;
    }

    public updateVisibility(environment: L2Environment, cameraPosition: THREE.Vector3, cameraFrustum: THREE.Frustum, frustumCullingEnabled: boolean = true, topLevelOnly: boolean = false, staticMeshCullDistanceSq: number = Infinity, emitterCullDistanceSq: number = Infinity) {
        // every sector, not just the active one - lights start with needsUpdate=true
        // and a light that is never updated never clears it, so every lit actor around
        // it would recompute its vertex lighting every frame
        this.updateLights(environment);

        if (this.isVisibilityCacheValid(environment, cameraPosition, cameraFrustum, frustumCullingEnabled, topLevelOnly, staticMeshCullDistanceSq, emitterCullDistanceSq)) return;

        const library = (this as any).decodeLibrary as GD.DecodeLibrary;

        // Early return if no BSP data - but terrain still needs its lighting pass
        if (!this.bspGroup && !this.staticMeshGroup) {
            this.updateTerrainSectors(environment, cameraPosition, cameraFrustum, frustumCullingEnabled);
            return;
        }

        const cameraLeaf = this.findPositionLeaf(cameraPosition);
        const isCameraInSector = cameraLeaf !== null && cameraLeaf >= 0;

        this.helpers.visible = isCameraInSector;

        const leafOnlyMode = !isCameraInSector;
        const activeZoneMask = leafOnlyMode ? this.outdoorZoneMask : this.getActiveZoneMask(cameraPosition);

        // Get camera zone from leaf (more reliable than findPositionZone)
        let currentZone: number | null = null;
        const leafIndex = this.findPositionLeaf(cameraPosition);
        if (leafIndex !== null && leafIndex >= 0 && leafIndex < this.bspLeaves.length) {
            currentZone = this.bspLeaves[leafIndex].zone;
        }
        // Fallback to findPositionZone if leaf lookup fails
        if (currentZone === null || currentZone < 0) {
            currentZone = this.findPositionZone(cameraPosition);
        }

        // Log zone/leaf changes (only when they actually change)
        const zoneChanged = currentZone !== null && currentZone >= 0 && (this._lastLoggedZone === null || this._lastLoggedZone !== currentZone);
        const leafChanged = leafIndex !== null && leafIndex >= 0 && (this._lastLoggedLeaf === null || this._lastLoggedLeaf !== leafIndex);

        if (zoneChanged || leafChanged) {
            if (zoneChanged) {
                const previousZone = this._lastLoggedZone !== null ? this._lastLoggedZone : "unknown";
                console.log(`[Zone Change] Zone: ${previousZone} -> ${currentZone}`);
                this._lastLoggedZone = currentZone;
            }
            if (leafChanged) {
                const previousLeaf = this._lastLoggedLeaf !== null ? this._lastLoggedLeaf : "unknown";
                console.log(`[Leaf Change] Leaf: ${previousLeaf} -> ${leafIndex}`);
                this._lastLoggedLeaf = leafIndex;
            }
        }

        const { visibleNodes, visibleLeaves, finalZoneMask } = this.traverseBSP(
            cameraPosition,
            activeZoneMask,
            cameraFrustum,
            frustumCullingEnabled,
            0,
            leafOnlyMode,
            topLevelOnly
        );

        this.visibleLeaves = visibleLeaves;

        if (this.bspGroup && this.bspSections && this.nodeToSection) {
            // Find which sections contain visible nodes
            const visibleSections = new Set<number>();
            visibleNodes.forEach(nodeIndex => {
                const sectionIndex = this.nodeToSection![nodeIndex];
                if (sectionIndex !== undefined && sectionIndex >= 0) {
                    visibleSections.add(sectionIndex);
                }
            });
            let visibleMeshCount = 0;
            let bspAmbientColor: ColorByte | null = null;
            if (environment) {
                bspAmbientColor = environment.getAmbientPlaneBSPLightHalved(tmpColorByte);
                const sunColor = environment.getBaseColorPlaneBSPSunLightScaled(tmpColorByte2);
                bspAmbientColor.set(bspAmbientColor.r + sunColor.r, bspAmbientColor.g + sunColor.g, bspAmbientColor.b + sunColor.b, bspAmbientColor.a);
            }

            let outdoorCount = 0, indoorCount = 0;
            this.bspGroup.children.forEach((child) => {
                if (child instanceof Mesh && (child as any).sectionIndex !== undefined) {
                    const sectionIndex = (child as any).sectionIndex;
                    let visible = visibleSections.has(sectionIndex);

                    // topLevelOnly's node set is cached camera-independent (see
                    // traverseBSP), so it carries no frustum info - a neighbor
                    // sector's outdoor sections need their own per-frame test here
                    if (visible && topLevelOnly && frustumCullingEnabled) {
                        if (!child.geometry.boundingSphere) child.geometry.computeBoundingSphere();
                        tmpSphere.copy(child.geometry.boundingSphere).applyMatrix4(child.matrixWorld);
                        visible = cameraFrustum.intersectsSphere(tmpSphere);
                    }

                    child.visible = visible;
                    if (child.visible) {
                        const sectionInfo = this.bspSections![sectionIndex] as any;
                        const isOutdoor = sectionInfo?.isOutdoor;

                        if (isOutdoor) outdoorCount++; else indoorCount++;

                        let material = child.material;
                        const hasLightmap = (m: any) => m?.defines?.USE_LIGHTMAP !== undefined;

                        const sectionZoneAmbient = isOutdoor ? null : this.getSectionZoneAmbient(sectionIndex);

                        const applyAmbient = (m: any) => {
                            if (m?.uniforms?.ambient?.value?.color) {
                                if (isOutdoor && bspAmbientColor && !hasLightmap(m)) {
                                    bspAmbientColor.toFloats(m.uniforms.ambient.value.color);
                                    if (m.defines && m.defines.USE_AMBIENT === undefined) {
                                        m.defines.USE_AMBIENT = "";
                                        m.needsUpdate = true;
                                    }
                                } else if (sectionZoneAmbient) {
                                    sectionZoneAmbient.toFloats(m.uniforms.ambient.value.color);
                                    if (m.defines && m.defines.USE_AMBIENT === undefined) {
                                        m.defines.USE_AMBIENT = "";
                                        m.needsUpdate = true;
                                    }
                                } else {
                                    m.uniforms.ambient.value.color.setRGB(1, 1, 1);
                                }
                            } else if (m?.color) {
                                // fallback
                                if (isOutdoor && bspAmbientColor) bspAmbientColor.toFloats(m.color);
                                else m.color.setHex(0xffffff);
                            }
                        };

                        if (Array.isArray(material)) {
                            material.forEach(applyAmbient);
                        } else {
                            applyAmbient(material);
                        }

                        visibleMeshCount++;
                    }
                }
            });

            // Log BSP ambient status on zone changes (condensed debug)
            if (zoneChanged && bspAmbientColor) {
                console.log(`[BSP Ambient] Outdoor: ${outdoorCount}, Indoor: ${indoorCount}, Color: rgb(${bspAmbientColor.r.toFixed(2)}, ${bspAmbientColor.g.toFixed(2)}, ${bspAmbientColor.b.toFixed(2)})`);
            }

            if (zoneChanged && currentZone !== null && currentZone >= 0) {
                const finalActiveZones: number[] = [];
                for (let i = 0; i < 64; i++) {
                    if (finalZoneMask & (1n << BigInt(i))) {
                        finalActiveZones.push(i);
                    }
                }
                console.log(`[BSP Visibility] Zone: ${currentZone}, Active zones: [${finalActiveZones.join(', ')}], Visible nodes: ${visibleNodes.size}, Visible sections: ${visibleSections.size}/${this.bspSections!.length}, Visible meshes: ${visibleMeshCount}`);
            }
        }

        if (library && this.staticMeshGroup && this.staticMeshMap.size > 0) {
            const candidateActorUuids = this.candidateStaticActorUuids;
            const visibleActorUuids = this.visibleStaticActorUuids;
            const visibleActorDistances = this.visibleStaticActorDistances;
            candidateActorUuids.clear();
            visibleActorUuids.clear();
            visibleActorDistances.clear();

            for (const leafIndex of visibleLeaves) {
                const actors = library.leafActors[leafIndex];
                if (actors) {
                    for (const actorBase of actors) {
                        if (actorBase.type !== "StaticMeshActor") continue;
                        const actor = actorBase as IStaticMeshActorDecodeInfo;
                        if (candidateActorUuids.has(actor.uuid)) continue;
                        candidateActorUuids.add(actor.uuid);

                        // Actor frustum and zone mask culling
                        tmpActorBox.min.fromArray(actor.bounds.min);
                        tmpActorBox.max.fromArray(actor.bounds.max);

                        const isFrustumVisible = !frustumCullingEnabled || cameraFrustum.intersectsBox(tmpActorBox);
                        const isZoneVisible = !frustumCullingEnabled || !actor.zoneMask || !!(actor.zoneMask & finalZoneMask);

                        // Distance-based culling — skip for actors with bIgnoredRange
                        const actorCenter = tmpActorBox.getCenter(tmpVec3);
                        const distSq = cameraPosition.distanceToSquared(actorCenter);
                        const isRangeIgnored = !!(actor as any).isRangeIgnored;
                        const isInRange = isRangeIgnored || distSq <= staticMeshCullDistanceSq;

                        if (isFrustumVisible && isZoneVisible && isInRange) {
                            visibleActorUuids.add(actor.uuid);
                            visibleActorDistances.set(actor.uuid, distSq);
                        }
                    }
                }
            }

            let visibleCount = 0;

            if (!this.staticMeshVisibilityEntries) {
                const processedBatches = new Set<string>();
                this.staticMeshVisibilityEntries = [];

                this.staticMeshMap.forEach((object, uuid) => {
                    if ((object as any).isBatch) {
                        if (processedBatches.has(object.uuid)) return;
                        processedBatches.add(object.uuid);
                    }

                    this.staticMeshVisibilityEntries.push({ object, uuid });
                });
            }

            for (const { object, uuid } of this.staticMeshVisibilityEntries) {
                // For batched meshes, per-element culling via geometry.groups
                if ((object as any).isBatch) {
                    const batchElements = (object as any).batchElements;
                    const geometry = (object as any).geometry;
                    if (!batchElements || !geometry) continue;

                    // Test each element's bounds individually
                    const sortedTransparentMats = (object as any).sortedTransparentMaterialIndexes as Set<number> | undefined;
                    let elemVisibility = (object as any).elemVisibility as Uint8Array;
                    if (!elemVisibility || elemVisibility.length !== batchElements.length) {
                        elemVisibility = (object as any).elemVisibility = new Uint8Array(batchElements.length);
                        elemVisibility.fill(2);
                    }
                    let elemDistances = (object as any).elemDistances as Float64Array;
                    if (!elemDistances || elemDistances.length !== batchElements.length)
                        elemDistances = (object as any).elemDistances = new Float64Array(batchElements.length);
                    let elemRelight = (object as any).elemRelight as Uint8Array;
                    if (!elemRelight || elemRelight.length !== batchElements.length)
                        elemRelight = (object as any).elemRelight = new Uint8Array(batchElements.length);
                    let visibilityChanged = false;

                    for (let ei = 0; ei < batchElements.length; ei++) {
                        const elem = batchElements[ei];

                        // per-element pvs: the element only qualifies when one of its
                        // leaves is visible (portals keep indoor cameras from seeing
                        // through walls), elements without leaf data skip the test
                        let elemVisible = visibleActorUuids.has(elem.uuid);
                        let distSq = visibleActorDistances.get(elem.uuid) ?? 0;

                        // Actors absent from leafActors still need the direct fallback.
                        if (!elemVisible && !candidateActorUuids.has(elem.uuid)) {
                            let inVisibleLeaves = !elem.leaves || elem.leaves.length === 0;
                            if (!inVisibleLeaves) {
                                for (const li of elem.leaves) {
                                    if (visibleLeaves.has(li)) { inVisibleLeaves = true; break; }
                                }
                            }

                            if (inVisibleLeaves) {
                                tmpActorBox.min.fromArray(elem.boundsMin);
                                tmpActorBox.max.fromArray(elem.boundsMax);

                                const isFrustumVisible = !frustumCullingEnabled || cameraFrustum.intersectsBox(tmpActorBox);
                                const isZoneVisible = !frustumCullingEnabled || !elem.zoneMask || !!(elem.zoneMask & finalZoneMask);
                                const actorCenter = tmpActorBox.getCenter(tmpVec3);
                                distSq = cameraPosition.distanceToSquared(actorCenter);
                                const isInRange = elem.isRangeIgnored || distSq <= staticMeshCullDistanceSq;

                                elemVisible = isFrustumVisible && isZoneVisible && isInRange;
                            }
                        }

                        elemDistances[ei] = distSq;

                        const visibleValue = elemVisible ? 1 : 0;
                        if (elemVisibility[ei] !== visibleValue) {
                            elemVisibility[ei] = visibleValue;
                            visibilityChanged = true;
                            // the dynamic pass skips hidden elements, so only one that just appeared owes a relight
                            elemRelight[ei] = visibleValue;
                        }
                    }

                    const transparentSortPosition = (object as any).transparentSortPosition as Vector3;
                    const sortChanged = !!sortedTransparentMats?.size && (!transparentSortPosition || transparentSortPosition.distanceToSquared(cameraPosition) >= TRANSPARENT_SORT_DISTANCE_SQ);

                    if (visibilityChanged) (object as any).needsRelightPass = true; // catch up a newly-visible element's dynamic lighting

                    if (visibilityChanged || sortChanged) {
                        let groupPool = (object as any).batchGroupPool as BatchGroup_T[];
                        if (!groupPool) groupPool = (object as any).batchGroupPool = [];

                        let visibleGroups = (object as any).visibleBatchGroups as BatchGroup_T[];
                        if (!visibleGroups) visibleGroups = (object as any).visibleBatchGroups = [];

                        let groupCount = 0;

                        for (let ei = 0; ei < batchElements.length; ei++) {
                            if (!elemVisibility[ei]) continue;

                            const distance = elemDistances[ei];

                            for (const g of batchElements[ei].groups) {
                                let entry = groupPool[groupCount];
                                if (!entry) entry = groupPool[groupCount] = { start: 0, count: 0, materialIndex: 0, distance: 0, transparent: 0 };

                                entry.start = g.start;
                                entry.count = g.count;
                                entry.materialIndex = g.materialIndex;
                                entry.distance = distance;

                                visibleGroups[groupCount++] = entry;
                            }
                        }

                        visibleGroups.length = groupCount;

                        if (groupCount > 0) {
                            rebuildBatchGroups(object, geometry, visibleGroups, sortedTransparentMats);
                        } else {
                            geometry.clearGroups();
                        }

                        object.visible = groupCount > 0;
                        if (sortedTransparentMats?.size) {
                            if (transparentSortPosition) transparentSortPosition.copy(cameraPosition);
                            else (object as any).transparentSortPosition = cameraPosition.clone();
                        }
                    }

                    if (object.visible) visibleCount++;

                    // no update() here: render-manager's Pass 2 (traverseVisible)
                    // relights visible meshes the same frame - a light's needsUpdate
                    // stays set for the whole frame, so updating in both passes ran
                    // every relight twice
                } else {
                    // Non-batch actors: leaf visibility, with the direct bounds fallback
                    // only for cameras outside the bsp (inside, the leaves are exact and
                    // the fallback would see through walls)
                    let isVisible = visibleActorUuids.has(uuid);

                    if (!isVisible && (object as any).actorBoundsMin && !isCameraInSector) {
                        tmpActorBox.min.fromArray((object as any).actorBoundsMin);
                        tmpActorBox.max.fromArray((object as any).actorBoundsMax);

                        const isFrustumVisible = !frustumCullingEnabled || cameraFrustum.intersectsBox(tmpActorBox);
                        const zoneMask = (object as any).actorZoneMask as bigint;
                        const isZoneVisible = !frustumCullingEnabled || !zoneMask || !!(zoneMask & finalZoneMask);
                        const actorCenter = tmpActorBox.getCenter(tmpVec3);
                        const distSq = cameraPosition.distanceToSquared(actorCenter);
                        const isInRange = (object as any).actorRangeIgnored || distSq <= staticMeshCullDistanceSq;

                        isVisible = isFrustumVisible && isZoneVisible && isInRange;
                    }

                    object.visible = isVisible;
                    if (isVisible) visibleCount++; // relighting happens in Pass 2, see the batch branch above
                }
            }

            if (leafIndex !== null && leafIndex >= 0 && leafIndex !== this._lastLoggedStaticMeshLeaf) {
                console.log(`leaf #${leafIndex} meshes ${visibleCount}/${this.staticMeshMap.size}`);
                this._lastLoggedStaticMeshLeaf = leafIndex;
            }
        }

        // unlike the static mesh pass above, no visibleLeaves/leafActors pre-filter - see allEmitterActors (decode-library.ts)
        if (library) {
            const visibleEmitterUuids = new Set<string>();

            for (const actorBase of library.allEmitterActors) {
                // zero-extent box (min===max) holding the actor's world origin - see un-emitter.ts
                const bounds = (actorBase as any).bounds;
                if (!bounds) continue;

                const origin = tmpVec3.fromArray(bounds.min);

                // zone and range first - the box fallback below walks every child of every out-of-frustum
                // eqmitter, and running it on one the cheap tests reject anyway was most of this loop
                const zoneMask = (actorBase as any).zoneMask as bigint;
                const isZoneVisible = !frustumCullingEnabled || !zoneMask || !!(zoneMask & finalZoneMask);
                if (!isZoneVisible) continue;

                // AEmitter::Render (0x8a2ae0): appSqrt(dx*dx + dy*dy) >= GL2ActorCR * 2048 skips rendering.
                const dx = origin.x - cameraPosition.x;
                const dy = origin.y - cameraPosition.y;
                const isRangeIgnored = !!(actorBase as any).isRangeIgnored;
                const isInRange = isRangeIgnored || (dx * dx + dy * dy) <= emitterCullDistanceSq;
                if (!isInRange) continue;

                let isFrustumVisible = !frustumCullingEnabled || cameraFrustum.containsPoint(origin);

                // UE2 frustum-tests the per-tick particle bounding box rebuilt in
                // UpdateParticles (UnParticleEmitter.cpp), not the actor origin - a
                // tall effect (mother tree column) otherwise vanishes as soon as its
                // base leaves the frustum even though particles fill the screen
                if (!isFrustumVisible) {
                    for (const child of this.getEmitterObjects(actorBase.uuid)) {
                        const box = (child as any).boundingBox as THREE.Box3;
                        if (!box || box.isEmpty()) continue;

                        tmpEmitterBox.copy(box).applyMatrix4(child.matrixWorld);
                        tmpEmitterBox.expandByScalar((child as any).worldParticleExtent);

                        if (cameraFrustum.intersectsBox(tmpEmitterBox)) {
                            isFrustumVisible = true;
                            break;
                        }
                    }
                }

                if (isFrustumVisible) visibleEmitterUuids.add(actorBase.uuid);
            }

            this.visibleEmitterUuids = visibleEmitterUuids;
        }

        // must run for every sector, terrain colors start black and sectors without
        // any StaticMeshActor (ocean tiles) would never get lit otherwise
        //
        // UE2 renders terrain per zone (UnRenderVisibility.cpp: bTerrainZone &&
        // ActiveZoneMask & (1 << ZoneIndex)) - when the visible-zone set is fully
        // indoor (sealed dungeon), the outdoor terrain must not draw or relight;
        // a portal to the outside entering the frustum re-adds the outdoor zones
        const terrainZoneVisible = !frustumCullingEnabled || (finalZoneMask & this.outdoorZoneMask) !== 0n;
        this.updateTerrainSectors(environment, cameraPosition, cameraFrustum, frustumCullingEnabled, terrainZoneVisible);
    }

    protected emitterObjectsByUuid?: Map<string, THREE.Object3D[]>;

    // the subtree is static after decode, collect the particle-bearing children once
    protected getEmitterObjects(actorUuid: string): THREE.Object3D[] {
        if (!this.emitterObjectsByUuid) {
            const map = new Map<string, THREE.Object3D[]>();

            this.traverse(obj => {
                const uuid = (obj as any).emitterActorUuid;
                if (!uuid || !(obj as any).particlePool) return;
                if (!map.has(uuid)) map.set(uuid, []);
                map.get(uuid).push(obj);
            });

            this.emitterObjectsByUuid = map;
        }

        return this.emitterObjectsByUuid.get(actorUuid) ?? EMPTY_EMITTER_LIST;
    }

    // Update terrain lighting and batch visibility
    protected updateTerrainSectors(environment: L2Environment, cameraPosition: THREE.Vector3, cameraFrustum: THREE.Frustum, frustumCullingEnabled: boolean, zoneVisible: boolean = true) {
        // the zones subtree is static after decode, collect the terrain nodes once
        if (!this.terrainRenderables) {
            const batches: Mesh[] = [];
            const standalone: any[] = [];
            const decorations = new Map<string, TerrainDecoration[]>();

            this.zones.traverse((object) => {
                if ((object as any).isTerrainBatch) batches.push(object as Mesh);
                else if ((object as any).isTerrain && !(object as any).batchGeometry) standalone.push(object);
                else if ((object as any).isTerrainDecoration) {
                    const decoration = object as TerrainDecoration;
                    if (!decorations.has(decoration.terrainSegment)) decorations.set(decoration.terrainSegment, []);
                    decorations.get(decoration.terrainSegment).push(decoration);
                }
            });

            this.terrainRenderables = { batches, standalone, decorations };
        }

        for (const batch of this.terrainRenderables.batches) {
            const batchGeo = batch.geometry as BufferGeometry;
            const sectors = (batch as any).sectors as any[];
            const originalGroups = (batch as any).originalGroups as any[];
            if (!sectors || !batchGeo || !originalGroups) continue;

            let groupKey = "";
            const visibleGroups: any[] = [];

            sectors.forEach(sector => {
                // Terrain sectors have 'bounds' (THREE.Box3)
                const isVisible = zoneVisible && (!frustumCullingEnabled || cameraFrustum.intersectsBox(sector.bounds));

                if (isVisible) {
                    sector.update(this, environment);
                    // Add this sector's groups to visibility
                    const start = sector.batchGroupOffset;
                    const count = sector.batchGroupCount;
                    groupKey += start + ",";
                    for (let i = start; i < start + count; i++) {
                        visibleGroups.push(originalGroups[i]);
                    }
                }

                const decorations = this.terrainRenderables.decorations.get(sector.terrainSegmentUuid);
                if (decorations) decorations.forEach(decoration => decoration.updateVisibility(cameraPosition, isVisible));
            });

            // rebuilding groups dirties the geometry, only do it when the selection changed
            if (groupKey === (batch as any).visibleGroupKey) continue;
            (batch as any).visibleGroupKey = groupKey;

            if (visibleGroups.length > 0) {
                batch.visible = true;
                batchGeo.clearGroups();
                visibleGroups.forEach(g => {
                    batchGeo.addGroup(g.start, g.count, g.materialIndex);
                });
            } else {
                batch.visible = false;
            }
        }

        for (const terrain of this.terrainRenderables.standalone) {
            const isVisible = zoneVisible && terrain.visible;
            if (isVisible) terrain.update?.(this, environment);

            const decorations = this.terrainRenderables.decorations.get(terrain.terrainSegmentUuid);
            if (decorations) decorations.forEach(decoration => decoration.updateVisibility(cameraPosition, isVisible));
        }
    }

    public updateVisibleStaticMeshActors(environment: L2Environment, cameraPosition: THREE.Vector3, cameraFrustum: THREE.Frustum, frustumCullingEnabled: boolean = true) {
        const library = (this as any).decodeLibrary as GD.DecodeLibrary;
        if (!library || !this.staticMeshGroup || this.staticMeshMap.size === 0) return;

        // Check if camera is within this sector (by finding valid leaf)
        const cameraLeaf = this.findPositionLeaf(cameraPosition);
        const isCameraInSector = cameraLeaf !== null && cameraLeaf >= 0;

        // Hide helpers when camera is outside sector
        this.helpers.visible = isCameraInSector;

        // If camera is outside sector, only render leaf 1 (no portal expansion)
        const leafOnlyMode = !isCameraInSector;
        const activeZoneMask = leafOnlyMode ? this.outdoorZoneMask : this.getActiveZoneMask(cameraPosition); // outdoor zones if camera is outside the bsp

        const { finalZoneMask, visibleLeaves } = this.traverseBSP(cameraPosition, activeZoneMask, cameraFrustum, frustumCullingEnabled, 0, leafOnlyMode);

        const visibleActorUuids = new Set<string>();
        const actorBox = new Box3();

        for (const leafIndex of visibleLeaves) {
            const actors = library.leafActors[leafIndex];
            if (actors) {
                for (const actorBase of actors) {
                    if (actorBase.type !== "StaticMeshActor") continue;
                    const actor = actorBase as IStaticMeshActorDecodeInfo;
                    if (visibleActorUuids.has(actor.uuid)) continue;

                    // Actor frustum and zone mask culling
                    actorBox.min.fromArray(actor.bounds.min);
                    actorBox.max.fromArray(actor.bounds.max);

                    const isFrustumVisible = !frustumCullingEnabled || cameraFrustum.intersectsBox(actorBox);
                    const isZoneVisible = !frustumCullingEnabled || !actor.zoneMask || !!(actor.zoneMask & finalZoneMask);

                    if (isFrustumVisible && isZoneVisible) {
                        visibleActorUuids.add(actor.uuid);
                    }
                }
            }
        }

        let visibleCount = 0;
        const processedBatches = new Set<string>();

        this.staticMeshMap.forEach((object, uuid) => {
            if ((object as any).isBatch) {
                const batchId = object.uuid;
                if (processedBatches.has(batchId)) return;
                processedBatches.add(batchId);

                const batchElements = (object as any).batchElements;
                const geometry = (object as any).geometry;
                if (!batchElements || !geometry) return;

                const visibleGroups: { start: number; count: number; materialIndex: number }[] = [];

                for (const elem of batchElements) {
                    let elemVisible = visibleActorUuids.has(elem.uuid);

                    if (!elemVisible) {
                        actorBox.min.fromArray(elem.boundsMin);
                        actorBox.max.fromArray(elem.boundsMax);

                        const isFrustumVisible = !frustumCullingEnabled || cameraFrustum.intersectsBox(actorBox);
                        const isZoneVisible = !frustumCullingEnabled || !elem.zoneMask || !!(elem.zoneMask & finalZoneMask);

                        elemVisible = isFrustumVisible && isZoneVisible;
                    }

                    if (elemVisible) {
                        for (const g of elem.groups) {
                            visibleGroups.push(g);
                        }
                    }
                }

                if (visibleGroups.length > 0) {
                    geometry.clearGroups();
                    for (const g of visibleGroups) {
                        geometry.addGroup(g.start, g.count, g.materialIndex);
                    }
                    object.visible = true;
                    visibleCount++;
                } else {
                    object.visible = false;
                }

                if (object.visible && (object as any).isUpdatable) {
                    (object as any)?.update(this, environment);
                }
            } else {
                const isVisible = visibleActorUuids.has(uuid);
                object.visible = isVisible;
                if (isVisible) {
                    visibleCount++;
                    if ((object as any).isUpdatable) {
                        (object as any)?.update(this, environment);
                    }
                }
            }
        });

        const leafIndex = this.findPositionLeaf(cameraPosition);
        if (leafIndex !== null && leafIndex >= 0 && leafIndex !== this._lastLoggedStaticMeshLeaf) {
            console.log(`leaf #${leafIndex} meshes ${visibleCount}/${this.staticMeshMap.size}`);
            this._lastLoggedStaticMeshLeaf = leafIndex;
        }
    }
}

class BSPZoneData {
    public connectivity: bigint;
    public visibility: bigint;
    public zoneInfo: any;

    protected constructor() { }

    public static fromInfo(info: GD.IBSPZoneDecodeInfo_T) {
        const zone = new BSPZoneData();

        zone.connectivity = info.connectivity
        zone.visibility = info.visibility;
        zone.zoneInfo = info.zoneInfo;

        return zone;
    }
}

class BSPLeafData {
    public zone: number
    public permiating: number
    public volumetric: number
    public visibleZones: bigint
    public musicId?: number

    protected constructor() { }

    public static fromInfo(info: GD.IBSPLeafDecodeInfo_T) {
        const leaf = new BSPLeafData();

        leaf.zone = info.zone;
        leaf.permiating = info.permiating;
        leaf.volumetric = info.volumetric;
        leaf.visibleZones = info.visibleZones;
        leaf.musicId = info.musicId;

        return leaf;
    }
}

class BSPNodeData {
    public back: number;
    public front: number;
    public iPlane: number; // Index to next coplanar node (UE2 line 1472-1473)
    public plane = new Vector4();
    public readonly leaves: [number, number] = [0, 0];
    public readonly zones: [number, number] = [0, 0];
    public surfFlags?: number;
    public iRenderBound?: number; // Index to render bounding box (INDEX_NONE = -1 means no bound)
    public collision?: ICollisionInfo;
    public exclusiveSphereBound = new Sphere();
    public inclusiveSphereBound = new Sphere();

    protected constructor() { }

    public static fromInfo(info: any) {
        const node = new BSPNodeData();

        [node.front, node.back] = info.children;
        node.iPlane = info.iPlane !== undefined ? info.iPlane : -1;

        node.plane.fromArray(info.plane);

        node.leaves[0] = info.leaves[0];
        node.leaves[1] = info.leaves[1];

        node.zones[0] = info.zones[0];
        node.zones[1] = info.zones[1];

        node.surfFlags = info.surfFlags;
        node.iRenderBound = info.iRenderBound !== undefined ? info.iRenderBound : undefined;

        if (info.spheres) {
            node.exclusiveSphereBound.center.set(info.spheres.exclusive[0], info.spheres.exclusive[1], info.spheres.exclusive[2]);
            node.exclusiveSphereBound.radius = info.spheres.exclusive[3];

            node.inclusiveSphereBound.center.set(info.spheres.inclusive[0], info.spheres.inclusive[1], info.spheres.inclusive[2]);
            node.inclusiveSphereBound.radius = info.spheres.inclusive[3];
        }

        if ("collision" in info) {
            const bounds = new Box3();

            bounds.min.fromArray(info.collision.bounds.min);
            bounds.max.fromArray(info.collision.bounds.max);

            node.collision = {
                flags: info.collision.flags,
                bounds
            };
        }

        return node;
    }
}

export default ZoneObject;
export { ZoneObject, SectorObject };

interface ICollisionInfo {
    bounds: THREE.Box3,
    flags: number[]
}
