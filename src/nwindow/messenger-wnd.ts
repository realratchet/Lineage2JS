import NCFrameCtrl from "./nc-frame-ctrl";
import L2FriendTree from "./l2-friend-tree";
import L2ChatWnd from "./l2-chat-wnd";
import L2TaskWnd from "./l2-task-wnd";
import type NDomLayer from "./ndom";
import type { NDomButton_T, NDomEdit_T } from "./ndom";
import type { FriendEntry_T } from "../network/game-packets";

const TEX_BACK = "L2UI_CH3.Msn.msn_back";
const TEX_FRIENDS = "L2UI_CH3.Msn.msn_back0";
const TEX_LOGIN = "L2UI_CH3.Msn.messenger_back1";
const TEX_LOGO = "L2UI_CH3.Msn.msnlogo";
const TEX_TAB = "L2UI_CH3.Msn.msn_tab1";
const TEX_SELECTED = "L2UI_CH3.Msn.msn_tab2";
const TEX_SMALL = "L2UI_CH3.Button.SmallButton2";
const TEX_BIG = "L2UI_CH3.Button.bigbutton3";
const TEX_BACK_BUTTON = "L2UI_CH3.Button.bigbutton";
const TEX_FOLDED = "L2UI_CH3.Msn.msnminiicon5";
// NWindow 0x10149ce0: English string-table +0x8210c/+0x820ac/+0x8213c/+0x820dc.
const arrFriendErrors: Record<number, string> = { 145: "The contact you chose to chat with is not currently logged in. ", 147: "You are not allowed to chat with your contact while you are blocked from chatting.", 620: "You have been blocked from the contact you selected.", 1079: "The contact you chose to chat with is currently blocked from chatting." };

export class MessengerWnd {
    public static getTextures() { return [TEX_BACK, TEX_FRIENDS, TEX_LOGIN, TEX_LOGO, TEX_TAB, TEX_SELECTED, TEX_SMALL, `${TEX_SMALL}_down`, TEX_BIG, `${TEX_BIG}_down`, TEX_BACK_BUTTON, `${TEX_BACK_BUTTON}_down`, TEX_FOLDED, ...NCFrameCtrl.getTextures(), ...L2FriendTree.getTextures(), ...L2ChatWnd.getTextures(), ...L2TaskWnd.getTextures()]; }
    public readonly element: HTMLDivElement;
    public readonly folded: HTMLDivElement;
    public onSend: (peer: string, message: string) => void = null;
    protected readonly msn: HTMLDivElement;
    protected readonly friends: HTMLDivElement;
    protected readonly login: HTMLDivElement;
    protected readonly info: HTMLDivElement;
    protected readonly email: NDomEdit_T;
    protected readonly password: NDomEdit_T;
    protected readonly tree: L2FriendTree;
    protected readonly arrTabs: NDomButton_T[] = [];
    protected readonly conversations = new Map<string, L2ChatWnd>();
    protected readonly arrChats: L2ChatWnd[] = [];
    protected readonly arrPooled: L2ChatWnd[] = [];
    protected arrFriends: FriendEntry_T[] = [];
    protected task: L2TaskWnd = null;
    protected playerName = "";
    protected selected = 0;
    protected isFoldedHeld = false;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(384, 180, 256, 401);
        this.element.hidden = true;
        this.element.style.overflow = "hidden";
        layer.tile(this.element, 0, 20, 276, 28, 0, 0, 276, 28, TEX_BACK);
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(999), true, () => this.setVisible(false), null, () => this.minimize());
        this.msn = layer.createWindow(0, 48, 256, 353, this.element);
        this.friends = layer.createWindow(0, 48, 256, 353, this.element);
        layer.tile(this.friends, 0, 0, 256, 353, 0, 0, 256, 353, TEX_FRIENDS);
        this.tree = new L2FriendTree(layer, this.friends);
        this.tree.onDoubleClick = friend => this.openConversation(friend);
        this.login = layer.createWindow(0, 0, 256, 353, this.msn);
        layer.tile(this.login, 0, 0, 256, 353, 0, 0, 256, 353, TEX_LOGIN);
        layer.tile(this.login, 95, 278, 142, 23, 0, 0, 142, 23, TEX_LOGO);
        const label = manager.getSysString(1003);

        layer.text(this.login, label, 0xffdcdcdc, undefined, Math.trunc((256 - layer.measureText(label)) / 2), 109);
        layer.text(this.login, manager.getSysString(1004), 0xffdcdcdc, undefined, 16, 134);
        layer.text(this.login, manager.getSysString(1005), 0xffdcdcdc, undefined, 16, 155);
        this.email = layer.edit(this.login, 92, 131, 151, 17, false, 100);
        this.password = layer.edit(this.login, 92, 151, 151, 17, true, 16);
        this.email.input.setAttribute("aria-label", manager.getSysString(1004));
        this.password.input.setAttribute("aria-label", manager.getSysString(1005));
        this.password.input.addEventListener("keydown", event => {
            if (event.key !== "Enter") return;

            event.preventDefault();
            this.submit();
        });
        layer.button(this.login, 72, 176, 66, 21, TEX_SMALL, `${TEX_SMALL}_down`, null, manager.getSysString(140), () => this.submit());
        layer.button(this.login, 142, 176, 66, 21, TEX_SMALL, `${TEX_SMALL}_down`, null, manager.getSysString(141), () => this.clearLogin());
        layer.button(this.login, 72, 204, 134, 23, TEX_BIG, `${TEX_BIG}_down`, null, manager.getSysString(995), () => {
            this.login.hidden = true;
            this.info.hidden = false;
        });
        this.info = layer.createWindow(0, 0, 256, 353, this.msn);
        this.info.hidden = true;
        layer.tile(this.info, 0, 0, 256, 353, 0, 0, 256, 353, TEX_LOGIN);
        // NWindow 0x10156720: English strings at global string-table +0x8186c/+0x8189c/+0x818cc.
        layer.wrappedText(this.info, 18, 44, 0xffdcdcdc, "For full functionality, the latest version of MSN Messenger client must be installed on the user's computer.\n\n\nPrevious versions of MSN Messenger only provide the basic features to chat in the game. Add/Delete Contacts and other options aren't available.\n\n\nThe latest version of MSN Messenger may be obtained from the MSN web site (http://messenger.msn.com).", 220);
        layer.button(this.info, 79, 274, 96, 23, TEX_BACK_BUTTON, `${TEX_BACK_BUTTON}_down`, null, manager.getSysString(1008), () => {
            this.info.hidden = true;
            this.login.hidden = false;
        });
        for (let i = 0; i < 2; i++) this.arrTabs.push(layer.tab(this.element, 12 + i * 115, 25, 114, 23, i ? TEX_TAB : TEX_SELECTED, TEX_SELECTED, manager.getSysString(996 + i), null, () => this.select(i)));
        this.friends.hidden = true;
        this.folded = layer.createWindow(384, 180, 32, 32);
        this.folded.hidden = true;
        this.folded.setAttribute("aria-label", manager.getSysString(999));
        layer.tile(this.folded, 0, 0, 32, 32, 0, 0, 32, 32, TEX_FOLDED);
        this.folded.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();
            const x = layer.toUI(event.clientX) - this.folded.offsetLeft, y = layer.toUI(event.clientY) - this.folded.offsetTop;
            let moved = false;

            layer.beginDrag(move => {
                moved = true;
                layer.place(this.folded, layer.toUI(move.clientX) - x, layer.toUI(move.clientY) - y);
            }, release => {
                this.isFoldedHeld = false;
                if (moved || !(release instanceof MouseEvent) || release.type !== "mouseup" && release.type !== "pointerup") return;

                manager.playWindowSound();
                this.setVisible(true);
            });
            this.isFoldedHeld = true;
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 384, 180); }
    public isVisible() { return !this.element.hidden; }
    public setFriends(friends: FriendEntry_T[]) { this.arrFriends = friends; this.tree.setFriends(friends); }
    public setPlayerName(name: string) { this.playerName = name; }
    public setChildVisible(element: HTMLElement, isVisible: boolean) {
        if (this.task && this.task.element === element) { this.task.setVisible(isVisible); return true; }
        const chat = this.arrChats.find(chat => chat.element === element);

        if (!chat) return false;

        chat.setVisible(isVisible);
        return true;
    }
    public setFoldedVisible(isVisible: boolean) {
        if (!isVisible && this.isFoldedHeld) this.layer.cancelDrag();
        this.folded.hidden = !isVisible;
    }
    public reset() {
        this.setVisible(false);
        this.setFoldedVisible(false);
        this.clearLogin();
        this.setFriends([]);
        for (const chat of this.arrChats) chat.reset();
        this.conversations.clear();
        this.arrPooled.length = 0;
        this.arrPooled.push(...this.arrChats);
        if (this.task) this.task.reset();
        this.playerName = "";
    }

    public setVisible(isVisible: boolean) {
        if (isVisible) {
            if (!this.folded.hidden) this.layer.place(this.element, this.folded.offsetLeft, this.folded.offsetTop);
            this.setFoldedVisible(false);
            this.login.hidden = false;
            this.info.hidden = true;
        }
        this.element.hidden = !isVisible;
        if (isVisible) {
            this.layer.activate(this.element);
            if (!this.selected) this.email.focus();
        }
    }

    protected select(index: number) {
        this.selected = index;
        this.msn.hidden = index !== 0;
        this.friends.hidden = index !== 1;
        for (let i = 0; i < 2; i++) {
            this.arrTabs[i].setTextures(i === index ? TEX_SELECTED : TEX_TAB, TEX_SELECTED);
            this.arrTabs[i].setAttribute("aria-selected", String(i === index));
        }
        if (!index) { this.login.hidden = false; this.info.hidden = true; }
    }

    protected minimize() {
        this.layer.place(this.folded, Math.max(0, this.element.offsetLeft), this.element.offsetTop);
        this.setVisible(false);
        this.setFoldedVisible(true);
        this.layer.activate(this.folded);
    }

    protected clearLogin() { this.email.setValue(""); this.password.setValue(""); }
    protected submit() {
        const email = this.email.getValue(), password = this.password.getValue();

        try {
            if (email && password) this.loginMsn(email, password);
        } finally { this.clearLogin(); }
    }

    protected loginMsn(email: string, password: string) {
        debugger;
        throw new Error(`MSN Messenger login is not implemented.`);
    }

    protected openConversation(friend: FriendEntry_T) {
        const chat = this.getConversation(friend.name);

        chat.show();
        this.task.setEntry(friend.name, false);
    }

    public receiveMessage(result: number, peer: string, message: string) {
        let chat = this.conversations.get(peer);
        const isNew = !chat;

        if (!chat) {
            chat = this.getConversation(peer);
            chat.setVisible(false);
            this.task.setEntry(peer, true);
        }
        if (!result) chat.addMessage(peer, message);
        else if (arrFriendErrors[result]) chat.addMessage("", arrFriendErrors[result], 0xffe37171);
        if (!isNew && !chat.isVisible()) this.task.setEntry(peer, true);
    }

    protected ensureTask() {
        if (!this.task) {
            this.task = new L2TaskWnd(this.layer);
            this.task.onOpen = peer => {
                const chat = this.conversations.get(peer)!;

                this.task.setEntry(peer, false);
                chat.show();
            };
        }
        this.task.setVisible(true);
        return this.task;
    }

    protected getConversation(peer: string) {
        this.ensureTask();
        let chat = this.conversations.get(peer);

        if (!chat) {
            chat = this.arrPooled.find(chat => !chat.getActive());
            if (!chat) {
                chat = new L2ChatWnd(this.layer);
                const view = chat;

                view.onClose = () => {
                    const peer = view.getPeer();

                    view.setVisible(false);
                    this.conversations.delete(peer);
                    this.task.removeEntry(peer);
                    view.reset();
                    if (!this.arrPooled.includes(view)) this.arrPooled.push(view);
                };
                view.onSend = message => this.sendMessage(view, message);
                this.arrChats.push(chat);
            }
            this.conversations.set(peer, chat);
        }
        chat.setPeer(peer);
        return chat;
    }

    protected sendMessage(chat: L2ChatWnd, message: string) {
        const peer = chat.getPeer(), friend = this.arrFriends.find(friend => friend.name === peer);

        if (friend && friend.isOnline) {
            if (!this.onSend) throw new Error(`Friend message sender is not initialized.`);

            this.onSend(peer, message);
            if (this.playerName) chat.addMessage(this.playerName, message);
        } else {
            // NWindow 0x10149dd0: English string-table +0x81b9c and format 0x101da040.
            chat.addMessage("", "The following message could not be delivered:", 0xffe37171);
            chat.addMessage("", `   ${message}`, 0xffe37171);
        }
        chat.clearEdit();
    }
}

export default MessengerWnd;
