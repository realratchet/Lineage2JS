import { FontType_T } from "./nwindow-canvas";
import type { NDomLayer, NDomButton_T } from "./ndom";

export type LobbyCharacter_T = { name: string, level: number, className: string, curHp: number, maxHp: number, curMp: number, maxMp: number, sp: number, exp: number, karma: number, deleteSeconds: number };
export type LobbyPawnLabel_T = { x: number, y: number, name: string, karma: number, deleteSeconds: number };

type PawnLabelElements_T = { name: HTMLCanvasElement, time: HTMLCanvasElement, text: string, color: number, timeText: string };

const TEXT_COLOR = 0xffdcdcdc;
const LABEL_COLOR = 0xffa3a3a3;
const VALUE_COLOR = 0xffb09b79;
const MAX_CHARACTERS = 7;
const BOTTOM_STRIP = 52;
const COMBO_ROW = 17;
const DIGIT_CELL = 8;
const DIGIT_CELLS = "0123456789HMP/%.C:";

const TEX_SELECT_BACK = "L2UI_CH3.LobbyWnd.select1_back";
const TEX_START_BACK = "L2UI_CH3.LobbyWnd.lobby_startbtnback";
const TEX_MENU_BACK = "L2UI_CH3.LobbyWnd.lobby_menuback";
const TEX_HPBAR = "L2UI_CH3.PlayerStatusWnd.ps_hpbar";
const TEX_MPBAR = "L2UI_CH3.PlayerStatusWnd.ps_mpbar";
const TEX_EXPBAR = "L2UI_CH3.PlayerStatusWnd.ps_expbar";
const TEX_BIGBUTTON = "L2UI_CH3.Button.BigButton";
const TEX_BIGBUTTON_DOWN = "L2UI_CH3.Button.BigButton_down";
const TEX_BIGBUTTON2 = "L2UI_CH3.Button.BigButton2";
const TEX_BIGBUTTON2_DOWN = "L2UI_CH3.Button.BigButton2_down";
const TEX_TEXTBOX1 = "L2UI_CH3.Etc.textbox1";
const TEX_TEXTBOX2 = "L2UI_CH3.Etc.textbox2";
const TEX_TEXTBOX3 = "L2UI_CH3.Etc.textbox3";
const TEX_TEXTSELECT = "L2UI_CH3.ListCtrl.TextSelect";
const TEX_TEXTSELECT2 = "L2UI_CH3.ListCtrl.TextSelect2";
const TEX_DOWNBUTTON = "L2UI_CH3.Button.downbutton";
const TEX_DOWNBUTTON_DOWN = "L2UI_CH3.Button.downbutton_down";
const TEX_DIGITS = "L2UI.NWindow.Number";

export const EXPERIENCE_TABLE = [0, 0, 68, 363, 1168, 2884, 6038, 11287, 19423, 31378, 48229, 71202, 101677, 141193, 191454, 254330, 331867, 426288, 540000, 675596, 835862, 1023784, 1242546, 1495543, 1786379, 2118876, 2497077, 2925250, 3407897, 3949754, 4555796, 5231246, 5981576, 6812513, 7730044, 8740422, 9850166, 11066072, 12395215, 13844951, 15422929, 17137087, 18995665, 21007203, 23180550, 25524868, 28049635, 30764654, 33680052, 36806289, 40154162, 45525133, 51262490, 57383988, 63907911, 70853089, 80700831, 91162654, 102265881, 114038596, 126509653, 146308200, 167244337, 189364894, 212717908, 237352644, 271975263, 308443198, 346827154, 387199547, 429634523, 474207979, 532694979, 606322775, 696381369, 804225364, 931275828, 1151275834, 1511275834, 2099275834, 2099325834, 2099375834, 2099425834, 2099475834, 2099525834, 2099575834, 2099625834, 2099675834, 2099725834]; // NWindow.dll 0x101b79fc: experience at the start of each level.

const cacheDigitAtlas = new Map<number, HTMLCanvasElement>();

function getDigitAtlas(layer: NDomLayer, color: number): HTMLCanvasElement {
    let atlas = cacheDigitAtlas.get(color & 0xffffff);

    if (atlas) return atlas;

    const texture = layer.getManager().canvas.getTexture(TEX_DIGITS);

    atlas = document.createElement("canvas");
    atlas.width = texture.width;
    atlas.height = texture.height;

    const context = atlas.getContext("2d");

    context.drawImage(texture, 0, 0);

    const pixels = context.getImageData(0, 0, atlas.width, atlas.height);
    const data = pixels.data;
    const r = (color >>> 16) & 0xff, g = (color >>> 8) & 0xff, b = color & 0xff;

    for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i] * r / 255;
        data[i + 1] = data[i + 1] * g / 255;
        data[i + 2] = data[i + 2] * b / 255;
    }

    context.putImageData(pixels, 0, 0);
    cacheDigitAtlas.set(color & 0xffffff, atlas);

    return atlas;
}

function drawDigits(layer: NDomLayer, context: CanvasRenderingContext2D, x: number, y: number, color: number, text: string) { // 0x10013350 font 1 -> UCanvas::DrawSpecialDigit: cell k is (k*8, 0, 8, 8), characters outside the strip skip without advancing.
    const atlas = getDigitAtlas(layer, color);
    let penX = Math.trunc(x);

    context.globalAlpha = ((color >>> 24) & 0xff) / 255;

    for (let i = 0; i < text.length; i++) {
        const cell = DIGIT_CELLS.indexOf(text[i]);

        if (cell < 0) continue;

        context.drawImage(atlas, cell * DIGIT_CELL, 0, DIGIT_CELL, DIGIT_CELL, penX, Math.trunc(y), DIGIT_CELL, DIGIT_CELL);
        penX += DIGIT_CELL;
    }

    context.globalAlpha = 1;
}

function karmaColor(karma: number): number { // NCLobbyWnd paint 0x1009c8cd: white, fading to red as karma grows.
    let a = 0;

    if (karma > 0) {
        const floor = Math.trunc(karma / 16) + 100;

        a = karma < floor ? floor : Math.min(karma, 255);
    }

    return (0xffff0000 | ((255 - a) << 8) | (255 - a)) >>> 0;
}

function makeTimeStr(layer: NDomLayer, seconds: number): string { // NWndUtil::MakeTimeStr 0x10037bc0: "%d%s %d%s %d%s" with sysstring 1109/1110/1111.
    const manager = layer.getManager();
    const days = Math.trunc(seconds / 86400), rest = seconds % 86400;

    return `${days}${manager.getSysString(1109)} ${Math.trunc(rest / 3600)}${manager.getSysString(1110)} ${Math.trunc((rest % 3600) / 60)}${manager.getSysString(1111)}`;
}

function isPendingDelete(character: LobbyCharacter_T) { return character.deleteSeconds > 0; }

export class NCComboBox { // NCComboBox OnCreate 0x100064d0, OnPaint 0x10005e40; the list drops below the box in 17px rows.
    public readonly element: HTMLDivElement;
    public onChange: (index: number) => void = null;
    protected readonly layer: NDomLayer;
    protected readonly caption: HTMLCanvasElement;
    protected readonly button: NDomButton_T;
    protected readonly list: HTMLDivElement;
    protected readonly width: number;
    protected readonly height: number;
    protected items: string[] = [];
    protected selected = -1;
    protected readonly onOutside = (event: MouseEvent) => { if (!this.element.contains(event.target as Node)) this.setOpen(false); };

    public constructor(layer: NDomLayer, parent: HTMLElement, x: number, y: number, width: number, height: number) {
        const top = Math.trunc(height * 0.5 - (COMBO_ROW >> 1));

        this.layer = layer;
        this.width = width;
        this.height = height;
        this.element = layer.createWindow(x, y, width, height, parent);

        layer.tile(this.element, 0, top, 8, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX1);
        layer.tile(this.element, 8, top, width - 16, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX2);
        layer.tile(this.element, width - 8, top, 8, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX3);
        this.caption = layer.text(this.element, "", TEXT_COLOR, FontType_T.SMALL, 5, this.getTextY());
        this.caption.hidden = true;
        this.button = layer.button(this.element, Math.trunc(width - 15 - 1), Math.trunc(height * 0.5 - 7), 15, 15, TEX_DOWNBUTTON, TEX_DOWNBUTTON_DOWN, null, null, () => this.setOpen(this.list.hidden));
        this.list = layer.createWindow(0, height, width, 0, this.element);
        this.list.hidden = true;

        this.element.addEventListener("mousedown", event => { // slot68 0x10005c60: a press on the closed box opens the list
            if (event.button !== 0 || this.list.contains(event.target as Node) || this.button.contains(event.target as Node)) return;
            if (this.list.hidden) this.setOpen(true);
        });
    }

    protected getTextY() { return (COMBO_ROW >> 1) - (this.layer.getManager().canvas.getLineHeight() >> 1); }

    public setItems(items: string[]) {
        this.items = items;
        this.list.replaceChildren();
        this.layer.place(this.list, 0, this.height, this.width, items.length * COMBO_ROW);

        items.forEach((item, index) => {
            const row = this.layer.createWindow(0, index * COMBO_ROW, this.width, COMBO_ROW, this.list);

            this.layer.tile(row, 0, 0, 8, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX1);
            this.layer.tile(row, 8, 0, this.width - 16, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX2);
            this.layer.tile(row, this.width - 8, 0, 8, COMBO_ROW, 0, 0, 8, 17, TEX_TEXTBOX3);

            const highlight = [this.layer.tile(row, 1, 0, this.width - 32, 16, 0, 0, 16, 13, TEX_TEXTSELECT), this.layer.tile(row, this.width - 31, 0, 32, 16, 0, 0, 32, 13, TEX_TEXTSELECT2)];

            for (const element of highlight) element.hidden = true;

            this.layer.text(row, item, TEXT_COLOR, FontType_T.SMALL, 5, this.getTextY());
            row.addEventListener("mouseenter", () => { for (const element of highlight) element.hidden = false; });
            row.addEventListener("mouseleave", () => { for (const element of highlight) element.hidden = true; });
            row.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                this.layer.getManager().playButtonSound(true);
                this.setSelected(index);
                this.setOpen(false);

                if (this.onChange) this.onChange(index);
            });
        });

        this.setSelected(-1);
    }

    public setSelected(index: number) {
        this.selected = index;
        this.caption.hidden = index < 0 || index >= this.items.length;

        if (!this.caption.hidden) this.layer.renderText(this.caption, this.items[index], TEXT_COLOR);
    }

    public setOpen(isOpen: boolean) {
        this.list.hidden = !isOpen || this.items.length === 0;

        if (this.list.hidden) window.removeEventListener("mousedown", this.onOutside, true);
        else window.addEventListener("mousedown", this.onOutside, true);
    }
}

export class NCPawnSelectWnd { // NCPawnSelectWnd OnCreate 0x1009ccc0, OnPaint 0x1009bbe0: (24,27) 256x108 character info panel.
    public readonly element: HTMLDivElement;
    public readonly combo: NCComboBox;
    protected readonly layer: NDomLayer;
    protected readonly values: HTMLDivElement;
    protected readonly hpBar: HTMLDivElement;
    protected readonly mpBar: HTMLDivElement;
    protected readonly expBar: HTMLDivElement;
    protected readonly digits: HTMLCanvasElement;
    protected readonly levelText: HTMLCanvasElement;
    protected readonly spText: HTMLCanvasElement;
    protected readonly karmaText: HTMLCanvasElement;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        const manager = layer.getManager();

        this.layer = layer;
        this.element = layer.createWindow(24, 27, 256, 108, parent);
        this.element.style.pointerEvents = "auto";

        layer.tile(this.element, 0, 0, 256, 108, 0, 0, 256, 108, TEX_SELECT_BACK);
        layer.text(this.element, manager.getSysString(50), LABEL_COLOR, FontType_T.SMALL, 15, 16);
        layer.text(this.element, manager.getSysString(88), LABEL_COLOR, FontType_T.SMALL, 15, 39);
        layer.text(this.element, manager.getSysString(101), TEXT_COLOR, FontType_T.SMALL, 131, 69);

        this.values = layer.createWindow(0, 0, 256, 108, this.element);
        this.values.hidden = true;
        this.hpBar = layer.tile(this.values, 35, 55, 85, 12, 0, 0, 8, 12, TEX_HPBAR);
        this.mpBar = layer.tile(this.values, 35, 69, 85, 12, 0, 0, 8, 12, TEX_MPBAR);
        this.expBar = layer.tile(this.values, 35, 83, 206, 12, 0, 0, 8, 12, TEX_EXPBAR);
        this.digits = document.createElement("canvas");
        this.digits.className = "ndom-text ndom-absolute";
        layer.place(this.digits, 0, 0);
        this.values.appendChild(this.digits);
        this.levelText = layer.text(this.values, "", VALUE_COLOR, FontType_T.SMALL, 32, 39);
        this.spText = layer.text(this.values, "", VALUE_COLOR, FontType_T.SMALL, 0, 56);
        this.karmaText = layer.text(this.values, "", VALUE_COLOR, FontType_T.SMALL, 0, 70);

        this.combo = new NCComboBox(layer, this.element, 46, 13, 138, 17);
    }

    protected setBar(element: HTMLDivElement, y: number, width: number, limit: number, texture: string) { // 0x1009bdd8: a bar past its limit is clamped and drawn 10px tall instead of 12.
        element.hidden = width <= 0;

        if (element.hidden) return;

        const w = Math.min(width, limit), h = width > limit ? 10 : 12;

        this.layer.place(element, 35, y, w, h);
        this.layer.setTile(element, w, h, 0, 0, 8, 12, texture);
    }

    public setCharacter(character: LobbyCharacter_T) {
        this.values.hidden = !character;

        if (!character) return;

        const levelStart = EXPERIENCE_TABLE[character.level], levelEnd = EXPERIENCE_TABLE[character.level + 1];

        if (levelEnd === undefined) throw new Error(`Level ${character.level} is outside the experience table.`);

        this.setBar(this.hpBar, 55, character.maxHp ? Math.trunc(character.curHp * 85 / character.maxHp) : 0, 85, TEX_HPBAR);
        this.setBar(this.mpBar, 69, character.maxMp ? Math.trunc(character.curMp * 85 / character.maxMp) : 0, 85, TEX_MPBAR);
        this.setBar(this.expBar, 83, levelEnd ? Math.trunc((character.exp - levelStart) * 206 / (levelEnd - levelStart)) : 0, 206, TEX_EXPBAR);

        const scale = this.layer.getManager().canvas.scale;
        const context = this.digits.getContext("2d");
        const percent = `${((character.exp - levelStart) * 100 / (levelEnd - levelStart)).toFixed(2)}%`;
        const hp = String(character.curHp), mp = String(character.curMp);

        this.digits.width = Math.round(256 * scale);
        this.digits.height = Math.round(108 * scale);
        this.digits.style.width = "256px";
        this.digits.style.height = "108px";
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.imageSmoothingEnabled = false;

        drawDigits(this.layer, context, 138 - Math.trunc(this.layer.measureText(percent) / 2), 85, TEXT_COLOR, percent); // digit strings are positioned with the regular-font extent 0x10012960, not the 8px cell width
        drawDigits(this.layer, context, 77 - Math.trunc(this.layer.measureText("/") / 2), 57, TEXT_COLOR, "/");
        drawDigits(this.layer, context, 67 - this.layer.measureText(hp), 57, TEXT_COLOR, hp);
        drawDigits(this.layer, context, 83, 57, TEXT_COLOR, String(character.maxHp));
        drawDigits(this.layer, context, 77 - Math.trunc(this.layer.measureText("/") / 2), 71, TEXT_COLOR, "/");
        drawDigits(this.layer, context, 67 - this.layer.measureText(mp), 71, TEXT_COLOR, mp);
        drawDigits(this.layer, context, 83, 71, TEXT_COLOR, String(character.maxMp));

        const karma = character.karma >= 999999 ? `${character.karma}+` : String(character.karma);

        this.layer.renderText(this.levelText, `${character.level} ${character.className}`, VALUE_COLOR);
        this.layer.renderText(this.spText, String(character.sp), VALUE_COLOR);
        this.layer.place(this.spText, 236 - this.layer.measureText(String(character.sp)), 56);
        this.layer.renderText(this.karmaText, karma, VALUE_COLOR);
        this.layer.place(this.karmaText, 236 - this.layer.measureText(karma), 70);
    }
}

export class NCLobbyStartWnd { // NCLobbyStartWnd OnCreate 0x1009b3a0, OnPaint 0x1009b220: 140x49 plate with the Start button.
    public readonly element: HTMLDivElement;
    public readonly startButton: NDomButton_T;

    public constructor(layer: NDomLayer, parent: HTMLElement, onStart: () => void) {
        this.element = layer.createWindow(0, 0, 140, 49, parent);
        this.element.style.pointerEvents = "auto";

        layer.tile(this.element, 0, 0, 140, 49, 0, 0, 140, 49, TEX_START_BACK);
        this.startButton = layer.button(this.element, 13, 10, 116, 31, TEX_BIGBUTTON2, TEX_BIGBUTTON2_DOWN, null, layer.getManager().getSysString(160), onStart);
        this.startButton.setEnabled(false);
    }
}

export class NCLobbyFunctionWnd { // NCLobbyFunctionWnd OnCreate 0x1009ada0, OnPaint 0x1009aaa0: 120x138 menu with Create / Delete / Re-Login.
    public readonly element: HTMLDivElement;
    public readonly createButton: NDomButton_T;
    public readonly deleteButton: NDomButton_T;
    public readonly reloginButton: NDomButton_T;

    public constructor(layer: NDomLayer, parent: HTMLElement, onCreate: () => void, onDelete: () => void, onRelogin: () => void) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 120, 138, parent);
        this.element.style.pointerEvents = "auto";

        layer.tile(this.element, 0, 0, 120, 138, 0, 0, 120, 138, TEX_MENU_BACK);
        this.createButton = layer.button(this.element, 13, 20, 96, 23, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, null, manager.getSysString(158), onCreate);
        this.deleteButton = layer.button(this.element, 13, 45, 96, 23, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, null, manager.getSysString(159), onDelete);
        this.reloginButton = layer.button(this.element, 13, 95, 96, 23, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, null, manager.getSysString(884), onRelogin);
        this.deleteButton.setEnabled(false);
    }
}

export class NCLobbyWnd { // NCLobbyWnd OnCreate 0x1009cff0, OnPaint 0x1009c7e0: character select root, (0,0) ScreenX x ScreenY-52.
    public static getTextures(): string[] { return [TEX_SELECT_BACK, TEX_START_BACK, TEX_MENU_BACK, TEX_HPBAR, TEX_MPBAR, TEX_EXPBAR, TEX_DIGITS, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, `?${TEX_BIGBUTTON}_over`, TEX_BIGBUTTON2, TEX_BIGBUTTON2_DOWN, `?${TEX_BIGBUTTON2}_over`, TEX_TEXTBOX1, TEX_TEXTBOX2, TEX_TEXTBOX3, TEX_TEXTSELECT, TEX_TEXTSELECT2, TEX_DOWNBUTTON, TEX_DOWNBUTTON_DOWN, `?${TEX_DOWNBUTTON}_over`]; }

    public readonly element: HTMLDivElement;
    public onSelect: (index: number) => void = null;
    public onStart: (index: number) => void = null;
    public onCreate: () => void = null;
    public onDelete: (index: number) => void = null;
    public onRestore: (index: number) => void = null;
    public onRelogin: () => void = null;
    public onSystemMessage: (id: number) => void = null;
    protected readonly layer: NDomLayer;
    protected readonly pawnSelect: NCPawnSelectWnd;
    protected readonly startWnd: NCLobbyStartWnd;
    protected readonly functionWnd: NCLobbyFunctionWnd;
    protected readonly labels: HTMLDivElement;
    protected readonly arrLabels: PawnLabelElements_T[] = [];
    protected characters: LobbyCharacter_T[] = [];
    protected selected = -1;

    public constructor(layer: NDomLayer) {
        this.layer = layer;
        this.element = layer.createWindow(0, 0, 0, 0);
        this.element.style.pointerEvents = "none";

        this.labels = layer.createWindow(0, 0, 0, 0, this.element);
        this.pawnSelect = new NCPawnSelectWnd(layer, this.element);
        this.startWnd = new NCLobbyStartWnd(layer, this.element, () => this.gameStart());
        this.functionWnd = new NCLobbyFunctionWnd(layer, this.element, () => this.newCharacter(), () => this.delCharacter(), () => { if (this.onRelogin) this.onRelogin(); });

        this.pawnSelect.combo.onChange = index => this.pick(index);
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) { // NCWnd::MoveChildWindow 0x100351d0: Start anchored bottom-centre (0,-10), menu bottom-right (-34,-10).
        const width = screenWidth, height = screenHeight - BOTTOM_STRIP;

        this.layer.place(this.element, 0, 0, width, height);
        this.layer.place(this.startWnd.element, Math.trunc(width / 2 - 140 / 2), height - 49 - 10);
        this.layer.place(this.functionWnd.element, width - 120 - 34, height - 138 - 10);
    }

    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }

    public setCharacters(characters: LobbyCharacter_T[]) {
        if (characters.length > MAX_CHARACTERS) throw new Error(`Lobby holds at most ${MAX_CHARACTERS} characters, got ${characters.length}.`);

        this.characters = characters;
        this.pawnSelect.combo.setItems(characters.map(character => character.name));
        this.setSelected(-1);
    }

    public setSelected(index: number) {
        if (index >= this.characters.length) throw new Error(`Character index ${index} is out of range (${this.characters.length}).`);

        const character = index >= 0 ? this.characters[index] : null;
        const isSelectable = !!character && !isPendingDelete(character);

        this.selected = index;
        this.pawnSelect.combo.setSelected(index);
        this.pawnSelect.setCharacter(character);
        this.startWnd.startButton.setEnabled(isSelectable);
        this.functionWnd.deleteButton.setEnabled(isSelectable);
    }

    public pick(index: number) { // NCPawnSelectWnd slot75 0x1009c590: a pending-delete pick deselects the pawn and asks systemmsg 1555 instead.
        this.setSelected(index);

        if (isPendingDelete(this.characters[index])) {
            if (this.onSelect) this.onSelect(-1);
            if (this.onRestore) this.onRestore(index);

            return;
        }

        if (this.onSelect) this.onSelect(index);
    }

    protected gameStart() { // 0x1009b8e0
        if (this.selected < 0 || isPendingDelete(this.characters[this.selected])) return;
        if (this.onStart) this.onStart(this.selected);
    }

    protected newCharacter() { // slot78 0x1009ba10
        if (this.characters.length === MAX_CHARACTERS) {
            if (this.onSystemMessage) this.onSystemMessage(77);

            return;
        }

        if (this.onCreate) this.onCreate();
    }

    protected delCharacter() { // slot79 0x1009cb90: confirmation is systemmsg 78 with the character name.
        if (this.selected < 0 || isPendingDelete(this.characters[this.selected])) return;
        if (this.onDelete) this.onDelete(this.selected);
    }

    public setPawnLabels(labels: LobbyPawnLabel_T[]) { // OnPaint 0x1009c849: Draw3DCoordText per pawn; a pending delete adds "Remaining Time : <time>" 9 units higher.
        const lineHeight = this.layer.getManager().canvas.getLineHeight();

        while (this.arrLabels.length < labels.length)
            this.arrLabels.push({ name: this.layer.text(this.labels, "", TEXT_COLOR, FontType_T.SMALL, 0, 0), time: this.layer.text(this.labels, "", TEXT_COLOR, FontType_T.SMALL, 0, 0), text: null, color: 0, timeText: null });

        this.arrLabels.forEach((element, index) => {
            const label = labels[index];

            element.name.hidden = !label;
            element.time.hidden = !label || label.deleteSeconds <= 0;

            if (!label) return;

            const color = karmaColor(label.karma);

            if (element.text !== label.name || element.color !== color) {
                this.layer.renderText(element.name, label.name, color);
                element.text = label.name;
                element.color = color;
            }

            this.layer.place(element.name, Math.trunc(label.x - this.layer.measureText(label.name) / 2), Math.trunc(label.y - lineHeight));

            if (element.time.hidden) return;

            const timeText = `${this.layer.getManager().getSysString(1108)} : ${makeTimeStr(this.layer, label.deleteSeconds)}`;

            if (element.timeText !== timeText) {
                this.layer.renderText(element.time, timeText, TEXT_COLOR);
                element.timeText = timeText;
            }

            this.layer.place(element.time, Math.trunc(label.x - this.layer.measureText(timeText) / 2), Math.trunc(label.y - lineHeight * 2));
        });
    }
}

export default NCLobbyWnd;
