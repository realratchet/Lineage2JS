import DynamicLight from "@client/objects/dynamic-light";
import type { L2Environment } from "@client/rendering/l2-env";
import { Box3, Color, Fog, Object3D, Sphere, Vector3, Vector4, Mesh, Quaternion, BufferGeometry, Material } from "three";
import type { Terrain } from "@client/objects/terrain";

import { ColorByte } from "@client/utils/color-byte";

const tmpColor = new Color();
const tmpColorByte = new ColorByte();
const tmpVec3 = new Vector3();
const tmpVec4 = new Vector4();

// Portal recursion depth limit (matches UE2's MAX_RECURSION_DEPTH)
const MAX_RECURSION_DEPTH = 4;

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
    public readonly zones = new Object3D();
    public readonly helpers = new Object3D();
    public readonly fogInfos: FogInfoObject[] = [];

    public bspZones: BSPZoneData[];
    public bspNodes: BSPNodeData[];
    public bspLeaves: BSPLeafData[];
    public index: THREE.Vector2;
    public sunTexture: any; // MapData_T - texture with size info
    public celestials: { type: string; sprite: any; data: any }[] = []; // Decoded celestial data with textures
    public brightness: number = 1.0;
    public lastZoneMask: bigint = 0n;
    public readonly worldBounds = new Box3();
    public readonly gridBounds = new Box3();

    // NEW: Precise Geometric volumes for runtime intersection
    public musicVolumes?: GD.IMusicVolumeDecodeInfo[];
    public ambientSounds?: GD.IAmbientSoundObjectDecodeInfo[];

    // NEW: BSP rendering data
    public bspSections?: GD.IBSPSectionDecodeInfo_T[];
    public nodeToSection?: number[];
    public nodeZoneMasks?: bigint[];
    public bspGroup?: THREE.Group;
    public staticMeshGroup?: THREE.Group;
    public staticMeshMap: Map<string, THREE.Object3D> = new Map();
    public readonly lights: Record<string, DynamicLight> = {};

    protected _lastLoggedStaticMeshLeaf: number | null = null;

    // Internal state for zone/leaf change tracking
    private _lastLoggedZone: number | null = null;
    private _lastLoggedLeaf: number | null = null;

    public setLights(lights: DynamicLight[]): this {
        for (const light of lights) {
            this.lights[light.name] = light;
        }

        return this;
    }

    public constructor() {
        super();

        this.helpers.name = "SectorHelpers";
        this.zones.name = "SectorZones";

        this.add(this.helpers, this.zones);
    }

    public setBSPInfo(bspZones: GD.IBSPZoneDecodeInfo_T[], bspNodes: GD.IBSPNodeDecodeInfo_T[], bspLeaves: GD.IBSPLeafDecodeInfo_T[]) {
        this.bspZones = bspZones.map(BSPZoneData.fromInfo);
        this.bspNodes = bspNodes.map(BSPNodeData.fromInfo);
        this.bspLeaves = bspLeaves.map(BSPLeafData.fromInfo);
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
            const cx = cameraPosition.x, cy = cameraPosition.y, cz = cameraPosition.z;

            for (const vol of this.musicVolumes) {
                if (vol.priority < highestPriority) continue;

                // Planes are pre-baked to world space, just PlaneDot directly
                let outside = vol.bsp.isRootOutside;
                const nodes = vol.bsp.nodes;

                if (nodes.length > 0) {
                    let iNode = 0;
                    let isFront = false;

                    do {
                        const node = nodes[iNode];
                        const p = node.plane;
                        // UE2 PlaneDot: X*P.X + Y*P.Y + Z*P.Z - W
                        const dist = p[0] * cx + p[1] * cy + p[2] * cz - p[3];
                        isFront = dist > 0;
                        
                        if (isFront) {
                            outside = outside || node.isCsg;
                        } else {
                            outside = outside && !node.isCsg;
                        }
                        
                        iNode = isFront ? node.iFront : node.iBack;
                    } while (iNode !== -1);
                }

                if (!outside) {
                    highestPriority = vol.priority;
                    selectedMusicId = vol.musicId;
                    isLooped = vol.isMusicLooped;
                    isForced = vol.isMusicForced;
                }
            }
        }

        return { musicId: selectedMusicId, isLooped, isForced };
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

        // If we have PVS data, intersect it with connectivity to ensure only connected zones are included.
        // IMPORTANT: If PVS is "invalid" (all zones or zero), DO NOT fall back to connectivity as visibility.
        // Connectivity describes potential reachability, not what is currently visible through portals.
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

        // Note: Portals will dynamically add more zones during BSP traversal (see traverseBSP)
        // Portal expansion is also constrained to connectivity

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
            // Find nodes that belong to outdoor sections
            for (let nodeIndex = 0; nodeIndex < this.bspNodes.length; nodeIndex++) {
                const sectionIndex = this.nodeToSection ? this.nodeToSection[nodeIndex] : -1;
                if (sectionIndex >= 0) {
                    const sectionInfo = this.bspSections ? this.bspSections[sectionIndex] as any : null;
                    if (sectionInfo?.isOutdoor) {
                        visibleNodes.add(nodeIndex);
                    }
                } else if (this.nodeZoneMasks) {
                    // Fallback to zone 1 if section info is missing but zone mask exists
                    if (this.nodeZoneMasks[nodeIndex] & (1n << 1n)) {
                        visibleNodes.add(nodeIndex);
                    }
                }
            }

            // For leaves, we also want those marked as outdoor if possible
            // In the absence of a clear outdoor flag for leaves, we'll use zone 1 as a heuristic
            if (this.bspLeaves) {
                for (let leafIndex = 0; leafIndex < this.bspLeaves.length; leafIndex++) {
                    if (this.bspLeaves[leafIndex].zone === 1) {
                        visibleLeaves.add(leafIndex);
                    }
                }
            }
            return { visibleNodes, visibleLeaves, finalZoneMask: (1n << 1n), zonesAddedThroughPortals: new Set<number>() };
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
                // 1. Zone Mask Culling (skip subtree if not visible)
                const nodeZoneMask = this.nodeZoneMasks[nodeIndex];
                if (hasViewZone && nodeZoneMask && nodeZoneMask !== 0n && currentZoneMask !== 0n) {
                    if (!(nodeZoneMask & currentZoneMask)) {
                        continue; // Cull this subtree
                    }
                }

                // 2. Bounding Box Portal Visibility Check (UE2: UnRenderVisibility.cpp lines 1800-1819)
                // If node has a render bound, check if it's visible through portals
                // UE2: Model->Bounds(Node.iRenderBound) - bounds are precomputed and stored in Model
                // We access precomputed bounds from library.bspRenderBounds (populated from this.bounds in un-model.ts)
                const library = (this as any).decodeLibrary as GD.DecodeLibrary;
                if (hasViewZone && node.iRenderBound !== undefined && node.iRenderBound >= 0 && library?.bspRenderBounds) {
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

                // 3. Determine side
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
                                // UE2-style: the recursion depth for the new zone is based on the depth of the
                                // *current* zone, not the minimum depth of any active zone.
                                //
                                // IMPORTANT: The previous logic took the minimum depth across all active zones.
                                // Since the camera zone is always depth 0, that effectively made every portal hop
                                // look like depth 1 and allowed multi-portal chains to expand without increasing depth.
                                const sourceDepth = zoneDepthMap.get(currentZone) ?? recursionDepth;

                                // Connectivity is defined per-zone. Only allow expansion if the current zone
                                // is connected to the opposite zone.
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
        const activeZoneMask = leafOnlyMode ? (1n << 1n) : this.getActiveZoneMask(cameraPosition); // Zone 1 bitmask if leaf-only

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
            if (child instanceof Mesh && child.userData.sectionIndex !== undefined) {
                const sectionIndex = child.userData.sectionIndex;
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

    protected updateLights(environment: L2Environment) {
        for (const light of Object.values(this.lights)) {
            light.update(environment, this.brightness);
        }
    }

    public updateVisibility(environment: L2Environment, cameraPosition: THREE.Vector3, cameraFrustum: THREE.Frustum, frustumCullingEnabled: boolean = true, topLevelOnly: boolean = false, staticMeshCullDistanceSq: number = Infinity) {
        // Only update lights for the active (camera) sector, not distant sectors
        if (!topLevelOnly) this.updateLights(environment);

        const library = (this as any).decodeLibrary as GD.DecodeLibrary;

        // Early return if no BSP data
        if (!this.bspGroup && !this.staticMeshGroup) return;

        const cameraLeaf = this.findPositionLeaf(cameraPosition);
        const isCameraInSector = cameraLeaf !== null && cameraLeaf >= 0;

        this.helpers.visible = isCameraInSector;

        const leafOnlyMode = !isCameraInSector;
        const activeZoneMask = leafOnlyMode ? (1n << 1n) : this.getActiveZoneMask(cameraPosition);

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
                bspAmbientColor = environment.getAmbientPlaneBSPLight(tmpColorByte);
            }

            let outdoorCount = 0, indoorCount = 0;
            this.bspGroup.children.forEach((child) => {
                if (child instanceof Mesh && child.userData.sectionIndex !== undefined) {
                    const sectionIndex = child.userData.sectionIndex;
                    child.visible = visibleSections.has(sectionIndex);
                    if (child.visible) {
                        const sectionInfo = this.bspSections![sectionIndex] as any;
                        const isOutdoor = sectionInfo?.isOutdoor;

                        if (isOutdoor) outdoorCount++; else indoorCount++;

                        // Apply ambient color via MeshStaticMaterial's ambient uniform
                        let material = child.material;
                        const applyAmbient = (m: any) => {
                            // MeshStaticMaterial uses uniforms.ambient.value.color (which is THREE.Color)
                            if (m?.uniforms?.ambient?.value?.color) {
                                if (isOutdoor && bspAmbientColor) {
                                    bspAmbientColor.toFloats(m.uniforms.ambient.value.color);
                                    // Ensure defines exists before checking USE_AMBIENT
                                    if (m.defines && m.defines.USE_AMBIENT === undefined) {
                                        m.defines.USE_AMBIENT = "";
                                        m.needsUpdate = true;
                                    }
                                } else {
                                    m.uniforms.ambient.value.color.setRGB(1, 1, 1);
                                }
                            } else if (m?.color) {
                                // Fallback for materials with .color (like MeshBasicMaterial)
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

                        // Distance-based culling — skip for actors with bIgnoredRange
                        const actorCenter = actorBox.getCenter(tmpVec3);
                        const distSq = cameraPosition.distanceToSquared(actorCenter);
                        const isRangeIgnored = !!(actor as any).isRangeIgnored;
                        const isInRange = isRangeIgnored || distSq <= staticMeshCullDistanceSq;

                        if (isFrustumVisible && isZoneVisible && isInRange) {
                            visibleActorUuids.add(actor.uuid);
                        }
                    }
                }
            }

            let visibleCount = 0;
            const processedBatches = new Set<string>();

            this.staticMeshMap.forEach((object, uuid) => {
                // For batched meshes, per-element culling via geometry.groups
                if (object.userData.isBatch) {
                    // Only process each batch mesh once (multiple UUIDs map to same object)
                    const batchId = object.uuid;
                    if (processedBatches.has(batchId)) return;
                    processedBatches.add(batchId);

                    const batchElements = object.userData.batchElements;
                    const geometry = (object as any).geometry;
                    if (!batchElements || !geometry) return;

                    // Test each element's bounds individually
                    const visibleGroups: { start: number; count: number; materialIndex: number }[] = [];

                    for (const elem of batchElements) {
                        // Check if this element is visible via the leaf/frustum pass
                        let elemVisible = visibleActorUuids.has(elem.uuid);

                        // If not found in leaf traversal, also check direct bounds
                        if (!elemVisible) {
                            actorBox.min.fromArray(elem.boundsMin);
                            actorBox.max.fromArray(elem.boundsMax);

                            const isFrustumVisible = !frustumCullingEnabled || cameraFrustum.intersectsBox(actorBox);
                            const isZoneVisible = !frustumCullingEnabled || !elem.zoneMask || !!(elem.zoneMask & finalZoneMask);
                            const actorCenter = actorBox.getCenter(tmpVec3);
                            const distSq = cameraPosition.distanceToSquared(actorCenter);
                            const isInRange = elem.isRangeIgnored || distSq <= staticMeshCullDistanceSq;

                            elemVisible = isFrustumVisible && isZoneVisible && isInRange;
                        }

                        if (elemVisible) {
                            for (const g of elem.groups) {
                                visibleGroups.push(g);
                            }
                        }
                    }

                    // Rebuild geometry groups with only visible elements
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
                    // Non-batch actors: simple visibility toggle
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

            // Update terrain lighting and batch visibility
            this.zones.traverse((object) => {
                const userData = (object as any).userData;
                const isTerrainBatch = userData?.isTerrainBatch;
                const isTerrain = (object as any).isTerrain;

                if (isTerrainBatch) {
                    const batch = object as Mesh;
                    const batchGeo = batch.geometry as BufferGeometry;
                    const sectors = userData.sectors as any[];
                    const originalGroups = userData.originalGroups as any[];
                    if (!sectors || !batchGeo || !originalGroups) return;

                    const visibleGroups: any[] = [];
                    sectors.forEach(sector => {
                        // Terrain sectors have 'bounds' (THREE.Box3)
                        const isVisible = !frustumCullingEnabled || cameraFrustum.intersectsBox(sector.bounds);

                        if (isVisible) {
                            sector.update(this, environment);
                            // Add this sector's groups to visibility
                            const start = sector.batchGroupOffset;
                            const count = sector.batchGroupCount;
                            for (let i = start; i < start + count; i++) {
                                visibleGroups.push(originalGroups[i]);
                            }
                        }
                    });

                    if (visibleGroups.length > 0) {
                        batch.visible = true;
                        batchGeo.clearGroups();
                        visibleGroups.forEach(g => {
                            batchGeo.addGroup(g.start, g.count, g.materialIndex);
                        });
                    } else {
                        batch.visible = false;
                    }
                } else if (isTerrain && object.visible && !(object as any).batchGeometry) {
                    // Standalone terrain or fallback: update if visible
                    (object as any).update?.(this, environment);
                }
            });

            if (leafIndex !== null && leafIndex >= 0 && leafIndex !== this._lastLoggedStaticMeshLeaf) {
                console.log(`leaf #${leafIndex} meshes ${visibleCount}/${this.staticMeshMap.size}`);
                this._lastLoggedStaticMeshLeaf = leafIndex;
            }
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
        const activeZoneMask = leafOnlyMode ? (1n << 1n) : this.getActiveZoneMask(cameraPosition); // Zone 1 bitmask if leaf-only

        // CONSERVATIVE UE2: Use specific actor traversal with portal frustum checks
        // CONSERVATIVE UE2: Use specific actor traversal with portal frustum checks
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
            if (object.userData.isBatch) {
                const batchId = object.uuid;
                if (processedBatches.has(batchId)) return;
                processedBatches.add(batchId);

                const batchElements = object.userData.batchElements;
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