import { type default as NDomLayer, NDOM_SCROLL_TEXTURES, type NDomScrollPane_T } from "./ndom";
import type { FriendEntry_T } from "../network/game-packets";
import { SKIN_SLOTS } from "./skin-textures";

const TEX_PLUS = "L2UI_CH3.QUESTWND.QuestWndPlusBtn";
const TEX_MINUS = "L2UI_CH3.QUESTWND.QuestWndMinusBtn";

type FriendTreeRow_T = { friend: FriendEntry_T, group: number, y: number };

export class L2FriendTree {
    public static getTextures() { return [TEX_PLUS, TEX_MINUS, SKIN_SLOTS.listSelect, SKIN_SLOTS.listSelectEnd, ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: NDomScrollPane_T;
    public onDoubleClick: (friend: FriendEntry_T) => void = null;
    protected arrFriends: FriendEntry_T[][] = [[], []];
    protected arrExpanded = [false, false];
    protected arrRows: FriendTreeRow_T[] = [];
    protected selected: FriendEntry_T | number = null;
    protected origin = 0;
    protected contentHeight = 0;

    public constructor(protected readonly layer: NDomLayer, parent: HTMLElement, x = 8, y = 45) {
        this.element = layer.scrollPane(parent, x, y, 240, 270, 15, true);
        this.element.setAttribute("role", "tree");
        this.element.setAttribute("aria-label", layer.getManager().getSysString(997));
        const setScroll = this.element.setScroll;

        this.element.setScroll = (position, isClamped = true) => {
            const previous = this.element.getScroll();

            setScroll(position, isClamped);
            const current = this.element.getScroll();

            // NWindow 0x10166d70/0x10166e30: arrow Move uses the full step at a clamped boundary.
            this.origin += current === previous ? 0 : Math.abs(position - previous) === 15 ? position - previous : current - previous;
            this.element.content.style.top = `${-this.origin}px`;
        };
        this.element.addEventListener("wheel", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const previous = this.element.getScroll();
            const notches = Math.trunc(event.deltaY / 120);

            setScroll(Math.max(0, Math.min(Math.max(0, this.contentHeight - 270), previous + notches * 45)));
            this.origin += this.element.getScroll() - previous;
            this.element.content.style.top = `${-this.origin}px`;
        }, { capture: true, passive: false });
        this.element.content.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            const row = this.hit(event.clientX, event.clientY);

            if (!row) return;
            if (event.detail === 2) {
                if (row.friend && row.friend.isOnline && this.onDoubleClick) this.onDoubleClick(row.friend);
                return;
            }

            this.selected = row.friend || row.group;
            if (!row.friend) this.arrExpanded[row.group] = !this.arrExpanded[row.group];
            this.paint();
        });
        this.element.addEventListener("contextmenu", event => event.preventDefault());
        this.paint();
    }

    public setFriends(friends: FriendEntry_T[]) {
        this.arrFriends = [friends.filter(friend => friend.isOnline).sort(compareFriendNames), friends.filter(friend => !friend.isOnline).sort(compareFriendNames)];
        this.arrExpanded = [false, false];
        this.selected = null;
        this.element.setScroll(0);
        this.origin = 0;
        this.paint();
    }

    protected hit(clientX: number, clientY: number) {
        const rect = this.element.getBoundingClientRect();
        const x = this.layer.toUI(clientX - rect.left), y = this.layer.toUI(clientY - rect.top) + this.origin;

        if (x < 0 || x >= 240 || y < this.origin || y >= this.origin + 270) return null;

        for (const row of this.arrRows) {
            const left = row.friend ? 18 : 15;

            if (x >= left && x < left + 220 && y >= row.y && y < row.y + 14 || !row.friend && x < 15 && y >= row.y && y < row.y + 15) return row;
        }
        return null;
    }

    protected paint() {
        const content = this.element.content;

        content.replaceChildren();
        this.arrRows = [];
        let y = 0;

        for (let group = 0; group < 2; group++) {
            this.arrRows.push({ friend: null, group, y });
            this.paintRow(null, group, y);
            y += 19;
            if (!this.arrExpanded[group]) continue;

            for (const friend of this.arrFriends[group]) {
                this.arrRows.push({ friend, group, y });
                this.paintRow(friend, group, y);
                y += 19;
            }
        }
        this.contentHeight = y;
        this.element.setContentHeight(y, true);
        content.style.top = `${-this.origin}px`;
    }

    protected paintRow(friend: FriendEntry_T, group: number, y: number) {
        const layer = this.layer, content = this.element.content, x = friend ? 18 : 15;
        const selected = this.selected === (friend || group);
        const row = layer.createWindow(0, y, 225, 19, content);
        const label = friend ? friend.name : `${layer.getManager().getSysString(1006 + group)} (${this.arrFriends[group].length})`;

        row.setAttribute("role", "treeitem");
        row.setAttribute("aria-label", label);
        row.setAttribute("aria-selected", String(selected));
        if (!friend) {
            row.setAttribute("aria-expanded", String(this.arrExpanded[group]));
            layer.tile(row, 0, 0, 15, 15, 0, 0, 15, 15, this.arrExpanded[group] ? TEX_MINUS : TEX_PLUS);
        }
        if (selected) {
            layer.tile(row, x, 0, 171, 14, 0, 0, 16, 13, SKIN_SLOTS.listSelect);
            layer.tile(row, x + 171, 0, 32, 14, 0, 0, 32, 13, SKIN_SLOTS.listSelectEnd);
        }
        layer.text(row, label, 0xffdcdcdc, undefined, friend ? 21 : 18, 2);
    }
}

function compareFriendNames(a: FriendEntry_T, b: FriendEntry_T) {
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export default L2FriendTree;
