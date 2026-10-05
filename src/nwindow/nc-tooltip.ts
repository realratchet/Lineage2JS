import type NWnd from "./nwnd";
import type NWindowCanvas from "./nwindow-canvas";
import type NDomLayer from "./ndom";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";

const TEXT_COLOR = 0xffdcdcdc;
const TEX_SLICES = Array.from({ length: 9 }, (_, i) => `L2UI_ch3.Tooltip.Tooltip${i + 1}`);

export type TooltipInfo_T = { title: string; titleRuns?: { text: string; color: number }[]; lines: { label: string; value: string }[]; description: string; };
type TooltipLayout_T = { width: number; height: number; runs: { x: number; y: number; color: number; text: string }[]; };

export class NCTooltip { // Tooltip helper owned by every NCWnd ([wnd+0x8c], NCWnd::OnCreate 0x100360d6); nine 8x8 slices.
    public getTextures(): string[] { return TEX_SLICES; }

    public static skill(strings: GameStrings_T, id: number, level: number): TooltipInfo_T { // NWindow 0x100317f3: type, HP, MP, range, then the level-specific description.
        const info = strings.skillInfos[`${id}:${level}`];
        const lines: TooltipInfo_T["lines"] = [];

        if (info) {
            lines.push({ label: "", value: strings.sysStrings[info.type] });
            if (info.hpConsume) lines.push({ label: strings.sysStrings[1195], value: String(info.hpConsume) });
            if (info.mpConsume) lines.push({ label: strings.sysStrings[320], value: String(info.mpConsume) });
            if (info.range >= 0) lines.push({ label: strings.sysStrings[321], value: String(info.range) });
        }

        const name = info ? info.name : strings.skillNames[id], label = ` ${strings.sysStrings[88]} `;

        return { title: `${name}${label}${level}`, titleRuns: [{ text: name, color: TEXT_COLOR }, { text: label, color: 0xffa3a3a3 }, { text: String(level), color: 0xffb09b79 }], lines, description: info ? info.description : "" };
    }

    public static shortcutSkill(strings: GameStrings_T, id: number, level: number): TooltipInfo_T { // NWindow 0x1002fbb8: shortcut type 2 adds level and MP to the title.
        const info = this.skill(strings, id, level), skill = strings.skillInfos[`${id}:${level}`];

        info.lines = [];
        info.description = "";
        if (skill && skill.mpConsume > 0) {
            const text = ` (${strings.sysStrings[91]}:${skill.mpConsume})`;

            info.title += text;
            info.titleRuns.push({ text, color: TEXT_COLOR });
        }

        return info;
    }

    public static action(strings: GameStrings_T, id: number): TooltipInfo_T {
        const action = strings.actions[id];

        return { title: action.command, lines: [], description: action.name };
    }

    protected layout(canvas: NWindowCanvas, text: string | TooltipInfo_T): TooltipLayout_T {
        const info: TooltipInfo_T = typeof text === "string" ? { title: text, lines: [], description: "" } : text;
        const width = Math.ceil(Math.max(info.lines.length || info.description ? 144 : 0, canvas.measureText(info.title), ...info.lines.map(line => canvas.measureText(line.label ? `${line.label} : ${line.value}` : line.value))));
        const step = canvas.getLineHeight() + 6;
        const runs: TooltipLayout_T["runs"] = [];
        let titleX = 5;

        for (const run of info.titleRuns || [{ text: info.title, color: TEXT_COLOR }]) {
            runs.push({ x: titleX, y: 5, color: run.color, text: run.text });
            titleX += canvas.measureText(run.text);
        }
        let y = 5;

        info.lines.forEach(line => {
            y += step;
            let x = 5;

            if (line.label) {
                runs.push({ x, y, color: 0xffa3a3a3, text: line.label });
                x += canvas.measureText(line.label);
                runs.push({ x, y, color: TEXT_COLOR, text: " : " });
                x += canvas.measureText(" : ");
            }
            runs.push({ x, y, color: 0xffb09b79, text: line.value });
        });
        if (info.description) for (const paragraph of info.description.split("\n")) {
            let current = "";

            for (const word of paragraph.split(" ")) {
                const next = current ? `${current} ${word}` : word;

                if (current && canvas.measureText(next) > width) {
                    y += step;
                    runs.push({ x: 5, y, color: 0xffb2becf, text: current });
                    current = word;
                } else current = next;
            }
            y += step;
            runs.push({ x: 5, y, color: 0xffb2becf, text: current });
        }

        return { width: width + 10, height: y + canvas.getLineHeight() + 5, runs };
    }

    protected draw(layout: TooltipLayout_T, tile: (x: number, y: number, w: number, h: number, texture: string) => void, text: (x: number, y: number, color: number, value: string) => void) {
        const w = layout.width, h = layout.height;
        const widths = [8, w - 16, 8], heights = [8, h - 16, 8];
        const xs = [0, 8, w - 8], ys = [0, 8, h - 8];

        TEX_SLICES.forEach((texture, index) => tile(xs[index % 3], ys[Math.trunc(index / 3)], widths[index % 3], heights[Math.trunc(index / 3)], texture));
        layout.runs.forEach(run => text(run.x, run.y, run.color, run.text));
    }

    public bind(layer: NDomLayer, parent: HTMLElement, button: HTMLElement, info: string | TooltipInfo_T) {
        let tooltip: HTMLDivElement = null;
        const hide = () => { if (tooltip) { tooltip.remove(); tooltip = null; } };
        const show = () => {
            hide();
            const layout = this.layout(layer.getManager().canvas, info);
            const rect = button.getBoundingClientRect(), parentRect = parent.getBoundingClientRect();
            const x = Math.max(0, Math.min(layer.toUI(rect.left), layer.getManager().canvas.width - layout.width));
            let y = layer.toUI(rect.top) - layout.height;

            if (y < 0) y = layer.toUI(rect.top) + 32;
            tooltip = layer.createWindow(x - layer.toUI(parentRect.left), y - layer.toUI(parentRect.top), layout.width, layout.height, parent);
            tooltip.classList.add("ndom-opaque", "ndom-tooltip");
            tooltip.setAttribute("role", "tooltip");
            tooltip.setAttribute("aria-label", typeof info === "string" ? info : [info.title, ...info.lines.map(line => `${line.label} ${line.value}`), info.description].join("\n"));
            tooltip.style.zIndex = "2147483647";
            tooltip.style.pointerEvents = "none";
            this.draw(layout, (x, y, w, h, texture) => layer.tile(tooltip, x, y, w, h, 0, 0, 8, 8, texture), (x, y, color, text) => layer.text(tooltip, text, color, undefined, x, y));
        };

        button.addEventListener("mouseenter", show);
        button.addEventListener("mouseleave", hide);
        button.addEventListener("focus", show);
        button.addEventListener("blur", hide);
    }

    public paint(canvas: NWindowCanvas, wnd: NWnd, anchorX: number, anchorY: number, text: string | TooltipInfo_T) { // 0x10032560: above the anchor, flipped 32 px below at the top edge, clamped horizontally.
        if (!text) return;

        const layout = this.layout(canvas, text);
        const screenX = wnd.getScreenX(), screenY = wnd.getScreenY();
        const x = Math.max(-screenX, Math.min(anchorX, canvas.width - screenX - layout.width));
        const y = screenY + anchorY - layout.height < 0 ? anchorY + 32 : anchorY - layout.height;

        this.draw(layout, (tx, ty, w, h, texture) => canvas.drawTile(x + tx, y + ty, w, h, 0, 0, 8, 8, texture), (tx, ty, color, value) => canvas.drawText(x + tx, y + ty, color, value));
    }
}

export default NCTooltip;
