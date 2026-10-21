import "../../style/nwindow.scss";
import NWindowCanvas from "./nwindow-canvas";
import type AssetManager from "../assets/asset-manager";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";
import fetchAsset from "../assets/asset-source";
import type SkinTextures from "./skin-textures";

const SNAP_DISTANCE = 10;

function snapToEdge(position: number, size: number, screen: number) { // NWindow 0x10037150 under GIsStickyWindow: windows stick to the screen edges within 10px.
    if (Math.abs(position) < SNAP_DISTANCE) return 0;
    if (Math.abs(position + size - screen) < SNAP_DISTANCE) return screen - size;

    return position;
}

type DockWindow_T = HTMLElement;

function getWindowRect(wnd: DockWindow_T): [number, number, number, number] { return [wnd.offsetLeft, wnd.offsetTop, wnd.offsetWidth, wnd.offsetHeight]; }

export class NWindowManager {
    public readonly canvas: NWindowCanvas;
    protected windowOwner: string = null;
    protected readonly dockedWindows = new Map<DockWindow_T, Set<DockWindow_T>[]>();
    protected isDirty = true;
    protected isReady = false;
    public readonly ready: Promise<void>;

    public overlayPaint: (canvas: NWindowCanvas) => void = null;
    public strings: GameStrings_T = { trueFonts: {}, zoneNames: [], zoneNameMasks: {}, systemMessages: {}, systemMessageColors: {}, systemMessageGroups: {}, systemMessageSounds: {}, systemMessageVoices: {}, sysStrings: {}, recipes: [], hennas: {}, serverNames: {}, skillIcons: {}, skillCastStyles: {}, skillRecords: {}, skillInfos: {}, actions: {}, logonSpots: [], classNames: {}, skillNames: {}, itemNames: {}, itemIcons: {}, itemInfos: {}, symbols: {} };

    public constructor(protected readonly asset: AssetManager, skin: SkinTextures) {
        this.canvas = new NWindowCanvas(asset, skin);

        document.body.appendChild(this.canvas.element);

        window.addEventListener("resize", () => this.resize());
        this.resize();
        this.ready = this.loadFonts();
    }

    protected async loadFonts() {
        await Promise.all([this.asset.loadCursors(), this.canvas.loadFonts(), this.asset.loadSound("InterfaceSound.click_01"), this.asset.loadSound("ItemSound.click_failed")]);

        document.documentElement.style.setProperty("--game-cursor", this.getCursor(0));
        this.isReady = true;
        this.invalidate();
    }

    public async loadTrueFonts() {
        const font = this.strings.trueFonts.zonetitle;

        if (!font) return;

        const file = font.file || (font.name.toLowerCase() === "tahoma" && font.weight === 700 && !font.italic ? "tahomabd.ttf" : "");

        if (!file) throw new Error(`TrueFont '${font.name}' has no game font asset.`);

        const response = await fetchAsset(`assets/system/${file}`);

        if (!response.ok) return; // retail takes TrueFonts from the OS, an untouched client folder doesn't ship them

        const face = new FontFace("L2ZoneTitle", await response.arrayBuffer(), { weight: String(font.weight), style: font.italic ? "italic" : "normal" });

        await face.load();
        document.fonts.add(face);
    }

    public setUIScale(scale: number) {
        this.canvas.uiScale = scale;
        this.resize();
    }

    protected resize() {
        this.dockedWindows.clear();
        this.canvas.resize(window.innerWidth, window.innerHeight);
        this.invalidate();
    }

    public invalidate() { this.isDirty = true; }

    public playSystemMessageSound(id: number) {
        const audio = this.asset.getParent().getComponent("audio");
        const sound = this.strings.systemMessageSounds[id], voice = this.strings.systemMessageVoices[id];

        if (sound) void audio.playInterfaceSound(sound);
        if (voice) void audio.playInterfaceVoice(voice);
    }

    public playButtonSound(isEnabled: boolean): void {
        void this.asset.getParent().getComponent("audio").playInterfaceSound(isEnabled ? "InterfaceSound.click_01" : "ItemSound.click_failed"); // NWindow.dll 0x10001230, sound table 0x10242368.
    }

    public playPickupSound(): void { void this.asset.getParent().getComponent("audio").playInterfaceSound("ItemSound.pickup"); } // 0x10074e60(3), sound table 0x10242368.

    public playPanelSound(panel: "charstat" | "inventory" | "map" | "system", isOpen: boolean): void { void this.asset.getParent().getComponent("audio").playInterfaceSound(`InterfaceSound.${panel}_${isOpen ? "open" : "close"}_01`); } // 0x10074e60(11..18), sound table 0x10242368.

    public playTrashSound(): void { void this.asset.getParent().getComponent("audio").playInterfaceSound("itemsound.trash_basket"); } // 0x10074e60(4), sound table 0x10242368.

    public playWindowSound(): void { void this.asset.getParent().getComponent("audio").playInterfaceSound("itemsound.window_open"); } // 0x10074e60(5), sound table 0x10242368.

    public playWindowCloseSound(): void { void this.asset.getParent().getComponent("audio").playInterfaceSound("itemsound.window_close"); } // 0x10074e60(6), sound table 0x10242368.

    public snapX(x: number, width: number) { return snapToEdge(x, width, this.canvas.width); }
    public snapY(y: number, height: number) { return snapToEdge(y, height, this.canvas.height); }

    protected getDockedWindows(wnd: DockWindow_T) {
        let edges = this.dockedWindows.get(wnd);

        if (!edges) {
            edges = [new Set<DockWindow_T>(), new Set<DockWindow_T>(), new Set<DockWindow_T>(), new Set<DockWindow_T>()];
            this.dockedWindows.set(wnd, edges);
        }

        return edges;
    }

    protected dockWindow(wnd: DockWindow_T, edge: number, peer: DockWindow_T) { // NWindow 0x10037010: reciprocal edges, one edge per peer; null is the screen.
        const edges = this.getDockedWindows(wnd);

        if (edges[edge].has(peer)) return;

        if (peer) for (let i = 0; i < 4; i++) this.undockWindow(wnd, i, peer);
        edges[edge].add(peer);
        if (peer) this.dockWindow(peer, 3 - edge, wnd);
    }

    protected undockWindow(wnd: DockWindow_T, edge: number, peer: DockWindow_T) {
        const edges = this.dockedWindows.get(wnd);

        if (!edges || !edges[edge].delete(peer)) return;
        if (peer) this.undockWindow(peer, 3 - edge, wnd);
    }

    public clearWindowDocking(wnd: DockWindow_T) {
        const edges = this.dockedWindows.get(wnd);

        if (!edges) return;

        for (let i = 0; i < 4; i++) for (const peer of edges[i]) this.undockWindow(wnd, i, peer);
        this.dockedWindows.delete(wnd);
    }

    public snapWindow(x: number, y: number, width: number, height: number, owner: DockWindow_T): [number, number] { // NWindow 0x10037150: acquire from the current rectangle, release from the mouse position.
        for (const wnd of this.dockedWindows.keys())
            if (wnd !== owner && !wnd.isConnected) this.clearWindowDocking(wnd);

        const [oldX, oldY] = getWindowRect(owner), edges = this.getDockedWindows(owner);
        let nextX = x, nextY = y;

        for (const edge of [1, 0, 2, 3]) {
            if (!edges[edge].has(null)) continue;

            const delta = edge === 1 ? x : edge === 0 ? y : edge === 2 ? x - oldX : y - oldY;
            const released = edge === 3 ? Math.abs(delta) > SNAP_DISTANCE : Math.abs(delta) >= SNAP_DISTANCE;

            if (edge === 1 || edge === 2) nextX = oldX + (released ? delta : 0);
            else nextY = oldY + (released ? delta : 0);

            if (released) {
                this.undockWindow(owner, edge, null);
                return [nextX, nextY];
            }
        }

        for (const edge of [1, 0, 2, 3]) {
            const delta = edge === 1 ? -oldX : edge === 0 ? -oldY : edge === 2 ? this.canvas.width - oldX - width : this.canvas.height - oldY - height;

            if (edges[edge].has(null) || Math.abs(delta) >= SNAP_DISTANCE) continue;
            if (edge === 1 || edge === 2) nextX = oldX + delta;
            else nextY = oldY + delta;
            this.dockWindow(owner, edge, null);
        }

        for (const peer of document.querySelectorAll<HTMLElement>(".ndom-layer > .ndom-window")) {
            if (peer === owner || !peer.getClientRects().length) continue;

            const [otherX, otherY, otherWidth, otherHeight] = getWindowRect(peer);
            const overlapX = Math.max(oldX, otherX) <= Math.min(oldX + width, otherX + otherWidth), overlapY = Math.max(oldY, otherY) <= Math.min(oldY + height, otherY + otherHeight);
            let released = false;

            for (const edge of [1, 0, 2, 3]) {
                if (!edges[edge].has(peer)) continue;

                const delta = edge === 1 ? Math.trunc(x - otherX - otherWidth) : edge === 0 ? Math.trunc(y - otherY - otherHeight) : edge === 2 ? x - oldX : y - oldY;
                released = Math.abs(delta) >= SNAP_DISTANCE || !(edge === 1 || edge === 2 ? overlapY : overlapX);
                if (edge === 1 || edge === 2) nextX = oldX + (released ? delta : 0);
                else nextY = oldY + (released ? delta : 0);

                if (released) {
                    this.undockWindow(owner, edge, peer);
                    break;
                }
            }

            if (released) continue;

            for (const edge of [1, 0, 2, 3]) {
                if (edge === 1 ? edges[3].has(peer) : edge === 0 ? edges[0].has(peer) : edge === 2 ? edges[2].has(peer) || edges[1].has(peer) : edges[3].has(peer) || edges[0].has(peer)) continue;
                if (!(edge === 1 || edge === 2 ? overlapY : overlapX)) continue;

                const delta = edge === 1 ? otherX + otherWidth - oldX : edge === 0 ? otherY + otherHeight - oldY : edge === 2 ? otherX - oldX - width : otherY - oldY - height;

                if (Math.abs(delta) >= SNAP_DISTANCE) continue;
                if (edge === 1 || edge === 2) nextX = oldX + Math.trunc(delta);
                else nextY = oldY + Math.trunc(delta);
                this.dockWindow(owner, edge, peer);
            }
        }

        return [nextX, nextY];
    }

    public loadWindowPosition(name: string, width: number, height: number): [number, number] { // NWindow 0x10073480 reads posX/posY per window from WindowsInfo.ini.
        if (this.windowOwner === null) return null;

        const value = localStorage.getItem(`wnd:${this.windowOwner}:${name}`);

        if (value === null) return null;

        const [x, y] = JSON.parse(value);

        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Invalid window position '${name}'.`);

        return [Math.max(0, Math.min(this.canvas.width - width, x)), Math.max(0, Math.min(this.canvas.height - height, y))];
    }

    public saveWindowPosition(name: string, x: number, y: number) { if (this.windowOwner !== null) localStorage.setItem(`wnd:${this.windowOwner}:${name}`, JSON.stringify([x, y])); } // NWindow 0x100732c0 writes posX/posY to WindowsInfo.ini.

    public resetWindowPositions() {
        this.dockedWindows.clear();

        if (this.windowOwner === null) return;

        const prefix = `wnd:${this.windowOwner}:`;

        for (const key of Object.keys(localStorage))
            if (key.startsWith(prefix)) localStorage.removeItem(key);
    }

    public getWindowOwner() { return this.windowOwner; }

    public setWindowOwner(owner: string) {
        if (owner === this.windowOwner) return;

        this.dockedWindows.clear();
        this.windowOwner = owner;
    }

    public getZoneName(x: number, y: number, z: number): string { return this.getZoneNameInfo(x, y, z)?.name || ""; }

    public getZoneNameInfo(x: number, y: number, z: number) { // Engine.dll 0x105984b3/0x1044c980: indexed sector mask, bottom < Z <= top.
        const sectorX = Math.trunc((Math.trunc(x) + 360448) / 32768 + 9), sectorY = Math.trunc((Math.trunc(y) + 294912) / 32768 + 9);
        const mask = this.strings.zoneNameMasks[`${sectorX}_${sectorY}`];

        if (!mask) return null;

        const pixelX = Math.trunc((x - (sectorX - 20) * 32768) * mask.width / 32768);
        const pixelY = Math.trunc((y - (sectorY - 18) * 32768) * mask.height / 32768);
        const color = mask.pixels[pixelY * mask.width + pixelX];
        const row = this.strings.zoneNames.find(row => row.color === color && (color < 200 || row.sectorX === sectorX && row.sectorY === sectorY) && z > row.bottom && z <= row.top);

        return row || null;
    }

    public getSysString(id: number): string { return this.strings.sysStrings[id] ?? ""; } // GL2GameData+0x9871c+id*12 in NWindow is the sysstring-e.dat table.
    public getSystemMessage(id: number): string { return this.strings.systemMessages[id] ?? ""; }

    public filterText(value: string) {
        const replacement = this.getSysString(740);
        let text = "";

        for (let i = 0; i < value.length; i++) {
            const character = value[i];

            if (character === "\r" || character === "\n" || this.canvas.hasGlyphs(character)) text += character;
        }

        let search = text.replace(/[A-Z]/g, character => character.toLowerCase());

        this.strings.obsceneWords.forEach(word => {
            if (!word) return;

            let index = search.indexOf(word);

            while (index >= 0) {
                text = text.slice(0, index) + replacement + text.slice(index + word.length);
                search = search.slice(0, index) + replacement + search.slice(index + word.length);
                index = search.indexOf(word);
            }
        });

        return text;
    }

    public getClassName(classId: number): string { return this.getSysString(classId >= 0 && classId < 88 ? 247 + classId : 1071 + classId); } // 0x1006b250: class names are sysstrings 247+id below class 88, 1071+id above.

    public getCursor(index: number) { return this.asset.getCursor(index); }

    public setCursor(cursor: string) {
        document.documentElement.style.cursor = cursor;
        document.documentElement.classList.toggle("nwindow-cursor", !!cursor);
    }

    public render() {
        if (!this.isReady) return;

        const hasOverlay = this.overlayPaint !== null;

        if (!this.isDirty && !hasOverlay && !this.canvas.isAnimating) return;

        this.canvas.beginFrame();

        if (hasOverlay) this.overlayPaint(this.canvas);

        this.isDirty = false;
    }
}

export default NWindowManager;
