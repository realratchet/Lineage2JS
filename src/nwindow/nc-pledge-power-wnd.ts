import type NDomLayer from "./ndom";
import NCFrameCtrl from "./nc-frame-ctrl";
import { FontType_T } from "./nwindow-canvas";
import { SKIN_SLOTS } from "./skin-textures";
import SysString_T from "./sys-string";

const TEX_BACK = "L2UI_CH3.BloodHoodWnd.empower_back";
const TEX_BUTTON = SKIN_SLOTS.button;
const TEX_BUTTON_DOWN = SKIN_SLOTS.buttonDown;
const arrChecks = ["L2UI.Control.CheckBox", "L2UI.ActionWnd.CheckBox_checked", "L2UI.Control.CheckBox_unable", "L2UI.ActionWnd.CheckBox_checked_unable"];
const arrControls = [[SysString_T.ClanRelatedPrivileges, 21, 87, 200, -1], [SysString_T.JoinAClan, 32, 107, 100, 0], [SysString_T.ClanWar, 142, 107, 200, 10], [SysString_T.GiveATitle, 32, 126, 200, 1], [SysString_T.ViewWarehouseContents, 32, 145, 200, 2], [SysString_T.ClanCrestManagement, 32, 164, 200, 3], [SysString_T.ClanHallRelatedPrivileges, 21, 191, 200, -1], [SysString_T.EntrancePrivileges, 32, 210, 200, 4], [SysString_T.OtherRights, 32, 229, 200, 5], [SysString_T.DismissPrivilege, 32, 248, 200, 6], [SysString_T.CastleRights, 21, 275, 200, -1], [SysString_T.OpeningADoor, 32, 294, 200, 7], [SysString_T.OtherRights, 32, 313, 200, 8], [SysString_T.DismissPrivilege, 32, 332, 200, 9]];
const arrGroups = [[0, 1, 2, 3, 4, 5], [6, 7, 8, 9], [10, 11, 12, 13]];

export class NCPledgePowerWnd {
    public static getTextures(): string[] { return [TEX_BACK, TEX_BUTTON, TEX_BUTTON_DOWN, ...arrChecks, ...NCFrameCtrl.getTextures()]; }
    public readonly element: HTMLDivElement;
    public onSave: (objectId: number, power: Uint8Array) => void = null;
    protected readonly name: HTMLDivElement;
    protected readonly controls: HTMLDivElement[] = [];
    protected readonly faces: HTMLDivElement[] = [];
    protected readonly labels: HTMLDivElement[] = [];
    protected readonly checked = arrControls.map(() => false);
    protected readonly power = new Uint8Array(32);
    protected objectId = 0;
    protected mode = 0;

    public constructor(protected readonly layer: NDomLayer) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, Math.trunc(layer.root.clientHeight * 0.5 - 252), 256, 401);
        this.element.hidden = true;
        this.element.tabIndex = -1;
        this.element.dataset.window = "pledge-power";
        NCFrameCtrl.createDOM(layer, this.element, 256, manager.getSysString(SysString_T.PrivilegeSettings), false, () => this.setVisible(false));
        layer.tile(this.element, 0, 20, 256, 381, 0, 0, 256, 381, TEX_BACK);
        this.name = layer.createWindow(0, 0, 256, 78, this.element);
        this.name.style.pointerEvents = "none";
        arrControls.forEach(([label, x, y, width], index) => {
            const control = layer.createWindow(x, y, width, 12, this.element);

            control.setAttribute("role", "checkbox");
            control.setAttribute("aria-label", manager.getSysString(label));
            this.controls.push(control);
            this.faces.push(layer.tile(control, 0, 0, 12, 12, 0, 0, 12, 12, arrChecks[0]));
            this.labels.push(layer.text(control, manager.getSysString(label), 0xffdcdcdc, FontType_T.SMALL, 16, 0));
            control.addEventListener("mousedown", event => {
                if (event.button !== 0 || event.detail === 2 || this.mode === 1) return;

                event.preventDefault();
                this.checked[index] = !this.checked[index];
                const group = arrGroups.find(values => values[0] === index);

                if (group)
                    for (let child = 1; child < group.length; child++) this.checked[group[child]] = this.checked[index];
                this.paintChecks();
            });
        });
        layer.button(this.element, 51, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(SysString_T.OK), () => {
            if (this.objectId > 0 && this.mode === 2) {
                const power = new Uint8Array(32);

                arrControls.forEach((control, index) => {
                    const bit = control[4];

                    if (bit >= 0 && this.checked[index]) power[bit >> 3] |= 1 << (bit & 7);
                });
                if (this.onSave) this.onSave(this.objectId, power);
            }
            this.setVisible(false);
        });
        layer.button(this.element, 131, 372, 76, 23, TEX_BUTTON, TEX_BUTTON_DOWN, null, manager.getSysString(SysString_T.Cancel), () => this.setVisible(false));
        this.paintChecks();
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, 0, Math.trunc(height * 0.5 - 252)); }

    public setVisible(visible: boolean) {
        this.element.hidden = !visible;
        if (!visible) {
            this.objectId = 0;
            this.mode = 0;
            this.power.fill(0);
            this.checked.fill(false);
            this.name.replaceChildren();
        }
        this.paintChecks();
    }

    public showFor(objectId: number, mode: number, memberName: string) {
        this.setVisible(false);
        this.objectId = objectId | 0;
        this.mode = mode;
        if (memberName.length) {
            this.layer.text(this.name, memberName, 0xffffff00, FontType_T.SMALL, 23, 54);
            this.layer.text(this.name, this.layer.getManager().getSysString(SysString_T.PrivilegesForMember), 0xffdcdcdc, FontType_T.SMALL, 23 + this.layer.measureText(memberName), 54);
        }
        this.setVisible(true);
        this.layer.activate(this.element);
        this.element.focus();
    }

    public setPower(power: Uint8Array) {
        if (power.length !== 32) throw new Error(`Invalid pledge privilege length: ${power.length}`);

        this.power.set(power);
        this.checked.fill(false);
        arrControls.forEach((control, index) => {
            const bit = control[4];

            if (bit >= 0) this.checked[index] = !!(power[bit >> 3] & (1 << (bit & 7)));
        });
        arrGroups.forEach(group => { this.checked[group[0]] = group.slice(1).some(index => this.checked[index]); });
        this.paintChecks();
    }

    protected paintChecks() {
        const readonly = this.mode === 1;

        this.controls.forEach((control, index) => {
            this.layer.setTile(this.faces[index], 12, 12, 0, 0, 12, 12, arrChecks[(readonly ? 2 : 0) + (this.checked[index] ? 1 : 0)]);
            this.layer.renderText(this.labels[index], this.layer.getManager().getSysString(arrControls[index][0]), readonly ? 0xff808080 : 0xffdcdcdc, FontType_T.SMALL);
            control.setAttribute("aria-checked", String(this.checked[index]));
            control.setAttribute("aria-readonly", String(readonly));
        });
    }
}

export default NCPledgePowerWnd;
