import NCFrameCtrl from "./nc-frame-ctrl";
import { getRecipeMpWidth } from "./nc-recipe-manufacture-wnd";
import NDomLayer, { NDOM_SCROLL_TEXTURES } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import type { RecipeInfo_T } from "../assets/decode-worker/decode-protocol";
import type { RecipeShopSellList_T, RecipeShopItem_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.RecipeWnd.Recipe3_Back";
const TEX_MP = "L2UI_CH3.PlayerStatusWnd.ps_mpbar";
const TEX_SELECTED = "L2UI_CH3.etc.IconSelect2";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_Normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_NormalOn";
const TEX_DEFAULT_ICON = "NWindow.BlackTexture";

type RecipeBuyRow_T = RecipeShopItem_T & { recipe: RecipeInfo_T };

export class NCRecipeBuyListWnd {
    public static getTextures() { return [TEX_BACK, TEX_MP, TEX_SELECTED, TEX_BUTTON, TEX_BUTTON_DOWN, TEX_DEFAULT_ICON, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public readonly list: HTMLDivElement;
    public onOpen: (objectId: number, recipeId: number) => void = null;
    protected readonly content: HTMLDivElement;
    protected readonly thumb: HTMLDivElement;
    protected readonly thumbCenter: HTMLDivElement;
    protected readonly thumbBottom: HTMLDivElement;
    protected readonly mp: HTMLDivElement;
    protected readonly adena: HTMLCanvasElement;
    protected items: RecipeBuyRow_T[] = [];
    protected ownerId = 0;
    protected scroll = 0;
    protected selected = -1;
    protected thumbLength = 0;
    protected generation = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(663), false, () => this.setVisible(false));
        this.element.setAttribute("aria-label", manager.getSysString(663));
        layer.text(this.element, manager.getSysString(643), 0xffdcdcdc, FontType_T.SMALL, 11, 32);
        layer.text(this.element, manager.getSysString(644), 0xffdcdcdc, FontType_T.SMALL, 18, 323);
        this.mp = layer.tile(this.element, 75, 323, 165, 12, 0, 0, 8, 12, TEX_MP);
        this.adena = layer.text(this.element, "", 0xffdcdcdc, FontType_T.SMALL, 157, 341);
        this.list = layer.createWindow(9, 49, 238, 254, this.element);
        this.list.style.overflow = "hidden";
        this.content = layer.createWindow(0, 0, 223, 254, this.list);
        this.content.style.overflow = "hidden";
        this.thumb = layer.createWindow(223, 15, 15, 0, this.list);
        layer.tile(this.thumb, 0, 0, 15, 8, 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarTop");
        this.thumbCenter = layer.tile(this.thumb, 0, 8, 15, 8, 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarCenter");
        this.thumbBottom = layer.tile(this.thumb, 0, 8, 15, 8, 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarBottom");
        [-1, 1].forEach(direction => {
            const texture = direction < 0 ? "ScrollBarUp" : "ScrollBarDown";
            const button = layer.button(this.list, 223, direction < 0 ? 0 : 239, 15, 15, `L2UI_CH3.ScrollBar.${texture}Btn`, `L2UI_CH3.ScrollBar.${texture}OnBtn`);

            button.addEventListener("mousedown", event => {
                if (event.button === 0) this.setScroll(this.scroll + direction);
            });
        });
        this.thumb.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            const startY = layer.toUI(event.clientY), startPosition = this.thumb.offsetTop - 15;

            layer.beginDrag(moveEvent => {
                const travel = 224 - this.thumbLength;

                if (travel <= 0) return;
                const position = Math.max(0, Math.min(travel, Math.trunc(startPosition + layer.toUI(moveEvent.clientY) - startY)));

                if (position === this.thumb.offsetTop - 15) return;
                this.setScroll(Math.trunc(position * Math.max(0, this.items.length - 5) / travel));
                layer.place(this.thumb, 223, 15 + position);
            });
        });
        this.list.addEventListener("wheel", event => {
            event.preventDefault();
            const delta = typeof (event as any).wheelDelta === "number" ? Math.trunc((event as any).wheelDelta / 120) : -Math.sign(event.deltaY);

            this.setScroll(this.scroll - delta);
        });
        this.list.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2 || this.thumb.contains(event.target as Node) || (event.target as HTMLElement).closest(".ndom-button")) return;

            event.preventDefault();
            const rect = this.list.getBoundingClientRect(), x = layer.toUI(event.clientX - rect.left), y = layer.toUI(event.clientY - rect.top);

            if (x < 0 || x > 238 || y < 0 || y > 254) this.selected = -1;
            else if (x < 238 && y >= 4) {
                const index = Math.trunc((y - 4) / 47);

                if (index < 5 && this.scroll + index < this.items.length) this.selected = this.scroll + index;
            }
            this.paintRows();
            const row = this.items[this.selected];

            if (row && this.onOpen) this.onOpen(this.ownerId, row.recipeId);
        });
        layer.button(this.element, 91, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(646), () => {
            this.setVisible(false);
            manager.playWindowCloseSound();
        });
        this.updateScroll();
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 302, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public getOwnerId() { return this.ownerId; }
    public getItems() { return this.items; }
    public getScroll() { return this.scroll; }
    public getSelectedIndex() { return this.selected; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (!visible) this.generation++;
    }
    public setScroll(position: number) {
        this.scroll = Math.max(0, Math.min(Math.trunc(position), this.items.length - 5));
        this.updateScroll();
        this.paintRows();
    }
    public async show(list: RecipeShopSellList_T) {
        const strings = this.layer.getManager().strings, generation = ++this.generation;

        this.ownerId = list.objectId;
        this.items = [];
        list.items.forEach(item => {
            const recipe = strings.recipes.find(recipe => recipe.id === item.recipeId);

            if (recipe && this.items.length < 100) this.items.push({ ...item, recipe });
        });
        this.scroll = 0;
        this.selected = -1;
        const mpWidth = getRecipeMpWidth(list.curMp, list.maxMp), adena = list.adena.toLocaleString("en-US");

        this.mp.hidden = !(mpWidth > 0);
        if (mpWidth > 0) {
            this.layer.place(this.mp, 75, 323, mpWidth, 12);
            this.layer.setTile(this.mp, mpWidth, 12, 0, 0, 8, 12, TEX_MP);
        }
        this.layer.renderText(this.adena, adena, 0xffdcdcdc);
        this.layer.place(this.adena, 157 - this.layer.measureText(adena), 341);
        this.content.replaceChildren();
        this.updateScroll();
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
        await this.layer.loadTextures([...new Set(this.items.map(row => strings.itemIcons[row.recipe.productId]).filter(path => !!path))]);
        if (generation !== this.generation) return;

        this.paintRows();
    }
    protected updateScroll() {
        this.thumb.hidden = this.items.length <= 5;
        if (this.thumb.hidden) return;

        this.thumbLength = Math.max(15, Math.trunc(5 * 224 / this.items.length));
        this.layer.place(this.thumb, 223, 15 + Math.trunc((224 - this.thumbLength) * this.scroll / (this.items.length - 5)), 15, this.thumbLength);
        this.layer.place(this.thumbCenter, 0, 8, 15, Math.max(0, this.thumbLength - 16));
        this.layer.setTile(this.thumbCenter, 15, Math.max(0, this.thumbLength - 16), 0, 0, 15, 8, "L2UI_CH3.ScrollBar.SliderBarCenter");
        this.layer.place(this.thumbBottom, 0, this.thumbLength - 8);
    }
    protected paintRows() {
        const layer = this.layer, manager = layer.getManager(), strings = manager.strings;

        this.content.replaceChildren();
        this.items.slice(this.scroll, this.scroll + 5).forEach((row, index) => {
            const y = index * 50, requestedIcon = strings.itemIcons[row.recipe.productId], icon = requestedIcon && layer.hasTexture(requestedIcon) ? requestedIcon : TEX_DEFAULT_ICON;
            const element = layer.createWindow(0, y, 223, 50, this.content);

            element.dataset.recipeId = String(row.recipeId);
            if (this.selected === this.scroll + index) layer.tile(element, 0, 4, 216, 46, 0, 0, 32, 40, TEX_SELECTED);
            layer.tile(element, 7, 11, 32, 32, 0, 0, 32, 32, icon);
            layer.text(element, strings.itemNames[row.recipe.productId] ?? "", 0xffdcdcdc, FontType_T.SMALL, 49, 7);
            const costLabel = manager.getSysString(641), separator = " : ", price = row.cost.toLocaleString("en-US"), digits = price.replace(/,/g, "").length;
            const color = digits < 5 ? 0xffdcdcdc : [0xffff80ff, 0xffffff00, 0xff00ff00, 0xff00ffff][(digits - 2) % 4];
            const separatorX = 49 + layer.measureText(costLabel), priceX = separatorX + layer.measureText(separator);

            layer.text(element, costLabel, 0xffffff00, FontType_T.SMALL, 49, 21);
            layer.text(element, separator, 0xffdcdcdc, FontType_T.SMALL, separatorX, 21);
            layer.text(element, price, color, FontType_T.SMALL, priceX, 21);
            layer.text(element, manager.getSysString(503), 0xffffff00, FontType_T.SMALL, priceX + layer.measureText(price) + 5, 21);
            const rateLabel = manager.getSysString(642), rateSeparatorX = 49 + layer.measureText(rateLabel);

            layer.text(element, rateLabel, 0xffa3a3a3, FontType_T.SMALL, 49, 35);
            layer.text(element, separator, 0xffdcdcdc, FontType_T.SMALL, rateSeparatorX, 35);
            layer.text(element, `${row.recipe.successRate}%`, 0xffb09b79, FontType_T.SMALL, rateSeparatorX + layer.measureText(separator), 35);
        });
    }
}

export default NCRecipeBuyListWnd;
