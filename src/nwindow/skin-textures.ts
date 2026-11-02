export const SKIN_SLOTS = {
    frameLeft: "L2UI_CH3.FrameCtrl.FrameBackLeft",
    frameMid: "L2UI_CH3.FrameCtrl.FrameBackMid",
    frameRight: "L2UI_CH3.FrameCtrl.FrameBackRight",
    frameClose: "L2UI_CH3.FrameCtrl.FrameCloseBtn",
    frameCloseDown: "L2UI_CH3.FrameCtrl.FrameCloseOnBtn",
    frameMinimize: "L2UI_CH3.FrameCtrl.FrameMiniBtn",
    frameMinimizeDown: "L2UI_CH3.FrameCtrl.FrameMiniOnBtn",
    button: "L2UI_CH3.Button.Btn1_normal",
    buttonDown: "L2UI_CH3.Button.Btn1_normalOn",
    smallButton: "L2UI_CH3.Button.SmallButton2",
    smallButtonDown: "L2UI_CH3.Button.SmallButton2_down",
    bigButton: "L2UI_CH3.Button.BigButton",
    bigButtonDown: "L2UI_CH3.Button.BigButton_down",
    edit1: "L2UI_CH3.Etc.inputbox1",
    edit2: "L2UI_CH3.Etc.inputbox2",
    edit3: "L2UI_CH3.Etc.inputbox3",
    edit1Disabled: "L2UI_CH3.Etc.inputbox1_disable",
    edit2Disabled: "L2UI_CH3.Etc.inputbox2_disable",
    edit3Disabled: "L2UI_CH3.Etc.inputbox3_disable",
    scrollUp: "L2UI_CH3.ScrollBar.ScrollBarUpBtn",
    scrollUpDown: "L2UI_CH3.ScrollBar.ScrollBarUpOnBtn",
    scrollDown: "L2UI_CH3.ScrollBar.ScrollBarDownBtn",
    scrollDownDown: "L2UI_CH3.ScrollBar.ScrollBarDownOnBtn",
    scrollThumbTop: "L2UI_CH3.ScrollBar.SliderBarTop",
    scrollThumbCenter: "L2UI_CH3.ScrollBar.SliderBarCenter",
    scrollThumbBottom: "L2UI_CH3.ScrollBar.SliderBarBottom",
    checkBox: "L2UI.Control.CheckBox",
    checkBoxChecked: "L2UI.ActionWnd.CheckBox_checked",
    listSelect: "L2UI_CH3.ListCtrl.TextSelect",
    listSelectEnd: "L2UI_CH3.ListCtrl.TextSelect2",
    tooltip1: "L2UI_ch3.Tooltip.Tooltip1",
    tooltip2: "L2UI_ch3.Tooltip.Tooltip2",
    tooltip3: "L2UI_ch3.Tooltip.Tooltip3",
    tooltip4: "L2UI_ch3.Tooltip.Tooltip4",
    tooltip5: "L2UI_ch3.Tooltip.Tooltip5",
    tooltip6: "L2UI_ch3.Tooltip.Tooltip6",
    tooltip7: "L2UI_ch3.Tooltip.Tooltip7",
    tooltip8: "L2UI_ch3.Tooltip.Tooltip8",
    tooltip9: "L2UI_ch3.Tooltip.Tooltip9"
} as const;

export type SkinSlot_T = keyof typeof SKIN_SLOTS;
export type SkinDefinition_T = { slots?: Partial<Record<SkinSlot_T, string>>, textures?: Record<string, string> };

export class SkinTextures { // a source is a UI package path ("Pkg.Group.Name") or an image url, and must keep the replaced texture's size
    protected readonly sources = new Map<string, string>();

    public constructor(definition: SkinDefinition_T = {}) {
        for (const [slot, source] of Object.entries(definition.slots || {})) this.setSlot(slot as SkinSlot_T, source);
        for (const [texture, source] of Object.entries(definition.textures || {})) this.setTexture(texture, source);
    }

    public setSlot(slot: SkinSlot_T, source: string) { this.setTexture(SKIN_SLOTS[slot], source); }
    public setTexture(texture: string, source: string) { this.sources.set(texture.toLowerCase(), source); }
    public resolve(texture: string) { return this.sources.get(texture.toLowerCase()) ?? texture; }
}

export function isSkinImageUrl(source: string) { return /\.(png|jpe?g|webp|gif)$/i.test(source); }

export default SkinTextures;
