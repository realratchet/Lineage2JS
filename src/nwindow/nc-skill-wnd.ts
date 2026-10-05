import type NDomLayer from "./ndom";
import { NDOM_SCROLL_TEXTURES } from "./ndom";
import type { NDomButton_T, NDomScrollPane_T } from "./ndom";
import type { SkillEntry_T } from "../network/game-packets";
import type NCCoolTimeIcon from "./nc-cool-time-icon";

const TEX_BACK = "L2UI_CH3.SkillWnd.Skill_Back";
const TEX_TAB = "L2UI_CH3.SkillWnd.Skill_Tab2";
const TEX_TAB_SELECTED = "L2UI_CH3.SkillWnd.Skill_Tab1";
const TEX_OUTLINE = "L2UI.NWindow.Icon_Back";
const TEX_PRESSED = "L2UI.NWindow.Icon_Click";

export class NCSkillWnd {
    public static getTextures() { return [TEX_BACK, TEX_TAB, TEX_TAB_SELECTED, TEX_OUTLINE, TEX_PRESSED, ...NDOM_SCROLL_TEXTURES]; }
    public readonly element: HTMLDivElement;
    public onUse: (id: number) => void = null;
    protected readonly layer: NDomLayer;
    protected readonly list: NDomScrollPane_T;
    protected readonly skillTabs: NDomButton_T[] = [];
    protected skills: SkillEntry_T[] = [];
    protected pendingSkills: SkillEntry_T[] = [];
    protected isPassive = false;
    protected readonly coolTimeIcons = new Map<string, HTMLCanvasElement>();

    public constructor(layer: NDomLayer, protected readonly coolTimes: Map<string, NCCoolTimeIcon>, parent: HTMLElement) {
        this.layer = layer;
        this.element = layer.createWindow(0, 66, 256, 335, parent);
        this.element.hidden = true;
        layer.tile(this.element, 0, 0, 256, 335, 0, 0, 256, 335, TEX_BACK);
        this.list = layer.scrollPane(this.element, 9, 40, 239, 280, 35); // NCSkillWnd item grid on NCScrollWnd.
        this.list.setAttribute("role", "tabpanel");

        [120, 121].forEach((id, index) => {
            const label = layer.getManager().getSysString(id);
            const select = () => {
                this.isPassive = index === 1;
                this.list.setScroll(0);
                this.paintSkills();
            };
            const tab = layer.button(this.element, 12 + index * 94, 8, 94, 23, TEX_TAB, TEX_TAB_SELECTED, null, label, select);

            tab.tabIndex = 0;
            tab.setAttribute("role", "tab");
            tab.setAttribute("aria-label", label);
            tab.addEventListener("keydown", event => {
                if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                layer.getManager().playButtonSound(true);
                select();
            });
            this.skillTabs.push(tab);
        });
        this.paintSkills();
    }

    public isVisible() { return !this.element.hidden && !this.element.parentElement.hidden; }

    public async setSkills(skills: SkillEntry_T[]) {
        this.pendingSkills = skills;

        const strings = this.layer.getManager().strings;

        await this.layer.loadTextures([...new Set(skills.map(skill => strings.skillIcons[skill.id]))]);
        if (this.pendingSkills !== skills) return;

        this.skills = skills;
        this.paintSkills();
    }

    public renderCoolTimes() {
        if (!this.isVisible()) return;

        const canvas = this.layer.getManager().canvas;

        for (const [key, element] of this.coolTimeIcons) {
            const coolTime = this.coolTimes.get(key);
            const texture = coolTime && coolTime.texture && canvas.hasTexture(coolTime.texture) ? coolTime.texture : "";

            if (element.dataset.texture === texture) continue;

            const context = element.getContext("2d");

            context.clearRect(0, 0, 32, 32);
            context.imageSmoothingEnabled = false;
            if (texture) context.drawImage(canvas.getTintedImage(texture, coolTime.color), 0, 0, 32, 32);
            element.dataset.texture = texture;
        }
    }

    protected paintSkills() {
        const layer = this.layer, strings = layer.getManager().strings;

        this.skillTabs.forEach((tab, index) => {
            const selected = this.isPassive === (index === 1);

            tab.setTextures(selected ? TEX_TAB_SELECTED : TEX_TAB, TEX_TAB_SELECTED);
            tab.setAttribute("aria-selected", String(selected));
        });
        this.list.content.replaceChildren();
        this.coolTimeIcons.clear();

        const skills = this.skills.filter(skill => skill.isPassive === this.isPassive);

        this.list.setContentHeight(Math.ceil(skills.length / 6) * 35);
        skills.forEach((skill, index) => {
            const button = document.createElement("button");

            button.type = "button";
            button.draggable = false;
            button.className = "ndom-inventory-item";
            button.dataset.skillId = String(skill.id);
            button.title = `${strings.skillNames[skill.id]} Lv ${skill.level}`;
            button.setAttribute("aria-label", button.title);
            button.setAttribute("aria-disabled", String(skill.isPassive));
            layer.place(button, index % 6 * 37, Math.trunc(index / 6) * 35, 34, 34);
            layer.tile(button, 1, 1, 32, 32, 0, 0, 32, 32, strings.skillIcons[skill.id]);
            const outline = layer.tile(button, 0, 0, 34, 34, 0, 0, 34, 34, TEX_OUTLINE);
            const coolTimeIcon = document.createElement("canvas");

            coolTimeIcon.className = "ndom-tile";
            coolTimeIcon.width = coolTimeIcon.height = 32;
            layer.place(coolTimeIcon, 1, 1, 32, 32);
            button.appendChild(coolTimeIcon);
            this.coolTimeIcons.set(`${skill.id}:${skill.level}`, coolTimeIcon);

            const use = () => { if (!skill.isPassive && this.onUse) this.onUse(skill.id); };
            button.addEventListener("mousedown", event => {
                if (event.button !== 0) return;

                layer.getManager().playButtonSound(!skill.isPassive);
                if (!skill.isPassive) layer.setTile(outline, 34, 34, 0, 0, 34, 34, TEX_PRESSED);
            });
            for (const type of ["mouseup", "mouseleave"]) button.addEventListener(type, () => layer.setTile(outline, 34, 34, 0, 0, 34, 34, TEX_OUTLINE));
            button.addEventListener("click", use);
            button.addEventListener("keydown", event => {
                if (event.repeat || event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                layer.getManager().playButtonSound(!skill.isPassive);
                use();
            });
            this.list.content.appendChild(button);
        });

    }
}

export default NCSkillWnd;
