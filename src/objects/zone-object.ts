import { Box3, Color, Fog, Object3D, Sphere, Vector4, Mesh } from "three";

const tmpColor = new Color();
const tmpVec4 = new Vector4();

interface IStaticMeshActorDecodeInfo {
    uuid: string;
    type: "StaticMeshActor";
    zoneMask: bigint; // Added for conservative culling
    bounds: {
        min: number[];
        max: number[];
    };
}

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
    public staticMeshGroup?: THREE.Group;
    public staticMeshMap: Map<string, THREE.Object3D> = new Map();
    protected _lastLoggedStaticMeshLeaf: number | null = null;

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
     */
    public traverseUnifiedBSP(
        cameraPosition: THREE.Vector3,
        activeZoneMask: bigint,
        cameraFrustum: THREE.Frustum,
        frustumCullingEnabled: boolean = true
    ): { visibleNodes: Set<number>, visibleLeaves: Set<number>, finalZoneMask: bigint } {
        const visibleNodes = new Set<number>();
        const visibleLeaves = new Set<number>();

        if (this.bspNodes.length === 0 || !this.nodeZoneMasks) {
            return { visibleNodes, visibleLeaves, finalZoneMask: activeZoneMask };
        }

        const cameraPos = tmpVec4.set(cameraPosition.x, cameraPosition.y, cameraPosition.z, -1);
        let currentZoneMask = activeZoneMask;

        const cameraZone = this.findPositionZone(cameraPosition);
        const hasViewZone = cameraZone !== null && cameraZone >= 0;

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
                if (nodeIndex !== 0 && hasViewZone && nodeZoneMask && nodeZoneMask !== 0n && currentZoneMask !== 0n) {
                    if (!(nodeZoneMask & currentZoneMask)) {
                        continue; // Cull this subtree
                    }
                }

                // 2. Determine side
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
                    // Check Far Leaf
                    if (farLeafIndex >= 0 && farLeafIndex < (this.bspLeaves?.length || 0)) {
                        const leaf = this.bspLeaves[farLeafIndex];
                        // Strict check: Only add leaf if its zone is currently active
                        if (leaf && leaf.zone >= 0 && ((1n << BigInt(leaf.zone)) & currentZoneMask)) {
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
                    // Check Near Leaf
                    if (nearLeafIndex >= 0 && nearLeafIndex < (this.bspLeaves?.length || 0)) {
                        const leaf = this.bspLeaves[nearLeafIndex];
                        // Strict check: Only add leaf if its zone is currently active
                        if (leaf && leaf.zone >= 0 && ((1n << BigInt(leaf.zone)) & currentZoneMask)) {
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
                        const portalVisible = !frustumCullingEnabled || cameraFrustum.intersectsSphere(currentNode.exclusiveSphereBound);

                        if (portalVisible) {
                            // Determine side for this specific node (coplanar nodes share plane, so same dot sign usually)
                            // But standard says use the node's own plane slightly? No, they are coplanar.
                            // However, we just need to know which zone is "opposite".
                            // For portal nodes, usually the "Front" or "Back" zone logic applies.
                            // In traverseBSP we re-calculated dot.
                            const planeDot = cameraPos.dot(currentNode.plane);
                            const isFront = planeDot >= 0;

                            const oppositeZone = isFront ? nodeZone0 : nodeZone1; // [0]=Back, [1]=Front ?? 
                            // Wait, in previous code: oppositeZone = isFront ? nodeZone0 : nodeZone1;
                            // If isFront, we are in Front. Portal connects Front and Back.
                            // Opposite should be Back zone. 
                            // zones[0] is Back zone? zones[1] is Front zone?
                            // Checked findPositionZone: side >= 0 ? node.zones[1] : node.zones[0].
                            // So zones[1] IS FRONT. zones[0] IS BACK.
                            // If we are in Front (isFront=true), opposite is Back (zones[0]).
                            // So `isFront ? nodeZone0 : nodeZone1` is CORRECT.

                            if (oppositeZone >= 0 && oppositeZone < 64) {
                                currentZoneMask |= (1n << BigInt(oppositeZone));
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

        return { visibleNodes, visibleLeaves, finalZoneMask: currentZoneMask };
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
        // Traverse BSP to find visible nodes (with optional frustum culling)
        const { visibleNodes, finalZoneMask } = this.traverseUnifiedBSP(cameraPosition, activeZoneMask, cameraFrustum, frustumCullingEnabled);


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




    public updateVisibleStaticMeshActors(cameraPosition: THREE.Vector3, cameraFrustum: THREE.Frustum, frustumCullingEnabled: boolean = true) {
        const library = (this as any).decodeLibrary as GD.DecodeLibrary;
        if (!library || !this.staticMeshGroup || this.staticMeshMap.size === 0) return;

        const activeZoneMask = this.getActiveZoneMask(cameraPosition);

        // CONSERVATIVE UE2: Use specific actor traversal with portal frustum checks
        // CONSERVATIVE UE2: Use specific actor traversal with portal frustum checks
        const { finalZoneMask, visibleLeaves } = this.traverseUnifiedBSP(cameraPosition, activeZoneMask, cameraFrustum, frustumCullingEnabled);

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
        this.staticMeshMap.forEach((object, uuid) => {
            const isVisible = visibleActorUuids.has(uuid);
            object.visible = isVisible;
            if (isVisible) visibleCount++;
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