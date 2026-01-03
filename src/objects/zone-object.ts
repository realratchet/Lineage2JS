import { Box3, Color, Fog, Object3D, Sphere, Vector4, Mesh } from "three";

const tmpColor = new Color();
const tmpVec4 = new Vector4();

class ZoneObject extends Object3D {
    public fog: Fog = null;

    public readonly boundsRender = new Box3();
    public readonly boundsRenderSphere = new Sphere();

    public readonly isCullable: boolean = true;
    public readonly isZoneObject = true;
    public readonly type: "Zone" | "Sector" = "Zone";

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

class SectorObject extends Object3D {
    public readonly isSectorObject = true;
    public readonly type = "Sector";
    public readonly zones = new Object3D();
    public readonly helpers = new Object3D();

    public bspZones: BSPZoneData[];
    public bspNodes: BSPNodeData[];
    public bspLeaves: BSPLeafData[];
    public index: THREE.Vector2;
    public sunTexture: any; // MapData_T - texture with size info

    // NEW: BSP rendering data
    public bspSections?: GD.IBSPSectionDecodeInfo_T[];
    public nodeToSection?: number[];
    public nodeZoneMasks?: bigint[];
    public bspGroup?: THREE.Group;

    // Internal state for zone/leaf change tracking
    private _lastLoggedZone: number | null = null;
    private _lastLoggedLeaf: number | null = null;

    constructor() {
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
    private findPositionLeaf(position: THREE.Vector3): number | null {
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

    /**
     * Find camera leaf and build active zone mask.
     * Uses the leaf's visibleZones (PVS) to include all potentially visible zones.
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

        if (leafIndex === null || leafIndex < 0 || leafIndex >= this.bspLeaves.length) {
            // Fallback: use camera zone and connectivity
            const cameraZone = this.findPositionZone(cameraPosition);
            if (cameraZone === null || cameraZone < 0) {
                return (1n << 64n) - 1n; // All zones if we can't determine
            }

            // Use connectivity as fallback when PVS is unavailable
            let fallbackMask = 1n << BigInt(cameraZone);
            if (this.bspZones && cameraZone >= 0 && cameraZone < this.bspZones.length) {
                const zoneData = this.bspZones[cameraZone];
                if (zoneData && zoneData.connectivity) {
                    fallbackMask = zoneData.connectivity;
                    // Always include the camera zone
                    fallbackMask |= (1n << BigInt(cameraZone));
                }
            }

            return fallbackMask;
        }

        // Use the leaf's visibleZones bitmask (PVS data)
        const leaf = this.bspLeaves[leafIndex];
        const cameraZone = leaf.zone;

        // Check if PVS is valid and use it if available
        let activeZoneMask: bigint;
        const pvsMask = leaf.visibleZones;

        // If PVS is valid (not all zones or zero), use it as initial active zone mask
        // This is crucial for proper culling - PVS tells us which zones are potentially visible from this leaf
        if (pvsMask && pvsMask !== 0n && pvsMask !== (1n << 64n) - 1n) {
            activeZoneMask = pvsMask;
        } else {
            // Fallback to camera zone only
            if (cameraZone >= 0 && cameraZone < 64) {
                activeZoneMask = 1n << BigInt(cameraZone);
            } else {
                activeZoneMask = 1n;
            }
        }

        // Note: Portals will dynamically add more zones during BSP traversal (see traverseBSP)

        return activeZoneMask;
    }

    /**
     * Recursively process a coplanar node (matching UE2's ProcessNode recursion for iPlane).
     * This processes the coplanar node immediately during PASS_Plane, after portals have expanded.
     */
    private processCoplanarNode(
        nodeIndex: number,
        cameraPosition: THREE.Vector3,
        currentZoneMask: bigint,
        cameraFrustum: THREE.Frustum,
        frustumCullingEnabled: boolean,
        hasViewZone: boolean,
        visibleNodes: Set<number>
    ): void {
        if (nodeIndex < 0 || nodeIndex >= this.bspNodes.length) return;

        const node = this.bspNodes[nodeIndex];
        const cameraPos = tmpVec4.set(cameraPosition.x, cameraPosition.y, cameraPosition.z, -1);
        const planeDot = cameraPos.dot(node.plane);
        const isFront = planeDot >= 0;


        // Process portal expansion (same as PASS_Plane)
        const PF_Portal = 0x04000000;
        const nodeZone0 = node.zones[0];
        const nodeZone1 = node.zones[1];
        const hasPortalFlag = node.surfFlags !== undefined && (node.surfFlags & PF_Portal) !== 0;

        if (hasViewZone && hasPortalFlag && nodeZone0 >= 0 && nodeZone1 >= 0 && nodeZone0 !== nodeZone1) {
            const oppositeZone = isFront ? nodeZone0 : nodeZone1;
            if (oppositeZone >= 0 && oppositeZone < 64) {
                const oppositeZoneMask = 1n << BigInt(oppositeZone);
                if (!(currentZoneMask & oppositeZoneMask)) {
                    currentZoneMask |= oppositeZoneMask;
                }
            }
        }

        // Frustum culling
        let isInFrustum = true;
        if (frustumCullingEnabled) {
            isInFrustum = cameraFrustum.intersectsSphere(node.exclusiveSphereBound);
        }

        // Add to visible nodes if it has a section
        if (isInFrustum && this.nodeToSection && this.nodeToSection[nodeIndex] !== undefined && this.nodeToSection[nodeIndex] >= 0) {
            visibleNodes.add(nodeIndex);
        }

        // Recursively process coplanar nodes (UE2 line 1473)
        if (node.iPlane >= 0) {
            this.processCoplanarNode(node.iPlane, cameraPosition, currentZoneMask, cameraFrustum, frustumCullingEnabled, hasViewZone, visibleNodes);
        }
    }

    /**
     * Traverse BSP tree from camera position with zone mask culling.
     * Dynamically adds zones when portal nodes are encountered (matching UE2).
     * Applies frustum culling using camera frustum (matching UE2's RenderState.Zones[ZoneIndex].Visible).
     * Returns set of visible node indices.
     */
    public traverseBSP(cameraPosition: THREE.Vector3, activeZoneMask: bigint, cameraFrustum: THREE.Frustum, frustumCullingEnabled: boolean = true): { visibleNodes: Set<number>, finalZoneMask: bigint } {
        if (this.bspNodes.length === 0 || !this.nodeZoneMasks) return { visibleNodes: new Set(), finalZoneMask: activeZoneMask };

        const visibleNodes = new Set<number>();
        const cameraPos = tmpVec4.set(cameraPosition.x, cameraPosition.y, cameraPosition.z, -1);

        // Track active zone mask (will be updated when portals are encountered)
        let currentZoneMask = activeZoneMask;

        // Get camera zone (ViewZone equivalent) for zone mask culling check
        const cameraZone = this.findPositionZone(cameraPosition);
        const hasViewZone = cameraZone !== null && cameraZone >= 0;

        // Root node should always be traversed (it's the entry point to the tree)
        // Zone mask culling will apply to child nodes, but root must be checked

        let portalCount = 0;
        let culledCount = 0;
        const portalsEncountered: Array<{ nodeIndex: number; zones: [number, number]; oppositeZone: number }> = [];

        // Stack-based BSP traversal (matching UE2's approach)
        const nodeStack: { nodeIndex: number; pass: "front" | "plane" }[] = [];



        // Start from root node
        nodeStack.push({ nodeIndex: 0, pass: "front" });

        while (nodeStack.length > 0) {
            const { nodeIndex, pass } = nodeStack.pop()!;
            const node = this.bspNodes[nodeIndex];


            if (pass === "front") {
                // Zone mask rejection (skip entire subtree if not visible)
                // UE2 check (line 1791): if(SceneNode->ViewZone && !(Node.ZoneMask & RenderState.ActiveZoneMask))
                // This means: if ViewZone exists AND node's ZoneMask doesn't overlap with ActiveZoneMask, skip subtree
                // Note: Root node (0) should always be traversed
                const nodeZoneMask = this.nodeZoneMasks[nodeIndex];

                // UE2 exact logic: if(SceneNode->ViewZone && !(Node.ZoneMask & RenderState.ActiveZoneMask))
                if (nodeIndex !== 0 && hasViewZone && nodeZoneMask && nodeZoneMask !== 0n && currentZoneMask !== 0n) {
                    const hasOverlap = !!(nodeZoneMask & currentZoneMask);
                    if (!hasOverlap) {
                        // No overlap with current active zones - skip this subtree (exact UE2 behavior)
                        culledCount++;
                        continue;
                    }
                }

                // Determine which side of the plane the camera is on
                const planeDot = cameraPos.dot(node.plane);
                const isFront = planeDot >= 0;

                // Push children first
                const farChild = isFront ? node.back : node.front;
                if (farChild >= 0) {
                    nodeStack.push({ nodeIndex: farChild, pass: "front" });
                }

                const nearChild = isFront ? node.front : node.back;
                if (nearChild >= 0) {
                    nodeStack.push({ nodeIndex: nearChild, pass: "front" });
                }

                // Push plane pass last (so it gets processed after children with LIFO)
                nodeStack.push({ nodeIndex: nodeIndex, pass: "plane" });
            } else {
                // Second pass - process the node itself (it's visible)
                // Recalculate which side of the plane the camera is on
                const planeDot = cameraPos.dot(node.plane);
                const isFront = planeDot >= 0;

                // UE2 portal check (line 1177): ViewZone && Surf.PolyFlags & PF_Portal
                // Portal processing (line 1187): Node.iZone[0] != Node.iZone[1]
                // Opposite zone (line 1192, 1274): Node.iZone[1 - IsFront]
                const PF_Portal = 0x04000000;
                const nodeZone0 = node.zones[0];
                const nodeZone1 = node.zones[1];
                const hasPortalFlag = node.surfFlags !== undefined && (node.surfFlags & PF_Portal) !== 0;

                // UE2 line 1177: Portal check requires ViewZone AND PF_Portal flag
                // UE2 line 1187: Portal processing requires Node.iZone[0] != Node.iZone[1]
                if (hasViewZone && hasPortalFlag && nodeZone0 >= 0 && nodeZone1 >= 0 && nodeZone0 !== nodeZone1) {
                    portalCount++;
                    // UE2 line 1192, 1274: iOppositeZone = Node.iZone[1 - IsFront]
                    // If IsFront = 1 (true), opposite is Node.iZone[0]
                    // If IsFront = 0 (false), opposite is Node.iZone[1]
                    const oppositeZone = isFront ? nodeZone0 : nodeZone1;

                    if (oppositeZone >= 0 && oppositeZone < 64) {
                        const oppositeZoneMask = 1n << BigInt(oppositeZone);
                        const wasAlreadyInMask = !!(currentZoneMask & oppositeZoneMask);

                        // UE2 line 1276-1279: Add zone unconditionally if not already in mask
                        if (!wasAlreadyInMask) {
                            currentZoneMask |= oppositeZoneMask;
                            portalsEncountered.push({ nodeIndex, zones: [nodeZone0, nodeZone1], oppositeZone });
                        }
                    }
                }

                // Frustum culling: Check if node is visible in frustum (matching UE2's RenderState.Zones[ZoneIndex].Visible)
                // UE2 line 1102: RenderState.Zones[RenderState.SceneNode->ViewZone ? Node.iZone[IsFront] : 0].Visible(Node.ExclusiveSphereBound)
                // Use precomputed sphere boundary for frustum check
                let isInFrustum = true;
                if (frustumCullingEnabled) {
                    isInFrustum = cameraFrustum.intersectsSphere(node.exclusiveSphereBound);
                }

                // UE2 line 1366: Only add nodes if Node.iSection != INDEX_NONE (has geometry)
                // Zone mask culling already happened on PASS_Front, so if we reach here, the node's zone mask overlaps with active zones
                // We just need to check frustum culling and that the node has a section
                if (isInFrustum && this.nodeToSection && this.nodeToSection[nodeIndex] !== undefined && this.nodeToSection[nodeIndex] >= 0) {
                    visibleNodes.add(nodeIndex);
                }

                // UE2 line 1472-1473: Process coplanar nodes recursively (nodes on the same plane)
                // ProcessNode calls ProcessNode recursively for coplanar nodes, not via stack
                // This ensures coplanar nodes are processed immediately during PASS_Plane (after portals expand)
                if (node.iPlane >= 0) {
                    // Recursively process coplanar node (matching UE2's ProcessNode recursion)
                    // This processes the coplanar node immediately during PASS_Plane, after portals have expanded
                    this.processCoplanarNode(node.iPlane, cameraPosition, currentZoneMask, cameraFrustum, frustumCullingEnabled, hasViewZone, visibleNodes);
                }

            }
        }


        return { visibleNodes, finalZoneMask: currentZoneMask };
    }

    /**
     * Update visible BSP sections based on camera position.
     * Only sections containing visible nodes will be rendered.
     */
    public updateVisibleBSPSections(cameraPosition: THREE.Vector3, cameraFrustum: THREE.Frustum, frustumCullingEnabled: boolean = true) {
        if (!this.bspGroup || !this.bspSections || !this.nodeToSection) return;

        // Find active zone mask and camera zone (from leaf for reliability)
        const activeZoneMask = this.getActiveZoneMask(cameraPosition);

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
        const { visibleNodes, finalZoneMask } = this.traverseBSP(cameraPosition, activeZoneMask, cameraFrustum, frustumCullingEnabled);


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
}

class BSPZoneData {
    public connectivity: bigint;
    public visibility: bigint;

    protected constructor() { }

    public static fromInfo(info: GD.IBSPZoneDecodeInfo_T) {
        const zone = new BSPZoneData();

        zone.connectivity = info.connectivity
        zone.visibility = info.visibility;

        return zone;
    }
}

class BSPLeafData {
    public zone: number
    public permiating: number
    public volumetric: number
    public visibleZones: bigint

    protected constructor() { }

    public static fromInfo(info: GD.IBSPLeafDecodeInfo_T) {
        const leaf = new BSPLeafData();

        leaf.zone = info.zone;
        leaf.permiating = info.permiating;
        leaf.volumetric = info.volumetric;
        leaf.visibleZones = info.visibleZones;

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