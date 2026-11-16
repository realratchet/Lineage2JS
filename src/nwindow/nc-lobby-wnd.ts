import EXPERIENCE_TABLE from "../game/experience";
import NCComboBox from "./nc-combo-box";
import { DigitFont_T, FontType_T } from "./nwindow-canvas";
import type { NDomLayer, NDomButton_T } from "./ndom";
import { SKIN_SLOTS } from "./skin-textures";
import SystemMessage_T from "./system-message";
import SysString_T from "./sys-string";

export type LobbyCharacter_T = { name: string, level: number, className: string, curHp: number, maxHp: number, curMp: number, maxMp: number, sp: number, exp: number, karma: number, deleteSeconds: number };
export type LobbyPawnLabel_T = { x: number, y: number, name: string, karma: number, deleteSeconds: number };

type PawnLabelElements_T = { name: HTMLDivElement, time: HTMLDivElement, text: string, color: number, timeText: string };

const TEXT_COLOR = 0xffdcdcdc;
const LABEL_COLOR = 0xffa3a3a3;
const VALUE_COLOR = 0xffb09b79;
const MAX_CHARACTERS = 7;
const BOTTOM_STRIP = 52;

const TEX_SELECT_BACK = "L2UI_CH3.LobbyWnd.select1_back";
const TEX_START_BACK = "L2UI_CH3.LobbyWnd.lobby_startbtnback";
const TEX_MENU_BACK = "L2UI_CH3.LobbyWnd.lobby_menuback";
const TEX_HPBAR = "L2UI_CH3.PlayerStatusWnd.ps_hpbar";
const TEX_MPBAR = "L2UI_CH3.PlayerStatusWnd.ps_mpbar";
const TEX_EXPBAR = "L2UI_CH3.PlayerStatusWnd.ps_expbar";
const TEX_BIGBUTTON = SKIN_SLOTS.bigButton;
const TEX_BIGBUTTON_DOWN = SKIN_SLOTS.bigButtonDown;
const TEX_BIGBUTTON2 = "L2UI_CH3.Button.BigButton2";
const TEX_BIGBUTTON2_DOWN = "L2UI_CH3.Button.BigButton2_down";
const TEX_DIGITS = "L2UI.NWindow.Number";

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
    const days = Math.trunc(seconds / (24 * 60 * 60)), rest = seconds % (24 * 60 * 60);

    return `${days}${manager.getSysString(SysString_T.Days)} ${Math.trunc(rest / 3600)}${manager.getSysString(SysString_T.Hours)} ${Math.trunc((rest % 3600) / 60)}${manager.getSysString(SysString_T.Minutes)}`;
}

function isPendingDelete(character: LobbyCharacter_T) { return character.deleteSeconds > 0; }

export class NCPawnSelectWnd { // NCPawnSelectWnd OnCreate 0x1009ccc0, OnPaint 0x1009bbe0: (24,27) 256x108 character info panel.
    public readonly element: HTMLDivElement;
    public readonly combo: NCComboBox;
    protected readonly layer: NDomLayer;
    protected readonly values: HTMLDivElement;
    protected readonly hpBar: HTMLDivElement;
    protected readonly mpBar: HTMLDivElement;
    protected readonly expBar: HTMLDivElement;
    protected readonly digits: HTMLDivElement;
    protected readonly levelText: HTMLDivElement;
    protected readonly spText: HTMLDivElement;
    protected readonly karmaText: HTMLDivElement;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        const manager = layer.getManager();

        this.layer = layer;
        this.element = layer.createWindow(24, 27, 270, 108, parent);
        this.element.style.pointerEvents = "auto";

        layer.tile(this.element, 0, 0, 153, 108, 0, 0, 153, 108, TEX_SELECT_BACK);
        layer.tile(this.element, 153, 0, 14, 108, 152, 0, 1, 108, TEX_SELECT_BACK);
        layer.tile(this.element, 167, 0, 103, 108, 153, 0, 103, 108, TEX_SELECT_BACK);
        layer.text(this.element, manager.getSysString(SysString_T.Name), LABEL_COLOR, FontType_T.SMALL, 15, 16);
        layer.text(this.element, manager.getSysString(SysString_T.Level), LABEL_COLOR, FontType_T.SMALL, 15, 39);
        layer.text(this.element, manager.getSysString(SysString_T.Karma), TEXT_COLOR, FontType_T.SMALL, 131, 69);

        this.values = layer.createWindow(0, 0, 270, 108, this.element);
        this.values.hidden = true;
        this.hpBar = layer.tile(this.values, 35, 55, 85, 12, 0, 0, 8, 12, TEX_HPBAR);
        this.mpBar = layer.tile(this.values, 35, 69, 85, 12, 0, 0, 8, 12, TEX_MPBAR);
        this.expBar = layer.tile(this.values, 35, 83, 220, 12, 0, 0, 8, 12, TEX_EXPBAR);
        this.digits = layer.createWindow(0, 0, 270, 108, this.values);
        this.digits.style.pointerEvents = "none";
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
        this.setBar(this.expBar, 83, levelEnd ? Math.trunc((character.exp - levelStart) * 220 / (levelEnd - levelStart)) : 0, 220, TEX_EXPBAR);

        const layer = this.layer, digits = this.digits;
        const percent = `${((character.exp - levelStart) * 100 / (levelEnd - levelStart)).toFixed(2)}%`;
        const hp = String(character.curHp), mp = String(character.curMp);

        digits.replaceChildren();
        layer.digits(digits, percent, TEXT_COLOR, DigitFont_T.NORMAL, 145 - Math.trunc(this.layer.measureText(percent) / 2), 85); // digit strings are positioned with the regular-font extent 0x10012960, not the 8px cell width
        layer.digits(digits, "/", TEXT_COLOR, DigitFont_T.NORMAL, 77 - Math.trunc(this.layer.measureText("/") / 2), 57); // 0x10013350 font 1 -> UCanvas::DrawSpecialDigit: cell k is (k*8, 0, 8, 8), characters outside the strip skip without advancing.
        layer.digits(digits, hp, TEXT_COLOR, DigitFont_T.NORMAL, 67 - this.layer.measureText(hp), 57);
        layer.digits(digits, String(character.maxHp), TEXT_COLOR, DigitFont_T.NORMAL, 83, 57);
        layer.digits(digits, "/", TEXT_COLOR, DigitFont_T.NORMAL, 77 - Math.trunc(this.layer.measureText("/") / 2), 71);
        layer.digits(digits, mp, TEXT_COLOR, DigitFont_T.NORMAL, 67 - this.layer.measureText(mp), 71);
        layer.digits(digits, String(character.maxMp), TEXT_COLOR, DigitFont_T.NORMAL, 83, 71);

        const karma = character.karma >= 999999 ? `${character.karma}+` : String(character.karma);

        this.layer.renderText(this.levelText, `${character.level} ${character.className}`, VALUE_COLOR);
        this.layer.renderText(this.spText, String(character.sp), VALUE_COLOR);
        this.layer.place(this.spText, 250 - this.layer.measureText(String(character.sp)), 56);
        this.layer.renderText(this.karmaText, karma, VALUE_COLOR);
        this.layer.place(this.karmaText, 250 - this.layer.measureText(karma), 70);
    }
}

export class NCLobbyStartWnd { // NCLobbyStartWnd OnCreate 0x1009b3a0, OnPaint 0x1009b220: 140x49 plate with the Start button.
    public readonly element: HTMLDivElement;
    public readonly startButton: NDomButton_T;

    public constructor(layer: NDomLayer, parent: HTMLElement, onStart: () => void) {
        this.element = layer.createWindow(0, 0, 140, 49, parent);
        this.element.style.pointerEvents = "auto";

        layer.tile(this.element, 0, 0, 140, 49, 0, 0, 140, 49, TEX_START_BACK);
        this.startButton = layer.button(this.element, 13, 10, 116, 31, TEX_BIGBUTTON2, TEX_BIGBUTTON2_DOWN, null, layer.getManager().getSysString(SysString_T.StartGame), onStart);
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
        this.createButton = layer.button(this.element, 13, 20, 96, 23, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, null, manager.getSysString(SysString_T.CreateCharacterButton), onCreate);
        this.deleteButton = layer.button(this.element, 13, 45, 96, 23, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, null, manager.getSysString(SysString_T.DeleteCharacter), onDelete);
        this.reloginButton = layer.button(this.element, 13, 95, 96, 23, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, null, manager.getSysString(SysString_T.ReLogin), onRelogin);
        this.deleteButton.setEnabled(false);
    }
}

export class NCLobbyWnd { // NCLobbyWnd OnCreate 0x1009cff0, OnPaint 0x1009c7e0: character select root, (0,0) ScreenX x ScreenY-52.
    public static getTextures(): string[] { return [TEX_SELECT_BACK, TEX_START_BACK, TEX_MENU_BACK, TEX_HPBAR, TEX_MPBAR, TEX_EXPBAR, TEX_DIGITS, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, `?${TEX_BIGBUTTON}_over`, TEX_BIGBUTTON2, TEX_BIGBUTTON2_DOWN, `?${TEX_BIGBUTTON2}_over`, ...NCComboBox.getTextures()]; }

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

    public gameStart() { // 0x1009b8e0
        if (this.selected < 0 || isPendingDelete(this.characters[this.selected])) return;
        if (this.onStart) this.onStart(this.selected);
    }

    protected newCharacter() { // slot78 0x1009ba10
        if (this.characters.length === MAX_CHARACTERS) {
            if (this.onSystemMessage) this.onSystemMessage(SystemMessage_T.CharacterLimitReached);

            return;
        }

        if (this.onCreate) this.onCreate();
    }

    protected delCharacter() { // slot79 0x1009cb90: confirmation is systemmsg 78 with the character name.
        if (this.selected < 0 || isPendingDelete(this.characters[this.selected])) return;
        if (this.onDelete) this.onDelete(this.selected);
    }

    public setPawnLabels(labels: LobbyPawnLabel_T[]) { // OnPaint 0x1009c849: Draw3DCoordText per pawn; a pending delete adds "Remaining Time : <time>" 9 units higher.
        const lineHeight = this.layer.getManager().canvas.getLineHeight(FontType_T.LARGE);

        while (this.arrLabels.length < labels.length)
            this.arrLabels.push({ name: this.layer.text(this.labels, "", TEXT_COLOR, FontType_T.LARGE, 0, 0), time: this.layer.text(this.labels, "", TEXT_COLOR, FontType_T.SMALL, 0, 0), text: null, color: 0, timeText: null });

        this.arrLabels.forEach((element, index) => {
            const label = labels[index];

            element.name.hidden = !label;
            element.time.hidden = !label || label.deleteSeconds <= 0;

            if (!label) return;

            const color = karmaColor(label.karma);

            if (element.text !== label.name || element.color !== color) {
                this.layer.renderText(element.name, label.name, color, FontType_T.LARGE);
                element.text = label.name;
                element.color = color;
            }

            this.layer.place(element.name, label.x - Math.trunc(this.layer.measureText(label.name, FontType_T.LARGE) / 2), Math.trunc(label.y - lineHeight));

            if (element.time.hidden) return;

            const timeText = `${this.layer.getManager().getSysString(SysString_T.DeletionTimeRemaining)} : ${makeTimeStr(this.layer, label.deleteSeconds)}`;

            if (element.timeText !== timeText) {
                this.layer.renderText(element.time, timeText, TEXT_COLOR);
                element.timeText = timeText;
            }

            this.layer.place(element.time, Math.trunc(label.x - this.layer.measureText(timeText) / 2), Math.trunc(label.y - this.layer.getManager().canvas.getLineHeight() * 2));
        });
    }
}

export default NCLobbyWnd;
