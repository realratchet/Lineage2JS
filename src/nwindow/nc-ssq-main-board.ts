import NCFrameCtrl from "./nc-frame-ctrl";
import NDomLayer, { NDOM_SCROLL_TEXTURES, type NDomButton_T, type NDomScrollPane_T } from "./ndom";
import { FontType_T } from "./nwindow-canvas";
import { SSQPage_T, type SSQStatus_T, type SSQRecord_T, type SSQFestival_T, type SSQSealStatus_T, type SSQSealPrediction_T } from "../network/game-packets";
import { SKIN_SLOTS } from "./skin-textures";

const TEX_BACK = "L2UI_CH3.SSQWnd.SSQ_back";
const TEX_RECORD = "L2UI_CH3.SSQWnd.SSQ_back1";
const TEX_PROJECTION = "L2UI_CH3.SSQWnd.SSQ_back1_1";
const TEX_LIST = "L2UI_CH3.SSQWnd.ssq_back2";
const TEX_BUTTON = SKIN_SLOTS.button;
const TEX_BUTTON_DOWN = SKIN_SLOTS.buttonDown;
const TEX_TAB = "L2UI_CH3.TabButton.normal_tab_on";
const TEX_TAB_SELECTED = "L2UI_CH3.TabButton.normal_tab";
const TEX_TEXT = "L2UI_CH3.Etc.TextBox";
const TEX_TEXT_BACK = "L2UI_CH3.Etc.TextBackline";
const arrBars = ["ssq_bar22", "ssq_bar12", "ssq_bar2back", "ssq_bar1back"].map(name => `L2UI_CH3.SSQWnd.${name}`);
const arrSealBars = ["ssq_bar21", "ssq_bar11", "ssq_barline"].map(name => `L2UI_CH3.SSQWnd.${name}`);
const arrPanels = [1, 2, 3].map(index => `L2UI_CH3.QuestWnd.QuestWndPanel${index}`);
const TEX_PLUS = "L2UI_CH3.QuestWnd.QuestWndPlusBtn";
const TEX_MINUS = "L2UI_CH3.QuestWnd.QuestWndMinusBtn";
const TEX_DOWN = "L2UI_CH3.QuestWnd.QuestWndDownBtn";
const TEX_UP = "L2UI_CH3.QuestWnd.QuestWndUpBtn";
const TEX_SELECT = SKIN_SLOTS.listSelect;
const TEX_SELECT_END = SKIN_SLOTS.listSelectEnd;
const arrStatusPages = [SSQPage_T.RECORD, SSQPage_T.FESTIVAL, SSQPage_T.SEALS];
const GRAY = 0xff808080;
const WHITE = 0xffdcdcdc;
const GOLD = 0xffb09b79;

export class NCSSQMainBoard {
    public static getTextures() { return [TEX_BACK, TEX_RECORD, TEX_PROJECTION, TEX_LIST, TEX_BUTTON, TEX_BUTTON_DOWN, TEX_TAB, TEX_TAB_SELECTED, TEX_TEXT_BACK, ...arrBars, ...arrSealBars, ...arrPanels, ...[1, 2, 3].map(index => `${TEX_TEXT}${index}`), TEX_PLUS, TEX_MINUS, TEX_DOWN, TEX_UP, TEX_SELECT, TEX_SELECT_END, ...NCFrameCtrl.getTextures(), ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onRequest: (page: SSQPage_T) => void = null;
    protected readonly pages: HTMLDivElement[] = [];
    protected readonly tabs: NDomButton_T[] = [];
    protected readonly content: HTMLDivElement;
    protected readonly recordBack: HTMLDivElement;
    protected readonly projectionButton: NDomButton_T;
    protected readonly lists: NDomScrollPane_T[] = [];
    protected readonly requested = new Set<number>();
    protected readonly expandedFestivals = new Set<number>();
    protected readonly expandedSeals = new Set<number>();
    protected selected = 0;
    protected selectedFestival = -1;
    protected selectedSeal = -1;
    protected isProjection = false;
    protected period = 0;
    protected festivalPeriod = 0;
    protected readonly expandedFestivalGroups = new Set<number>();
    protected selectedFestivalGroup = -1;
    protected festivalGroups: number[] = [];
    protected record: SSQRecord_T = null;
    protected festivals: SSQFestival_T[] = [];
    protected seals: SSQSealStatus_T[] = [];
    protected predictions: SSQSealPrediction_T[] = [];
    protected predictedWinner = 0;
    protected retainLimit = 0;
    protected claimLimit = 0;

    public constructor(protected readonly layer: NDomLayer) { // NCSSQMainBoard 0x100fc760, NCSSQStatusWnd 0x100fc490.
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 256, 401);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        layer.tile(this.element, 0, 20, 256, 28, 0, 0, 256, 28, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.strings.itemNames[5707], false, () => this.setVisible(false));
        for (let index = 0; index < 3; index++) {
            const label = manager.getSysString(824 + index);
            const tab = layer.tab(this.element, 12 + index * 74, 25, 74, 23, TEX_TAB, TEX_TAB_SELECTED, label, null, () => this.select(index));

            tab.setAttribute("aria-selected", String(index === 0));
            this.tabs.push(tab);
            const page = layer.createWindow(0, 48, 256, 353, this.element);

            page.hidden = index !== 0;
            this.pages.push(page);
            if (index) {
                layer.tile(page, 0, 0, 256, 353, 0, 0, 256, 353, TEX_LIST);
                const list = layer.scrollPane(page, index === 1 ? 8 : 9, 11, index === 1 ? 240 : 238, 304, 16, true);

                list.style.overflow = "hidden";
                list.content.style.width = index === 1 ? "224px" : "222px";
                list.content.style.overflow = "hidden";
                this.lists.push(list);
                this.button(page, 91, 324, manager.getSysString(938), () => this.request(arrStatusPages[index]));
            }
        }
        this.select(0);
        this.recordBack = layer.tile(this.pages[0], 0, 0, 256, 353, 0, 0, 256, 353, TEX_RECORD);
        this.content = layer.createWindow(0, 0, 256, 324, this.pages[0]);
        this.content.style.overflow = "hidden";
        this.button(this.pages[0], 51, 324, manager.getSysString(938), () => this.request(this.isProjection ? SSQPage_T.PREDICTION : SSQPage_T.RECORD));
        this.projectionButton = this.button(this.pages[0], 131, 324, manager.getSysString(937), () => {
            this.isProjection = !this.isProjection;
            this.projectionButton.setLabel(manager.getSysString(this.isProjection ? 939 : 937));
            this.projectionButton.setAttribute("aria-label", manager.getSysString(this.isProjection ? 939 : 937));
            this.paintRecord();
            this.request(this.isProjection ? SSQPage_T.PREDICTION : SSQPage_T.RECORD);
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }
    public isVisible() { return !this.element.hidden; }
    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (visible) return;

        this.requested.clear();
        this.isProjection = false;
        this.record = null;
        this.festivals = [];
        this.seals = [];
        this.predictions = [];
        this.predictedWinner = 0;
        this.expandedFestivals.clear();
        this.expandedSeals.clear();
        this.selectedFestival = -1;
        this.selectedSeal = -1;
        this.expandedFestivalGroups.clear();
        this.festivalGroups = [];
        this.selectedFestivalGroup = -1;
        this.content.replaceChildren();
        for (const list of this.lists) {
            list.content.replaceChildren();
            list.setContentHeight(0);
            list.setScroll(0);
        }
    }

    public show(status: SSQStatus_T) {
        switch (status.page) {
            case SSQPage_T.RECORD:
                this.setVisible(false);
                this.period = status.period;
                this.record = status.record;
                this.projectionButton.setLabel(this.layer.getManager().getSysString(937));
                this.projectionButton.setAttribute("aria-label", this.layer.getManager().getSysString(937));
                this.select(0);
                this.paintRecord();
                this.setVisible(true);
                this.layer.activate(this.element);
                this.element.focus();
                break;
            case SSQPage_T.FESTIVAL:
                this.festivalPeriod = status.period;
                this.festivals = status.festivals;
                this.expandedFestivals.clear();
                this.selectedFestival = -1;
                this.expandedFestivalGroups.clear();
                this.festivalGroups = status.groups;
                this.selectedFestivalGroup = -1;
                this.paintFestivals();
                break;
            case SSQPage_T.SEALS:
                this.seals = status.seals;
                this.retainLimit = status.retainLimit;
                this.claimLimit = status.claimLimit;
                this.expandedSeals.clear();
                this.selectedSeal = -1;
                this.paintSeals();
                break;
            case SSQPage_T.PREDICTION:
                this.predictedWinner = status.predictedWinner;
                this.predictions = status.predictions;
                if (this.isProjection) this.paintRecord();
                break;
            default: throw new Error(`Unknown Seven Signs page '${(status as any).page}'.`);
        }
    }

    protected request(page: SSQPage_T) { if (this.onRequest) this.onRequest(page); }
    protected select(index: number) {
        this.selected = index;
        this.pages.forEach((page, i) => { page.hidden = i !== index; });
        this.tabs.forEach((tab, i) => {
            tab.setTextures(i === index ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED);
            tab.setAttribute("aria-selected", String(i === index));
        });
        if (index === 0 || this.requested.has(index)) return;

        this.requested.add(index);
        this.request(arrStatusPages[index]);
    }
    protected cabal(cabal: number) { return this.layer.getManager().getSysString(cabal === 1 ? 814 : cabal === 2 ? 815 : 27); }
    protected seal(seal: number) { return this.layer.getManager().getSysString(seal >= 1 && seal <= 3 ? 815 + seal : 27); }
    protected text(parent: HTMLElement, text: string, x: number, y: number, color = WHITE) { return this.layer.text(parent, text, color, FontType_T.SMALL, x, y); }
    protected lines(parent: HTMLElement, text: string, x: number, y: number, width: number, color = GRAY, isSpaced = false) { // UCanvas::DrawNormalText / GetTextSize: each new line adds the 'A' height, plus 6 when spaced.
        const canvas = this.layer.getManager().canvas, lines = canvas.wrapText(text.replace(/\\n/g, "\n"), width), step = canvas.getLineHeight() + (isSpaced ? 6 : 0);

        lines.forEach((line, index) => this.text(parent, line, x, y + index * step, color));
        return lines.length ? canvas.getLineHeight() + (lines.length - 1) * step : 0;
    }

    protected paintRecord() { // NCSSQStatusWnd paint 0x100fa620 / 0x100fb370.
        const layer = this.layer, manager = layer.getManager(), record = this.record, content = this.content, height = manager.canvas.getLineHeight();

        content.replaceChildren();
        layer.setTile(this.recordBack, 256, 353, 0, 0, 256, 353, this.isProjection ? TEX_PROJECTION : TEX_RECORD);
        layer.tile(content, 0, 0, 256, 324, 0, 0, 256, 324, this.isProjection ? TEX_PROJECTION : TEX_RECORD);
        if (this.isProjection) {
            const label = manager.getSysString(937);

            this.text(content, label, 11, 13);
            if (this.predictedWinner) this.text(content, `${this.cabal(this.predictedWinner)} ${manager.getSysString(828)}`, 16 + layer.measureText(label), 13, GOLD);
            this.lines(content, manager.getSystemMessage(this.predictedWinner ? 1288 : 1293).replace(/\$s1/g, this.cabal(this.predictedWinner)), 14, 32, 226);
            this.text(content, manager.getSysString(940), 11, 88);
            const list = layer.scrollPane(content, 8, 103, 240, 212, 16, true);
            let previousHeight = 0, contentHeight = 0, paintedHeight = 0;

            this.predictions.forEach((entry, index) => {
                const label = `${this.seal(entry.id)} : `, y = index * (previousHeight + height * 2 + 15) + 3;

                this.text(list.content, label, 6, y, GRAY);
                this.text(list.content, entry.cabal ? this.cabal(entry.cabal) : manager.getSysString(936), 6 + layer.measureText(label), y, GOLD);
                const descriptionHeight = this.lines(list.content, manager.getSystemMessage(entry.messageId), 10, y + height + 6, 214, GRAY, true);

                paintedHeight = Math.max(paintedHeight, y + height + 6 + descriptionHeight);
                contentHeight += previousHeight + height * 2 + 17;
                previousHeight = descriptionHeight;
            });
            for (let index = 1; index < Math.trunc(contentHeight / 16); index += 2)
                layer.tile(list.content, 0, index * 17 + 2, 240, 16, 0, 0, 8, 15, TEX_TEXT_BACK);
            // NCPreWinnerWnd 0x100fbc04 omits the final description height from its scroll extent.
            list.setContentHeight(Math.max(contentHeight, paintedHeight));
            return;
        }
        if (!record) return;

        const title = `${manager.getSysString(833)} - `;

        this.text(content, title, 11, 13);
        this.text(content, `${record.cycle} ${manager.getSysString(934)}`, 11 + layer.measureText(title), 13, GOLD);
        if (record.periodMessageId) this.text(content, manager.getSystemMessage(record.periodMessageId), 14, 34, GRAY);
        if (record.periodEndMessageId) this.text(content, manager.getSystemMessage(record.periodEndMessageId), 14, 38 + height, GOLD);
        this.text(content, manager.getSysString(834), 11, 73);
        [[835, this.cabal(record.playerCabal)], [836, this.seal(record.playerSeal)], [931, `${record.stoneContribution}${manager.getSysString(932)}`]].forEach(([id, value], row) => {
            const y = 94 + row * (height + 4);

            this.text(content, manager.getSysString(id as number), 14, y, GRAY);
            this.text(content, value as string, 100, y, GOLD);
        });
        this.text(content, `(${record.ancientAdena}${manager.getSysString(933)})`, 100, 106 + height * 3, GOLD);
        const total = manager.getSysString(824);

        this.text(content, total, 11, 168);
        this.text(content, ` - ${manager.getSysString(this.period === 3 ? 838 : 837)}`, 11 + layer.measureText(total), 168, GOLD);
        [record.dusk, record.dawn].forEach((score, index) => {
            const y = 192 + index * 18;

            this.text(content, this.cabal(index === 0 ? 2 : 1), 14, y, GOLD);
            layer.tile(content, 92, y, 150, 11, 0, 0, 8, 11, arrBars[index + 2]);
            if (score.percent) layer.tile(content, 92, y, Math.trunc(score.percent * 1.5), 11, 0, 0, 8, 11, arrBars[index]);
            this.text(content, this.cabal(index === 0 ? 2 : 1), index === 0 ? 82 : 166, 237, GRAY);
        });
        [839, 825, 840].forEach((id, row) => this.text(content, manager.getSysString(id), 14, 252 + row * (height + 8), GRAY));
        [record.dusk, record.dawn].forEach((score, column) => {
            [score.stoneScore, score.festivalScore, score.totalScore].forEach((value, row) => {
                const x = column === 0 ? 78 : 166, y = 250 + row * 19;

                layer.tile(content, x, y, 8, 17, 0, 0, 8, 17, `${TEX_TEXT}1`);
                layer.tile(content, x + 8, y, 63, 17, 0, 0, 8, 17, `${TEX_TEXT}2`);
                layer.tile(content, x + 71, y, 8, 17, 0, 0, 8, 17, `${TEX_TEXT}3`);
                this.text(content, String(value), x + 77 - layer.measureText(String(value)), y + 9 - Math.trunc(height / 2), GRAY);
            });
        });
    }

    protected paintFestivals() { // NCSSQMainEventTree 0x100fcdd2 / 0x100fd73d.
        const list = this.lists[0], layer = this.layer, manager = layer.getManager(), height = manager.canvas.getLineHeight();

        list.content.replaceChildren();
        let y = 5;

        for (const groupId of this.festivalGroups) {
            const groupLabel = groupId === 0 ? manager.getSysString(845) : "", groupExpanded = this.expandedFestivalGroups.has(groupId);

            this.treeButton(list.content, groupLabel || `Festival group ${groupId}`, 29, y, groupExpanded, (toggle = true) => {
                this.selectedFestivalGroup = groupExpanded ? -1 : groupId;
                if (toggle) {
                    if (groupExpanded) this.expandedFestivalGroups.delete(groupId);
                    else this.expandedFestivalGroups.add(groupId);
                }
                this.paintFestivals();
            }, false, this.selectedFestivalGroup === groupId);
            if (groupExpanded) {
                layer.tile(list.content, 29, y + 1, 175, 13, 0, 0, 16, 13, TEX_SELECT);
                layer.tile(list.content, 204, y + 1, 32, 13, 0, 0, 32, 13, TEX_SELECT_END);
            }
            if (groupLabel) this.text(list.content, groupLabel, 34, y + 2);
            y += 23;
            if (!groupExpanded) continue;

            for (const festival of this.festivals) {
                if (festival.groupId !== groupId) continue;

                const key = groupId * 256 + festival.id;
                const label = manager.getSysString([819, 820, 821, 844, 822][festival.id - 1]), expanded = this.expandedFestivals.has(key);

                this.treeButton(list.content, label, 36, y, expanded, (toggle = true) => {
                    this.selectedFestival = expanded ? -1 : key;
                    if (toggle) {
                        if (expanded) this.expandedFestivals.delete(key);
                        else this.expandedFestivals.add(key);
                    }
                    this.paintFestivals();
                }, true, this.selectedFestival === key);
                this.text(list.content, label, 41, y + 2, GRAY);
                const result = this.festivalPeriod === 1 ? manager.getSysString(829) : festival.duskScore === festival.dawnScore ? `(${manager.getSysString(846)})` : `(${manager.getSysString(festival.duskScore > festival.dawnScore ? 924 : 923)} ${manager.getSysString(828)})`;

                this.text(list.content, result, 46 + layer.measureText(label), y + 2, GOLD);
                const scoreLabel = `${manager.getSysString(831)} : `;

                this.text(list.content, scoreLabel, 41, y + height + 6, GRAY);
                this.text(list.content, String(festival.levelScore), 41 + layer.measureText(scoreLabel), y + height + 6, GOLD);
                y += height * 2 + 14;
                if (!expanded) continue;

                const duskMembers = festival.duskMembers.filter(Boolean).slice(0, 9), dawnMembers = festival.dawnMembers.filter(Boolean).slice(0, 9);
                const panelHeight = (7 + duskMembers.length + dawnMembers.length) * (height + 4), panel = layer.createWindow(24, y - 3, 211, panelHeight, list.content);

                panel.style.overflow = "hidden";
                layer.tile(panel, 0, 0, 211, 8, 0, 0, 211, 8, arrPanels[0]);
                layer.tile(panel, 0, 8, 211, panelHeight - 16, 0, 0, 211, 8, arrPanels[1]);
                layer.tile(panel, 0, panelHeight - 8, 211, 8, 0, 0, 211, 8, arrPanels[2]);
                for (let row = 1; row < Math.trunc(panelHeight / 15); row += 2)
                    layer.tile(panel, 0, 1 + row * 16, 211, 15, 0, 0, 8, 15, TEX_TEXT_BACK);
                let row = 0;

                for (const [cabal, score, members] of [[1, festival.dawnScore, dawnMembers], [2, festival.duskScore, duskMembers]] as [number, number, string[]][]) {
                    this.text(panel, this.cabal(cabal), 5, 3 + row * (height + 4), GRAY);
                    this.text(panel, manager.getSysString(830), 5, 3 + (row + 1) * (height + 4), GRAY);
                    this.text(panel, String(score), 9 + layer.measureText(manager.getSysString(830)), 3 + (row + 1) * (height + 4), GOLD);
                    this.text(panel, manager.getSysString(832), 5, 3 + (row + 2) * (height + 4), GRAY);
                    members.forEach((name, index) => this.text(panel, name, 5, 3 + (row + 3 + index) * (height + 4), GOLD));
                    row += members.length + 4;
                }
                y += panelHeight;
            }
        }
        list.setContentHeight(y, true);
    }

    protected paintSeals() { // NCSSQSealStatusTree 0x100fe7ce..0x100fed9d.
        const list = this.lists[1], layer = this.layer, manager = layer.getManager(), height = manager.canvas.getLineHeight();

        list.content.replaceChildren();
        let y = 5;

        for (const seal of this.seals) {
            const expanded = this.expandedSeals.has(seal.id);

            this.treeButton(list.content, this.seal(seal.id), 29, y, expanded, (toggle = true) => {
                this.selectedSeal = expanded ? -1 : seal.id;
                if (toggle) {
                    if (expanded) this.expandedSeals.delete(seal.id);
                    else this.expandedSeals.add(seal.id);
                }
                this.paintSeals();
            }, false, this.selectedSeal === seal.id);
            if (expanded) {
                layer.tile(list.content, 29, y + 1, 173, 13, 0, 0, 16, 13, TEX_SELECT);
                layer.tile(list.content, 202, y + 1, 32, 13, 0, 0, 32, 13, TEX_SELECT_END);
            }
            this.text(list.content, this.seal(seal.id), 33, y + 2);
            y += height + 7;
            const ownerLabel = manager.getSysString(823);

            this.text(list.content, ownerLabel, 15, y, GRAY);
            this.text(list.content, this.cabal(seal.owner), 19 + layer.measureText(ownerLabel), y, GOLD);
            y += height + 7;
            [seal.duskPercent, seal.dawnPercent].forEach((percent, index) => {
                const cabal = index === 0 ? 2 : 1, limit = seal.owner === cabal ? this.retainLimit : this.claimLimit;
                const scale = Math.fround(0.01) * 140, text = `${percent}%`, label = this.cabal(cabal);

                this.text(list.content, label, Math.min(15, 76 - layer.measureText(label)), y, GRAY);
                layer.tile(list.content, 80, y, 140, 11, 0, 0, 8, 11, arrBars[index + 2]);
                if (percent > limit) {
                    const width = Math.fround(limit * scale);

                    layer.tile(list.content, 80, y, Math.trunc(width), 11, 0, 0, 8, 11, arrSealBars[index]);
                    layer.tile(list.content, Math.trunc(80 + width), y, Math.trunc((percent - limit) * scale), 11, 0, 0, 8, 11, arrBars[index]);
                } else if (percent) layer.tile(list.content, 80, y, Math.trunc(percent * scale), 11, 0, 0, 8, 11, arrSealBars[index]);
                layer.tile(list.content, Math.trunc(80 + limit * scale), y, 1, 11, 0, 0, 1, 11, arrSealBars[2]);
                this.text(list.content, text, 150 - Math.trunc(layer.measureText(text) / 2), y + 1);
                y += index === 0 ? height + 7 : 25;
            });
            if (expanded) { // NCSSQSealStatusTree 0x100fed9d..0x100ff1f1.
                const count = seal.id === 1 ? 8 : seal.id === 2 ? 6 : 0, first = seal.id === 1 ? 941 : 957;
                const description = manager.getSystemMessage(1177 + seal.id), descriptionLines = manager.canvas.wrapText(description, 207).length, descriptionHeight = height + (descriptionLines - 1) * (height + 6);
                const panelHeight = descriptionHeight + 24 + count * 2 * (height + 6), panel = layer.createWindow(10, y - 3, 236, panelHeight, list.content);

                layer.tile(panel, 0, 0, 236, 8, 0, 0, 222, 8, arrPanels[0]);
                layer.tile(panel, 0, 8, 236, panelHeight - 16, 0, 0, 222, 8, arrPanels[1]);
                layer.tile(panel, 0, panelHeight - 8, 236, 8, 0, 0, 222, 8, arrPanels[2]);
                for (let row = 1; row < Math.trunc(panelHeight / 17); row += 2)
                    layer.tile(panel, 0, 1 + row * 18, 222, 15, 0, 0, 8, 15, TEX_TEXT_BACK);
                this.lines(panel, description, 5, 3, 207, GRAY, true);
                for (let index = 0; index < count; index++) {
                    const row = descriptionHeight + 27 + index * 2 * (height + 6);

                    this.text(panel, manager.getSysString(first + index * 2), 5, row, GRAY);
                    this.text(panel, ":", 5, row + height + 6, GRAY);
                    this.text(panel, manager.getSysString(first + index * 2 + 1), 9, row + height + 6, GOLD);
                }
                y += panelHeight;
            }
        }
        list.setContentHeight(y, true);
    }

    protected treeButton(parent: HTMLElement, label: string, x: number, y: number, expanded: boolean, onPress: (toggle?: boolean) => void, isDetail = false, selected = false) {
        const texture = isDetail ? expanded ? TEX_UP : TEX_DOWN : expanded ? TEX_MINUS : TEX_PLUS;
        const button = this.layer.createWindow(x - 14, y, this.layer.measureText(label) + 32, 14, parent);

        button.style.zIndex = "1";
        this.layer.tile(button, 0, 0, 14, 14, 0, 0, 14, 14, texture);
        button.setAttribute("role", "treeitem");
        button.setAttribute("aria-label", label);
        button.setAttribute("aria-expanded", String(expanded));
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = 0;
        button.addEventListener("mousedown", event => {
            if (event.button !== 0 || event.detail === 2) return;

            event.preventDefault();
            const rect = button.getBoundingClientRect();

            onPress(this.layer.toUI(event.clientX - rect.left) !== 0 || this.layer.toUI(event.clientY - rect.top) !== 0);
            (parent.parentElement as HTMLElement).focus();
        });
        button.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            onPress();
        });
    }

    protected button(parent: HTMLElement, x: number, y: number, label: string, onPress: () => void) {
        const button = this.layer.button(parent, x, y, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, label, onPress);

        button.tabIndex = 0;
        button.setAttribute("role", "button");
        button.setAttribute("aria-label", label);
        button.addEventListener("keydown", event => {
            if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            this.layer.getManager().playButtonSound(true);
            onPress();
        });
        return button;
    }
}

export default NCSSQMainBoard;
