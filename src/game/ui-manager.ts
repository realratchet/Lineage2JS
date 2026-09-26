import { IEngineComponent } from "./components";
import Stats from "../rendering/stats";
import { GAMMA_STEPS } from "../rendering/display-gamma";
import { VisualizerMode, LeafVisualizerDetail } from "../rendering/visualizer";
import type Visualizer from "../rendering/visualizer";
import type RenderManager from "../rendering/render-manager";
import type BaseActor from "../base-actor";
import type { NpcAttackSelection_T } from "../objects/components/npc-attack-component";
import type GameManager from "./game-manager";
import type { ICharacterArmorSelection } from "@l2js/engine/contracts/pawn";

type DebugTab = "controls" | "environment" | "bsp" | "statistics" | VisualizerMode.Fogs | VisualizerMode.Audio | VisualizerMode.Emitters;
type GraphSeries_T = { label: string, color: string, values: number[] };
type GpuMemoryUsage_T = { used: number, total: number };

export class UIManager implements IEngineComponent<GameManager> {
    public moverPosition = 0;
    public fogPreset = "4";
    public showLevel = true;
    public showColliders = false;
    public followPlayer = false;

    protected manGame: GameManager;
    protected readonly stats = new (Stats as any)(0);
    protected readonly debugView = document.createElement("aside");
    protected readonly debugTabs = new Map<DebugTab, { button: HTMLButtonElement, panel: HTMLElement }>();
    protected activeTab: DebugTab = "controls";
    protected qualitySection: HTMLElement;
    protected bspMode: HTMLSelectElement;
    protected leafDetail: HTMLSelectElement;
    protected leafDetailRow: HTMLElement;
    protected bspInfoElement: HTMLElement;
    protected statisticsElement: HTMLElement;
    protected statisticsCanvas: HTMLCanvasElement;
    protected statisticsContext: CanvasRenderingContext2D;
    protected statisticsHistory = { fps: [], frameTime: [], calls: [], triangles: [], heap: [], vram: [] };
    protected frameStartedAt = 0;
    protected frameWindowStartedAt = performance.now();
    protected frameCount = 0;
    protected frameRate = 0;
    protected frameTime = 0;
    protected gpuVendor = "unknown";
    protected gpuRenderer = "unknown";
    protected gpuMemoryExtension: any;
    protected characterGroup = 1;
    protected characterFace = 0;
    protected characterHair = 0;
    protected characterHairColour = 0;
    protected characterArmor: ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 };
    protected spawnedNpc: BaseActor = null;
    protected npcSpawnRequest = 0;

    public constructor() {
        this.debugView.className = "debug-view";
        this.debugView.hidden = true;

        const header = document.createElement("header");
        const title = document.createElement("strong");
        title.textContent = "DEBUG";
        const hint = document.createElement("span");
        hint.textContent = "F4 to close";
        header.append(title, hint);
        this.stats.dom.classList.add("debug-stats");
        this.stats.showPanel(0);
        document.body.appendChild(this.stats.dom);

        const tabs = document.createElement("nav");
        tabs.className = "debug-tabs";
        const content = document.createElement("div");
        content.className = "debug-content";
        this.debugView.append(header, tabs, content);
        document.body.appendChild(this.debugView);

        this.addDebugTab("controls", "Controls", tabs, content);
        this.addDebugTab("environment", "Environment", tabs, content);
        this.addDebugTab("bsp", "BSP", tabs, content);
        this.addDebugTab("statistics", "Statistics", tabs, content);
        this.addDebugTab(VisualizerMode.Fogs, "Fogs", tabs, content);
        this.addDebugTab(VisualizerMode.Audio, "Audio", tabs, content);
        this.addDebugTab(VisualizerMode.Emitters, "Emitters", tabs, content);
    }

    public setParent(parent: GameManager): this { this.manGame = parent; return this; }
    public getParent(): GameManager { return this.manGame; }

    public async onInit(): Promise<this> {
        this.addRenderControls();
        this.addBspControls();
        this.addStatisticsControls();

        this.attachVisualizerDebugElements(this.manGame.getComponent("render").visualizer);

        return this;
    }

    public beginFrame(): void {
        this.frameStartedAt = performance.now();
        this.stats.begin();
    }

    public endFrame(): void {
        const time = performance.now();
        this.frameTime = time - this.frameStartedAt;
        this.frameCount++;
        if (time >= this.frameWindowStartedAt + 1000) {
            this.frameRate = this.frameCount * 1000 / (time - this.frameWindowStartedAt);
            this.frameWindowStartedAt = time;
            this.frameCount = 0;
        }
        this.stats.end();
    }

    public onAfterEngineTick(): void {
        if (this.debugView.hidden) return;

        const render = this.manGame.getComponent("render");
        if (this.activeTab === "statistics") {
            const info = render.renderer.info;
            const memory = (performance as any).memory;
            const heap = memory ? memory.usedJSHeapSize / 1048576 : 0;
            const gpuMemory = this.getGpuMemoryUsage(render);
            this.pushStatisticsValue(this.statisticsHistory.fps, this.frameRate);
            this.pushStatisticsValue(this.statisticsHistory.frameTime, this.frameTime);
            this.pushStatisticsValue(this.statisticsHistory.calls, info.render.calls);
            this.pushStatisticsValue(this.statisticsHistory.triangles, info.render.triangles);
            this.pushStatisticsValue(this.statisticsHistory.heap, heap);
            this.pushStatisticsValue(this.statisticsHistory.vram, gpuMemory.used);
            this.drawStatisticsGraph();
            this.statisticsElement.textContent = [
                `FPS:              ${this.frameRate.toFixed(1)}`,
                `Frame:            ${this.frameTime.toFixed(2)} ms`,
                `JS heap:          ${memory ? `${heap.toFixed(1)} / ${(memory.jsHeapSize / 1048576).toFixed(1)} MB` : "unavailable"}`,
                `VRAM:             ${gpuMemory.total ? `${gpuMemory.used.toFixed(1)} / ${gpuMemory.total.toFixed(1)} MB` : "unavailable"}`,
                `GPU vendor:       ${this.gpuVendor}`,
                `GPU renderer:     ${this.gpuRenderer}`,
                `WebGL:            ${render.renderer.capabilities.isWebGL2 ? "2" : "1"}`,
                `Viewport:         ${render.lastSize.x} x ${render.lastSize.y} @${window.devicePixelRatio}x`,
                `Draw calls:       ${info.render.calls}`,
                `Triangles:        ${info.render.triangles}`,
                `Lines:            ${info.render.lines}`,
                `Points:           ${info.render.points}`,
                `Geometries:       ${info.memory.geometries}`,
                `Textures:         ${info.memory.textures}`,
                `Programs:         ${(info as any).programs?.length ?? 0}`
            ].join("\n");
            return;
        }

        if (this.activeTab !== "bsp" || !this.bspInfoElement) return;
        const sector = render.getSector(render.camera.position);
        if (!sector) {
            this.bspInfoElement.textContent = "No sector at camera position";
            return;
        }

        const [sectorX, sectorY] = render.getSectorId(render.camera.position);
        const zone = sector.findPositionZone(render.camera.position);
        const leaf = sector.findPositionLeaf(render.camera.position);
        this.bspInfoElement.textContent = [
            `Mode:             ${this.bspMode.value}`,
            `Leaf detail:      ${this.leafDetailRow.hidden ? "n/a" : this.leafDetail.value}`,
            `Sector:            ${sectorX}, ${sectorY}`,
            `BSP nodes:         ${sector.bspNodes?.length ?? 0}`,
            `BSP leaves:        ${sector.bspLeaves?.length ?? 0}`,
            `Zones:             ${sector.bspZones?.length ?? 0}`,
            `Fog infos:         ${sector.fogInfos.length}`,
            `Camera zone:       ${zone ?? "---"}`,
            `Camera leaf:       ${leaf ?? "---"}`,
            `Visible leaves:    ${sector.visibleLeaves.size}`,
            `Visible emitters:  ${sector.visibleEmitterUuids.size}`,
            `Frustum cull:      ${render.frustumCullingEnabled ? "ON" : "OFF"}`,
            `BSP camera:        ${render.bspHelperActive ? "ON" : "OFF"}`
        ].join("\n");
    }

    public attachVisualizerDebugElements(visualizer: Visualizer): void {
        for (const mode of [VisualizerMode.Fogs, VisualizerMode.Audio, VisualizerMode.Emitters]) {
            const element = visualizer.getDebugElement(mode);
            const panel = this.debugTabs.get(mode)!.panel;
            if (element && element.parentNode !== panel) panel.appendChild(element);
        }
    }

    public toggleDebugView(): void {
        if (!this.debugView.hidden) this.selectDebugTab("controls");
        this.debugView.hidden = !this.debugView.hidden;
    }

    protected addDebugTab(key: DebugTab, label: string, tabs: HTMLElement, content: HTMLElement): void {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.classList.toggle("active", key === this.activeTab);
        button.onclick = () => this.selectDebugTab(key);

        const panel = document.createElement("section");
        panel.className = "debug-tab-panel";
        panel.hidden = key !== this.activeTab;
        content.appendChild(panel);
        tabs.appendChild(button);
        this.debugTabs.set(key, { button, panel });

    }

    protected selectDebugTab(tab: DebugTab): void {
        this.activeTab = tab;
        this.debugView.classList.toggle("debug-visualizer", tab === VisualizerMode.Fogs || tab === VisualizerMode.Audio || tab === VisualizerMode.Emitters);
        for (const [key, entry] of this.debugTabs) {
            entry.button.classList.toggle("active", key === tab);
            entry.panel.hidden = key !== tab;
        }

        const render = this.manGame.getComponent("render");
        if (tab === "controls" || tab === "environment" || tab === "statistics") {
            if (render.visualizer.isEnabled()) render.toggleVisualizer();
        } else if (tab === "bsp") {
            render.setVisualizerMode(this.bspMode.value as VisualizerMode);
        } else render.setVisualizerMode(tab);
    }

    protected addBspControls(): void {
        const panel = this.debugTabs.get("bsp")!.panel;
        this.bspMode = this.addSelect(panel, "Mode", {
            None: VisualizerMode.None,
            Portals: VisualizerMode.Portals,
            Zones: VisualizerMode.Zones,
            Leaves: VisualizerMode.Leaves
        }, VisualizerMode.None, value => {
            this.leafDetailRow.hidden = value !== VisualizerMode.Leaves;
            this.selectDebugTab("bsp");
        });
        const leafDetail = this.leafDetail = this.addSelect(panel, "Leaf detail", Object.values(LeafVisualizerDetail), LeafVisualizerDetail.Auto, value => {
            this.manGame.getComponent("render").setVisualizerLeafDetail(value as LeafVisualizerDetail);
        });
        this.leafDetailRow = leafDetail.parentElement!;
        this.leafDetailRow.hidden = true;
        this.bspInfoElement = document.createElement("pre");
        this.bspInfoElement.className = "debug-info";
        this.bspInfoElement.textContent = "Open a loaded sector to inspect BSP state";
        panel.appendChild(this.bspInfoElement);
    }

    protected addStatisticsControls(): void {
        const panel = this.debugTabs.get("statistics")!.panel;
        const render = this.manGame.getComponent("render");
        const gl = render.renderer.getContext();
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info") as any;
        this.gpuVendor = String(debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR));
        this.gpuRenderer = String(debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        this.gpuMemoryExtension = gl.getExtension("WEBGL_memory_info") || gl.getExtension("GL_NVX_gpu_memory_info");
        this.statisticsCanvas = document.createElement("canvas");
        this.statisticsCanvas.className = "debug-graph";
        this.statisticsCanvas.width = 420;
        this.statisticsCanvas.height = 180;
        this.statisticsContext = this.statisticsCanvas.getContext("2d")!;
        this.statisticsElement = document.createElement("pre");
        this.statisticsElement.className = "debug-info";
        panel.append(this.statisticsCanvas, this.statisticsElement);
        this.addCheckbox(panel, "Show FPS overlay", true, value => this.stats.dom.style.display = value ? "block" : "none");
    }

    protected getGpuMemoryUsage(render: RenderManager): GpuMemoryUsage_T {
        if (!this.gpuMemoryExtension) return { used: 0, total: 0 };
        const gl = render.renderer.getContext();
        const totalKey = this.gpuMemoryExtension.GPU_MEMORY_INFO_TOTAL_AVAILABLE_MEMORY_NVX;
        const availableKey = this.gpuMemoryExtension.GPU_MEMORY_INFO_CURRENT_AVAILABLE_VIDMEM_NVX;
        if (!totalKey || !availableKey) return { used: 0, total: 0 };
        const total = Number(gl.getParameter(totalKey));
        const available = Number(gl.getParameter(availableKey));
        if (!Number.isFinite(total) || !Number.isFinite(available) || total <= 0) return { used: 0, total: 0 };
        return { used: Math.max(0, total - available) / 1024, total: total / 1024 };
    }

    protected pushStatisticsValue(values: number[], value: number): void {
        values.push(value);
        if (values.length > 120) values.shift();
    }

    protected drawStatisticsGraph(): void {
        const rows: [string, GraphSeries_T[]][] = [
            ["FPS", [{ label: "FPS", color: "#8bd5ff", values: this.statisticsHistory.fps }]],
            ["Frame ms", [{ label: "ms", color: "#f2b880", values: this.statisticsHistory.frameTime }]],
            ["Draw calls", [{ label: "calls", color: "#b8e986", values: this.statisticsHistory.calls }]],
            ["Triangles", [{ label: "tri", color: "#d6a8ff", values: this.statisticsHistory.triangles }]],
            ["Memory MB", [
                { label: "JS", color: "#ff91c8", values: this.statisticsHistory.heap },
                { label: "VRAM", color: "#8ff0d0", values: this.statisticsHistory.vram }
            ]]
        ];
        const graph = this.statisticsContext;
        const width = this.statisticsCanvas.width;
        const rowHeight = this.statisticsCanvas.height / rows.length;
        graph.clearRect(0, 0, width, this.statisticsCanvas.height);
        graph.fillStyle = "#111";
        graph.fillRect(0, 0, width, this.statisticsCanvas.height);
        graph.font = "12px monospace";
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const [label, series] = rows[rowIndex];
            const top = rowIndex * rowHeight;
            const graphLeft = 78;
            const graphBottom = top + rowHeight - 5;
            graph.fillStyle = "#aaa";
            graph.fillText(label, 4, top + 14);
            graph.strokeStyle = "#333";
            graph.beginPath();
            graph.moveTo(graphLeft, graphBottom);
            graph.lineTo(width - 4, graphBottom);
            graph.stroke();
            const max = Math.max(1, ...series.flatMap(item => item.values));
            for (const item of series) {
                graph.strokeStyle = item.color;
                graph.beginPath();
                for (let i = 0; i < item.values.length; i++) {
                    const x = graphLeft + (i / Math.max(1, item.values.length - 1)) * (width - graphLeft - 4);
                    const y = graphBottom - item.values[i] / max * (rowHeight - 20);
                    if (i === 0) graph.moveTo(x, y);
                    else graph.lineTo(x, y);
                }
                graph.stroke();
                graph.fillStyle = item.color;
                const value = item.values[item.values.length - 1] || 0;
                graph.fillText(`${item.label} ${value.toFixed(1)}`, graphLeft + 5 + series.indexOf(item) * 90, top + 14);
            }
        }
    }

    protected addSection(title: string, open = false, tab: DebugTab = "controls"): HTMLElement {
        const section = document.createElement("details");
        section.open = open;
        section.className = "debug-section";
        const summary = document.createElement("summary");
        summary.textContent = title;
        section.appendChild(summary);
        this.debugTabs.get(tab)!.panel.appendChild(section);
        return section;
    }

    protected addRow(parent: HTMLElement, label: string, control: HTMLElement): HTMLElement {
        const row = document.createElement("label");
        row.className = "debug-row";
        const text = document.createElement("span");
        text.textContent = label;
        row.append(text, control);
        parent.appendChild(row);
        return row;
    }

    protected addSelect(parent: HTMLElement, label: string, options: readonly string[] | Record<string, string | number>, value: string, onChange: (value: string) => void): HTMLSelectElement {
        const select = document.createElement("select");
        const entries = Array.isArray(options) ? options.map(option => [option, option] as [string, string]) : Object.entries(options).map(([name, option]) => [name, String(option)] as [string, string]);
        for (const [name, option] of entries) {
            const element = document.createElement("option");
            element.textContent = name;
            element.value = option;
            select.appendChild(element);
        }
        select.value = value;
        select.onchange = () => onChange(select.value);
        this.addRow(parent, label, select);
        return select;
    }

    protected addCheckbox(parent: HTMLElement, label: string, value: boolean, onChange: (value: boolean) => void): HTMLInputElement {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = value;
        input.onchange = () => onChange(input.checked);
        this.addRow(parent, label, input);
        return input;
    }

    protected addRange(parent: HTMLElement, label: string, value: number, min: number, max: number, step: number, onChange: (value: number) => void): HTMLInputElement {
        const input = document.createElement("input");
        input.type = "range";
        input.min = String(min);
        input.max = String(max);
        input.step = String(step);
        input.value = String(value);
        input.oninput = () => onChange(Number(input.value));
        this.addRow(parent, label, input);
        return input;
    }

    protected addText(parent: HTMLElement, label: string, value: string, onChange: (value: string) => void): HTMLInputElement {
        const input = document.createElement("input");
        input.type = "text";
        input.value = value;
        input.onchange = () => onChange(input.value);
        this.addRow(parent, label, input);
        return input;
    }

    protected addButton(parent: HTMLElement, label: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.onclick = onClick;
        parent.appendChild(button);
        return button;
    }

    protected addRenderControls(): void {
        const render = this.manGame.getComponent("render");
        const environment = render.getEnvironment();
        const world = this.addSection("World", true, "environment");
        const quality = this.qualitySection = this.addSection("Quality", false, "environment");
        const sky = this.addSection("Sky", false, "environment");
        const audio = this.addSection("Audio", false, "environment");

        this.addSelect(quality, "Fog Range", {
            "1 (2k-8k)": "1", "2 (3k-10k)": "2", "3 (4k-12k)": "3", "4 (5k-14k)": "4", "5 (8k-20k)": "5"
        }, this.fogPreset, value => this.fogPreset = value);
        this.addCheckbox(world, "Show Level", this.showLevel, value => { this.showLevel = value; render.setLevelVisible(value); });
        this.addCheckbox(world, "Show Colliders", this.showColliders, value => { this.showColliders = value; render.setCollidersVisible(value); });
        this.addRange(world, "Door Position", this.moverPosition, 0, 1, 0.01, value => { this.moverPosition = value; render.needsUpdate = true; });
        this.addCheckbox(sky, "Celestials", render.skyRenderer.config.celestials, value => render.skyRenderer.config.celestials = value);
        this.addCheckbox(sky, "Haze", render.skyRenderer.config.haze1, value => render.skyRenderer.config.haze1 = value);
        this.addCheckbox(sky, "Stars/Clouds", render.skyRenderer.config.starsClouds, value => render.skyRenderer.config.starsClouds = value);
        this.addRange(audio, "Music Volume", render.audioManager.musicVolume, 0, 1, 0.01, value => render.audioManager.musicVolume = value);
        this.addRange(audio, "Ambient Volume", render.audioManager.ambientVolume, 0, 1, 0.01, value => render.audioManager.ambientVolume = value);

        this.addRange(world, "Time", environment.getTimeOfDay(), 0, 24, 0.01, value => { environment.setTimeOfDay(value); render.needsUpdate = true; });
        this.addRange(world, "Time Scale", environment.getTimeScale(), 0, 100, 0.01, value => environment.setTimeScale(value));
        this.addSelect(world, "Signs Sky", { Normal: 0, Dusk: 1, Dawn: 2 }, String(environment.getActiveEnv()), value => { environment.setActiveEnv(Number(value) as 0 | 1 | 2); render.needsUpdate = true; });
    }

    public async addCharacterControls(): Promise<void> {
        const asset = this.manGame.getComponent("asset");
        const physics = this.manGame.getComponent("physics");
        const render = this.manGame.getComponent("render");
        const groups = await asset.getCharGroups();
        const section = this.addSection("Character");
        const groupOptions: Record<string, number> = {};
        for (const group of groups) groupOptions[group.name] = group.index;

        this.addSelect(section, "Character", groupOptions, String(this.characterGroup), async value => {
            this.characterGroup = Number(value);
            this.characterArmor = { chest: 0, legs: 0, gloves: 0, boots: 0 };
            buildVariantControls();
            await applyCharacter();
        });
        const variants = document.createElement("div");
        variants.className = "debug-subsection";
        section.appendChild(variants);
        this.addCheckbox(section, "Follow Player", this.followPlayer, value => {
            this.followPlayer = value;
            this.manGame.getComponent("input").setFollowPlayer(value);
        });
        this.addButton(section, "Simulate Pawns", () => physics.simulatePawns());

        const applyCharacter = (): Promise<void> => asset.loadCharacter(render, this.characterGroup, this.characterFace, this.characterHair, this.characterHairColour, this.characterArmor);
        const addArmorControls = (group: typeof groups[number]): void => {
            for (const slot of Object.keys(this.characterArmor) as (keyof ICharacterArmorSelection)[]) {
                const options: Record<string, number> = { None: 0 };
                for (const item of group.armor[slot]) options[item.label] = item.id;
                this.addSelect(variants, slot[0].toUpperCase() + slot.slice(1), options, String(this.characterArmor[slot]), async value => {
                    this.characterArmor[slot] = Number(value);
                    await applyCharacter();
                });
            }
        };
        const buildVariantControls = (): void => {
            const group = groups[this.characterGroup];
            variants.innerHTML = "";
            this.characterFace = Math.min(this.characterFace, group.faceVariants - 1);
            this.characterHair = group.hairStyles.includes(this.characterHair) ? this.characterHair : group.hairStyles[0];
            this.addSelect(variants, "Face", Array.from({ length: group.faceVariants }, (_, i) => String(i)), String(this.characterFace), async value => { this.characterFace = Number(value); await applyCharacter(); });
            this.addSelect(variants, "Hair", group.hairStyles.map(String), String(this.characterHair), async value => { this.characterHair = Number(value); buildVariantControls(); await applyCharacter(); });
            const colours = group.hairColours[this.characterHair];
            this.characterHairColour = colours.includes(this.characterHairColour) ? this.characterHairColour : colours[0];
            this.addSelect(variants, "Hair Color", colours.map(String), String(this.characterHairColour), async value => { this.characterHairColour = Number(value); await applyCharacter(); });
            addArmorControls(group);
        };

        buildVariantControls();
    }

    public addNpcControls(): void {
        const render = this.manGame.getComponent("render");
        const section = this.addSection("NPC");
        const state = { selector: "Baium", selectedAttack: "random", selectedTarget: "player" };
        const attackControls = document.createElement("div");
        attackControls.className = "debug-subsection";

        const buildAttackControl = (npc: BaseActor): void => {
            attackControls.innerHTML = "";
            const options: Record<string, string> = { Random: "random" };
            if (npc) npc.getNpcAttacks().forEach((attack, index) => options[attack.label] = String(index));
            state.selectedAttack = "random";
            this.addSelect(attackControls, "NPC attacks", options, state.selectedAttack, value => state.selectedAttack = value);
        };

        this.addText(section, "Name / ID", state.selector, value => state.selector = value);
        const actions = document.createElement("div");
        actions.className = "debug-actions";
        this.addButton(actions, "Spawn", async () => {
            const request = ++this.npcSpawnRequest;
            if (this.spawnedNpc) {
                this.spawnedNpc.stopAttack();
                render.removePawn(this.spawnedNpc);
                this.spawnedNpc = null;
            }
            buildAttackControl(null);
            const npc = await render.spawnNpc(state.selector);
            if (request !== this.npcSpawnRequest) return render.removePawn(npc);
            this.spawnedNpc = npc;
            buildAttackControl(npc);
        });
        this.addButton(actions, "Kill", () => {
            ++this.npcSpawnRequest;
            const npc = this.spawnedNpc;
            if (!npc) return;
            npc.stopAttack();
            npc.playDeathAnimation(() => {
                render.removePawn(npc);
                if (this.spawnedNpc === npc) {
                    this.spawnedNpc = null;
                    buildAttackControl(null);
                }
            });
        });
        section.appendChild(actions);
        section.appendChild(attackControls);
        buildAttackControl(null);
        this.addSelect(section, "Attack target", { Player: "player", Self: "self" }, state.selectedTarget, value => { state.selectedTarget = value; this.spawnedNpc?.stopAttack(); });
        const attackActions = document.createElement("div");
        attackActions.className = "debug-actions";
        this.addButton(attackActions, "Attack", () => {
            const npc = this.spawnedNpc;
            if (npc) npc.attack(state.selectedTarget === "self" ? npc : render.player, state.selectedAttack === "random" ? "random" : Number(state.selectedAttack) as NpcAttackSelection_T);
        });
        this.addButton(attackActions, "Stop", () => this.spawnedNpc?.stopAttack());
        section.appendChild(attackActions);
    }

    public addClippingRangeControls(): void {
        const asset = this.manGame.getComponent("asset"), render = this.manGame.getComponent("render");
        const clippingRange = asset.userConfig.clippingRange;
        this.addRange(this.qualitySection, "Emitter Range", clippingRange.actor, 1, 12, 0.5, value => { clippingRange.actor = value; render.invalidateSectorVisibility(); });
    }

    public addDisplayGammaControls(): void {
        const asset = this.manGame.getComponent("asset"), render = this.manGame.getComponent("render");
        const display = asset.userConfig.display;
        display.gamma = 0;
        const steps = GAMMA_STEPS.reduce((acc, gamma) => (acc[gamma.toFixed(1)] = gamma, acc), { off: 0 } as Record<string, number>);
        this.addSelect(this.qualitySection, "Gamma", steps, "0", value => render.setDisplayGamma(display, Number(value)));
    }
}

export default UIManager;
