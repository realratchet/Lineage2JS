import type NWindowCanvas from "./nwindow-canvas";
import type NDomLayer from "./ndom";
import type { GameStrings_T } from "../assets/decode-worker/decode-protocol";
import { SKIN_SLOTS } from "./skin-textures";
import SysString_T from "./sys-string";

const TEXT_COLOR = 0xffdcdcdc;
export const TEX_TOOLTIP_SLICES = [SKIN_SLOTS.tooltip1, SKIN_SLOTS.tooltip2, SKIN_SLOTS.tooltip3, SKIN_SLOTS.tooltip4, SKIN_SLOTS.tooltip5, SKIN_SLOTS.tooltip6, SKIN_SLOTS.tooltip7, SKIN_SLOTS.tooltip8, SKIN_SLOTS.tooltip9];

export type TooltipInfo_T = { title: string; extentTitle?: string; titleRuns?: { text: string; color: number; gap?: number }[]; lines: { label: string; value: string }[]; description: string; minimumWidth?: number; };
type TooltipLayout_T = { width: number; height: number; runs: { x: number; y: number; color: number; text: string }[]; };

export class NCTooltip { // Tooltip helper owned by every NCWnd ([wnd+0x8c], NCWnd::OnCreate 0x100360d6); nine 8x8 slices.
    public getTextures(): string[] { return TEX_TOOLTIP_SLICES; }

    public static skill(strings: GameStrings_T, id: number, level: number): TooltipInfo_T { // NWindow 0x100317f3: type, HP, MP, range, then the level-specific description.
        const info = strings.skillInfos[`${id}:${level}`];
        const lines: TooltipInfo_T["lines"] = [];

        if (info) {
            lines.push({ label: "", value: strings.sysStrings[info.type] });
            if (info.hpConsume) lines.push({ label: strings.sysStrings[SysString_T.HPCost], value: String(info.hpConsume) });
            if (info.mpConsume) lines.push({ label: strings.sysStrings[SysString_T.MPCost], value: String(info.mpConsume) });
            if (info.range >= 0) lines.push({ label: strings.sysStrings[SysString_T.Range], value: String(info.range) });
        }

        const name = info ? info.name : strings.skillNames[id], label = ` ${strings.sysStrings[SysString_T.Level]} `;

        return { title: `${name}${label}${level}`, titleRuns: [{ text: name, color: TEXT_COLOR }, { text: label, color: 0xffa3a3a3 }, { text: String(level), color: 0xffb09b79 }], lines, description: info ? info.description : "", minimumWidth: 144 };
    }

    public static shortcutSkill(strings: GameStrings_T, id: number, level: number): TooltipInfo_T { // NWindow 0x1002fbb8: shortcut type 2 adds level and MP to the title.
        const info = this.skill(strings, id, level), skill = strings.skillInfos[`${id}:${level}`];

        info.lines = [];
        info.description = "";
        info.minimumWidth = 0;
        if (skill && skill.mpConsume > 0) {
            const text = ` (${strings.sysStrings[SysString_T.MP]}:${skill.mpConsume})`;

            info.title += text;
            info.titleRuns.push({ text, color: TEXT_COLOR });
        }

        return info;
    }

    public static action(strings: GameStrings_T, id: number): TooltipInfo_T {
        const action = strings.actions[id];

        return { title: action.command, lines: [], description: action.name };
    }

    public static abnormal(strings: GameStrings_T, id: number, level: number, remaining: number, isSecondary = false): TooltipInfo_T {
        const skill = strings.skillInfos[`${id}:${level}`], name = skill ? skill.name : "", addName = !isSecondary && skill && skill.isEnchanted ? skill.enchantName : "", shownLevel = addName ? skill.enchantSkillLevel : level;
        const titleRuns: TooltipInfo_T["titleRuns"] = [{ text: name, color: TEXT_COLOR }];
        const lines: TooltipInfo_T["lines"] = [];
        let title = name;

        if (addName) {
            title += ` ${addName}`;
            titleRuns.push({ text: addName, color: 0xffffd969, gap: 5 });
        }
        if (shownLevel > 0) {
            const label = ` ${strings.sysStrings[SysString_T.Level]} `;

            title += `${label}${shownLevel}`;
            titleRuns.push({ text: label, color: 0xffa3a3a3 }, { text: String(shownLevel), color: 0xffb09b79 });
        }
        if (remaining >= 0) {
            const seconds = remaining % (24 * 60 * 60), hours = Math.trunc(seconds / 3600), minutes = Math.trunc(seconds % 3600 / 60);
            const value = hours > 0 ? `${hours}${strings.sysStrings[SysString_T.Hours]}` : minutes > 0 ? `${minutes}${strings.sysStrings[SysString_T.Minutes]}` : `${seconds % 60}초`;

            lines.push({ label: strings.sysStrings[SysString_T.RemainingTime], value });
        }

        const extentTitle = `${name}${addName ? ` ${addName}` : ""}${level > 0 ? ` ${strings.sysStrings[SysString_T.Level]} ${level}` : ""}`;

        return { title, extentTitle, titleRuns, lines, description: skill ? skill.description : "", minimumWidth: 144 };
    }

    protected layout(canvas: NWindowCanvas, text: string | TooltipInfo_T): TooltipLayout_T {
        if (typeof text === "string") {
            const lines = text.split("\n");

            return { width: Math.max(...lines.map(line => canvas.measureText(line))) + 10, height: lines.length * canvas.getLineHeight() + 10, runs: [{ x: 5, y: 5, color: TEXT_COLOR, text }] };
        }

        const info = text;
        const width = Math.ceil(Math.max(info.minimumWidth || 0, info.lines.length || info.description ? 144 : 0, canvas.measureText(info.extentTitle ?? info.title)));
        const step = canvas.getLineHeight() + 6;
        const runs: TooltipLayout_T["runs"] = [];
        let titleX = 5;

        for (const run of info.titleRuns || [{ text: info.title, color: TEXT_COLOR }]) {
            titleX += run.gap || 0;
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
        if (info.description) for (const line of canvas.wrapText(info.description.replace(/\\n/g, "\n"), width)) {
            y += step;
            runs.push({ x: 5, y, color: 0xffb2becf, text: line });
        }

        return { width: width + 10, height: y + canvas.getLineHeight() + 5, runs };
    }

    protected draw(layout: TooltipLayout_T, tile: (x: number, y: number, w: number, h: number, texture: string) => void, text: (x: number, y: number, color: number, value: string) => void) {
        const w = layout.width, h = layout.height;
        const widths = [8, w - 16, 8], heights = [8, h - 16, 8];
        const xs = [0, 8, w - 8], ys = [0, 8, h - 8];

        TEX_TOOLTIP_SLICES.forEach((texture, index) => tile(xs[index % 3], ys[Math.trunc(index / 3)], widths[index % 3], heights[Math.trunc(index / 3)], texture));
        layout.runs.forEach(run => text(run.x, run.y, run.color, run.text));
    }

    public createDOM(layer: NDomLayer, parent: HTMLElement, anchorX: number, anchorY: number, info: string | TooltipInfo_T, topOffset = 32) {
        const layout = this.layout(layer.getManager().canvas, info);
        const parentRect = parent.getBoundingClientRect();
        const x = Math.max(0, Math.min(anchorX, layer.getManager().canvas.width - layout.width));
        let y = anchorY - layout.height;

        if (y < 0) y = anchorY + topOffset;
        const tooltip = layer.createWindow(x - layer.toUI(parentRect.left), y - layer.toUI(parentRect.top), layout.width, layout.height, parent);
        tooltip.classList.add("ndom-opaque", "ndom-tooltip");
        tooltip.setAttribute("role", "tooltip");
        tooltip.setAttribute("aria-label", typeof info === "string" ? info : [info.title, ...info.lines.map(line => `${line.label} ${line.value}`), info.description].join("\n"));
        tooltip.style.zIndex = "2147483647";
        tooltip.style.pointerEvents = "none";
        this.draw(layout, (x, y, w, h, texture) => layer.tile(tooltip, x, y, w, h, 0, 0, 8, 8, texture), (x, y, color, text) => layer.text(tooltip, text, color, undefined, x, y));

        return tooltip;
    }

    public bind(layer: NDomLayer, parent: HTMLElement, button: HTMLElement, info: string | TooltipInfo_T, topOffset = 32) { // 0x10032560 uses 32 at the top edge; NCButton's 0x10032860 uses 0.
        let tooltip: HTMLDivElement = null;
        const hide = () => { if (tooltip) { tooltip.remove(); tooltip = null; } };
        const show = () => {
            hide();
            const rect = button.getBoundingClientRect();

            tooltip = this.createDOM(layer, parent, layer.toUI(rect.left), layer.toUI(rect.top), info, topOffset);
        };

        button.addEventListener("mouseenter", show);
        button.addEventListener("mouseleave", hide);
        button.addEventListener("focus", show);
        button.addEventListener("blur", hide);
    }
}

export default NCTooltip;
