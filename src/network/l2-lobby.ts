import { Vector3 } from "three";
import BaseActor from "../base-actor";
import MatineePlayer from "../rendering/camera/matinee-player";
import type GameManager from "../game/game-manager";
import type { SectorObject, ZoneObject } from "../objects/zone-object";
import type { Appearance_T, Race_T } from "./game-packets";
import type { PawnCreateSelection_T } from "../nwindow/nc-pawn-create-wnd";
import type { LobbyPawnLabel_T } from "../nwindow/nc-lobby-wnd";

type AppearanceLoader_T = (appearance: Appearance_T, actor: BaseActor) => Promise<void>;

const LOBBY_LEVEL = "lobby";
const SELECTED_SPOT = 7; // Logongrp rows: 0..6 select slots, 7 the spot a selected pawn walks to (Engine.dll SelectedCharacterNum 0x1042d540).
const MAX_SELECT_PAWNS = 7;
const SPAWN_TRACE_HEIGHT = 60; // InsertSelectCharacterInfo traces down from Z+60 (0x1042ef1f, 0x107ccf44); the rows sit at floor height.
const PREVIEW_ROW_OFFSET = 8; // SpawnDefaultCharacter 0x1042e450: preview pawn i = race*4 + class*2 + sex stands at Logongrp row 8+i.
const PREVIEW_CLASS_IDS = [[0, 10], [18, 25], [31, 38], [44, 49], [53, 53]]; // Pawn table 0x1093cec8 base class ids per race: fighter, mystic.
const RACE_EVENT_NAMES = ["HUMAN", "ELF", "DARKELF", "ORC", "DWARF"]; // NWindow 0x10262098 event-name tables.
const CLASS_EVENT_NAMES = ["KNIGHT", "WIZARD"];
const SEX_EVENT_NAMES = ["MAN", "WOMAN"];

const tmpLabelPosition = new Vector3();

export class L2Lobby {
    protected readonly manGame: GameManager;
    protected readonly loadAppearance: AppearanceLoader_T;
    protected sector: SectorObject = null;
    protected matinee: MatineePlayer = null;
    protected spots: [number, number, number, number][] = [];
    protected pawns: BaseActor[] = [];
    protected readonly previewPawns = new Map<number, BaseActor>();
    protected createSelection: PawnCreateSelection_T = null;
    protected selected = -1;
    protected generation = 0;
    protected enterPromise: Promise<void> = null;

    public constructor(game: GameManager, loadAppearance: AppearanceLoader_T) {
        this.manGame = game;
        this.loadAppearance = loadAppearance;
    }

    public isActive() { return !!this.sector; }

    public async enter(spots: [number, number, number, number][]) {
        this.spots = spots;

        if (this.sector) return;
        if (this.enterPromise) return this.enterPromise;

        this.enterPromise = this.load(spots);

        try {
            await this.enterPromise;
        } finally {
            this.enterPromise = null;
        }
    }

    protected async load(spots: [number, number, number, number][]) {

        const asset = this.manGame.getComponent("asset"), render = this.manGame.getComponent("render");
        const [x, y] = render.getSectorId(new Vector3(spots[0][0], spots[0][1], spots[0][2]));

        asset.setStreaming(render, false);
        render.getEnvironment().setTimeToLobbyTime();
        this.manGame.getComponent("input").setCameraLocked(true);
        render.player.visible = false;

        const [sector, scenes] = await Promise.all([asset.setAlwaysLoaded(render, LOBBY_LEVEL, [x, y]), asset.decodeMatineeScenes(LOBBY_LEVEL)]);

        this.sector = sector;
        const skyZone = (sector.zones.children as ZoneObject[]).find(zone => zone.isSkyZoneInfo);

        if (!skyZone) throw new Error(`Lobby SkyZoneInfo is missing`);

        render.skyRenderer.setSkyZone(skyZone);
        render.setHorizontalFov(50); // L2.4_20.trace call 104300: projection X = cot(25 degrees).
        this.matinee = new MatineePlayer(render.camera, scenes);
    }

    public leave() {
        if (!this.sector) return;

        const asset = this.manGame.getComponent("asset"), render = this.manGame.getComponent("render");

        this.clearPawns();
        render.skyRenderer.setSkyZone(null);
        render.setHorizontalFov();
        asset.unloadAlwaysLoaded(render, LOBBY_LEVEL, this.sector);
        asset.setStreaming(render, true);
        this.manGame.getComponent("input").setCameraLocked(false);
        render.player.visible = true;
        this.sector = null;
        this.matinee = null;
    }

    public showLogin() { this.matinee.trigger("LogOn_Warp"); } // MoveCameraByState 0x1042e9e0: to-state 2 fires LogOn_Warp, 4 fires Char_Select_Warp.

    public async showSelect(characters: Appearance_T[]) {
        const render = this.manGame.getComponent("render");
        this.matinee.trigger("Char_Select_Warp");
        this.clearPawns();

        const generation = this.generation;

        await Promise.all(characters.slice(0, MAX_SELECT_PAWNS).map(async (character, i) => { // InsertSelectCharacterInfo 0x1042eca0 accepts slots 0..6, in arrival order.
            const actor = new BaseActor(render);
            const [x, y, z, yaw] = this.spots[i];

            actor.position.set(x, y, z + SPAWN_TRACE_HEIGHT);
            this.pawns.push(actor);

            await this.loadAppearance(character, actor);

            if (generation !== this.generation) return actor.release();

            render.addPawn(actor);
            actor.setRotationYaw(yaw);
        }));
    }

    public select(index: number) {
        if (index === this.selected) return;

        const previous = this.pawns[this.selected];

        if (previous && previous.parent) previous.goTo(new Vector3(this.spots[this.selected][0], this.spots[this.selected][1], this.spots[this.selected][2]));

        this.selected = index;

        const pawn = this.pawns[index];

        if (pawn && pawn.parent) pawn.goTo(new Vector3(this.spots[SELECTED_SPOT][0], this.spots[SELECTED_SPOT][1], this.spots[SELECTED_SPOT][2]));
    }

    public getPawn(index: number) { return this.pawns[index] || null; }

    public getPawnLabels(characters: { name: string, karma: number, deleteSeconds: number }[], width: number, height: number): LobbyPawnLabel_T[] {
        const camera = this.manGame.getComponent("render").camera;
        const labels: LobbyPawnLabel_T[] = [];

        for (let i = 0; i < this.pawns.length; i++) {
            const pawn = this.pawns[i];

            if (!pawn.parent) continue;

            tmpLabelPosition.copy(pawn.position);
            tmpLabelPosition.z += pawn.getCollisionHeight() * 1.5 + 7; // NWindow 0x1009c885: Location.Z (cylinder centre, CollisionHeight above the feet) + CollisionHeight * 0.5 + 7.
            tmpLabelPosition.project(camera);

            if (tmpLabelPosition.z >= 1) continue;

            labels.push({ x: Math.round((tmpLabelPosition.x + 1) * 0.5 * width), y: Math.round((1 - tmpLabelPosition.y) * 0.5 * height), name: characters[i].name, karma: characters[i].karma, deleteSeconds: characters[i].deleteSeconds });
        }

        return labels;
    }

    public showCreate() {
        this.clearPawns();
        this.createSelection = null;
        this.matinee.trigger("Char_Create_Warp");
    }

    protected getPreviewIndex(race: Race_T, isMystic: boolean, sex: number) { return race * 4 + (isMystic ? 1 : 0) * 2 + sex; }

    protected async spawnPreview(race: Race_T, isMystic: boolean, sex: number, hairStyle: number, hairColor: number, face: number) {
        const render = this.manGame.getComponent("render");
        const index = this.getPreviewIndex(race, isMystic, sex);
        const [x, y, z, yaw] = this.spots[PREVIEW_ROW_OFFSET + index];
        const generation = this.generation;
        let actor = this.previewPawns.get(index);
        const isNew = !actor;

        if (isNew) {
            actor = new BaseActor(render);
            actor.position.set(x, y, z + SPAWN_TRACE_HEIGHT);
            this.previewPawns.set(index, actor);
        }

        await this.loadAppearance({ race, sex, classId: PREVIEW_CLASS_IDS[race][isMystic ? 1 : 0], hairStyle, hairColor, face, enchantLevel: 0, paperdoll: new Array(16).fill(0) }, actor);

        if (generation !== this.generation || !isNew) return;

        render.addPawn(actor);
        actor.setRotationYaw(yaw);
    }

    public async previewCreate(selection: PawnCreateSelection_T) { // NWindow 0x100cdee0 builds the create-screen event names; flag=1 variants (zoom out, back steps) are not decoded.
        const race = RACE_EVENT_NAMES[selection.race];

        this.createSelection = selection;

        if (selection.step === "race") {
            this.triggerScene(race);

            for (const isMystic of selection.race === 4 ? [false] : [false, true])
                for (const sex of [0, 1]) void this.spawnPreview(selection.race, isMystic, sex, 0, 0, 0);

            return;
        }

        const klass = CLASS_EVENT_NAMES[selection.isMystic ? 1 : 0];

        if (selection.step === "class") return this.triggerScene(`${race}_${klass}`);

        const sex = `${klass[0]}${SEX_EVENT_NAMES[selection.sex]}`;

        if (selection.step === "sex") return this.triggerScene(`${race}_${klass}_${sex}`);

        await this.spawnPreview(selection.race, selection.isMystic, selection.sex, selection.hairStyle, selection.hairColor, selection.face);
    }

    public zoomCreate(isIn: boolean) {
        const selection = this.createSelection;

        if (!selection || selection.sex < 0) return;

        const race = RACE_EVENT_NAMES[selection.race], klass = CLASS_EVENT_NAMES[selection.isMystic ? 1 : 0];

        this.triggerScene(isIn ? `${race}_${klass[0]}${SEX_EVENT_NAMES[selection.sex]}_CHEST` : `${race}_${klass}_${klass[0]}${SEX_EVENT_NAMES[selection.sex]}`);
    }

    public triggerScene(tag: string) { if (this.matinee.hasScene(tag)) this.matinee.trigger(tag); }

    protected clearPawns() {
        const render = this.manGame.getComponent("render");

        this.generation++;

        for (const pawn of [...this.pawns, ...this.previewPawns.values()])
            if (pawn.parent) render.removePawn(pawn);

        this.pawns = [];
        this.previewPawns.clear();
        this.selected = -1;
    }

    public tick(deltaTime: number) {
        if (this.matinee && this.matinee.tick(deltaTime / 1000)) this.manGame.getComponent("render").needsUpdate = true;
    }
}

export default L2Lobby;
