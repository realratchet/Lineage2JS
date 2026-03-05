import { Object3D, Group, Box3Helper, Box3, Vector3, ArrowHelper, Color, Mesh, BoxGeometry, MeshBasicMaterial, Frustum, Line, LineBasicMaterial, BufferGeometry, SphereGeometry } from "three";
import { ColorByte } from "../utils/color-byte";

type SectorObject = import("../objects/zone-object").SectorObject;

export enum VisualizerMode {
    None = 0,
    Portals = 1,
    Zones = 2,
    Leaves = 3,
    Fogs = 4,
    MusicVolumes = 5,
}

export enum LeafVisualizerDetail {
    /**
     * Automatically switches to a decluttered view when there are lots of leaves visible.
     */
    Auto = 0,
    /**
     * Draw one box per visible leaf (can get very noisy).
     */
    PerLeaf = 1,
    /**
     * Aggregate/union visible leaf bounds per zone (much cleaner).
     */
    PerZone = 2,
}

export interface FogSourceColors {
    fog: ColorByte;
    sky: ColorByte;
    cloud: ColorByte;
    haze: ColorByte;
}

export interface GlobalEnvColors {
    fog: ColorByte;
    sky: ColorByte;
    cloud1: ColorByte;
    cloud2: ColorByte;
    cloud3: ColorByte;
    sun: ColorByte;
    haze: ColorByte;
}

export interface ZoneFogData {
    isFogZone: boolean;
    color: ColorByte;
    start: number;
    end: number;
}

class Visualizer {
    private readonly HUD_NAME_WIDTH = 8;
    private readonly group: Group;
    private readonly fogGroup: Group;
    private readonly hudElement: HTMLElement;
    private readonly hudColors: Map<string, { swatch: HTMLElement, hex: HTMLElement, alpha: HTMLElement }> = new Map();
    private enabled: boolean = false;
    private mode: VisualizerMode = VisualizerMode.None;

    public setMode(mode: VisualizerMode): void {
        this.mode = mode;
        this.updateVisualizations();
    }
    private portalVisualizations: Object3D[] = [];
    private zoneVisualizations: Object3D[] = [];
    private leafVisualizations: Object3D[] = [];
    private fogVisualizations: Object3D[] = [];
    private musicVolumeVisualizations: Object3D[] = [];
    private leafDetail: LeafVisualizerDetail = LeafVisualizerDetail.Auto;
    private readonly leafAutoAggregateThreshold: number = 200;

    constructor(scene: Object3D) {
        this.group = new Group();
        this.group.name = "Visualizers";
        // Render on top - set renderOrder high
        this.group.renderOrder = 999;
        // Don't participate in culling
        scene.add(this.group);

        this.fogGroup = new Group();
        this.fogGroup.name = "FogVisualizers";
        this.fogGroup.renderOrder = 999;
        scene.add(this.fogGroup);

        this.hudElement = this.initHUD();
        document.body.appendChild(this.hudElement);
    }

    private createHudRow(container: HTMLElement, name: string, prefix: string): void {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.marginBottom = "4px";

        const swatch = document.createElement("div");
        Object.assign(swatch.style, {
            width: "16px",
            height: "16px",
            border: "1px solid #fff",
            marginRight: "8px",
            backgroundColor: "#000",
            flexShrink: "0"
        });

        const label = document.createElement("span");
        label.innerText = name.padEnd(this.HUD_NAME_WIDTH, " ");
        label.style.whiteSpace = "pre";

        const rgbDisplay = document.createElement("span");
        rgbDisplay.innerText = "  0,   0,   0";
        rgbDisplay.style.marginLeft = "12px";
        rgbDisplay.style.color = "#aaa";
        rgbDisplay.style.width = "100px";
        rgbDisplay.style.textAlign = "right";

        const alpha = document.createElement("span");
        alpha.innerText = "255";
        alpha.style.marginLeft = "12px";
        alpha.style.color = "#888";
        alpha.style.width = "24px";
        alpha.style.textAlign = "right";

        row.appendChild(swatch);
        row.appendChild(label);
        row.appendChild(rgbDisplay);
        row.appendChild(alpha);
        container.appendChild(row);

        this.hudColors.set(`${prefix}:${name}`, { swatch, rgbDisplay, alpha } as any);
    }

    private initHUD(): HTMLElement {
        const hud = document.createElement("div");
        hud.id = "env-color-hud-container";
        Object.assign(hud.style, {
            position: "fixed",
            top: "10px",
            left: "10px",
            display: "none",
            flexDirection: "column",
            gap: "10px",
            pointerEvents: "none",
            zIndex: "10001"
        });

        const createPanel = (titleText: string) => {
            const panel = document.createElement("div");
            Object.assign(panel.style, {
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                color: "#fff",
                padding: "10px",
                borderRadius: "5px",
                fontFamily: "monospace",
                fontSize: "12px",
                border: "1px solid #444",
                boxShadow: "0 0 10px rgba(0,0,0,0.5)"
            });

            const title = document.createElement("div");
            title.innerText = titleText;
            title.style.fontWeight = "bold";
            title.style.marginBottom = "8px";
            title.style.borderBottom = "1px solid #444";
            title.style.paddingBottom = "4px";
            panel.appendChild(title);
            return panel;
        };

        // Panel 1: Fog Source Colors
        const fogPanel = createPanel("FOG SOURCE COLORS");
        ["Fog", "Sky", "Cloud", "Haze"].forEach(name => this.createHudRow(fogPanel, name, "fog"));
        hud.appendChild(fogPanel);

        // Panel 2: Global Environment Colors
        const globalPanel = createPanel("GLOBAL ENVIRONMENT");
        ["Fog", "Sky", "Cloud 1", "Cloud 2", "Cloud 3", "Sun", "Haze"].forEach(name => this.createHudRow(globalPanel, name, "global"));
        hud.appendChild(globalPanel);

        // Panel 3: Zone Fog Colors
        const zonePanel = createPanel("ZONE FOG COLORS");
        this.createHudRow(zonePanel, "Fog Color", "zone");
        this.createHudRow(zonePanel, "Fog Start", "zone");
        this.createHudRow(zonePanel, "Fog End", "zone");
        this.createHudRow(zonePanel, "Fog Zone", "zone");
        hud.appendChild(zonePanel);

        return hud;
    }

    public updateHUD(activeFogColors?: FogSourceColors, globalEnvColors?: GlobalEnvColors, zoneFogData?: ZoneFogData): void {
        if (!this.enabled || this.mode !== VisualizerMode.Fogs) return;

        const updateEntry = (prefix: string, name: string, color?: ColorByte) => {
            const entry = this.hudColors.get(`${prefix}:${name}`) as any;
            if (entry) {
                if (color) {
                    const hexValue = color.toHex();
                    entry.swatch.style.backgroundColor = hexValue;

                    const r = Math.round(color.r).toString().padStart(3, " ");
                    const g = Math.round(color.g).toString().padStart(3, " ");
                    const b = Math.round(color.b).toString().padStart(3, " ");
                    entry.rgbDisplay.innerText = `${r}, ${g}, ${b}`;

                    entry.alpha.innerText = Math.round(color.a).toString();
                } else {
                    entry.swatch.style.backgroundColor = "#000";
                    entry.rgbDisplay.innerText = "---, ---, ---";
                    entry.alpha.innerText = "---";
                }
            }
        };

        // Update Fog Source
        if (activeFogColors) {
            updateEntry("fog", "Fog", activeFogColors.fog);
            updateEntry("fog", "Sky", activeFogColors.sky);
            updateEntry("fog", "Cloud", activeFogColors.cloud);
            updateEntry("fog", "Haze", activeFogColors.haze);
        } else {
            ["Fog", "Sky", "Cloud", "Haze"].forEach(n => updateEntry("fog", n));
        }

        // Update Global Environment
        if (globalEnvColors) {
            updateEntry("global", "Fog", globalEnvColors.fog);
            updateEntry("global", "Sky", globalEnvColors.sky);
            updateEntry("global", "Cloud 1", globalEnvColors.cloud1);
            updateEntry("global", "Cloud 2", globalEnvColors.cloud2);
            updateEntry("global", "Cloud 3", globalEnvColors.cloud3);
            updateEntry("global", "Sun", globalEnvColors.sun);
            updateEntry("global", "Haze", globalEnvColors.haze);
        } else {
            ["Fog", "Sky", "Cloud 1", "Cloud 2", "Cloud 3", "Sun", "Haze"].forEach(n => updateEntry("global", n));
        }

        // Update Zone Fog
        if (zoneFogData) {
            updateEntry("zone", "Fog Color", zoneFogData.color);

            // Re-purpose RGB display for numbers
            const startEntry = this.hudColors.get("zone:Fog Start") as any;
            if (startEntry) {
                startEntry.rgbDisplay.innerText = Math.round(zoneFogData.start).toString().padStart(11, " ");
                startEntry.alpha.innerText = "";
            }
            const endEntry = this.hudColors.get("zone:Fog End") as any;
            if (endEntry) {
                endEntry.rgbDisplay.innerText = Math.round(zoneFogData.end).toString().padStart(11, " ");
                endEntry.alpha.innerText = "";
            }
            const zoneEntry = this.hudColors.get("zone:Fog Zone") as any;
            if (zoneEntry) {
                zoneEntry.rgbDisplay.innerText = zoneFogData.isFogZone ? "        YES" : "         NO";
                zoneEntry.alpha.innerText = "";
                zoneEntry.swatch.style.backgroundColor = zoneFogData.isFogZone ? "#0f0" : "#f00";
            }
        } else {
            updateEntry("zone", "Fog Color");
            ["Fog Start", "Fog End", "Fog Zone"].forEach(n => {
                const entry = this.hudColors.get(`zone:${n}`) as any;
                if (entry) {
                    entry.rgbDisplay.innerText = "---, ---, ---";
                    entry.alpha.innerText = "---";
                }
            });
        }
    }

    public toggle(): void {
        this.enabled = !this.enabled;
        this.updateVisibility();
        console.log(`Visualizer ${this.enabled ? "enabled" : "disabled"} (Mode: ${VisualizerMode[this.mode]})`);
    }

    public nextMode(): void {
        // Only cycle through actual visualization modes (exclude None)
        const visualizationModes: VisualizerMode[] = [];
        for (const key in VisualizerMode) {
            const modeValue = VisualizerMode[key as keyof typeof VisualizerMode];
            if (typeof modeValue === 'number' && modeValue !== VisualizerMode.None) {
                visualizationModes.push(modeValue);
            }
        }

        if (visualizationModes.length === 0) {
            return; // No visualization modes available
        }

        // If currently None or disabled, start with first visualization mode
        if (this.mode === VisualizerMode.None || !this.enabled) {
            this.mode = visualizationModes[0];
            this.enabled = true;
        } else {
            // Cycle through visualization modes
            const currentIndex = visualizationModes.indexOf(this.mode);
            const nextIndex = (currentIndex + 1) % visualizationModes.length;
            this.mode = visualizationModes[nextIndex];
        }

        this.updateVisualizations();
        console.log(`Visualizer mode: ${VisualizerMode[this.mode]}`);
    }

    public nextLeafDetail(): void {
        // Only meaningful while Leaves mode is active, but harmless otherwise.
        const details: LeafVisualizerDetail[] = [
            LeafVisualizerDetail.Auto,
            LeafVisualizerDetail.PerLeaf,
            LeafVisualizerDetail.PerZone,
        ];

        const idx = details.indexOf(this.leafDetail);
        this.leafDetail = details[(idx + 1) % details.length];
        console.log(`Leaf visualizer detail: ${LeafVisualizerDetail[this.leafDetail]}`);
    }

    private updateVisibility(): void {
        this.group.visible = this.enabled && this.mode !== VisualizerMode.None;
        // Fogs are only visible in Fogs mode
        const isFogMode = this.enabled && this.mode === VisualizerMode.Fogs;
        this.fogGroup.visible = isFogMode;
        if (this.hudElement) {
            this.hudElement.style.display = isFogMode ? "flex" : "none";
        }
    }

    private updateVisualizations(): void {
        this.clearVisualizations();
        this.updateVisibility();

        if (!this.enabled || this.mode === VisualizerMode.None) {
            return;
        }

        switch (this.mode) {
            case VisualizerMode.Portals:
                // Portals will be added via updatePortals()
                break;
            case VisualizerMode.Zones:
                // Zones will be added via updateZones()
                break;
            case VisualizerMode.Leaves:
                // Leaves will be added via updateLeaves()
                break;
            case VisualizerMode.Fogs:
                // Fogs will be added via updateFogs()
                break;
            case VisualizerMode.MusicVolumes:
                // MusicVolumes will be added via updateMusicVolumes()
                break;
        }
    }

    public updatePortals(sectors: Map<number, Map<number, SectorObject>>, cameraPosition?: Vector3): void {
        if (!this.enabled || this.mode !== VisualizerMode.Portals) {
            return;
        }

        this.clearPortalVisualizations();

        const PF_Portal = 0x04000000;
        const visiblePortalColor = new Color(0x00ff00); // Green for visible portals
        const hiddenPortalColor = new Color(0x004400); // Dark green for hidden portals
        const arrowColor = new Color(0xffff00); // Yellow for direction arrows

        for (const [, sectorYMap] of sectors) {
            for (const [, sector] of sectorYMap) {
                if (!sector.bspNodes || !sector.nodeZoneMasks) {
                    continue;
                }

                // Only show helpers for sectors where camera is inside
                if (cameraPosition) {
                    const cameraLeaf = sector.findPositionLeaf(cameraPosition);
                    const isCameraInSector = cameraLeaf !== null && cameraLeaf >= 0;
                    if (!isCameraInSector) {
                        continue; // Skip sectors where camera is outside
                    }
                }

                // Get active zone mask for this sector if camera position is provided
                let activeZoneMask: bigint | null = null;
                if (cameraPosition) {
                    activeZoneMask = sector.getActiveZoneMask(cameraPosition);
                }

                for (let nodeIndex = 0; nodeIndex < sector.bspNodes.length; nodeIndex++) {
                    const node = sector.bspNodes[nodeIndex];
                    const hasPortalFlag = node.surfFlags !== undefined && (node.surfFlags & PF_Portal) !== 0;

                    if (hasPortalFlag && node.zones[0] >= 0 && node.zones[1] >= 0 && node.zones[0] !== node.zones[1]) {
                        // Determine if portal is visible from camera
                        let isVisible = true;
                        if (activeZoneMask !== null) {
                            // Portal is visible if either of its zones is in the active zone mask
                            const zone0Mask = 1n << BigInt(node.zones[0]);
                            const zone1Mask = 1n << BigInt(node.zones[1]);
                            isVisible = !!(activeZoneMask & zone0Mask) || !!(activeZoneMask & zone1Mask);
                        }

                        const portalColor = isVisible ? visiblePortalColor : hiddenPortalColor;

                        // Create AABB visualization from exclusive sphere bound
                        const sphere = node.exclusiveSphereBound;
                        const box = new Box3();
                        box.setFromCenterAndSize(sphere.center, new Vector3(sphere.radius * 2, sphere.radius * 2, sphere.radius * 2));

                        // Create box helper
                        const boxHelper = new Box3Helper(box, portalColor);
                        const boxMaterial = Array.isArray(boxHelper.material) ? boxHelper.material[0] : boxHelper.material;
                        if (boxMaterial) {
                            (boxMaterial as any).linewidth = 2;
                            boxMaterial.transparent = true;
                            boxMaterial.depthTest = false; // Always render on top
                            boxMaterial.depthWrite = false;
                        }
                        boxHelper.renderOrder = 1000; // Render on top
                        this.portalVisualizations.push(boxHelper);
                        this.group.add(boxHelper);

                        // Create direction arrow
                        // Portal direction: from zone[0] (back) to zone[1] (front)
                        // Arrow points in the direction of the plane normal
                        const planeNormal = new Vector3(node.plane.x, node.plane.y, node.plane.z).normalize();
                        const arrowLength = sphere.radius * 0.5;
                        const arrow = new ArrowHelper(planeNormal, sphere.center, arrowLength, arrowColor, arrowLength * 0.3, arrowLength * 0.2);
                        // Update arrow materials to render on top
                        if (arrow.line) {
                            const lineMaterial = Array.isArray(arrow.line.material) ? arrow.line.material[0] : arrow.line.material;
                            if (lineMaterial) {
                                lineMaterial.transparent = true;
                                lineMaterial.depthTest = false;
                                lineMaterial.depthWrite = false;
                            }
                            arrow.line.renderOrder = 1000;
                        }
                        if (arrow.cone) {
                            const coneMaterial = Array.isArray(arrow.cone.material) ? arrow.cone.material[0] : arrow.cone.material;
                            if (coneMaterial) {
                                coneMaterial.transparent = true;
                                coneMaterial.depthTest = false;
                                coneMaterial.depthWrite = false;
                            }
                            arrow.cone.renderOrder = 1000;
                        }
                        arrow.renderOrder = 1000; // Render on top
                        this.portalVisualizations.push(arrow);
                        this.group.add(arrow);

                        // Add zone labels as simple text representation (using a small box for now)
                        // You could enhance this with actual text rendering later
                        const zoneLabel = new Mesh(
                            new BoxGeometry(10, 10, 10),
                            new MeshBasicMaterial({
                                color: portalColor,
                                transparent: true,
                                opacity: 0.5,
                                depthTest: false,
                                depthWrite: false
                            })
                        );
                        zoneLabel.position.copy(sphere.center);
                        zoneLabel.position.y += sphere.radius + 20;
                        zoneLabel.renderOrder = 1000; // Render on top
                        zoneLabel.userData.zone0 = node.zones[0];
                        zoneLabel.userData.zone1 = node.zones[1];
                        this.portalVisualizations.push(zoneLabel);
                        this.group.add(zoneLabel);
                    }
                }
            }
        }
    }

    private clearPortalVisualizations(): void {
        this.portalVisualizations.forEach(viz => {
            this.group.remove(viz);
            if (viz instanceof Mesh) {
                viz.geometry.dispose();
                const material = Array.isArray(viz.material) ? viz.material[0] : viz.material;
                if (material instanceof MeshBasicMaterial) {
                    material.dispose();
                }
            }
            // Box3Helper and ArrowHelper don't have dispose methods, just remove them
        });
        this.portalVisualizations = [];
    }

    public updateZones(sectors: Map<number, Map<number, SectorObject>>, cameraPosition?: Vector3): void {
        if (!this.enabled || this.mode !== VisualizerMode.Zones) {
            return;
        }

        this.clearZoneVisualizations();

        const visibleZoneColor = new Color(0x00ff00); // Green for visible zones
        const hiddenZoneColor = new Color(0x004400); // Dark green for hidden zones
        const activeConnectivityColor = new Color(0x00ffff); // Cyan for connectivity from active zones
        const inactiveConnectivityColor = new Color(0x444444); // Dark gray for connectivity from inactive zones

        for (const [, sectorYMap] of sectors) {
            for (const [, sector] of sectorYMap) {
                if (!sector.bspNodes || !sector.bspLeaves || !sector.bspZones) {
                    continue;
                }

                // Only show helpers for sectors where camera is inside
                if (cameraPosition) {
                    const cameraLeaf = sector.findPositionLeaf(cameraPosition);
                    const isCameraInSector = cameraLeaf !== null && cameraLeaf >= 0;
                    if (!isCameraInSector) {
                        continue; // Skip sectors where camera is outside
                    }
                }

                // Get active zone mask for visibility determination
                let activeZoneMask: bigint | null = null;
                if (cameraPosition) {
                    activeZoneMask = sector.getActiveZoneMask(cameraPosition);
                }

                // Compute bounds for each zone by aggregating from nodes/leaves
                const zoneBounds = new Map<number, Box3>();
                const zoneCenters = new Map<number, Vector3>();
                const zoneNodeCounts = new Map<number, number>();

                // Aggregate bounds from leaves (more accurate for zone representation)
                for (let leafIndex = 0; leafIndex < sector.bspLeaves.length; leafIndex++) {
                    const leaf = sector.bspLeaves[leafIndex];
                    if (leaf && leaf.zone >= 0 && leaf.zone < 64) {
                        // Find nodes that reference this leaf to get bounds
                        for (let nodeIndex = 0; nodeIndex < sector.bspNodes.length; nodeIndex++) {
                            const node = sector.bspNodes[nodeIndex];
                            if (node.leaves[0] === leafIndex || node.leaves[1] === leafIndex) {
                                let bounds: Box3 | null = null;

                                // Try collision bounds first
                                if (node.collision && node.collision.bounds) {
                                    const collisionBox = node.collision.bounds;
                                    if (collisionBox.min && collisionBox.max &&
                                        collisionBox.max.x > collisionBox.min.x &&
                                        collisionBox.max.y > collisionBox.min.y &&
                                        collisionBox.max.z > collisionBox.min.z) {
                                        bounds = collisionBox.clone();
                                    }
                                }

                                // Fallback to sphere bounds
                                if (!bounds) {
                                    const sphere = node.exclusiveSphereBound.radius > 0 ? node.exclusiveSphereBound : node.inclusiveSphereBound;
                                    if (sphere.radius > 0 && !isNaN(sphere.radius) && sphere.center) {
                                        bounds = new Box3();
                                        const size = Math.max(sphere.radius * 2, 100);
                                        bounds.setFromCenterAndSize(sphere.center, new Vector3(size, size, size));
                                    }
                                }

                                if (bounds) {
                                    const existing = zoneBounds.get(leaf.zone);
                                    if (existing) {
                                        existing.union(bounds);
                                    } else {
                                        zoneBounds.set(leaf.zone, bounds.clone());
                                    }
                                    zoneNodeCounts.set(leaf.zone, (zoneNodeCounts.get(leaf.zone) || 0) + 1);
                                }
                                break; // Found a node for this leaf, move to next leaf
                            }
                        }
                    }
                }

                // Calculate centers for each zone
                for (const [zoneIndex, bounds] of zoneBounds) {
                    const center = new Vector3();
                    bounds.getCenter(center);
                    zoneCenters.set(zoneIndex, center);
                }

                // Visualize zones
                for (const [zoneIndex, bounds] of zoneBounds) {
                    if (zoneIndex < 0 || zoneIndex >= 64) continue;

                    // Determine if zone is visible
                    let isVisible = true;
                    if (activeZoneMask !== null) {
                        const zoneBit = 1n << BigInt(zoneIndex);
                        isVisible = !!(activeZoneMask & zoneBit);
                    }

                    const zoneColor = isVisible ? visibleZoneColor : hiddenZoneColor;

                    // Create box helper for zone bounds
                    const boxHelper = new Box3Helper(bounds, zoneColor);
                    const boxMaterial = Array.isArray(boxHelper.material) ? boxHelper.material[0] : boxHelper.material;
                    if (boxMaterial) {
                        (boxMaterial as any).linewidth = 2;
                        boxMaterial.transparent = true;
                        boxMaterial.depthTest = false;
                        boxMaterial.depthWrite = false;
                    }
                    boxHelper.renderOrder = 1000;
                    boxHelper.userData.zoneIndex = zoneIndex;
                    this.zoneVisualizations.push(boxHelper);
                    this.group.add(boxHelper);

                    // Add zone label
                    const center = zoneCenters.get(zoneIndex);
                    if (center) {
                        const zoneLabel = new Mesh(
                            new BoxGeometry(20, 20, 20),
                            new MeshBasicMaterial({
                                color: zoneColor,
                                transparent: true,
                                opacity: 0.5,
                                depthTest: false,
                                depthWrite: false
                            })
                        );
                        zoneLabel.position.copy(center);
                        zoneLabel.position.y += bounds.max.y - bounds.min.y + 30;
                        zoneLabel.renderOrder = 1000;
                        zoneLabel.userData.zoneIndex = zoneIndex;
                        this.zoneVisualizations.push(zoneLabel);
                        this.group.add(zoneLabel);
                    }
                }

                // Visualize connectivity between zones
                for (let zoneIndex = 0; zoneIndex < 64; zoneIndex++) {
                    const zoneData = sector.bspZones[zoneIndex];
                    if (!zoneData || !zoneData.connectivity) continue;

                    const sourceCenter = zoneCenters.get(zoneIndex);
                    if (!sourceCenter) continue;

                    // Check if source zone is active
                    let isSourceActive = false;
                    if (activeZoneMask !== null) {
                        const sourceZoneBit = 1n << BigInt(zoneIndex);
                        isSourceActive = !!(activeZoneMask & sourceZoneBit);
                    }

                    // Draw lines to connected zones
                    for (let targetZoneIndex = 0; targetZoneIndex < 64; targetZoneIndex++) {
                        if (targetZoneIndex === zoneIndex) continue;

                        const zoneBit = 1n << BigInt(targetZoneIndex);
                        if (zoneData.connectivity & zoneBit) {
                            const targetCenter = zoneCenters.get(targetZoneIndex);
                            if (!targetCenter) continue;

                            // Determine connectivity color based on whether source zone is active
                            const connectivityColor = isSourceActive ? activeConnectivityColor : inactiveConnectivityColor;
                            const connectivityOpacity = isSourceActive ? 0.8 : 0.3;

                            // Create line geometry for connectivity
                            const geometry = new BufferGeometry().setFromPoints([sourceCenter, targetCenter]);
                            const material = new LineBasicMaterial({
                                color: connectivityColor,
                                transparent: true,
                                opacity: connectivityOpacity,
                                depthTest: false,
                                depthWrite: false,
                                linewidth: 1
                            });
                            const line = new Line(geometry, material);
                            line.renderOrder = 999; // Slightly below zone boxes
                            line.userData.sourceZone = zoneIndex;
                            line.userData.targetZone = targetZoneIndex;
                            this.zoneVisualizations.push(line);
                            this.group.add(line);
                        }
                    }
                }
            }
        }
    }

    private clearZoneVisualizations(): void {
        this.zoneVisualizations.forEach(viz => {
            this.group.remove(viz);
            if (viz instanceof Mesh) {
                viz.geometry.dispose();
                const material = Array.isArray(viz.material) ? viz.material[0] : viz.material;
                if (material instanceof MeshBasicMaterial) {
                    material.dispose();
                }
            } else if (viz instanceof Line) {
                viz.geometry.dispose();
                const material = viz.material;
                if (material instanceof LineBasicMaterial) {
                    material.dispose();
                }
            }
            // Box3Helper doesn't have dispose, just remove it
        });
        this.zoneVisualizations = [];
    }

    /**
     * Calculate the depth of each node in the BSP tree (distance from root).
     * Returns a map from node index to depth.
     */
    private calculateNodeDepths(bspNodes: any[]): Map<number, number> {
        const depths = new Map<number, number>();
        if (bspNodes.length === 0) {
            return depths;
        }

        // BFS from root (node 0)
        const queue: { nodeIndex: number; depth: number }[] = [{ nodeIndex: 0, depth: 0 }];
        depths.set(0, 0);

        while (queue.length > 0) {
            const { nodeIndex, depth } = queue.shift()!;
            const node = bspNodes[nodeIndex];

            if (!node) continue;

            // Process children
            const children = [node.front, node.back].filter(idx => idx >= 0);
            for (const childIndex of children) {
                if (!depths.has(childIndex)) {
                    depths.set(childIndex, depth + 1);
                    queue.push({ nodeIndex: childIndex, depth: depth + 1 });
                }
            }
        }

        return depths;
    }

    /**
     * Darken a color based on depth level.
     * Returns a darker shade of the original color.
     */
    private darkenColorByDepth(baseColor: Color, depth: number, maxDepth: number): Color {
        // Calculate darkness factor: 1.0 (full brightness) at depth 0, decreasing to ~0.3 at max depth
        // Use exponential decay for smoother transitions
        const maxDarkness = 0.3; // Minimum brightness (30%)
        const darknessFactor = 1.0 - (1.0 - maxDarkness) * (depth / Math.max(maxDepth, 1));

        const darkened = baseColor.clone();
        darkened.multiplyScalar(Math.max(darknessFactor, maxDarkness));
        return darkened;
    }

    public updateLeaves(sectors: Map<number, Map<number, SectorObject>>, cameraPosition?: Vector3, cameraFrustum?: THREE.Frustum, frustumCullingEnabled: boolean = true): void {
        if (!this.enabled || this.mode !== VisualizerMode.Leaves) {
            return;
        }

        this.clearLeafVisualizations();

        if (!cameraPosition) {
            return;
        }

        const directLeafColor = new Color(0x0088ff); // Blue for directly visible leaves (camera zone)
        const portalLeafColor = new Color(0xff8800); // Orange for leaves visible through portals

        for (const [, sectorYMap] of sectors) {
            for (const [, sector] of sectorYMap) {
                if (!sector.bspNodes || !sector.bspLeaves || !sector.nodeZoneMasks) {
                    continue;
                }

                // Only show helpers for sectors where camera is inside
                if (cameraPosition) {
                    const cameraLeaf = sector.findPositionLeaf(cameraPosition);
                    const isCameraInSector = cameraLeaf !== null && cameraLeaf >= 0;
                    if (!isCameraInSector) {
                        continue; // Skip sectors where camera is outside
                    }
                }

                // Calculate node depths for this sector
                const nodeDepths = this.calculateNodeDepths(sector.bspNodes);
                const maxDepth = nodeDepths.size > 0 ? Math.max(...Array.from(nodeDepths.values())) : 0;

                // Get initial active zone mask (before portal expansion)
                const initialZoneMask = sector.getActiveZoneMask(cameraPosition);
                const frustum = cameraFrustum || new Frustum();

                // Traverse BSP to get visible leaves and zones added through portals
                const { visibleLeaves, zonesAddedThroughPortals } = sector.traverseBSP(cameraPosition, initialZoneMask, frustum, frustumCullingEnabled);

                if (visibleLeaves.size === 0) {
                    continue; // No visible leaves in this sector
                }

                // Use the zonesAddedThroughPortals directly from traversal (more accurate)
                const portalAddedZones = zonesAddedThroughPortals;

                // Decide which detail mode to use for this frame (Auto can switch when noisy)
                const effectiveLeafDetail =
                    this.leafDetail === LeafVisualizerDetail.Auto
                        ? (visibleLeaves.size >= this.leafAutoAggregateThreshold ? LeafVisualizerDetail.PerZone : LeafVisualizerDetail.PerLeaf)
                        : this.leafDetail;

                // For each visible leaf, find the highest level (minimum depth) node that references it
                // Map: leafIndex -> { nodeIndex, depth }
                const leafToNodeMap = new Map<number, { nodeIndex: number; depth: number }>();

                // First pass: find the highest level (minimum depth) node for each visible leaf
                for (let nodeIndex = 0; nodeIndex < sector.bspNodes.length; nodeIndex++) {
                    const node = sector.bspNodes[nodeIndex];
                    const nodeDepth = nodeDepths.get(nodeIndex) ?? Infinity;

                    // Check both leaves this node references
                    for (let i = 0; i < 2; i++) {
                        const leafIndex = node.leaves[i];
                        if (leafIndex >= 0 && leafIndex < sector.bspLeaves.length && visibleLeaves.has(leafIndex)) {
                            const existing = leafToNodeMap.get(leafIndex);
                            // Keep the node with minimum depth (highest level)
                            if (!existing || nodeDepth < existing.depth) {
                                leafToNodeMap.set(leafIndex, { nodeIndex, depth: nodeDepth });
                            }
                        }
                    }
                }

                // Second pass: compute bounds per leaf (from its highest-level node), then either
                // visualize per-leaf or aggregate/union per-zone for decluttering.
                const leafBoxes = new Map<number, { box: Box3; zone: number; depth: number; isPortalLeaf: boolean }>();

                for (const [leafIndex, { nodeIndex, depth }] of leafToNodeMap) {
                    const node = sector.bspNodes[nodeIndex];
                    const leaf = sector.bspLeaves[leafIndex];

                    const zone = leaf?.zone ?? -1;
                    const isPortalLeaf = zone >= 0 && portalAddedZones.has(zone);

                    let box: Box3 | null = null;

                    // Try to get bounds from node's collision bounds first (most accurate)
                    if (node.collision && node.collision.bounds) {
                        const collisionBox = node.collision.bounds;
                        if (collisionBox.min && collisionBox.max &&
                            collisionBox.max.x > collisionBox.min.x &&
                            collisionBox.max.y > collisionBox.min.y &&
                            collisionBox.max.z > collisionBox.min.z) {
                            box = collisionBox.clone();
                        }
                    }

                    // Fallback to sphere bounds if collision bounds not available
                    if (!box) {
                        const exclusiveSphere = node.exclusiveSphereBound;
                        if (exclusiveSphere.radius > 0 && !isNaN(exclusiveSphere.radius) && exclusiveSphere.center &&
                            !isNaN(exclusiveSphere.center.x) && !isNaN(exclusiveSphere.center.y) && !isNaN(exclusiveSphere.center.z)) {
                            box = new Box3();
                            const size = Math.max(exclusiveSphere.radius * 2, 100);
                            box.setFromCenterAndSize(exclusiveSphere.center, new Vector3(size, size, size));
                        } else {
                            const inclusiveSphere = node.inclusiveSphereBound;
                            if (inclusiveSphere.radius > 0 && !isNaN(inclusiveSphere.radius) && inclusiveSphere.center &&
                                !isNaN(inclusiveSphere.center.x) && !isNaN(inclusiveSphere.center.y) && !isNaN(inclusiveSphere.center.z)) {
                                box = new Box3();
                                const size = Math.max(inclusiveSphere.radius * 2, 100);
                                box.setFromCenterAndSize(inclusiveSphere.center, new Vector3(size, size, size));
                            }
                        }
                    }

                    if (!box) continue;
                    leafBoxes.set(leafIndex, { box, zone, depth, isPortalLeaf });
                }

                if (effectiveLeafDetail === LeafVisualizerDetail.PerLeaf) {
                    for (const [leafIndex, info] of leafBoxes) {
                        const baseColor = info.isPortalLeaf ? portalLeafColor : directLeafColor;
                        const leafColor = this.darkenColorByDepth(baseColor, info.depth, maxDepth);

                        const boxHelper = new Box3Helper(info.box, leafColor);
                        const boxMaterial = Array.isArray(boxHelper.material) ? boxHelper.material[0] : boxHelper.material;
                        if (boxMaterial) {
                            (boxMaterial as any).linewidth = 2;
                            boxMaterial.transparent = true;
                            boxMaterial.depthTest = false;
                            boxMaterial.depthWrite = false;
                        }
                        boxHelper.renderOrder = 1000;
                        boxHelper.userData.leafIndex = leafIndex;
                        boxHelper.userData.zone = info.zone;
                        boxHelper.userData.depth = info.depth;
                        this.leafVisualizations.push(boxHelper);
                        this.group.add(boxHelper);
                    }
                } else {
                    // Aggregate per zone: union all visible leaf bounds for each zone.
                    const zoneUnion = new Map<number, { box: Box3; minDepth: number; anyPortalLeaf: boolean; leafCount: number }>();

                    for (const [, info] of leafBoxes) {
                        if (info.zone < 0 || info.zone >= 64) continue;
                        const existing = zoneUnion.get(info.zone);
                        if (!existing) {
                            zoneUnion.set(info.zone, {
                                box: info.box.clone(),
                                minDepth: info.depth,
                                anyPortalLeaf: info.isPortalLeaf,
                                leafCount: 1,
                            });
                        } else {
                            existing.box.union(info.box);
                            existing.minDepth = Math.min(existing.minDepth, info.depth);
                            existing.anyPortalLeaf = existing.anyPortalLeaf || info.isPortalLeaf;
                            existing.leafCount++;
                        }
                    }

                    for (const [zone, agg] of zoneUnion) {
                        const baseColor = agg.anyPortalLeaf ? portalLeafColor : directLeafColor;
                        const zoneColor = this.darkenColorByDepth(baseColor, agg.minDepth, maxDepth);

                        const boxHelper = new Box3Helper(agg.box, zoneColor);
                        const boxMaterial = Array.isArray(boxHelper.material) ? boxHelper.material[0] : boxHelper.material;
                        if (boxMaterial) {
                            (boxMaterial as any).linewidth = 2;
                            boxMaterial.transparent = true;
                            boxMaterial.depthTest = false;
                            boxMaterial.depthWrite = false;
                        }
                        boxHelper.renderOrder = 1000;
                        boxHelper.userData.zone = zone;
                        boxHelper.userData.leafCount = agg.leafCount;
                        boxHelper.userData.depth = agg.minDepth;
                        boxHelper.userData.aggregated = true;
                        this.leafVisualizations.push(boxHelper);
                        this.group.add(boxHelper);
                    }
                }

                // Debug: log results (only on first visualization or when issues occur)
                // Removed per-frame logging to avoid console spam
            }
        }
    }

    private clearLeafVisualizations(): void {
        this.leafVisualizations.forEach(viz => {
            this.group.remove(viz);
            if (viz instanceof Box3Helper) {
                // Box3Helper doesn't have dispose, just remove it
            } else if (viz instanceof Mesh) {
                viz.geometry.dispose();
                const material = Array.isArray(viz.material) ? viz.material[0] : viz.material;
                if (material instanceof MeshBasicMaterial) {
                    material.dispose();
                }
            }
        });
        this.leafVisualizations = [];
    }

    public updateFogs(sectors: Map<number, Map<number, SectorObject>>, activeFogUuid?: string): void {

        this.clearFogVisualizations();

        const activeFogColor = new Color(0x00ff00); // Green
        const inactiveFogColor = new Color(0xff0000); // Red

        for (const [, sectorYMap] of sectors) {
            for (const [, sector] of sectorYMap) {
                if (!sector.fogInfos) continue;

                for (const fogInfo of sector.fogInfos) {
                    const isActive = fogInfo.uuid === activeFogUuid;
                    const color = isActive ? activeFogColor : inactiveFogColor;

                    if (isActive) {
                        const affectRange = (fogInfo as any).affectRange;
                        const innerRadius = Math.min(affectRange.A, affectRange.B);
                        const outerRadius = Math.max(affectRange.A, affectRange.B);

                        const segments = 16;

                        // Outer radius (max)
                        const outerGeometry = new SphereGeometry(outerRadius, segments, segments);
                        const outerMaterial = new MeshBasicMaterial({
                            color: activeFogColor,
                            wireframe: true,
                            transparent: true,
                            opacity: 0.3,
                            depthTest: false,
                            depthWrite: false
                        });
                        const outerMesh = new Mesh(outerGeometry, outerMaterial);
                        outerMesh.position.copy(fogInfo.position);
                        outerMesh.renderOrder = 1000;
                        this.fogVisualizations.push(outerMesh);
                        this.fogGroup.add(outerMesh);

                        // Inner radius (min) - only if significantly different
                        if (outerRadius - innerRadius > 10) {
                            const innerGeometry = new SphereGeometry(innerRadius, segments, segments);
                            const innerMaterial = new MeshBasicMaterial({
                                color: new Color(0x00ffff), // Cyan for inner range
                                wireframe: true,
                                transparent: true,
                                opacity: 0.15,
                                depthTest: false,
                                depthWrite: false
                            });
                            const innerMesh = new Mesh(innerGeometry, innerMaterial);
                            innerMesh.position.copy(fogInfo.position);
                            innerMesh.renderOrder = 1000;
                            this.fogVisualizations.push(innerMesh);
                            this.fogGroup.add(innerMesh);
                        }
                    }

                    // Add a center point or label if needed
                    const centerPoint = new Mesh(
                        new BoxGeometry(20, 20, 20),
                        new MeshBasicMaterial({ color: color, depthTest: false, depthWrite: false })
                    );
                    centerPoint.position.copy(fogInfo.position);
                    centerPoint.renderOrder = 1000;
                    this.fogVisualizations.push(centerPoint);
                    this.fogGroup.add(centerPoint);
                }
            }
        }
    }

    private clearFogVisualizations(): void {
        this.fogVisualizations.forEach(viz => {
            this.fogGroup.remove(viz);
            if (viz instanceof Mesh) {
                viz.geometry.dispose();
                const material = Array.isArray(viz.material) ? viz.material[0] : viz.material;
                if (material instanceof MeshBasicMaterial) {
                    material.dispose();
                }
            }
        });
        this.fogVisualizations = [];
    }

    private clearVisualizations(): void {
        this.clearPortalVisualizations();
        this.clearZoneVisualizations();
        this.clearLeafVisualizations();
        this.clearFogVisualizations();
        this.clearMusicVolumeVisualizations();
    }

    public updateMusicVolumes(sectors: Map<number, Map<number, SectorObject>>, cameraPosition?: Vector3): void {
        if (!this.enabled || this.mode !== VisualizerMode.MusicVolumes) return;
        this.clearMusicVolumeVisualizations();
        if (!cameraPosition) return;

        const cx = cameraPosition.x, cy = cameraPosition.y, cz = cameraPosition.z;
        const insideColor = new Color(0x00ff00);
        const outsideColor = new Color(0xff4444);

        for (const [, sectorYMap] of sectors) {
            for (const [, sector] of sectorYMap) {
                if (!sector.musicVolumes || sector.musicVolumes.length === 0) continue;

                for (const vol of sector.musicVolumes) {
                    const nodes = vol.bsp.nodes;
                    if (nodes.length === 0) continue;

                    // Run PointCheck to determine if camera is inside
                    let outside = vol.bsp.isRootOutside;
                    if (nodes.length > 0) {
                        let iNode = 0;
                        let isFront = false;
                        do {
                            const node = nodes[iNode];
                            const p = node.plane;
                            const dist = p[0] * cx + p[1] * cy + p[2] * cz - p[3];
                            isFront = dist > 0;
                            if (isFront) outside = outside || node.isCsg;
                            else outside = outside && !node.isCsg;
                            iNode = isFront ? node.iFront : node.iBack;
                        } while (iNode !== -1);
                    }

                    const volColor = outside ? outsideColor : insideColor;

                    // Use bounds center (in UE2 coords, swap Y/Z for Three.js)
                    const box = vol.bounds.box;
                    if (!box) continue;
                    const bcx = (box.min[0] + box.max[0]) * 0.5;
                    const bcy = (box.min[2] + box.max[2]) * 0.5; // Y↔Z swap
                    const bcz = (box.min[1] + box.max[1]) * 0.5;
                    const bExtent = Math.max(
                        box.max[0] - box.min[0],
                        box.max[1] - box.min[1],
                        box.max[2] - box.min[2]
                    ) * 0.5;

                    // Visualize each BSP plane as an arrow projected from bounds center onto the plane
                    for (const node of nodes) {
                        const [nx, ny, nz, w] = node.plane;
                        // Project bounds center onto the plane: point = center + normal * (w - dot(center, normal))
                        const dot = nx * bcx + ny * bcy + nz * bcz;
                        const t = w - dot;
                        const ox = bcx + nx * t;
                        const oy = bcy + ny * t;
                        const oz = bcz + nz * t;
                        const origin = new Vector3(ox, oy, oz);
                        const dir = new Vector3(nx, ny, nz);
                        const arrowLen = Math.min(bExtent * 0.3, 500);
                        const arrow = new ArrowHelper(dir, origin, arrowLen, volColor.getHex(), arrowLen * 0.2, arrowLen * 0.1);
                        if (arrow.line) {
                            const lm = Array.isArray(arrow.line.material) ? arrow.line.material[0] : arrow.line.material;
                            if (lm) { lm.transparent = true; lm.depthTest = false; lm.depthWrite = false; }
                            arrow.line.renderOrder = 1000;
                        }
                        if (arrow.cone) {
                            const cm = Array.isArray(arrow.cone.material) ? arrow.cone.material[0] : arrow.cone.material;
                            if (cm) { cm.transparent = true; cm.depthTest = false; cm.depthWrite = false; }
                            arrow.cone.renderOrder = 1000;
                        }
                        arrow.renderOrder = 1000;
                        this.musicVolumeVisualizations.push(arrow);
                        this.group.add(arrow);
                    }

                    // Label at volume bounds center
                    const label = new Mesh(
                        new BoxGeometry(50, 50, 50),
                        new MeshBasicMaterial({ color: volColor, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false })
                    );
                    label.position.set(bcx, bcy, bcz);
                    label.renderOrder = 1000;
                    label.userData.musicId = vol.musicId;
                    label.userData.inside = !outside;
                    this.musicVolumeVisualizations.push(label);
                    this.group.add(label);
                }
            }
        }
    }

    private clearMusicVolumeVisualizations(): void {
        this.musicVolumeVisualizations.forEach(viz => {
            this.group.remove(viz);
            if (viz instanceof Mesh) {
                viz.geometry.dispose();
                const material = Array.isArray(viz.material) ? viz.material[0] : viz.material;
                if (material instanceof MeshBasicMaterial) material.dispose();
            }
        });
        this.musicVolumeVisualizations = [];
    }

    public getMode(): VisualizerMode {
        return this.mode;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public getGroup(): Group {
        return this.group;
    }

    public getFogGroup(): Group {
        return this.fogGroup;
    }
}

export default Visualizer;

