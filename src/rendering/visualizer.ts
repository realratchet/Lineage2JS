import { Object3D, Group, Box3Helper, Box3, Vector3, ArrowHelper, Color, Mesh, BoxGeometry, MeshBasicMaterial, Frustum, Line, LineBasicMaterial, BufferGeometry, SphereGeometry, Sprite, SpriteMaterial, CanvasTexture } from "three";
import { ColorByte } from "../utils/color-byte";

type SectorObject = import("../objects/zone-object").SectorObject;

export enum VisualizerMode {
    None = 0,
    Portals = 1,
    Zones = 2,
    Leaves = 3,
    Fogs = 4,
    Audio = 5,
    Emitters = 6,
}

export interface EmitterDebugInfo {
    uuid: string;
    name: string;
    type: string;
    worldPos: Vector3;
    distance: number;
    activeCount: number;
    maxParticles: number;
    isDisabled: boolean;
    isVisible: boolean;
    isManuallyHidden: boolean;
    // the wrapping "Emitter" actor (un-emitter.ts) that this sub-emitter (SpriteEmitter/
    // MeshEmitter/BeamEmitter, un-particle-emitter.ts) lives under - one actor can carry
    // several sub-emitters, and the HUD groups by this rather than listing them flat
    parentUuid: string;
    parentName: string;
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
    private readonly emitterLabelGroup: Group;
    private readonly hudElement: HTMLElement;
    private readonly audioHudElement: HTMLElement;
    private readonly emittersHudElement: HTMLElement;
    private readonly hudColors: Map<string, { swatch: HTMLElement, rgbDisplay: HTMLElement, alpha: HTMLElement }> = new Map();
    private readonly audioLines: Map<string, HTMLElement> = new Map();
    private readonly emitterLines: Map<string, HTMLElement> = new Map();
    // one wrapper per parent "Emitter" actor - `body` is where that actor's own
    // sub-emitter lines (from emitterLines) get appended, `header` shows its name/count
    private readonly emitterGroups: Map<string, { wrapper: HTMLElement, header: HTMLElement, body: HTMLElement }> = new Map();
    private readonly emitterLabels: Map<string, Sprite> = new Map();
    private readonly emitterCheckboxes: Map<string, HTMLInputElement> = new Map();
    private emitterMasterCheckbox: HTMLInputElement | null = null;
    private onEmitterToggle?: (uuid: string, visible: boolean) => void;
    private onEmitterToggleAll?: (visible: boolean) => void;
    private musicInfoElement: HTMLElement | null = null;
    private ambientListElement: HTMLElement | null = null;
    private emitterListElement: HTMLElement | null = null;
    private enabled: boolean = false;
    private mode: VisualizerMode = VisualizerMode.None;

    public setEmitterVisibilityHandlers(onToggle: (uuid: string, visible: boolean) => void, onToggleAll: (visible: boolean) => void): void {
        this.onEmitterToggle = onToggle;
        this.onEmitterToggleAll = onToggleAll;
    }

    public setMode(mode: VisualizerMode): void {
        this.mode = mode;
        this.updateVisualizations();
    }
    private portalVisualizations: Object3D[] = [];
    private zoneVisualizations: Object3D[] = [];
    private leafVisualizations: Object3D[] = [];
    private fogVisualizations: Object3D[] = [];
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

        this.emitterLabelGroup = new Group();
        this.emitterLabelGroup.name = "EmitterLabels";
        this.emitterLabelGroup.renderOrder = 1000;
        scene.add(this.emitterLabelGroup);

        this.hudElement = this.initHUD();
        this.audioHudElement = this.initAudioHUD();
        this.emittersHudElement = this.initEmittersHUD();
        document.body.appendChild(this.hudElement);
        document.body.appendChild(this.audioHudElement);
        document.body.appendChild(this.emittersHudElement);
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

    private initAudioHUD(): HTMLElement {
        const hud = document.createElement("div");
        hud.id = "audio-hud-container";
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
                boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                minWidth: "300px"
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

        const musicPanel = createPanel("MUSIC STATUS");
        this.musicInfoElement = document.createElement("div");
        this.musicInfoElement.style.whiteSpace = "pre";
        musicPanel.appendChild(this.musicInfoElement);
        hud.appendChild(musicPanel);

        const ambientPanel = createPanel("AMBIENT SOUNDS");
        this.ambientListElement = document.createElement("div");
        this.ambientListElement.style.display = "grid";
        this.ambientListElement.style.gridTemplateRows = "repeat(15, auto)";
        this.ambientListElement.style.gridAutoFlow = "column";
        this.ambientListElement.style.gap = "4px 20px";
        ambientPanel.appendChild(this.ambientListElement);
        hud.appendChild(ambientPanel);

        return hud;
    }

    private initEmittersHUD(): HTMLElement {
        const hud = document.createElement("div");
        hud.id = "emitters-hud-container";
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

        const panel = document.createElement("div");
        Object.assign(panel.style, {
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "#fff",
            padding: "10px",
            borderRadius: "5px",
            fontFamily: "monospace",
            fontSize: "12px",
            border: "1px solid #444",
            boxShadow: "0 0 10px rgba(0,0,0,0.5)",
            maxHeight: "80vh",
            overflowY: "auto",
            // the hud wrapper is pointer-events:none so empty space around the panel
            // doesn't eat clicks meant for camera control - the panel itself needs
            // pointer events back or its own scrollbar is inert
            pointerEvents: "auto"
        });

        const title = document.createElement("div");
        title.innerText = "EMITTERS (decoded, nearest first)";
        title.style.fontWeight = "bold";
        title.style.marginBottom = "4px";
        panel.appendChild(title);

        const masterRow = document.createElement("label");
        Object.assign(masterRow.style, {
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "8px",
            borderBottom: "1px solid #444",
            paddingBottom: "8px",
            cursor: "pointer"
        });
        this.emitterMasterCheckbox = document.createElement("input");
        this.emitterMasterCheckbox.type = "checkbox";
        this.emitterMasterCheckbox.checked = true;
        this.emitterMasterCheckbox.onchange = () => this.onEmitterToggleAll?.(this.emitterMasterCheckbox!.checked);
        const masterLabel = document.createElement("span");
        masterLabel.innerText = "Show all";
        masterRow.appendChild(this.emitterMasterCheckbox);
        masterRow.appendChild(masterLabel);
        panel.appendChild(masterRow);

        this.emitterListElement = document.createElement("div");
        Object.assign(this.emitterListElement.style, {
            // CSS multi-column instead of grid-auto-flow: entries are grouped by
            // parent actor (see updateEmitters) and a grid's column-then-row fill
            // order would happily slice a group in half at the column boundary;
            // multi-column text flow + break-inside:avoid on each group keeps a
            // parent and all its sub-emitters together in one column.
            columnCount: "3",
            columnGap: "20px"
        });
        panel.appendChild(this.emitterListElement);

        hud.appendChild(panel);
        return hud;
    }

    private makeTextSprite(text: string, color: string): Sprite {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const fontSize = 48;
        ctx.font = `${fontSize}px monospace`;
        const width = Math.ceil(ctx.measureText(text).width) + 20;
        const height = fontSize + 20;
        canvas.width = width;
        canvas.height = height;

        // measureText above ran against a freshly-resized (and thus cleared) canvas
        // context, so font/fill state needs reapplying after the resize
        ctx.font = `${fontSize}px monospace`;
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = color;
        ctx.fillText(text, 10, height / 2);

        const texture = new CanvasTexture(canvas);
        const material = new SpriteMaterial({
            map: texture,
            depthTest: false,
            depthWrite: false,
            transparent: true
        });
        const sprite = new Sprite(material);
        // world-unit size independent of camera distance would need per-frame
        // rescaling; a fixed world size is good enough for a debug overlay and
        // keeps this update-free between label content changes
        const scale = 40;
        sprite.scale.set(scale * (width / height), scale, 1);
        sprite.renderOrder = 1000;
        return sprite;
    }

    /**
     * Updates both the Emitters HUD list and the floating in-world labels.
     * `emitters` should already be sorted nearest-first and pre-filtered to a
     * reasonable count - this redraws a canvas texture per label, so it isn't meant
     * to run against thousands of entries per frame.
     */
    public updateEmitters(emitters: EmitterDebugInfo[]): void {
        if (!this.enabled || this.mode !== VisualizerMode.Emitters) return;

        if (this.emitterListElement) {
            // one "Emitter" actor can carry several sub-emitters (SpriteEmitter/
            // MeshEmitter/BeamEmitter) - group the flat feed back by parent so they
            // read as one unit instead of being scattered across the sort order
            const groups = new Map<string, EmitterDebugInfo[]>();
            for (const e of emitters) {
                let members = groups.get(e.parentUuid);
                if (!members) groups.set(e.parentUuid, members = []);
                members.push(e);
            }

            const orderedGroupIds = [...groups.keys()].sort((a, b) => {
                const da = Math.min(...groups.get(a)!.map(e => e.distance));
                const db = Math.min(...groups.get(b)!.map(e => e.distance));
                return da - db;
            });

            const currentGroupIds = new Set(orderedGroupIds);
            for (const id of this.emitterGroups.keys()) {
                if (!currentGroupIds.has(id)) {
                    this.emitterGroups.get(id)!.wrapper.remove();
                    this.emitterGroups.delete(id);
                }
            }

            const currentLineIds = new Set(emitters.map(e => e.uuid));
            for (const id of this.emitterLines.keys()) {
                if (!currentLineIds.has(id)) {
                    this.emitterLines.get(id)?.remove();
                    this.emitterLines.delete(id);
                    this.emitterCheckboxes.delete(id);
                }
            }

            // reorders group/line elements to match sort order, but only touches the DOM when
            // position actually changed - an unconditional move (even to the same spot) can
            // detach/reattach the node between a checkbox's mousedown and mouseup, which silently
            // swallows the click (the browser only synthesizes "click" if both land on the same node)
            let prevGroupWrapper: HTMLElement | null = null;

            for (const groupId of orderedGroupIds) {
                const members = groups.get(groupId)!.sort((a, b) => a.distance - b.distance);
                const minDist = members[0].distance;

                let group = this.emitterGroups.get(groupId);
                if (!group) {
                    const wrapper = document.createElement("div");
                    Object.assign(wrapper.style, {
                        breakInside: "avoid", // keep a group's rows out of a column split
                        marginBottom: "8px"
                    });

                    const header = document.createElement("div");
                    header.style.fontWeight = "bold";
                    header.style.color = "#8cf";
                    wrapper.appendChild(header);

                    const body = document.createElement("div");
                    body.style.paddingLeft = "10px";
                    body.style.borderLeft = "2px solid #345";
                    wrapper.appendChild(body);

                    group = { wrapper, header, body };
                    this.emitterGroups.set(groupId, group);
                }

                const expectedNext = prevGroupWrapper ? prevGroupWrapper.nextElementSibling : this.emitterListElement.firstElementChild;
                if (expectedNext !== group.wrapper) {
                    this.emitterListElement.insertBefore(group.wrapper, expectedNext);
                }
                prevGroupWrapper = group.wrapper;

                const distText = Math.round(minDist).toString().padStart(6, " ");
                group.header.innerText = `[${distText}] ${members[0].parentName} (${members.length} sub${members.length === 1 ? "" : "s"})`;

                let prevLine: HTMLElement | null = null;
                members.forEach(e => {
                    let line = this.emitterLines.get(e.uuid);
                    let checkbox = this.emitterCheckboxes.get(e.uuid);
                    let textEl: HTMLElement;
                    if (!line) {
                        line = document.createElement("div");
                        Object.assign(line.style, {
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "4px",
                            borderLeft: "2px solid #444",
                            paddingLeft: "6px",
                            marginTop: "2px"
                        });

                        checkbox = document.createElement("input");
                        checkbox.type = "checkbox";
                        checkbox.style.marginTop = "3px";
                        checkbox.onchange = () => this.onEmitterToggle?.(e.uuid, checkbox!.checked);
                        this.emitterCheckboxes.set(e.uuid, checkbox);
                        line.appendChild(checkbox);

                        textEl = document.createElement("span");
                        textEl.style.whiteSpace = "pre";
                        line.appendChild(textEl);

                        this.emitterLines.set(e.uuid, line);
                    } else {
                        textEl = line.lastElementChild as HTMLElement;
                    }

                    const expectedNextLine = prevLine ? prevLine.nextElementSibling : group!.body.firstElementChild;
                    if (expectedNextLine !== line) {
                        group!.body.insertBefore(line, expectedNextLine);
                    }
                    prevLine = line;

                    checkbox!.checked = !e.isManuallyHidden;

                    const eDistText = Math.round(e.distance).toString().padStart(6, " ");
                    const activeText = `${e.activeCount}/${e.maxParticles}`;
                    const state = e.isDisabled ? "DISABLED" : (e.isVisible ? "VISIBLE" : "hidden");
                    textEl.innerText = `[${eDistText}] ${this.shortEmitterName(e.name)} (${e.type})\n      active: ${activeText} | ${state}`;
                    textEl.style.color = e.isDisabled ? "#888" : (e.isVisible ? "#fff" : "#f80");
                    line.style.borderColor = e.isVisible ? "#0f0" : "#444";
                });
            }
        }

        const currentIds = new Set(emitters.map(e => e.uuid));
        for (const id of this.emitterLabels.keys()) {
            if (!currentIds.has(id)) {
                const sprite = this.emitterLabels.get(id)!;
                this.emitterLabelGroup.remove(sprite);
                sprite.material.map?.dispose();
                sprite.material.dispose();
                this.emitterLabels.delete(id);
            }
        }

        for (const e of emitters) {
            let sprite = this.emitterLabels.get(e.uuid);
            if (!sprite) {
                sprite = this.makeTextSprite(this.shortEmitterName(e.name), e.isVisible ? "#0f0" : "#f80");
                this.emitterLabels.set(e.uuid, sprite);
                this.emitterLabelGroup.add(sprite);
            }
            sprite.position.copy(e.worldPos);
        }
    }

    // full name is "{ClassName}_{objectName}_{uuid}" (un-object-mixin.ts) - both the
    // HUD list and world-space labels only want objectName (the middle segment),
    // which is also exactly what loadEmitterList's `emitters` array expects, so it
    // doubles as copy-pasteable output.
    private shortEmitterName(fullName: string): string {
        const parts = fullName.split("_");
        return parts.length >= 3 ? parts[1] : fullName;
    }

    public updateAudioHUD(musicData: any, ambientSounds: any[], currentTime: number, cameraPosition: Vector3): void {
        if (!this.enabled || this.mode !== VisualizerMode.Audio) return;

        if (this.musicInfoElement) {
            const lines = [
                `Current ID: ${musicData.currentIndex !== undefined ? musicData.currentIndex : "None"}`,
                `Playing ID: ${musicData.playingIndex !== undefined ? musicData.playingIndex : "None"}`,
                `Looping:    ${musicData.isLooped ? "YES" : "NO"}`,
                `Fading:     ${musicData.isFading ? "YES" : "NO"}`,
                `Next Track: ${musicData.nextTrackTime !== undefined ? Math.round((musicData.nextTrackTime - currentTime) / 100) / 10 + "s" : "---"}`,
                `Volume:     ${Math.round(musicData.volume * 100)}%`
            ];
            this.musicInfoElement.innerText = lines.join("\n");
        }

        if (this.ambientListElement) {
            const sorted = [...ambientSounds].map(s => {
                const dx = s.info.position[0] - cameraPosition.x;
                const dy = s.info.position[1] - cameraPosition.y;
                const dz = s.info.position[2] - cameraPosition.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                return { ...s, dist };
            }).sort((a, b) => a.dist - b.dist);

            const currentIds = new Set(sorted.map(s => s.id));
            const existingIds = new Set(this.audioLines.keys());

            for (const id of existingIds) {
                if (!currentIds.has(id)) {
                    this.audioLines.get(id)?.remove();
                    this.audioLines.delete(id);
                }
            }

            sorted.forEach(s => {
                let line = this.audioLines.get(s.id);
                if (!line) {
                    line = document.createElement("div");
                    line.style.borderLeft = "2px solid #444";
                    line.style.paddingLeft = "6px";
                    line.style.fontSize = "11px";
                    this.audioLines.set(s.id, line);
                }
                
                // Re-appending naturally moves the element, keeping the DOM sorted 
                this.ambientListElement.appendChild(line);

                const sndName = s.info.soundName;
                const distText = Math.round(s.dist).toString().padStart(6, " ");
                const baseVol = s.info.volume;
                
                // Calculate AL_INVERSE_DISTANCE_CLAMPED attenuation
                const ref = s.info.refDistance;
                let attenuation = 1.0;
                if (s.dist > ref) {
                    attenuation = ref / (ref + 1.0 * (s.dist - ref));
                }
                const actualVol = baseVol * attenuation;

                const baseVolText = Math.round(baseVol * 100).toString().padStart(3, " ");
                const actualVolText = Math.round(actualVol * 100).toString().padStart(3, " ");
                const status = s.isPlaying ? "PLAYING" : "WAITING";
                const delayText = s.nextReplayTime !== undefined ? 
                    ` (next: ${Math.round((s.nextReplayTime - currentTime) / 100) / 10}s)` : "";

                line.innerText = `[${distText}] ${sndName}\n      Vol: ${actualVolText}% (Base: ${baseVolText}%) | ${status}${delayText}`;
                line.style.color = s.isPlaying ? "#fff" : "#888";
                line.style.borderColor = s.isPlaying ? "#0f0" : "#444";
            });
        }
    }

    public updateHUD(activeFogColors?: FogSourceColors, globalEnvColors?: GlobalEnvColors, zoneFogData?: ZoneFogData): void {
        if (!this.enabled || this.mode !== VisualizerMode.Fogs) return;

        const updateEntry = (prefix: string, name: string, color?: ColorByte) => {
            const entry = this.hudColors.get(`${prefix}:${name}`);
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
        const isFogMode = this.enabled && this.mode === VisualizerMode.Fogs;
        const isAudioMode = this.enabled && this.mode === VisualizerMode.Audio;
        const isEmittersMode = this.enabled && this.mode === VisualizerMode.Emitters;
        this.fogGroup.visible = isFogMode;
        this.emitterLabelGroup.visible = isEmittersMode;
        if (this.hudElement) {
            this.hudElement.style.display = isFogMode ? "flex" : "none";
        }
        if (this.audioHudElement) {
            this.audioHudElement.style.display = isAudioMode ? "flex" : "none";
        }
        if (this.emittersHudElement) {
            this.emittersHudElement.style.display = isEmittersMode ? "flex" : "none";
        }
        if (!isEmittersMode) {
            // labels are cheap to rebuild but not free (canvas + texture per entry) -
            // drop them the instant the mode isn't active instead of leaving them
            // parked offscreen
            for (const sprite of this.emitterLabels.values()) {
                this.emitterLabelGroup.remove(sprite);
                sprite.material.map?.dispose();
                sprite.material.dispose();
            }
            this.emitterLabels.clear();
            this.emitterLines.clear();
            this.emitterGroups.clear();
            if (this.emitterListElement) this.emitterListElement.innerHTML = "";
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
            case VisualizerMode.Audio:
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
                        (zoneLabel as any).zone0 = node.zones[0];
                        (zoneLabel as any).zone1 = node.zones[1];
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
                    (boxHelper as any).zoneIndex = zoneIndex;
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
                        (zoneLabel as any).zoneIndex = zoneIndex;
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
                            (line as any).sourceZone = zoneIndex;
                            (line as any).targetZone = targetZoneIndex;
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

                // find the highest level (minimum depth) node for each visible leaf
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

                // compute bounds per leaf (from its highest-level node), visualize per-leaf or union per-zone
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
                        (boxHelper as any).leafIndex = leafIndex;
                        (boxHelper as any).zone = info.zone;
                        (boxHelper as any).depth = info.depth;
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
                        (boxHelper as any).zone = zone;
                        (boxHelper as any).leafCount = agg.leafCount;
                        (boxHelper as any).depth = agg.minDepth;
                        (boxHelper as any).aggregated = true;
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

    public getEmitterLabelGroup(): Group {
        return this.emitterLabelGroup;
    }

    public destroy(): void {
        this.clearVisualizations();
        for (const sprite of this.emitterLabels.values()) {
            this.emitterLabelGroup.remove(sprite);
            sprite.material.map?.dispose();
            sprite.material.dispose();
        }
        this.emitterLabels.clear();
        if (this.hudElement && this.hudElement.parentNode) {
            this.hudElement.parentNode.removeChild(this.hudElement);
        }
        if (this.audioHudElement && this.audioHudElement.parentNode) {
            this.audioHudElement.parentNode.removeChild(this.audioHudElement);
        }
        if (this.emittersHudElement && this.emittersHudElement.parentNode) {
            this.emittersHudElement.parentNode.removeChild(this.emittersHudElement);
        }
    }
}

export default Visualizer;

