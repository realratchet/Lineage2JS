import "../../style/skill-viewer.scss";
import { Box3, Vector3 } from "three";
import type { SkillViewerStage, SkillViewerEntry_T, SkillViewerSkill_T } from "./skill-viewer-npc";
import type BaseActor from "../base-actor";
import type AnimationComponent from "../objects/components/animation-component";
import type { ZUpOrbitControls } from "../rendering/camera/controllers/zup-orbit-controls";

const PAGE_SIZE = 20;
const MAX_LOG_LINES = 200;
const FOCUS_FILL = 0.75;
const RECORD_SETTLE_MS = 1000;
const RECORD_CAST_TIMEOUT_MS = 20000;
const RECORD_TAIL_MS = 1500;
const FOCUS_YAW = -Math.PI / 4;
const FOCUS_PITCH = Math.PI / 6;
const focusDirection = new Vector3(Math.sin(FOCUS_YAW) * Math.cos(FOCUS_PITCH), Math.cos(FOCUS_YAW) * Math.cos(FOCUS_PITCH), Math.sin(FOCUS_PITCH));
const tmpFocusBox = new Box3();
const arrFocusPoints: Vector3[] = [];
const tmpCorner = new Vector3();
const tmpCameraRight = new Vector3();
const tmpCameraUp = new Vector3();

export class SkillViewerUI {
    protected readonly stage: SkillViewerStage;
    protected readonly controls: ZUpOrbitControls;
    protected readonly root = document.createElement("aside");
    protected readonly search = document.createElement("input");
    protected readonly skillList = document.createElement("div");
    protected readonly skillHeader = document.createElement("div");
    protected readonly skillTitle = document.createElement("span");
    protected readonly npcList = document.createElement("div");
    protected readonly npcHeader = document.createElement("div");
    protected readonly npcTitle = document.createElement("span");
    protected readonly spawnedList = document.createElement("div");
    protected readonly logElement = document.createElement("div");
    protected skills: SkillViewerSkill_T[] = [];
    protected filtered: SkillViewerSkill_T[] = [];
    protected skill: SkillViewerSkill_T = null;
    protected page = 0;
    protected matchedNpcs: SkillViewerSkill_T["npcs"] = [];
    protected searchText = "";
    protected readonly caption = document.createElement("div");
    protected recordingSkill: SkillViewerSkill_T = null;
    protected recordingRun = 0;
    protected readonly arrRecordingErrors: string[] = [];

    public constructor(stage: SkillViewerStage, controls: ZUpOrbitControls) {
        this.stage = stage;
        this.controls = controls;

        this.root.className = "skill-viewer";

        const title = document.createElement("header");
        title.textContent = "SKILL VIEWER";

        this.search.type = "text";
        this.search.placeholder = stage.isPlayerViewer ? "skill id / name" : "skill id / name, npc id / name";
        this.search.oninput = () => this.applyFilter();

        const skillNav = this.createActions([["◀", () => this.stepSkill(-1)], ["▶", () => this.stepSkill(1)]]);
        const npcNav = this.createActions([["◀", () => this.setPage(this.page - 1)], ["▶", () => this.setPage(this.page + 1)]]);
        const buttons: [string, () => void][] = [["Cast", () => void this.cast()], ["Stop", () => this.stage.stop()], ["Clear", () => this.clear()], ["Focus", () => this.focus()], ["Record", () => void this.record()]];
        if (!stage.isPlayerViewer) buttons.unshift(["Spawn page", () => this.spawnPage()]);
        const actions = this.createActions(buttons);

        this.skillHeader.className = "skill-viewer-header";
        this.npcHeader.className = "skill-viewer-header";
        this.skillList.className = "skill-viewer-list skill-viewer-skills";
        this.npcList.className = "skill-viewer-list skill-viewer-npcs";
        this.spawnedList.className = "skill-viewer-list skill-viewer-spawned";
        this.logElement.className = "skill-viewer-log";

        this.skillHeader.append(this.skillTitle, skillNav);
        this.npcHeader.append(this.npcTitle, npcNav);

        this.root.append(title, this.search, this.skillHeader, this.skillList);
        if (!stage.isPlayerViewer) this.root.append(this.npcHeader, this.npcList);
        this.root.append(actions, this.spawnedList, this.logElement);
        document.body.appendChild(this.root);

        this.caption.className = "skill-viewer-caption";
        document.body.appendChild(this.caption);

        window.addEventListener("keydown", event => { if (event.key === "Escape") this.stopRecording(); });

        this.hookConsole();
    }

    public async init(): Promise<void> {
        this.log(this.stage.isPlayerViewer ? "loading player skills..." : "loading NPC skill groups...");
        this.skills = await this.stage.getSkills();
        this.log(`${this.skills.length} skills`);
        this.applyFilter();
        const selected = Number(new URLSearchParams(location.search).get("skill"));
        const skill = this.skills.find(skill => skill.id === selected);

        if (skill) this.selectSkill(skill);
        if (this.stage.isPlayerViewer) await this.spawnPage();
    }

    public log(message: string, isError: boolean = false): void {
        const line = document.createElement("div");

        line.textContent = message;
        if (isError) line.className = "error";
        if (isError && this.recordingSkill) this.arrRecordingErrors.push(`${this.recordingSkill.id} ${this.recordingSkill.name}: ${message}`);

        this.logElement.appendChild(line);

        while (this.logElement.childElementCount > MAX_LOG_LINES) this.logElement.firstElementChild.remove();

        this.logElement.scrollTop = this.logElement.scrollHeight;
    }

    protected hookConsole(): void {
        const error = console.error, warn = console.warn;

        console.error = (...args: any[]) => {
            error.apply(console, args);
            this.log(args.map(value => value instanceof Error ? value.message : String(value)).join(" "), true);
        };
        console.warn = (...args: any[]) => {
            warn.apply(console, args);
            this.log(args.map(value => value instanceof Error ? value.message : String(value)).join(" "), true);
        };

        window.addEventListener("error", event => this.log(event.error ? event.error.message : event.message, true));
        window.addEventListener("unhandledrejection", event => this.log(event.reason instanceof Error ? event.reason.message : String(event.reason), true));
    }

    protected createActions(buttons: [string, () => void][]): HTMLElement {
        const actions = document.createElement("div");

        actions.className = "skill-viewer-actions";

        for (const [label, onClick] of buttons) {
            const button = document.createElement("button");

            button.type = "button";
            button.textContent = label;
            button.onclick = onClick;
            actions.appendChild(button);
        }

        return actions;
    }

    protected applyFilter(): void {
        const text = this.search.value.trim().toLowerCase();

        const matchedNpcs: SkillViewerSkill_T["npcs"] = [];

        if (text)
            for (const npc of this.stage.getNpcs())
                if ((String(npc.id) === text || npc.name.toLowerCase().includes(text)) && !matchedNpcs.some(other => other.className.toLowerCase() === npc.className.toLowerCase())) matchedNpcs.push(npc);

        this.matchedNpcs = matchedNpcs;
        this.searchText = text;
        this.filtered = this.skills.filter(skill => !text || String(skill.id) === text || skill.name.toLowerCase().includes(text) || matchedNpcs.some(npc => npc.skillAttacks.some(attack => attack.id === skill.id)));

        for (const npc of matchedNpcs)
            if (npc.skillAttacks.length === 0) this.filtered.push({ id: npc.id, name: npc.name, npcs: [npc], isNpcOnly: true });

        this.skillList.innerHTML = "";

        for (const skill of this.filtered) {
            const row = document.createElement("div");

            const npcs = this.getSkillNpcs(skill);

            row.textContent = this.stage.isPlayerViewer ? `${skill.id} ${skill.name}` : skill.isNpcOnly ? `npc ${skill.id} ${skill.name} · no skill group` : `${skill.id} ${skill.name} · ${npcs.length}`;
            if (npcs !== skill.npcs) row.textContent += ` · ${npcs.slice(0, 2).map(npc => npc.name).join(", ")}${npcs.length > 2 ? ` +${npcs.length - 2}` : ""}`;
            row.title = this.stage.isPlayerViewer ? "double click to cast" : "double click to spawn and cast";
            row.onclick = () => this.selectSkill(skill);
            row.ondblclick = () => void this.spawnAndCast(this.getPageNpcs());
            (row as any).skill = skill;
            this.skillList.appendChild(row);
        }

        this.skillTitle.textContent = `Skills ${this.filtered.length}/${this.skills.length}`;

        this.selectSkill(this.filtered.includes(this.skill) ? this.skill : this.filtered[0] || null);
    }

    protected selectSkill(skill: SkillViewerSkill_T): void {
        this.skill = skill;
        this.page = 0;

        for (const row of this.skillList.children as any as HTMLElement[]) {
            row.classList.toggle("active", (row as any).skill === skill);
            if ((row as any).skill === skill) row.scrollIntoView({ block: "nearest" });
        }

        this.renderNpcs();
        if (this.stage.isPlayerViewer) this.renderSpawned();
    }

    protected stepSkill(offset: number): void {
        const index = this.filtered.indexOf(this.skill) + offset;

        if (index < 0 || index >= this.filtered.length) return;

        this.selectSkill(this.filtered[index]);
        if (!this.stage.isPlayerViewer) void this.spawnPage();
    }

    protected setPage(page: number): void {
        if (!this.skill || page < 0 || page * PAGE_SIZE >= this.getSkillNpcs(this.skill).length) return;

        this.page = page;
        this.renderNpcs();
    }

    protected getPageNpcs() { return this.skill ? this.getSkillNpcs(this.skill).slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE) : []; }

    // a search hit on npc names narrows the list to those npcs, a hit on the skill itself keeps all of them
    protected getSkillNpcs(skill: SkillViewerSkill_T): SkillViewerSkill_T["npcs"] {
        const text = this.searchText;

        if (skill.isNpcOnly || this.matchedNpcs.length === 0 || String(skill.id) === text || skill.name.toLowerCase().includes(text)) return skill.npcs;

        return this.matchedNpcs.filter(npc => npc.skillAttacks.some(attack => attack.id === skill.id));
    }

    protected renderNpcs(): void {
        const npcs = this.skill ? this.getSkillNpcs(this.skill) : [];
        const pages = Math.max(1, Math.ceil(npcs.length / PAGE_SIZE));

        this.npcList.innerHTML = "";

        for (const npc of this.getPageNpcs()) {
            const row = document.createElement("div");

            row.textContent = `${npc.id} ${npc.name || "(no name)"}`;
            row.classList.toggle("matched", this.matchedNpcs.includes(npc));
            row.title = "double click to spawn and cast only this NPC";
            row.ondblclick = () => void this.spawnAndCast([npc]);
            this.npcList.appendChild(row);
        }

        this.npcTitle.textContent = `NPCs ${npcs.length} · page ${this.page + 1}/${pages}`;
        this.stage.preload(this.getPageNpcs());
    }

    protected spawnPage(): Promise<void> {
        return this.spawn(this.getPageNpcs());
    }

    protected async spawn(npcs: SkillViewerSkill_T["npcs"]): Promise<void> {
        if (!this.skill || !this.stage.isPlayerViewer && npcs.length === 0) return;

        const skill = this.skill;

        this.spawnedList.innerHTML = "";

        const failures = await this.stage.spawn(npcs, message => this.log(message));

        this.log(`${this.stage.getEntries().length}/${this.stage.isPlayerViewer ? 1 : npcs.length} spawned for ${skill.id} ${skill.name}`);

        for (const failure of failures) this.log(`spawn failed: ${failure}`, true);

        this.stage.preload(this.getPageNpcs());

        this.renderSpawned();
        this.focus();
    }

    protected async spawnAndCast(npcs: SkillViewerSkill_T["npcs"]): Promise<void> {
        const skill = this.skill;

        await this.spawn(npcs);

        if (this.skill === skill) await this.cast();
    }

    protected async record(): Promise<void> {
        if (document.body.classList.contains("skill-viewer-recording")) return;

        const skills = this.filtered.slice(Math.max(0, this.filtered.indexOf(this.skill)));
        const batches: { skill: SkillViewerSkill_T, npcs: SkillViewerSkill_T["npcs"] }[] = [];

        for (const skill of skills) {
            if (this.stage.isPlayerViewer) {
                batches.push({ skill, npcs: [] });
                continue;
            }
            const npcs = this.stage.getCastableNpcs(skill, this.getSkillNpcs(skill));

            for (let i = 0; i < npcs.length; i += PAGE_SIZE) batches.push({ skill, npcs: npcs.slice(i, i + PAGE_SIZE) });
        }

        if (batches.length === 0) return;

        this.arrRecordingErrors.length = 0;
        this.spawnedList.innerHTML = "";
        this.setRecordingLayout(true);
        this.log(`recording ${batches.length} batches from ${skills.length} skills, escape stops`);

        const run = ++this.recordingRun;

        for (let i = 0; i < batches.length && run === this.recordingRun; i++) {
            const { skill, npcs } = batches[i];

            this.recordingSkill = skill;
            this.caption.textContent = skill.name;

            const failures = await this.stage.spawn(npcs, () => { });

            if (run !== this.recordingRun) break;

            for (const failure of failures) this.log(`spawn failed: ${failure}`, true);

            this.stage.preload(i + 1 < batches.length ? batches[i + 1].npcs : []);
            this.focus();

            await wait(RECORD_SETTLE_MS);

            if (run !== this.recordingRun) break;

            await this.cast(skill);

            const castStarted = performance.now();

            while (run === this.recordingRun && this.stage.isCasting() && performance.now() - castStarted < RECORD_CAST_TIMEOUT_MS) await wait(100);

            if (run === this.recordingRun && this.stage.isCasting()) this.log(`cast still running after ${RECORD_CAST_TIMEOUT_MS / 1000}s`, true);

            await wait(RECORD_TAIL_MS);
        }

        if (run === this.recordingRun) this.stopRecording();
    }

    protected stopRecording(): void {
        if (!document.body.classList.contains("skill-viewer-recording")) return;

        const skill = this.recordingSkill;

        this.recordingRun++;
        this.recordingSkill = null;
        this.stage.clear();
        this.setRecordingLayout(false);

        if (skill) this.selectSkill(skill);

        this.log(`recording stopped at ${skill ? `${skill.id} ${skill.name}` : "start"}, ${this.arrRecordingErrors.length} errors`, this.arrRecordingErrors.length > 0);

        for (const error of this.arrRecordingErrors) this.log(error, true);
    }

    protected setRecordingLayout(isRecording: boolean): void {
        this.stage.setEnterEventEnabled(!isRecording);
        document.body.classList.toggle("skill-viewer-recording", isRecording);
        window.dispatchEvent(new Event("resize"));
    }

    protected renderSpawned(): void {
        this.spawnedList.innerHTML = "";

        for (const entry of this.stage.getEntries()) {
            const row = document.createElement("div");
            const label = document.createElement("span");

            if (this.stage.isPlayerViewer) {
                label.textContent = `${entry.npc.name} → ${this.skill?.previewTarget === "self" ? "Self (preview)" : entry.target.name}`;
                label.title = "focus";
                label.onclick = () => this.focus();
                row.ondblclick = () => void this.cast();
                row.append(label, this.createActions([["Cast", () => void this.cast()]]));
                this.spawnedList.appendChild(row);
                continue;
            }
            const select = document.createElement("select");
            const attacks = entry.npc.getNpcAttacks();

            label.textContent = `${entry.definition.id} ${entry.definition.name}`;
            label.title = "focus";
            label.onclick = () => this.focusEntry(entry);

            attacks.forEach((attack, index) => {
                const option = document.createElement("option");

                option.textContent = attack.label;
                option.value = String(index);
                select.appendChild(option);
            });

            const selected = attacks.findIndex(attack => attack.skill && this.skill && attack.skill.id === this.skill.id);

            if (selected >= 0) select.value = String(selected);

            row.title = "double click to cast";
            row.ondblclick = event => { if (event.target !== select) this.stage.castAttack(entry, Number(select.value)); };
            row.append(label, select, this.createActions([["Cast", () => this.stage.castAttack(entry, Number(select.value))]]));
            this.spawnedList.appendChild(row);
        }
    }

    protected async cast(skill: SkillViewerSkill_T = this.skill): Promise<void> {
        if (!skill) return;

        try {
            const skipped = await this.stage.cast(skill);

            for (const name of skipped) this.log(skill.isNpcOnly ? `${name}: has no attacks` : `${name}: skill ${skill.id} is passive or has no animation, not castable`, true);
        } catch (error) {
            this.stage.stop();
            this.log(`${skill.id} ${skill.name}: ${(error as Error).message}`, true);
        }
    }

    protected clear(): void {
        this.stage.clear();
        this.renderSpawned();
    }

    protected focus(): void {
        const entries = this.stage.getEntries();

        if (entries.length === 0) return;

        arrFocusPoints.length = 0;

        for (const entry of entries) {
            collectPosePoints(entry.npc, arrFocusPoints);
            if (this.stage.isPlayerViewer) collectPosePoints(entry.target, arrFocusPoints);
        }

        this.fitCamera(arrFocusPoints);
    }

    protected focusEntry(entry: SkillViewerEntry_T): void {
        arrFocusPoints.length = 0;
        collectPosePoints(entry.npc, arrFocusPoints);

        this.fitCamera(arrFocusPoints);
    }

    protected fitCamera(points: readonly Vector3[]): void {
        const camera = this.controls.object;

        tmpFocusBox.setFromPoints(points as Vector3[]);
        tmpFocusBox.getCenter(this.controls.target);

        let distance = tmpFocusBox.getSize(tmpCorner).length() * 2;

        for (let i = 0; i < 8; i++) {
            this.placeCamera(distance);

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

            for (const point of points) {
                tmpCorner.copy(point).project(camera);
                minX = Math.min(minX, tmpCorner.x);
                maxX = Math.max(maxX, tmpCorner.x);
                minY = Math.min(minY, tmpCorner.y);
                maxY = Math.max(maxY, tmpCorner.y);
            }

            const halfHeight = distance * Math.tan(camera.fov * Math.PI / 360);
            const halfWidth = halfHeight * camera.aspect;

            tmpCameraRight.setFromMatrixColumn(camera.matrixWorld, 0);
            tmpCameraUp.setFromMatrixColumn(camera.matrixWorld, 1);

            // clip space X is flipped globally, measure which way screen x runs instead of assuming
            const signX = Math.sign(tmpCorner.copy(this.controls.target).add(tmpCameraRight).project(camera).x);

            this.controls.target.addScaledVector(tmpCameraRight, signX * (minX + maxX) * 0.5 * halfWidth).addScaledVector(tmpCameraUp, (minY + maxY) * 0.5 * halfHeight);
            distance *= Math.max(maxX - minX, maxY - minY) * 0.5 / FOCUS_FILL;
        }

        this.placeCamera(distance);
    }

    protected placeCamera(distance: number): void {
        const camera = this.controls.object;

        camera.position.copy(this.controls.target).addScaledVector(focusDirection, distance);
        this.controls.update();
        camera.updateMatrixWorld();
    }
}

// bones follow the current pose, the mesh bounding sphere is the loose bind pose
function collectPosePoints(npc: BaseActor, points: Vector3[]): void {
    const meshes = npc.getComponent<AnimationComponent>("animation").getMeshes();
    const bones = meshes.reduce((count, mesh) => Math.max(count, (mesh as any).skeleton ? (mesh as any).skeleton.bones.length : 0), 0);

    points.push(npc.position.clone(), npc.position.clone().setZ(npc.position.z + npc.getCollisionHeight() * 2));

    for (let i = 0; i < bones; i++) points.push(npc.getBoneWorldPosition(i, new Vector3()));
}

function wait(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }

export default SkillViewerUI;
