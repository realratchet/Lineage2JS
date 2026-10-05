import { FontType_T } from "./nwindow-canvas";
import { NDOM_EDIT_TEXTURES, NDomLayer, NDomButton_T, NDomEdit_T } from "./ndom";

export type PawnCreateStep_T = "race" | "class" | "sex" | "appearance";
export type PawnCreateSelection_T = { race: number, isMystic: boolean, sex: number, hairStyle: number, hairColor: number, face: number, step: PawnCreateStep_T };
export type PawnCreateTemplate_T = { race: number, classId: number };

const TEXT_COLOR = 0xffdcdcdc;
const BOTTOM_STRIP = 52;
const RACE_DWARF = 4;

const TEX_SETUP_BACK = "L2UI_CH3.LobbyWnd.select2_back";
const TEX_TEXTBACKLINE = "L2UI_CH3.Etc.textbackline";
const TEX_MENU_BACK = "L2UI_CH3.LobbyWnd.lobby_menuback";
const TEX_TEXTBOX1 = "L2UI_CH3.Etc.textbox1";
const TEX_TEXTBOX2 = "L2UI_CH3.Etc.textbox2";
const TEX_TEXTBOX3 = "L2UI_CH3.Etc.textbox3";
const TEX_PREV = "L2UI_CH3.Button.PREV1";
const TEX_PREV_DOWN = "L2UI_CH3.Button.PREV1_down";
const TEX_NEXT = "L2UI_CH3.Button.NEXT1";
const TEX_NEXT_DOWN = "L2UI_CH3.Button.NEXT1_down";
const TEX_BIGBUTTON = "L2UI_CH3.Button.BigButton";
const TEX_BIGBUTTON_DOWN = "L2UI_CH3.Button.BigButton_down";
const TEX_LEFT = "l2ui.LobbyWnd.left";
const TEX_LEFT_DOWN = "l2ui.LobbyWnd.left_click";
const TEX_RIGHT = "l2ui.LobbyWnd.right";
const TEX_RIGHT_DOWN = "l2ui.LobbyWnd.right_click";
const TEX_ZOOMIN = "l2ui.LobbyWnd.zoomin";
const TEX_ZOOMIN_DOWN = "l2ui.LobbyWnd.zoomin_click";
const TEX_ZOOMOUT = "l2ui.LobbyWnd.zoomout";
const TEX_ZOOMOUT_DOWN = "l2ui.LobbyWnd.zoomout_click";

const RACE_OPTIONS = [170, 171, 172, 173, 174]; // NCPawnSetupWnd init 0x100ce9c0 / sex pick 0x100ceff0: sysstring ids per selector.
const CLASS_OPTIONS = [175, 176];
const SEX_OPTIONS = [177, 178];
const HAIR_STYLE_MALE = [179, 180, 181, 182, 186];
const HAIR_STYLE_FEMALE = [179, 180, 181, 182, 186, 187, 803];
const HAIR_COLOR_OPTIONS = [179, 180, 181, 182];
const FACE_OPTIONS = [179, 180, 181];

const BASE_CLASS_IDS = [[0, 10], [18, 25], [31, 38], [44, 49], [53]]; // 0x100cc610: base class id per race, fighter / mystic.

export class NCSelectCtrl { // NCSelectCtrl OnCreate 0x100ce7b0, OnPaint 0x100cc980: "value < >" selector, arrows wrap the index.
    public readonly element: HTMLDivElement;
    public onChange: (index: number) => void = null;
    protected readonly layer: NDomLayer;
    protected readonly caption: HTMLCanvasElement;
    protected readonly prevButton: NDomButton_T;
    protected readonly nextButton: NDomButton_T;
    protected options: number[] = [];
    protected index = -1;
    protected isEnabled = true;

    public constructor(layer: NDomLayer, parent: HTMLElement, x: number, y: number, width: number, height: number) {
        this.layer = layer;
        this.element = layer.createWindow(x, y, width, height, parent);

        layer.tile(this.element, 0, 0, 8, 17, 0, 0, 8, 17, TEX_TEXTBOX1);
        layer.tile(this.element, 8, 0, width - 54, 17, 0, 0, 8, 17, TEX_TEXTBOX2);
        layer.tile(this.element, width - 46, 0, 8, 17, 0, 0, 8, 17, TEX_TEXTBOX3);
        this.caption = layer.text(this.element, "", TEXT_COLOR, FontType_T.SMALL, 3, 3);
        this.caption.hidden = true;
        this.prevButton = layer.button(this.element, width - 33, 1, 15, 15, TEX_PREV, TEX_PREV_DOWN, TEX_PREV, null, () => this.step(-1));
        this.nextButton = layer.button(this.element, width - 15, 1, 15, 15, TEX_NEXT, TEX_NEXT_DOWN, TEX_NEXT, null, () => this.step(1));
    }

    public getCount() { return this.options.length; }

    public setOptions(options: number[]) { this.options = options; }

    public setIndex(index: number) {
        this.index = index;
        this.caption.hidden = index < 0 || index >= this.options.length;

        if (!this.caption.hidden) this.layer.renderText(this.caption, this.layer.getManager().getSysString(this.options[index]), TEXT_COLOR);
    }

    public setEnabled(isEnabled: boolean) {
        this.isEnabled = isEnabled;
        this.prevButton.setEnabled(isEnabled);
        this.nextButton.setEnabled(isEnabled);
    }

    protected step(direction: number) { // slot75 0x100cc2e0 / slot76 0x100cc330
        const count = this.options.length;

        if (count === 0 || !this.isEnabled) return;

        let index = this.index + direction;

        if (index < 0) index = count - 1;
        if (index >= count) index = 0;

        this.setIndex(index);

        if (this.onChange) this.onChange(index);
    }
}

export class NCPawnSetupWnd { // NCPawnSetupWnd OnCreate 0x100cf680, OnPaint 0x100cce00: (24,27) 256x205 name / race / class / gender / hair / face form.
    public readonly element: HTMLDivElement;
    public readonly nameEdit: NDomEdit_T;
    public onPick: (step: PawnCreateStep_T) => void = null;
    public race = -1;
    public classType = -1;
    public sex = -1;
    public hairStyle = -1;
    public hairColor = -1;
    public face = -1;
    protected readonly raceCtrl: NCSelectCtrl;
    protected readonly classCtrl: NCSelectCtrl;
    protected readonly sexCtrl: NCSelectCtrl;
    protected readonly hairStyleCtrl: NCSelectCtrl;
    protected readonly hairColorCtrl: NCSelectCtrl;
    protected readonly faceCtrl: NCSelectCtrl;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        const manager = layer.getManager();

        this.element = layer.createWindow(24, 27, 256, 205, parent);
        this.element.style.pointerEvents = "auto";

        layer.tile(this.element, 0, 0, 256, 205, 0, 0, 256, 205, TEX_SETUP_BACK);
        [[872, 20], [164, 55], [165, 79], [166, 103], [167, 127], [168, 151], [169, 175]].forEach(([id, y]) => layer.text(this.element, manager.getSysString(id), TEXT_COLOR, FontType_T.SMALL, 33, y));

        this.nameEdit = layer.edit(this.element, 66, 17, 128, 17);
        this.raceCtrl = new NCSelectCtrl(layer, this.element, 86, 52, 136, 17);
        this.classCtrl = new NCSelectCtrl(layer, this.element, 86, 76, 136, 17);
        this.sexCtrl = new NCSelectCtrl(layer, this.element, 86, 100, 136, 17);
        this.hairStyleCtrl = new NCSelectCtrl(layer, this.element, 86, 124, 136, 17);
        this.hairColorCtrl = new NCSelectCtrl(layer, this.element, 86, 148, 136, 17);
        this.faceCtrl = new NCSelectCtrl(layer, this.element, 86, 172, 136, 17);

        this.raceCtrl.setOptions(RACE_OPTIONS);
        this.classCtrl.setOptions(CLASS_OPTIONS);
        this.sexCtrl.setOptions(SEX_OPTIONS);
        this.hairStyleCtrl.setOptions(HAIR_STYLE_FEMALE);
        this.hairColorCtrl.setOptions(HAIR_COLOR_OPTIONS);
        this.faceCtrl.setOptions(FACE_OPTIONS);
        this.setEnabled(1);

        this.raceCtrl.onChange = index => this.pickRace(index);
        this.classCtrl.onChange = index => this.pickClass(index);
        this.sexCtrl.onChange = index => this.pickSex(index);
        this.hairStyleCtrl.onChange = index => { this.hairStyle = index; this.pick("appearance"); };
        this.hairColorCtrl.onChange = index => { this.hairColor = index; this.pick("appearance"); };
        this.faceCtrl.onChange = index => { this.face = index; this.pick("appearance"); };
    }

    protected setEnabled(count: number) {
        [this.raceCtrl, this.classCtrl, this.sexCtrl, this.hairStyleCtrl, this.hairColorCtrl, this.faceCtrl].forEach((ctrl, index) => ctrl.setEnabled(index < count));
    }

    protected syncIndices() { // 0x100cec35: each selector shows its value, or nothing when the value is past its list.
        const pairs: [NCSelectCtrl, number][] = [[this.raceCtrl, this.race], [this.classCtrl, this.classType], [this.sexCtrl, this.sex], [this.hairStyleCtrl, this.hairStyle], [this.hairColorCtrl, this.hairColor], [this.faceCtrl, this.face]];

        for (const [ctrl, value] of pairs)
            ctrl.setIndex(value < ctrl.getCount() ? value : -1);
    }

    protected pick(step: PawnCreateStep_T) {
        if (this.onPick) this.onPick(step);
    }

    protected pickRace(race: number) { // slot74 0x100ceba0
        this.race = race;
        this.classType = this.sex = this.hairStyle = this.hairColor = this.face = -1;
        this.classCtrl.setOptions(race === RACE_DWARF ? [CLASS_OPTIONS[0]] : CLASS_OPTIONS);
        this.syncIndices();
        this.setEnabled(2);
        this.pick("race");
    }

    protected pickClass(classType: number) { // slot75 0x100ced90
        this.classType = classType;
        this.sex = this.hairStyle = this.hairColor = this.face = -1;
        this.syncIndices();
        this.setEnabled(3);
        this.pick("class");
    }

    protected pickSex(sex: number) { // slot76 0x100ceff0
        this.sex = sex;
        this.hairStyle = this.hairColor = this.face = 0;
        this.hairStyleCtrl.setOptions(sex === 0 ? HAIR_STYLE_MALE : HAIR_STYLE_FEMALE);
        this.syncIndices();
        this.setEnabled(6);
        this.pick("sex");
    }

    public getSelection(step: PawnCreateStep_T): PawnCreateSelection_T {
        return { race: this.race, isMystic: this.classType === 1, sex: this.sex, hairStyle: this.hairStyle, hairColor: this.hairColor, face: this.face, step };
    }
}

export class NCPawnInfoWnd { // NCPawnInfoWnd OnCreate 0x100ccc10, OnPaint 0x100ccc70: (24,249) 256x205 class description box.
    public readonly element: HTMLDivElement;

    public constructor(layer: NDomLayer, parent: HTMLElement) {
        this.element = layer.createWindow(24, 249, 256, 205, parent);
        this.element.style.pointerEvents = "auto";

        layer.tile(this.element, 0, 0, 256, 205, 0, 0, 256, 205, TEX_SETUP_BACK);

        for (let i = 1; i < 13; i += 2)
            layer.tile(this.element, 5, i * 15 + 5, 256 - 10, 15, 0, 0, 8, 15, TEX_TEXTBACKLINE); // TODO: description text (7,7) comes from GL2GameData+0xaa05c + n*12, table not resolved

    }
}

export class NCPawnCreateFunctionWnd { // NCPawnCreateFunctionWnd OnCreate 0x100cbfb0, OnPaint 0x100cbd40: 120x138 menu with Create Character / Previous.
    public readonly element: HTMLDivElement;

    public constructor(layer: NDomLayer, parent: HTMLElement, onCreate: () => void, onBack: () => void) {
        const manager = layer.getManager();

        this.element = layer.createWindow(0, 0, 120, 138, parent);
        this.element.style.pointerEvents = "auto";

        layer.tile(this.element, 0, 0, 120, 138, 0, 0, 120, 138, TEX_MENU_BACK);
        layer.button(this.element, 13, 20, 96, 23, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, null, manager.getSysString(162), onCreate);
        layer.button(this.element, 13, 45, 96, 23, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, null, manager.getSysString(161), onBack);
    }
}

export class NCPawnCreateWnd { // NCPawnCreateWnd OnCreate 0x100cfbd0: character create root, (0,0) ScreenX x ScreenY-52, no paint of its own.
    public static getTextures(): string[] { return [TEX_SETUP_BACK, TEX_TEXTBACKLINE, TEX_MENU_BACK, TEX_TEXTBOX1, TEX_TEXTBOX2, TEX_TEXTBOX3, TEX_PREV, TEX_PREV_DOWN, TEX_NEXT, TEX_NEXT_DOWN, TEX_BIGBUTTON, TEX_BIGBUTTON_DOWN, `?${TEX_BIGBUTTON}_over`, TEX_LEFT, TEX_LEFT_DOWN, TEX_RIGHT, TEX_RIGHT_DOWN, TEX_ZOOMIN, TEX_ZOOMIN_DOWN, TEX_ZOOMOUT, TEX_ZOOMOUT_DOWN, ...NDOM_EDIT_TEXTURES]; }

    public readonly element: HTMLDivElement;
    public onChange: (selection: PawnCreateSelection_T) => void = null;
    public onRotate: (direction: number) => void = null;
    public onZoom: (isIn: boolean) => void = null;
    public onCreate: (name: string, selection: PawnCreateSelection_T) => void = null;
    public onBack: () => void = null;
    protected readonly layer: NDomLayer;
    protected readonly setup: NCPawnSetupWnd;
    protected readonly info: NCPawnInfoWnd;
    protected readonly functionWnd: NCPawnCreateFunctionWnd;
    protected readonly leftButton: NDomButton_T;
    protected readonly rightButton: NDomButton_T;
    protected readonly zoomInButton: NDomButton_T;
    protected readonly zoomOutButton: NDomButton_T;
    protected templates: PawnCreateTemplate_T[] = [];
    protected step: PawnCreateStep_T = "race";
    protected isZoomed = false;

    public constructor(layer: NDomLayer) {
        this.layer = layer;
        this.element = layer.createWindow(0, 0, 0, 0);
        this.element.style.pointerEvents = "none";

        this.setup = new NCPawnSetupWnd(layer, this.element);
        this.info = new NCPawnInfoWnd(layer, this.element);
        this.functionWnd = new NCPawnCreateFunctionWnd(layer, this.element, () => this.create(), () => { if (this.onBack) this.onBack(); });

        this.leftButton = this.createRoundButton(TEX_LEFT, TEX_LEFT_DOWN, null); // flag 2 buttons (0x100cfd77): no implicit '_over' texture
        this.rightButton = this.createRoundButton(TEX_RIGHT, TEX_RIGHT_DOWN, null);
        this.zoomInButton = this.createRoundButton(TEX_ZOOMIN, TEX_ZOOMIN_DOWN, () => this.toggleZoom());
        this.zoomOutButton = this.createRoundButton(TEX_ZOOMOUT, TEX_ZOOMOUT_DOWN, () => this.toggleZoom());

        this.bindRotate(this.leftButton, 2); // NCExButton notifies press and release: slot74 0x100cc8d0 turn +2.0, slot75 0x100cc910 turn -2.0, release stops
        this.bindRotate(this.rightButton, -2);
        this.showControls(false);

        this.setup.onPick = step => this.pick(step);
    }

    protected createRoundButton(normal: string, down: string, onPress: () => void): NDomButton_T {
        const button = this.layer.button(this.element, 0, 0, 44, 44, normal, down, normal, null, onPress);

        button.style.pointerEvents = "auto";

        return button;
    }

    protected bindRotate(button: NDomButton_T, direction: number) {
        button.addEventListener("mousedown", event => {
            if (event.button !== 0) return;
            if (this.onRotate) this.onRotate(direction);

            window.addEventListener("mouseup", () => { if (this.onRotate) this.onRotate(0); }, { once: true });
        });
    }

    protected showControls(isShown: boolean) { // 0x100cc7e0: round buttons appear once race, class and gender are chosen; hiding clears the zoom.
        if (!isShown) this.isZoomed = false;

        this.leftButton.hidden = !isShown;
        this.rightButton.hidden = !isShown;
        this.zoomInButton.hidden = !isShown || this.isZoomed;
        this.zoomOutButton.hidden = !isShown || !this.isZoomed;
    }

    protected toggleZoom() { // slot76 0x100ce610
        this.isZoomed = !this.isZoomed;
        this.showControls(true);

        if (this.onZoom) this.onZoom(this.isZoomed);
    }

    protected pick(step: PawnCreateStep_T) {
        this.step = step;

        if (step !== "appearance") this.showControls(step === "sex");
        if (this.onChange) this.onChange(this.setup.getSelection(step));
    }

    protected create() { // slot78 0x100ce4e0
        if (this.onCreate) this.onCreate(this.setup.nameEdit.getValue(), this.setup.getSelection(this.step));
    }

    public placeOnScreen(screenWidth: number, screenHeight: number) { // NCWnd::MoveChildWindow 0x100351d0: round buttons anchored bottom-centre at dy -56, menu bottom-right (-34,-10).
        const width = screenWidth, height = screenHeight - BOTTOM_STRIP;
        const centre = Math.trunc(width / 2 - 44 / 2), y = height - 44 - 56;

        this.layer.place(this.element, 0, 0, width, height);
        this.layer.place(this.leftButton, centre - 66, y);
        this.layer.place(this.zoomInButton, centre, y);
        this.layer.place(this.zoomOutButton, centre, y);
        this.layer.place(this.rightButton, centre + 66, y);
        this.layer.place(this.functionWnd.element, width - 120 - 34, height - 138 - 10);
    }

    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }

    public setTemplates(templates: PawnCreateTemplate_T[]) { this.templates = templates; }

    public getTemplate(selection: PawnCreateSelection_T): PawnCreateTemplate_T {
        const classId = BASE_CLASS_IDS[selection.race][selection.isMystic ? 1 : 0];
        const template = this.templates.find(entry => entry.classId === classId);

        if (!template) throw new Error(`No character template for race ${selection.race} class ${classId}.`);

        return template;
    }
}

export default NCPawnCreateWnd;
