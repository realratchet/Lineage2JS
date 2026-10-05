import NDomLayer from "./ndom";
import NCHtmlViewer from "./nc-html-viewer";
import { FontType_T } from "./nwindow-canvas";

const TEXT_COLOR = 0xffdcdcdc;
const HEADER_COLOR = 0xffe6dcbe;
const TEX_SELECT_BACK = "L2UI_CH3.Serverselectwnd.Serverselect_back";
const TEX_INFO_BACK = "L2UI_CH3.Serverselectwnd.Serverinfo_back";
const TEX_BUTTON = "L2UI_CH3.Button.Btn1_normal";
const TEX_BUTTON_DOWN = "L2UI_CH3.Button.Btn1_normalOn";
const TEX_TEXTBACKLINE = "L2UI_CH3.Etc.textbackline";
const TEX_TEXTSELECT = "L2UI_CH3.ListCtrl.TextSelect";
const TEX_TEXTSELECT2 = "L2UI_CH3.ListCtrl.TextSelect2";
const TEX_TABS = ["L2UI_CH3.ListCtrl.tab1", "L2UI_CH3.ListCtrl.tab2", "L2UI_CH3.ListCtrl.tab3"];
const TEX_UP = "L2UI_CH3.ScrollBar.ScrollBarUpBtn";
const TEX_UP_ON = "L2UI_CH3.ScrollBar.ScrollBarUpOnBtn";
const TEX_DOWN = "L2UI_CH3.ScrollBar.ScrollBarDownBtn";
const TEX_DOWN_ON = "L2UI_CH3.ScrollBar.ScrollBarDownOnBtn";
const CONNECT_RESET_INTERVAL = 3000;

const VISIBLE_ROWS = 15;
const ROW_HEIGHT = 17;
const HEADER_HEIGHT = 19;

export type ServerRow_T = { id: number, name: string, isUp: boolean, currentPlayers: number, maxPlayers: number, pvp: boolean, isTestServer: boolean, ping: number };

type Column_T = { header: number, x: number, width: number };
type Cell_T = { text: string, color: number };
type Traffic_T = { id: number, color: number };

const COLUMNS: Column_T[] = [ // NCServerSelectWnd::OnCreate 0x1010195d-0x10101e7a, GLanguageType != 2 widths.
    { header: 416, x: 0, width: 32 },
    { header: 451, x: 32, width: 111 },
    { header: 452, x: 143, width: 59 },
    { header: 601, x: 202, width: 49 },
    { header: 602, x: 251, width: 49 }
];


function getNumberText(row: ServerRow_T) { // AddServer 0x100ffe30.
    if (row.isTestServer) return "1";

    return row.id <= 9 ? `0${row.id}` : `${row.id}`;
}

function getTraffic(row: ServerRow_T): Traffic_T { // AddServer 0x10100753-0x10100893.
    if (!row.isUp) return { id: 456, color: 0xffff0000 };
    if (row.maxPlayers <= 0) return { id: 457, color: 0xffbfae64 };

    const ratio = row.currentPlayers / row.maxPlayers * 100;

    if (ratio >= 80 || row.currentPlayers >= 3700) return { id: 458, color: 0xffff8080 };
    if (ratio <= 50) return { id: 466, color: 0xff64a3d9 };

    return { id: 457, color: 0xffbfae64 };
}

function getPingBucket(ping: number) { // Quality sort 0x10100df0: ping < 10, 10..50 and 51..9998 are each re-sorted by player count.
    if (ping < 10) return 0;
    if (ping > 50 && ping < 9999) return 2;

    return ping < 9999 ? 1 : 3;
}

export class NCServerSelectListCtrl { // NCServerSelectListCtrl: NCListCtrl 300x274, header 19, 15 rows of 17; paint 0x10022ad0.
    public static getTextures(): string[] { return [TEX_TEXTBACKLINE, TEX_TEXTSELECT, TEX_TEXTSELECT2, ...TEX_TABS, TEX_UP, TEX_UP_ON, TEX_DOWN, TEX_DOWN_ON]; }

    public readonly element: HTMLDivElement;
    public onActivate: () => void = null;
    public onSelect: (index: number) => void = null;

    protected readonly layer: NDomLayer;
    protected readonly body: HTMLDivElement;
    protected items: Cell_T[][] = [];
    protected selected = -1;
    protected scroll = 0;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        const manager = layer.getManager();

        this.layer = layer;
        this.element = layer.createWindow(8, 10, 300, 274, parent);
        this.element.style.overflow = "hidden";

        for (let i = 1; i <= VISIBLE_ROWS; i += 2)
            layer.tile(this.element, 0, ROW_HEIGHT * i + HEADER_HEIGHT - 1, 300, ROW_HEIGHT, 0, 0, 8, 15, TEX_TEXTBACKLINE);

        this.body = layer.createWindow(0, 0, 300, 274, this.element);

        for (const column of COLUMNS) { // NCHeaderCtrl paint 0x10022820: tab1/tab2/tab3 three-slice (source 8x19), label centred +1.
            const header = layer.createWindow(column.x, 0, column.width, HEADER_HEIGHT, this.element);
            const label = manager.getSysString(column.header);

            layer.tile(header, 0, 0, 8, HEADER_HEIGHT, 0, 0, 8, 19, TEX_TABS[0]);
            layer.tile(header, 8, 0, column.width - 16, HEADER_HEIGHT, 0, 0, 8, 19, TEX_TABS[1]);
            layer.tile(header, column.width - 8, 0, 8, HEADER_HEIGHT, 0, 0, 8, 19, TEX_TABS[2]);
            layer.text(header, label, HEADER_COLOR, FontType_T.SMALL, Math.trunc(column.width * 0.5 - Math.trunc(layer.measureText(label) / 2)), Math.trunc(HEADER_HEIGHT * 0.5 - Math.trunc(manager.canvas.getLineHeight() / 2)) + 1);
        }

        layer.button(this.element, 285, HEADER_HEIGHT, 15, 15, TEX_UP, TEX_UP_ON, TEX_UP, null, () => this.scrollBy(-1)); // Scroll buttons down the right edge below the header, L2.4_20 capture.
        layer.button(this.element, 285, 274 - 15, 15, 15, TEX_DOWN, TEX_DOWN_ON, TEX_DOWN, null, () => this.scrollBy(1));

        this.element.addEventListener("mousedown", event => {
            if ((event.target as HTMLElement).closest(".ndom-button")) return;

            const index = this.getRowAt(event.clientY);

            if (event.button !== 0 || index < 0) return;

            this.layer.getManager().playButtonSound(true);
            this.select(index);

            if (this.onSelect) this.onSelect(index);
            if (this.onActivate) this.onActivate();
        });
    }

    protected getRowAt(clientY: number) {
        const index = Math.floor((this.layer.toUI(clientY - this.element.getBoundingClientRect().top) - HEADER_HEIGHT) / ROW_HEIGHT);

        return index < 0 || index >= VISIBLE_ROWS || index + this.scroll >= this.items.length ? -1 : index + this.scroll;
    }

    protected scrollBy(delta: number) {
        this.scroll = Math.max(0, Math.min(this.items.length - VISIBLE_ROWS, this.scroll + delta));
        this.update();
    }

    public getSelected() { return this.selected; }

    public setItems(items: Cell_T[][]) {
        this.items = items;
        this.selected = -1;
        this.scroll = 0;
        this.update();
    }

    public select(index: number) {
        if (index < 0 || index >= this.items.length) return;

        this.selected = index;
        this.update();
    }

    protected update() {
        const layer = this.layer;

        this.body.replaceChildren();

        if (this.selected >= this.scroll && this.selected < this.scroll + VISIBLE_ROWS) {
            const y = (this.selected - this.scroll) * ROW_HEIGHT + HEADER_HEIGHT - 1;

            layer.tile(this.body, 1, y, 300 - 49, ROW_HEIGHT, 0, 0, 16, 13, TEX_TEXTSELECT);
            layer.tile(this.body, 300 - 48, y, 32, ROW_HEIGHT, 0, 0, 32, 13, TEX_TEXTSELECT2);
        }

        this.items.slice(this.scroll, this.scroll + VISIBLE_ROWS).forEach((cells, row) => {
            const y = row * ROW_HEIGHT + 3 + HEADER_HEIGHT;

            cells.forEach((cell, index) => {
                if (!cell.text) return;

                const column = COLUMNS[index];
                const clip = layer.createWindow(column.x, y - 1, column.width, 15, this.body);

                clip.style.overflow = "hidden";
                layer.text(clip, cell.text, cell.color, FontType_T.SMALL, 10, 1);
            });
        });
    }
}

export class NCServerSelectWnd { // NCServerSelectWnd: 316x330, OnCreate 0x10101860, paint 0x101004d0, OnCommand 0x100ffd70.
    public static getTextures(): string[] { return [TEX_SELECT_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, `?${TEX_BUTTON}_over`, ...NCServerSelectListCtrl.getTextures()]; }

    public readonly element: HTMLDivElement;
    public onSelect: (serverId: number) => void = null;
    public onCancel: () => void = null;

    protected readonly layer: NDomLayer;
    protected readonly list: NCServerSelectListCtrl;
    protected rows: ServerRow_T[] = [];
    protected topServerId = -1;
    protected isSent = false;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        const manager = layer.getManager();

        this.layer = layer;
        this.element = layer.createWindow(0, 0, 316, 330, parent);
        this.element.tabIndex = -1;
        this.element.style.outline = "none";

        layer.tile(this.element, 0, 0, 316, 330, 0, 0, 316, 330, TEX_SELECT_BACK);

        this.list = new NCServerSelectListCtrl(layer, this.element);
        this.list.onActivate = () => this.connect();

        layer.button(this.element, 41, 297, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(603), () => this.sortByQuality());
        layer.button(this.element, 121, 297, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(140), () => this.connect());
        layer.button(this.element, 201, 297, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(141), () => { if (this.onCancel) this.onCancel(); });

        this.element.addEventListener("keydown", event => {
            if (event.key !== "Enter") return;

            this.layer.getManager().playButtonSound(true);
            this.connect();
        });

        window.setInterval(() => { this.isSent = false; }, CONNECT_RESET_INTERVAL); // Timer 0xf019 (0x10101898) clears the connect flag [+0x10c] every 3000 ms.
    }

    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;

        if (isVisible) this.element.focus();
    }

    public setServers(rows: ServerRow_T[], lastServerId: number) {
        this.rows = rows.slice();
        this.topServerId = this.rows.some(row => row.id === lastServerId) ? lastServerId : 0;
        this.updateItems();
        this.list.select(Math.max(0, this.rows.findIndex(row => row.id === lastServerId)));
    }

    protected updateItems() {
        const manager = this.layer.getManager();

        this.list.setItems(this.rows.map(row => {
            const traffic = getTraffic(row);

            return [
                { text: getNumberText(row), color: TEXT_COLOR },
                { text: row.name, color: TEXT_COLOR },
                { text: manager.getSysString(traffic.id), color: traffic.color },
                { text: `${row.ping}`, color: TEXT_COLOR },
                { text: null, color: TEXT_COLOR }
            ];
        }));
    }

    protected sortByQuality() {
        const rows = this.rows;

        if (rows.length === 0) return;

        const top = Math.max(0, rows.findIndex(row => row.id === this.topServerId));

        [rows[0], rows[top]] = [rows[top], rows[0]];

        const rest = rows.slice(1).sort((a, b) => a.ping - b.ping);

        rest.sort((a, b) => {
            const bucket = getPingBucket(a.ping);

            return bucket - getPingBucket(b.ping) || (bucket < 3 ? a.currentPlayers - b.currentPlayers : 0);
        });

        this.rows = [rows[0], ...rest];
        this.updateItems();
        this.list.select(0);
    }

    protected connect() { // 0x10100bf0.
        const row = this.rows[this.list.getSelected()];

        if (!row || this.isSent) return;

        this.isSent = true;

        if (this.onSelect) this.onSelect(row.id);
    }
}

export class NCServerInfoWnd { // NCServerInfoWnd: 316x205, paint 0x101011f0; NCHtmlViewer at (7, 7, W - 14, H - 14).
    public static getTextures(): string[] { return [TEX_INFO_BACK, ...NCHtmlViewer.getTextures()]; }

    public readonly element: HTMLDivElement;
    public readonly viewer: NCHtmlViewer;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        this.element = layer.createWindow(0, 337, 316, 205, parent);

        layer.tile(this.element, 0, 0, 316, 205, 0, 0, 316, 205, TEX_INFO_BACK);

        this.viewer = new NCHtmlViewer(layer, this.element, 7, 7, 316 - 14, 205 - 14);
    }

    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }
}

export class NCLoginServerWnd { // NCLoginServerWnd: invisible 316x542 container, OnCreate 0x1009e120.
    public static getTextures(): string[] { return [...NCServerSelectWnd.getTextures(), ...NCServerInfoWnd.getTextures()]; }

    public readonly element: HTMLDivElement;
    public readonly serverSelect: NCServerSelectWnd;
    public readonly serverInfo: NCServerInfoWnd;
    public onSelect: (serverId: number) => void = null;
    public onCancel: () => void = null;

    protected readonly layer: NDomLayer;

    public constructor(layer: NDomLayer) {
        this.layer = layer;
        this.element = layer.createWindow(0, 0, 316, 542);

        this.serverSelect = new NCServerSelectWnd(layer, this.element);
        this.serverInfo = new NCServerInfoWnd(layer, this.element);

        this.serverSelect.onSelect = serverId => { if (this.onSelect) this.onSelect(serverId); };
        this.serverSelect.onCancel = () => { if (this.onCancel) this.onCancel(); };
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) { // NCLoginWnd::OnCreate 0x1009fc81: halves of the NCLoginWnd area (W, H - 52), matching the L2.4_20 capture.
        this.layer.place(this.element, Math.trunc(screenWidth / 2) - 158, Math.trunc((screenHeight - 52) / 2) - 271);
    }

    public setVisible(isVisible: boolean) {
        this.element.hidden = !isVisible;
        this.serverSelect.setVisible(isVisible);
    }

    public setServers(rows: ServerRow_T[], lastServerId: number) { this.serverSelect.setServers(rows, lastServerId); }
}

export default NCLoginServerWnd;
