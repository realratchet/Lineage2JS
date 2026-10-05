import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { NDomButton_T, NDomScrollPane_T } from "./ndom";
import type { ItemInfo_T } from "../assets/decode-worker/decode-protocol";

const TEX_BACK = "L2UI_CH3.InventoryWnd.Inventory_Back";
const TEX_TAB = "L2UI_CH3.InventoryWnd.Inventory_tab2";
const TEX_TAB_SELECTED = "L2UI_CH3.InventoryWnd.Inventory_tab1";
const TEX_OUTLINE = "L2UI_CH3.InventoryWnd.Inventory_OutLine";
const TEX_OUTLINE_DOWN = "L2UI_CH3.InventoryWnd.Inventory_OutLine_down";
const TEX_SELECTED = "L2UI.NWindow.item_click";
const TEX_FRAME_LEFT = "L2UI_CH3.FrameCtrl.FrameBackLeft";
const TEX_FRAME_MID = "L2UI_CH3.FrameCtrl.FrameBackMid";
const TEX_FRAME_RIGHT = "L2UI_CH3.FrameCtrl.FrameBackRight";
const TEX_CLOSE = "L2UI_CH3.FrameCtrl.FrameCloseBtn";
const TEX_CLOSE_DOWN = "L2UI_CH3.FrameCtrl.FrameCloseOnBtn";
const TEX_MINIMIZE = "L2UI_CH3.FrameCtrl.FrameMiniBtn";
const TEX_MINIMIZE_DOWN = "L2UI_CH3.FrameCtrl.FrameMiniOnBtn";
const TEX_ADENA = "L2UI.WindowIcon.WindowIconAdena";
const TEX_WEIGHT = "L2UI.WindowIcon.Weight";
const TEX_TRASH = "L2UI_CH3.InventoryWnd.Inventory_trash";
const arrWeightBars = [1, 2, 3, 4, 5].map(index => `L2UI_CH3.PlayerStatusWnd.PS_weightbar${index}`);
const arrTooltipSlices = Array.from({ length: 9 }, (_, i) => `L2UI_ch3.Tooltip.Tooltip${i + 1}`);
const arrGradeSymbols = ["", "graded", "gradec", "gradeb", "gradea", "grades"]; // 0x1006b440, table 0x10242504.
const arrWeaponPAtk = [[0, 2, 3, 3, 4, 5], [0, 2, 4, 4, 5, 6], [0, 4, 6, 6, 8, 10]]; // 0x100741b0: one-handed 0x101af218, two-handed 0x101af248, bow 0x101af278.
const arrWeaponMAtk = [0, 2, 3, 3, 3, 4]; // 0x10074250: 0x10242790, 0x102427c0 and 0x102427f0 are identical.
const arrDefenceBonus = [0, 1, 1, 1, 1, 1]; // 0x100742f0: 0x101af2a8.

const SLOT_UNDERWEAR = 0x1, SLOT_EARS = 0x6, SLOT_NECK = 0x8, SLOT_FINGERS = 0x30, SLOT_HEAD = 0x40, SLOT_R_HAND = 0x80, SLOT_L_HAND = 0x100, SLOT_GLOVES = 0x200, SLOT_CHEST = 0x400, SLOT_LEGS = 0x800, SLOT_FEET = 0x1000, SLOT_BACK = 0x2000, SLOT_LR_HAND = 0x4000, SLOT_FULL_ARMOR = 0x8000, SLOT_HAIR = 0x10000;

export type InventoryEntry_T = { objectId: number, itemId: number, name: string, icon: string, count: number, enchant: number, itemClass: number, bodyPart: number, slot: number, isQuest: boolean, isMoney: boolean, info: ItemInfo_T };
type ItemLine_T = { label: string, value: string };
type ItemDrag_T = { item: InventoryEntry_T, isDragging: boolean };

function getWeaponEnchant(enchant: number) { return enchant > 3 ? enchant * 2 - 3 : enchant; } // 0x1006b690
function getArmorEnchant(enchant: number) { return enchant > 3 ? enchant * 3 - 6 : enchant; } // 0x1006b6a0

function getWeaponTable(weaponType: number, bodyPart: number) { // 0x100741b0 jump table
    switch (weaponType) {
        case 1: case 2: return bodyPart === SLOT_LR_HAND ? 1 : 0;
        case 3: case 4: case 7: return 0;
        case 5: case 8: return 1;
        case 6: return 2;
        default: return -1;
    }
}

export class NCInventoryWnd { // NCConsole 0x10060bc2, NCInventoryWnd::OnCreate 0x10099a60, OnPaint 0x10095870.
    public static getTextures(): string[] { return [TEX_BACK, TEX_TAB, TEX_TAB_SELECTED, `${TEX_TAB}_over`, TEX_OUTLINE, TEX_OUTLINE_DOWN, TEX_FRAME_LEFT, TEX_FRAME_MID, TEX_FRAME_RIGHT, TEX_CLOSE, TEX_CLOSE_DOWN, TEX_MINIMIZE, TEX_MINIMIZE_DOWN, TEX_ADENA, TEX_WEIGHT, TEX_TRASH, TEX_SELECTED, ...arrWeightBars, ...arrTooltipSlices, "L2UI.NWindow.Number", ...NDOM_SCROLL_TEXTURES]; }

    public readonly element: HTMLDivElement;
    public onUse: (objectId: number) => void = null;
    public onChoose: (objectId: number) => void = null;
    public onDropItem: (objectId: number, clientX: number, clientY: number) => boolean = null;
    protected readonly layer: NDomLayer;
    protected readonly equipment: HTMLDivElement;
    protected readonly bag: NDomScrollPane_T;
    protected readonly adena: HTMLCanvasElement;
    protected readonly count: HTMLCanvasElement;
    protected readonly weightBar: HTMLDivElement;
    protected readonly weightText: HTMLCanvasElement;
    protected limit = 0;
    protected readonly tabs: NDomButton_T[] = [];
    protected items: InventoryEntry_T[] = [];
    protected isQuest = false;
    protected chooseItemId = 0;
    protected readonly tooltip: HTMLDivElement;
    protected readonly selection = new Map<HTMLElement, number>();
    protected readonly frames = new Map<number, HTMLDivElement[]>();
    protected drag: ItemDrag_T = null;
    protected isDoubleClick = false;

    public constructor(layer: NDomLayer) {
        this.layer = layer;
        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        this.element.setAttribute("role", "dialog");
        this.element.setAttribute("aria-label", layer.getManager().getSysString(138));
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);

        const frame = layer.createWindow(0, 0, 256, 20, this.element);

        layer.tile(frame, 0, 0, 16, 20, 0, 0, 16, 20, TEX_FRAME_LEFT);
        layer.tile(frame, 16, 0, 224, 20, 0, 0, 32, 20, TEX_FRAME_MID);
        layer.tile(frame, 240, 0, 16, 20, 0, 0, 16, 20, TEX_FRAME_RIGHT);
        layer.text(frame, layer.getManager().getSysString(138), 0xffc8d2dc, FontType_T.SMALL, 20, 5);

        const close = layer.button(frame, 233, 3, 15, 15, TEX_CLOSE, TEX_CLOSE_DOWN, null, null, () => this.setVisible(false));
        const minimize = layer.button(frame, 216, 3, 15, 15, TEX_MINIMIZE, TEX_MINIMIZE_DOWN, null, null, () => { // style 0x3002 carries the 0x2000 minimize bit.
            for (const child of this.element.children)
                if (child !== frame) (child as HTMLElement).hidden = !(child as HTMLElement).hidden;
        });

        minimize.setAttribute("aria-label", "Minimize");

        close.tabIndex = 0;
        close.setAttribute("role", "button");
        close.setAttribute("aria-label", "Close");
        close.addEventListener("keydown", event => {
            if (event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            this.layer.getManager().playButtonSound(true);
            this.setVisible(false);
        });
        this.element.addEventListener("keydown", event => { if (event.key === "Escape") this.setVisible(false); });
        frame.addEventListener("mousedown", event => {
            if (event.button !== 0 || close.contains(event.target as Node) || minimize.contains(event.target as Node)) return;

            event.preventDefault();

            const startX = layer.toUI(event.clientX) - this.element.offsetLeft, startY = layer.toUI(event.clientY) - this.element.offsetTop;

            layer.beginDrag(e => layer.place(this.element, layer.toUI(e.clientX) - startX, layer.toUI(e.clientY) - startY));
        });
        this.equipment = layer.createWindow(8, 31, 240, 122, this.element);
        this.bag = layer.scrollPane(this.element, 9, 189, 236, 139, 35); // NCInvenItemWnd on NCScrollWnd, 6x4 grid of 37x35 cells.

        [2, 118].forEach((id, index) => {
            const select = () => {
                this.isQuest = index === 1;
                this.bag.setScroll(0);
                this.paintItems();
            };
            const label = layer.getManager().getSysString(id);
            const tab = layer.tab(this.element, 12 + index * 94, 159, 94, 23, TEX_TAB, TEX_TAB_SELECTED, label, null, select);

            this.tabs.push(tab);
        });
        layer.tile(this.element, 98, 355, 16, 12, 0, 0, 16, 12, TEX_ADENA);
        this.adena = layer.text(this.element, "0", 0xffdcdcdc, FontType_T.SMALL, 199, 356);
        this.count = layer.text(this.element, "", 0xffb09b79, FontType_T.SMALL, 0, 162);
        layer.tile(this.element, 98, 372, 16, 12, 0, 0, 16, 12, TEX_WEIGHT);

        const weight = layer.createWindow(117, 372, 85, 12, this.element); // NCInvenWeightWnd at (117, 372, 85, 12), OnPaint 0x10095630.

        this.weightBar = layer.tile(weight, 0, 0, 0, 12, 0, 0, 1, 12, arrWeightBars[0]);
        this.weightText = document.createElement("canvas");
        this.weightText.className = "ndom-text ndom-absolute";
        weight.appendChild(this.weightText);

        const trash = layer.tile(this.element, 208, 351, 34, 34, 0, 0, 34, 34, TEX_TRASH); // OnCreate 0x1009a015: trash drop target at (208, 351), tooltip sysstring 890.

        trash.title = layer.getManager().getSysString(890);
        this.setWeight(0, 0);

        this.tooltip = layer.createWindow(0, 0, 0, 0);
        this.tooltip.classList.add("ndom-opaque", "ndom-tooltip");
        this.tooltip.hidden = true;

        window.addEventListener("mousemove", event => {
            if (!this.drag) return;
            if (!(event.buttons & 1)) { this.endDrag(); return; }
            if (this.drag.isDragging) return;

            this.drag.isDragging = true; // 0x10095472
            this.tooltip.hidden = true;
            document.documentElement.style.cursor = `url(${layer.getWrapUrl(this.drag.item.icon)}) 16 16, default`; // 0x10039680
            document.documentElement.classList.add("ndom-item-drag");
        }, true);
        window.addEventListener("mouseup", event => {
            if (!this.drag || event.button !== 0) return;

            const drag = this.drag;

            this.endDrag();
            if (drag.isDragging) this.dropItem(drag.item, event);
        }, true);
    }

    public setWeight(current: number, maximum: number) {
        const width = maximum > 0 ? Math.trunc(current * 85 / maximum) : 0;
        const percent = width > 0 ? current / maximum * 100 : 0;
        const index = percent > 100 ? 4 : percent > 80 ? 3 : percent > 66.6 ? 2 : percent > 50 ? 1 : 0;
        const canvas = this.layer.getManager().canvas, scale = canvas.scale, text = `${percent.toFixed(2)}%`;

        this.weightBar.hidden = width <= 0;
        if (width > 0) {
            this.weightBar.style.width = `${width}px`;
            this.layer.setTile(this.weightBar, width, 12, 0, 0, width, 12, arrWeightBars[index]);
        }

        const textWidth = canvas.measureText(text); // 0x100957d5 measures with the text font, 0x10095811 draws digits.

        this.weightText.width = Math.round(85 * scale);
        this.weightText.height = Math.round(12 * scale);
        this.weightText.style.width = "85px";
        this.weightText.style.height = "12px";
        this.layer.place(this.weightText, 0, 0);

        const context = this.weightText.getContext("2d");

        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.imageSmoothingEnabled = false;
        canvas.renderDigits(context, Math.trunc(85 * 0.5 - textWidth / 2), 2, 0xffdcdcdc, text);
    }

    public setLimit(limit: number) {
        this.limit = limit;
        this.paintItems();
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 302, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;

        if (!isVisible) {
            this.chooseItemId = 0;
            this.tooltip.hidden = true;
        }
    }

    public chooseItem(itemId: number) {
        this.chooseItemId = itemId;
        this.setVisible(true);
        this.paintItems();
    }
    public clearChoice() {
        this.chooseItemId = 0;
        this.paintItems();
    }

    public async setItems(items: InventoryEntry_T[]) {
        this.items = items;
        const symbols = this.layer.getManager().strings.symbols;

        await this.layer.loadTextures([...new Set(items.flatMap(item => item.info.crystalType > 0 ? [item.icon, symbols[arrGradeSymbols[item.info.crystalType]]] : [item.icon]))]);

        if (this.items !== items) return;

        this.paintItems();
    }

    protected paintItems() {
        this.equipment.replaceChildren();
        this.bag.content.replaceChildren();
        this.frames.clear();
        this.tooltip.hidden = true;
        this.tabs.forEach((tab, index) => {
            const isSelected = (index === 1) === this.isQuest;

            tab.setTextures(isSelected ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED);
            tab.setAttribute("aria-pressed", String(isSelected));
        });

        let index = 0, money = 0;

        for (const item of this.items) {
            if (item.isMoney) { money += item.count; continue; }
            if (!this.layer.hasTexture(item.icon)) continue;

            if (item.slot >= 0) {
                // NCEquipItemWnd::OnPaint 0x1009414f..0x10094264.
                this.addItem(this.equipment, [7, 46, 85, 130, 169][item.slot % 5] - 1, 6 + Math.trunc(item.slot / 5) * 38, item);
            } else if (item.isQuest === this.isQuest) {
                // NCInvenItemWnd::OnPaint 0x1009528f..0x10095369.
                this.addItem(this.bag.content, index % 6 * 37, Math.trunc(index / 6) * 35, item);
                index++;
            }
        }

        this.bag.setContentHeight(Math.ceil(index / 6) * 35);

        const count = `(${this.items.filter(item => !item.isMoney).length}/${this.limit})`;

        this.layer.renderText(this.count, count, 0xffb09b79);
        this.layer.place(this.count, Math.trunc(256 - this.layer.measureText(count) - 5), 162); // OnPaint 0x10095a7b: "(%d/%d)" at width - textWidth - 5.

        const text = money.toLocaleString("en-US");

        this.layer.renderText(this.adena, text, 0xffdcdcdc);
        this.layer.place(this.adena, 199 - this.layer.measureText(text), 356);
    }

    protected addItem(parent: HTMLElement, x: number, y: number, item: InventoryEntry_T) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "ndom-inventory-item";
        button.dataset.objectId = String(item.objectId);
        button.setAttribute("aria-label", `${item.name}${item.count > 1 ? ` (${item.count.toLocaleString("en-US")})` : ""}`);
        this.layer.place(button, x, y, 34, 34);
        this.layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, item.icon);
        this.frames.set(item.objectId, [this.layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE_DOWN), this.layer.tile(button, 0, 0, 35, 35, 0, 0, 35, 35, TEX_OUTLINE)]);
        this.paintFrame(item.objectId, this.selection.get(parent) === item.objectId);

        const choose = () => {
            if (item.itemId !== this.chooseItemId) return;

            this.chooseItemId = 0;
            if (this.onChoose) this.onChoose(item.objectId);
        };
        const use = () => { // 0x10094ed0 / 0x10094be0 -> NConsoleWnd::RequestUseItem 0x10066320.
            this.select(parent, 0);
            if (this.onUse) this.onUse(item.objectId);
        };

        button.addEventListener("mousedown", event => {
            if (this.chooseItemId) {
                if (event.button === 0) this.layer.getManager().playButtonSound(item.itemId === this.chooseItemId);
                return;
            }
            if (event.button === 2) { use(); return; }
            if (event.button !== 0) return;

            this.select(parent, item.objectId); // 0x10094e40
            this.layer.getManager().playPickupSound();
            this.showTooltip(item, button);

            if (this.isDoubleClick) this.isDoubleClick = false;
            else this.drag = { item, isDragging: false };
        });
        button.addEventListener("click", event => { if (event.button === 0 && this.chooseItemId) choose(); });
        button.addEventListener("dblclick", event => {
            if (event.button !== 0 || this.chooseItemId) return;

            this.isDoubleClick = true;
            this.endDrag();
            use();
        });
        button.addEventListener("contextmenu", event => event.preventDefault());
        button.addEventListener("mouseenter", () => this.showTooltip(item, button));
        button.addEventListener("mouseleave", () => { this.tooltip.hidden = true; });
        button.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            if (this.chooseItemId) {
                this.layer.getManager().playButtonSound(item.itemId === this.chooseItemId);
                choose();
            } else use();
        });
        parent.appendChild(button);
    }

    protected paintFrame(objectId: number, isSelected: boolean) { // NCInvenItemWnd::OnPaint 0x10095369: item_click when selected, else OutLine_down 34x34 under OutLine 35x35.
        const [frame, outline] = this.frames.get(objectId);

        this.layer.setTile(frame, 34, 34, 0, 0, 34, 34, isSelected ? TEX_SELECTED : TEX_OUTLINE_DOWN);
        outline.hidden = isSelected;
    }

    protected select(parent: HTMLElement, objectId: number) {
        const previous = this.selection.get(parent);

        if (previous && this.frames.has(previous)) this.paintFrame(previous, false);

        this.selection.set(parent, objectId);

        if (objectId) this.paintFrame(objectId, true);
    }

    protected endDrag() {
        this.drag = null;
        document.documentElement.style.cursor = "";
        document.documentElement.classList.remove("ndom-item-drag");
    }

    protected dropItem(item: InventoryEntry_T, event: MouseEvent) { // NCInvenItemWnd::OnLButtonUp 0x100976c0.
        const target = event.target as Element;

        if (this.equipment.contains(target)) {
            if (item.slot < 0 && this.onUse) this.onUse(item.objectId);
            this.select(this.bag.content, 0);
            return;
        }

        if (target.closest(".ndom-window") || !this.onDropItem || !this.onDropItem(item.objectId, event.clientX, event.clientY)) return;

        this.select(this.equipment, 0);
        this.select(this.bag.content, 0);
        this.layer.getManager().playPickupSound();
    }

    protected getItemTitle(item: InventoryEntry_T): [string, number][] { // 0x100301f0 / 0x1002f750 first line.
        const runs: [string, number][] = [];

        if (item.enchant > 0 && item.itemClass < 4) runs.push([`+${item.enchant} `, 0xffb09b79]);

        runs.push([item.name, 0xffdcdcdc]);

        if (item.info.addName) runs.push([` ${item.info.addName}`, 0xffffd969]);
        if (item.info.crystalType > 0) runs.push([" ", 0xffdcdcdc], [`\`${arrGradeSymbols[item.info.crystalType]}`, 0]);
        if (item.info.consumeType >= 1 && item.info.consumeType <= 3) runs.push([` (${item.count.toLocaleString("en-US")})`, 0xffdcdcdc]); // 0x1002ea70

        return runs;
    }

    protected getSlotName(item: InventoryEntry_T) { // 0x1006acd0
        const manager = this.layer.getManager(), bodyPart = item.bodyPart;

        switch (item.itemClass) {
            case 0: return bodyPart === SLOT_R_HAND || bodyPart === SLOT_L_HAND ? manager.getSysString(242) : bodyPart === SLOT_LR_HAND ? manager.getSysString(243) : "";
            case 1: {
                switch (bodyPart) {
                    case SLOT_UNDERWEAR: return manager.getSysString(229);
                    case SLOT_HEAD: return manager.getSysString(230);
                    case SLOT_R_HAND: case SLOT_L_HAND: return manager.getSysString(231);
                    case SLOT_GLOVES: return manager.getSysString(232);
                    case SLOT_FEET: return manager.getSysString(233);
                    case SLOT_BACK: return manager.getSysString(234);
                    case SLOT_HAIR: return manager.getSysString(1024);
                    case SLOT_CHEST: case SLOT_LEGS: case SLOT_FULL_ARMOR: {
                        const armorType = [0, 245, 246, 244][item.info.armorType];

                        return `${manager.getSysString(bodyPart === SLOT_CHEST ? 235 : bodyPart === SLOT_LEGS ? 236 : 542)} / ${armorType ? manager.getSysString(armorType) : ""}`;
                    }
                    default: return "";
                }
            }
            case 2: return bodyPart & SLOT_EARS ? manager.getSysString(237) : bodyPart & SLOT_NECK ? manager.getSysString(238) : bodyPart & SLOT_FINGERS ? manager.getSysString(239) : "";
            case 3: return manager.getSysString(240);
            case 4: return manager.getSysString(241);
            default: return "";
        }
    }

    protected getItemLines(item: InventoryEntry_T): ItemLine_T[] { // 0x10030770 mode 2: 0x10030d1b..0x100317d7.
        const manager = this.layer.getManager(), info = item.info, lines: ItemLine_T[] = [];
        const line = (id: number, value: number | string) => lines.push({ label: manager.getSysString(id), value: String(value) });
        const defence = (base: number) => Math.trunc(arrDefenceBonus[info.crystalType] * getArmorEnchant(item.enchant) + base);

        switch (item.itemClass) {
            case 0: {
                const weaponTypes = [0, 43, 44, 45, 46, 47, 48, 49, 504], table = getWeaponTable(info.weaponType, item.bodyPart), enchant = getWeaponEnchant(item.enchant);
                const speed = info.speed < 260 ? 310 : info.speed < 309 ? 309 : info.speed < 352 ? 308 : info.speed < 406 ? 307 : 306; // 0x1006afc0

                if (weaponTypes[info.weaponType]) lines.push({ label: null, value: `${manager.getSysString(weaponTypes[info.weaponType])} / ${this.getSlotName(item)}` }); // 0x1006abe0

                line(94, Math.trunc((table < 0 ? 0 : arrWeaponPAtk[table][info.crystalType]) * enchant + info.pAtk));
                line(98, Math.trunc((table < 0 ? 0 : arrWeaponMAtk[info.crystalType]) * enchant + info.mAtk));
                line(111, manager.getSysString(speed));

                if (info.soulshots > 0) line(404, `X ${info.soulshots}`);
                if (info.spiritshots > 0) line(496, `X ${info.spiritshots}`);

                line(52, info.weight);

                if (info.mpConsume) line(320, info.mpConsume);
                break;
            }
            case 1:
                if (item.bodyPart & (SLOT_R_HAND | SLOT_L_HAND)) {
                    line(95, defence(info.shieldPDef));
                    line(317, info.shieldRate);
                    line(97, info.avoidModify);
                } else {
                    lines.push({ label: null, value: this.getSlotName(item) });

                    if (info.armorType === 3) line(388, info.mpBonus); // 0x1007d730: armorgrp armor_type 3.

                    line(95, defence(info.pDef));
                }

                line(52, info.weight);
                break;
            case 2:
                lines.push({ label: null, value: this.getSlotName(item) });
                line(99, defence(info.mDef));
                line(52, info.weight);
                break;
            case 3: lines.push({ label: null, value: this.getSlotName(item) }); break;
            case 5: line(52, info.weight); break; // TODO: etcitem pet collar / lottery / seven signs lines.
        }

        return lines;
    }

    protected measureRuns(runs: [string, number][]) { return runs.reduce((width, [text, color]) => width + (color ? this.layer.measureText(text) : 12), 0); }

    protected drawRuns(runs: [string, number][], x: number, y: number) {
        for (const [text, color] of runs) {
            if (color) this.layer.text(this.tooltip, text, color, FontType_T.SMALL, x, y);
            else if (this.layer.hasTexture(this.layer.getManager().strings.symbols[text.slice(1)])) this.layer.tile(this.tooltip, x, y, 12, 12, 0, 0, 12, 12, this.layer.getManager().strings.symbols[text.slice(1)]); // UCanvas::DrawNormalText -> FL2GameData::GetSymbolTexture, 12x12.

            x += color ? this.layer.measureText(text) : 12;
        }
    }

    protected wrapText(text: string, width: number) {
        const lines: string[] = [];

        for (const paragraph of text.split("\n")) {
            let current = "";

            for (const word of paragraph.split(" ")) {
                const next = current ? `${current} ${word}` : word;

                if (current && this.layer.measureText(next) > width) {
                    lines.push(current);
                    current = word;
                } else current = next;
            }

            lines.push(current);
        }

        return lines;
    }

    protected showTooltip(item: InventoryEntry_T, button: HTMLElement) { // NCItemWnd 0x10020370: simple box 0x10032860, detailed box 0x10032560 once the item is selected.
        if (this.drag && this.drag.isDragging) return;

        const layer = this.layer, lineHeight = layer.getManager().canvas.getLineHeight();
        const title = this.getItemTitle(item), titleWidth = this.measureRuns(title);
        const isDetailed = this.selection.get(button.parentElement) === item.objectId;
        const lines = isDetailed ? this.getItemLines(item) : [];
        const first = lines.length ? (lines[0].label ? `${lines[0].label} : ${lines[0].value}` : lines[0].value) : "";
        const width = isDetailed ? Math.max(144, titleWidth, layer.measureText(first)) : titleWidth; // 0x1002ea90: detailed boxes are at least 144 wide.
        const description = isDetailed && item.info.description ? this.wrapText(item.info.description, width) : [];
        let height = isDetailed ? lines.length * (lineHeight + 6) + lineHeight : lineHeight;

        if (description.length) height += description.length * (lineHeight + 6);

        this.tooltip.replaceChildren();

        const w = width + 10, h = height + 10, [tex1, tex2, tex3, tex4, tex5, tex6, tex7, tex8, tex9] = arrTooltipSlices;

        layer.tile(this.tooltip, 0, 0, 8, 8, 0, 0, 8, 8, tex1);
        layer.tile(this.tooltip, 8, 0, w - 16, 8, 0, 0, 8, 8, tex2);
        layer.tile(this.tooltip, w - 8, 0, 8, 8, 0, 0, 8, 8, tex3);
        layer.tile(this.tooltip, 0, 8, 8, h - 16, 0, 0, 8, 8, tex4);
        layer.tile(this.tooltip, 8, 8, w - 16, h - 16, 0, 0, 8, 8, tex5);
        layer.tile(this.tooltip, w - 8, 8, 8, h - 16, 0, 0, 8, 8, tex6);
        layer.tile(this.tooltip, 0, h - 8, 8, 8, 0, 0, 8, 8, tex7);
        layer.tile(this.tooltip, 8, h - 8, w - 16, 8, 0, 0, 8, 8, tex8);
        layer.tile(this.tooltip, w - 8, h - 8, 8, 8, 0, 0, 8, 8, tex9);
        this.drawRuns(title, 5, 5);

        lines.forEach((line, index) => { // 0x1002f750: label #A3A3A3, " : " #DCDCDC, value #B09B79, one line per lineHeight + 6.
            const y = 5 + (index + 1) * (lineHeight + 6);
            let x = 5;

            if (line.label) {
                layer.text(this.tooltip, line.label, 0xffa3a3a3, FontType_T.SMALL, x, y);
                x += layer.measureText(line.label);
                layer.text(this.tooltip, " : ", 0xffdcdcdc, FontType_T.SMALL, x, y);
                x += layer.measureText(" : ");
            }

            layer.text(this.tooltip, line.value, 0xffb09b79, FontType_T.SMALL, x, y);
        });
        description.forEach((text, index) => layer.text(this.tooltip, text, 0xffb2becf, FontType_T.SMALL, 5, 5 + lines.length * (lineHeight + 6) + lineHeight + 6 + index * (lineHeight + 6)));

        const rect = button.getBoundingClientRect(), screenWidth = layer.getManager().canvas.width;
        let x = layer.toUI(rect.left), y = layer.toUI(rect.top) - h;

        if (x + w > screenWidth) x = screenWidth - w;
        if (x < 0) x = 0;
        if (y < 0) y += isDetailed ? h + 32 : h;

        layer.place(this.tooltip, x, y, w, h);
        this.tooltip.style.zIndex = "2147483647";
        this.tooltip.hidden = false;
    }
}

export default NCInventoryWnd;
