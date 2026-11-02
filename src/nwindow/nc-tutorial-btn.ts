import NDomLayer, { type NDomButton_T } from "./ndom";

const TEX_NORMAL = "L2UI_ch3.ConsoleBtn.TutorialBtn";
const TEX_DOWN = "L2UI_ch3.ConsoleBtn.TutorialBtn_down";
const TEX_LIGHT = "L2UI_ch3.ConsoleBtn.TutorialBtn_light";
const BLINK_PERIOD = 500;

export class NCTutorialBtn { // NConsole OnCreate 0x100624c0: ctor 0x10003c00, rect (5, H-224, 32x32); blink timer 0xf0e0f0 0x10002120
    public static getTextures(): string[] { return [TEX_NORMAL, TEX_DOWN, TEX_LIGHT]; }

    public readonly element: NDomButton_T;
    public onPress: (id: number) => void = null;
    protected id = 0;
    protected timer = 0;
    protected isLight = false;

    public constructor(protected readonly layer: NDomLayer) {
        this.element = layer.button(layer.root, 5, 0, 32, 32, TEX_NORMAL, TEX_DOWN, TEX_NORMAL, null, () => { // 0x10002918: RequestTutorialQuestionMark with +0x2c4, then hide
            this.hide();
            if (this.onPress) this.onPress(this.id);
        });
        this.element.hidden = true;
    }

    public placeOnScreen(_screenWidth: number, screenHeight: number) { this.layer.place(this.element, 5, screenHeight - 187 - 32 - 5); }

    public show(id: number, chatTop: number) { // NConsole::ShowTutorialQuestionMark 0x10068f20, reposition 0x1005cf40
        this.id = id;
        this.timer = BLINK_PERIOD;
        this.setLight(false);
        this.layer.place(this.element, 5, chatTop - 37);
        this.element.hidden = false;
        this.layer.activate(this.element);
    }

    public tick(deltaMs: number) {
        if (this.element.hidden) return;

        this.timer -= deltaMs;
        if (this.timer > 0) return;

        while (this.timer <= 0) this.timer += BLINK_PERIOD;
        this.setLight(!this.isLight);
    }

    protected setLight(isLight: boolean) {
        this.isLight = isLight;
        this.element.setTextures(isLight ? TEX_LIGHT : TEX_NORMAL, TEX_DOWN, isLight ? TEX_LIGHT : TEX_NORMAL);
    }

    public isVisible() { return !this.element.hidden; }
    public hide() { this.element.hidden = true; }
    public setVisible(isVisible: boolean) { this.element.hidden = !isVisible; }
}

export default NCTutorialBtn;
