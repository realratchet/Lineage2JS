import type NDomLayer from "./ndom";
import type { NDomButton_T } from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import CBBSHtmlViewer from "./cbbs-html-viewer";
import { FontType_T } from "./nwindow-canvas";

const TEX_PATH = "L2UI_CH3.BoardWnd.";
const TEX_TAB = TEX_PATH + "Board_tab2";
const TEX_SELECTED = TEX_PATH + "Board_tab1";
const TEX_BUTTON = "L2UI_CH3.Button.SmallButton2";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.SmallButton2_down";
const TEX_CAPTION = "NWindow.Icon.chatback";
const arrTabs = [[377, 0], [379, 75], [381, 157], [382, 232], [403, 314], [905, 389], [904, 464]];
const arrActions = ["bypass _bbshome", "bypass _bbsgetfav", "bypass _bbsloc", "bypass _bbsclan", "bypass _bbsmemo", "bypass _maillist_0_1_0_", "bypass _friendlist_0_"];

export class NCCommunityWnd {
    public static getTextures(): string[] { return [TEX_PATH + "board_back1", TEX_PATH + "board_back2", TEX_PATH + "board_icon", TEX_TAB, TEX_SELECTED, "?" + TEX_TAB + "_over", TEX_BUTTON, TEX_BUTTON_DOWN, TEX_CAPTION, ...NCFrameCtrl.getTextures(), ...CBBSHtmlViewer.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly viewer: CBBSHtmlViewer;
    public onRequest: () => void = null;
    public onAction: (target: string) => number = null;
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly folded: HTMLDivElement;
    protected readonly caption: HTMLDivElement;
    protected actions = Array(8).fill("") as string[];
    protected requestPending = false;
    protected selectedTab = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 646, 530);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        this.element.dataset.window = "community";
        const title = NCFrameCtrl.createDOM(layer, this.element, 646, manager.getSysString(387), false, () => this.hide());
        const minimize = layer.button(title.parentElement, 606, 3, 15, 15, "L2UI_CH3.FrameCtrl.FrameMiniBtn", "L2UI_CH3.FrameCtrl.FrameMiniOnBtn", null, null, () => this.minimize());

        minimize.setAttribute("aria-label", "Minimize");
        minimize.addEventListener("mousedown", event => event.stopPropagation());
        layer.tile(this.element, 0, 20, 646, 28, 0, 0, 646, 28, TEX_PATH + "board_back1");
        layer.tile(this.element, 0, 48, 646, 482, 0, 0, 646, 482, TEX_PATH + "board_back2");
        this.viewer = new CBBSHtmlViewer(layer, this.element, 8, 51, 633, 474);
        this.viewer.onHide = () => this.hide();
        layer.button(this.element, 574, 25, 66, 21, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(380), () => {
            if (this.actions[7].length && !this.requestPending) this.submit(this.actions[7]);
        });
        arrTabs.forEach(([label, x], index) => {
            const tab = layer.button(this.element, 12 + x, 25, 74, 23, TEX_TAB, TEX_TAB, TEX_TAB + "_over", manager.getSysString(label), null, isDown => {
                if (!isDown) return;

                this.selectTab(index);
                this.submit(arrActions[index]);
                manager.playWindowSound();
            });

            tab.addEventListener("mousedown", event => { if (event.detail === 2) event.stopImmediatePropagation(); }, true);
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-label", manager.getSysString(label));
            this.tabs.push(tab);
        });
        this.selectTab(0);
        this.folded = layer.createWindow(0, 0, 32, 32);
        this.folded.classList.add("ndom-opaque");
        this.folded.hidden = true;
        this.folded.tabIndex = -1;
        this.folded.setAttribute("aria-label", manager.getSysString(390));
        layer.tile(this.folded, 0, 0, 32, 32, 0, 0, 32, 32, TEX_PATH + "board_icon");
        const captionText = manager.getSysString(390), width = layer.measureText(captionText), height = manager.canvas.getLineHeight(), texture = manager.canvas.getTexture(TEX_CAPTION);

        this.caption = layer.createWindow(0, 32, width, height, this.folded);
        this.caption.hidden = true;
        this.caption.style.pointerEvents = "none";
        layer.tile(this.caption, 0, 0, width, height, 0, 0, texture.width, texture.height, TEX_CAPTION);
        layer.text(this.caption, captionText, 0xffdcdcdc, FontType_T.SMALL, 0, 0);
        this.folded.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2) return;

            event.preventDefault();
            this.folded.focus();
            const startX = layer.toUI(event.clientX) - this.folded.offsetLeft, startY = layer.toUI(event.clientY) - this.folded.offsetTop;
            let isDragging = false;

            layer.beginDrag(move => {
                isDragging = true;
                layer.place(this.folded, layer.toUI(move.clientX) - startX, layer.toUI(move.clientY) - startY);
                this.placeCaption();
            }, up => {
                if (isDragging) { this.element.focus(); this.folded.blur(); return; }
                if (up.type !== "mouseup" && up.type !== "pointerup" || (up as MouseEvent).button !== 0) return;

                manager.playWindowSound();
                layer.place(this.element, this.folded.offsetLeft, this.folded.offsetTop);
                this.show();
            });
        });
        window.addEventListener("mousemove", event => {
            if (this.folded.hidden || event.buttons & 1) return;

            const x = layer.toUI(event.clientX) - this.folded.offsetLeft, y = layer.toUI(event.clientY) - this.folded.offsetTop;

            this.caption.hidden = x < 0 || x > 32 || y < 0 || y > 32;
            this.placeCaption();
        });
        this.placeOnScreen(manager.canvas.width, manager.canvas.height);
    }

    public placeOnScreen(width: number, height: number) {
        const x = Math.trunc(width * 0.5 - 323), y = Math.trunc(height * 0.5 - 265);

        this.layer.place(this.element, x, y);
        this.layer.place(this.folded, x, y);
        this.placeCaption();
    }

    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) { if (visible) this.show(); else this.hide(); }
    public show() {
        if (!this.folded.hidden) this.layer.place(this.element, this.folded.offsetLeft, this.folded.offsetTop);
        this.element.hidden = false;
        this.layer.place(this.folded, this.element.offsetLeft, this.element.offsetTop);
        this.folded.hidden = true;
        this.caption.hidden = true;
        this.layer.activate(this.element);
        this.element.focus();
    }
    public hide() {
        if (!this.folded.hidden) this.layer.place(this.element, this.folded.offsetLeft, this.folded.offsetTop);
        this.element.hidden = true;
        this.folded.hidden = true;
        this.caption.hidden = true;
    }

    public toggle() {
        const manager = this.layer.getManager();

        if (this.isVisible()) {
            manager.playWindowCloseSound();
            this.hide();
        } else if (!this.viewer.boardPending) {
            if (this.onRequest) this.onRequest();
            this.selectTab(0);
            this.hide();
            manager.playWindowSound();
            this.viewer.boardPending = true;
        }
    }

    public openClan() {
        this.submit(arrActions[3]);
        this.show();
        this.selectTab(3);
    }

    public async setBoard(actions: string[], content: string) {
        if (actions.length !== 8) throw new Error(`Invalid community action count: ${actions.length}`);

        const pending = this.viewer.setBoardHtml(content);

        this.actions = actions.slice();
        this.requestPending = false;
        this.show();
        await pending;
    }

    public selectTab(index: number) {
        if (index < 0 || index >= this.tabs.length) throw new Error(`Invalid community tab: ${index}`);

        this.selectedTab = index;
        this.tabs.forEach((tab, tabIndex) => {
            const texture = index === tabIndex ? TEX_SELECTED : TEX_TAB;

            tab.setTextures(texture, texture, index === tabIndex ? texture : TEX_TAB + "_over");
            tab.setAttribute("aria-selected", String(index === tabIndex));
        });
        this.viewer.element.hidden = false;
    }

    protected submit(target: string) {
        if (this.onAction && this.onAction(target) === 1) this.requestPending = true;
    }

    protected minimize() {
        const x = this.element.offsetLeft, y = this.element.offsetTop;

        this.hide();
        this.layer.place(this.folded, Math.max(0, x), y);
        this.folded.hidden = false;
        this.folded.focus();
        this.placeCaption();
    }

    protected placeCaption() {
        const width = parseFloat(this.caption.style.width), screenWidth = this.layer.getManager().canvas.width;

        this.layer.place(this.caption, Math.min(0, screenWidth - width - this.folded.offsetLeft), 32);
    }
}

export default NCCommunityWnd;
