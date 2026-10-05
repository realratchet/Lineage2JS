import NWnd from "./nwnd";
import NCButton, { NCBUTTON_NO_OVER } from "./nc-button";
import type NWindowCanvas from "./nwindow-canvas";

export class NCTabButton extends NCButton { // NCTabButton (uclass 0x102b5350): paint 0x10002410 -> 0x10001000, state 0 selected [+0x200], 1 unselected [+0x204].
    public readonly labelId: number;
    public isSelected = false;

    public constructor(x: number, y: number, width: number, height: number, labelId: number, selectedTexture: string, unselectedTexture: string) {
        super(x, y, width, height, selectedTexture, unselectedTexture, null, NCBUTTON_NO_OVER);

        this.labelId = labelId;
        this.labelOffsetX = 2;
        this.labelOffsetY = 1;
    }

    protected getState(): 0 | 1 | 2 { return this.isSelected ? 0 : 1; }
}

export class NCTabControl extends NWnd { // AddTab 0x1002ded0: tabs laid left to right, gap 0; the first one starts selected (0x10001a50).
    public readonly tabs: NCTabButton[] = [];
    public selected = 0;
    public onSelect: (index: number) => void = null;

    public addTab(labelId: number, width: number, height: number, selectedTexture: string, unselectedTexture: string): NCTabButton {
        const index = this.tabs.length;
        const x = index ? this.tabs[index - 1].x + this.tabs[index - 1].width : 0;
        const tab = this.addChild(new NCTabButton(x, 0, width, height, labelId, selectedTexture, unselectedTexture));

        tab.isSelected = index === 0;
        tab.onPress = () => this.select(index);
        this.tabs.push(tab);

        return tab;
    }

    public select(index: number) {
        if (index === this.selected) return;

        this.selected = index;

        for (let i = 0; i < this.tabs.length; i++)
            this.tabs[i].isSelected = i === index;

        if (this.onSelect) this.onSelect(index);

        this.invalidate();
    }

    public onPaint(_canvas: NWindowCanvas) {
        for (const tab of this.tabs) tab.label = this.manager.getSysString(tab.labelId);
    }
}

export default NCTabControl;
