import type NDomLayer from "./ndom";

const arrTextures = ["L2UI_CH3.MenuIcon.MenuButton1", "L2UI_CH3.MenuIcon.MenuButton2", "L2UI_CH3.MenuIcon.MenuButton3", "L2UI_CH3.MenuIcon.MenuButton4"];
const arrBack = ["L2UI_CH3.SmallWnd.Smallwindow_back1", "L2UI_CH3.SmallWnd.Smallwindow_back2", "L2UI_CH3.SmallWnd.Smallwindow_back3"];
const arrGrip = ["L2UI_CH3.FrameCtrl.smallbar1", "L2UI_CH3.FrameCtrl.smallbar2", "L2UI_CH3.FrameCtrl.smallbar3"];
const arrLabels = [434, 195, 925, 193];
export type MenuButton_T = "characterStatus" | "inventory" | "map" | "system";
const arrButtons: MenuButton_T[] = ["characterStatus", "inventory", "map", "system"];

export class NCMenuWnd {
    public static getTextures() { return [...arrBack, ...arrGrip, ...arrTextures.flatMap(path => [path, `${path}_down`, `?${path}_over`])]; }
    public readonly element: HTMLDivElement;
    public onSelect: (button: MenuButton_T) => void = null;
    protected readonly layer: NDomLayer;

    public constructor(layer: NDomLayer) {
        this.layer = layer;
        this.element = layer.createWindow(0, 0, 173, 46);
        this.element.classList.add("ndom-opaque"); // NCConsole 0x100617f6 creates NCMenuWnd with style 0x85002; bit 0x80000 skips TransparencyMode.
        this.element.hidden = true;
        this.element.setAttribute("role", "toolbar");
        this.element.setAttribute("aria-label", "Game menu");

        // NCMenuWnd::OnCreate 0x100a9290 / OnDestroy 0x100a9650.
        const grip = layer.createWindow(0, 0, 12, 46, this.element); // NCFrameCtrl grip in the 12px strip left of the back slices (L2.4_20 capture).

        layer.tile(grip, 0, 0, 12, 8, 0, 0, 12, 8, arrGrip[0]);
        layer.tile(grip, 0, 8, 12, 30, 0, 0, 12, 8, arrGrip[1]);
        layer.tile(grip, 0, 38, 12, 8, 0, 0, 12, 8, arrGrip[2]);
        grip.addEventListener("mousedown", event => {
            if (event.button !== 0) return;

            event.preventDefault();

            const x = layer.toUI(event.clientX) - this.element.offsetLeft, y = layer.toUI(event.clientY) - this.element.offsetTop;

            layer.beginDrag(e => layer.place(this.element, layer.toUI(e.clientX) - x, layer.toUI(e.clientY) - y));
        });

        layer.tile(this.element, 12, 0, 16, 46, 0, 0, 16, 46, arrBack[0]);
        layer.tile(this.element, 28, 0, 129, 46, 0, 0, 16, 46, arrBack[1]);
        layer.tile(this.element, 157, 0, 16, 46, 0, 0, 16, 46, arrBack[2]);

        arrTextures.forEach((path, index) => {
            const label = layer.getManager().getSysString(arrLabels[index]);
            const select = () => { if (this.onSelect) this.onSelect(arrButtons[index]); };
            const button = layer.button(this.element, 19 + index * 37, 6, 34, 34, path, `${path}_down`, null, null, select);

            button.title = label;
            button.tabIndex = 0;
            button.setAttribute("role", "button");
            button.setAttribute("aria-label", label);
            button.addEventListener("keydown", event => {
                if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                layer.getManager().playButtonSound(true);
                select();
            });
        });
    }

    public placeOnScreen(width: number, height: number) { this.layer.place(this.element, width - 173, height - 46); }
    public setVisible(visible: boolean) { this.element.hidden = !visible; }
}

export default NCMenuWnd;
