import * as dat from "dat.gui";
import { IEngineComponent } from "./components";
import Stats from "../rendering/stats";
import { GAMMA_STEPS } from "../rendering/display-gamma";
import type BaseActor from "../base-actor";
import type { NpcAttackSelection_T } from "../objects/components/npc-attack-component";
import type GameManager from "./game-manager";
import type { ICharacterArmorSelection } from "@l2js/engine/contracts/pawn";

export class UIManager implements IEngineComponent<GameManager> {
    public moverPosition = 0;
    public fogPreset = "4";
    public showLevel = true;
    public showColliders = false;
    public followPlayer = false;

    protected manGame: GameManager;
    protected readonly gui = new dat.GUI({ autoPlace: false, width: 300 });
    protected readonly worldFolder = this.gui.addFolder("World");
    protected readonly qualityFolder = this.gui.addFolder("Quality");
    protected readonly stats = new (Stats as any)(0);
    protected characterGroup = 1;
    protected characterFace = 0;
    protected characterHair = 0;
    protected characterHairColour = 0;
    protected characterArmor: ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 };
    protected spawnedNpc: BaseActor = null;
    protected npcSpawnRequest = 0;

    public constructor() {
        Object.assign(this.gui.domElement.style, {
            position: "fixed",
            top: "0px",
            right: "0px",
            zIndex: "10000"
        });
        document.body.appendChild(this.gui.domElement);
        this.worldFolder.open();

        this.stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        document.body.appendChild(this.stats.dom);
    }

    public setParent(parent: GameManager): this { this.manGame = parent; return this; }
    public getParent(): GameManager { return this.manGame; }

    public async onInit(): Promise<this> {
        this.addRenderControls();

        return this;
    }

    public beginFrame(): void { this.stats.begin(); }
    public endFrame(): void { this.stats.end(); }

    protected addRenderControls(): void {
        const manRender = this.manGame.getComponent("render");
        const environment = manRender.getEnvironment();

        this.qualityFolder.add(this, "fogPreset", {
            "1 (2k-8k)": "1",
            "2 (3k-10k)": "2",
            "3 (4k-12k)": "3",
            "4 (5k-14k)": "4",
            "5 (8k-20k)": "5"
        }).name("Fog Range");

        this.worldFolder.add(this, "showLevel")
            .name("Show Level")
            .onChange(v => manRender.setLevelVisible(v));

        this.worldFolder.add(this, "showColliders")
            .name("Show Colliders")
            .onChange(v => manRender.setCollidersVisible(v));

        this.worldFolder.add(this, "moverPosition", 0, 1, 0.01)
            .name("Door Position")
            .onChange(() => manRender.needsUpdate = true);

        const skyFolder = this.gui.addFolder("Sky Layers");
        skyFolder.add(manRender.skyRenderer.config, "celestials").name("Celestials");
        skyFolder.add(manRender.skyRenderer.config, "haze1").name("Haze");
        skyFolder.add(manRender.skyRenderer.config, "starsClouds").name("Stars/Clouds");
        // skyFolder.add(manRender.skyRenderer.config, "haze2").name("Haze 2 (Dome)");

        const audioFolder = this.gui.addFolder("Audio");
        audioFolder.add(manRender.audioManager, "musicVolume", 0, 1, 0.01).name("Music Volume");
        audioFolder.add(manRender.audioManager, "ambientVolume", 0, 1, 0.01).name("Ambient Volume");
        audioFolder.open();

        const timeState = {
            get time() { return environment.getTimeOfDay(); },
            set time(v) {
                environment.setTimeOfDay(v);
                manRender.needsUpdate = true;
            },
            get timeScale() { return environment.getTimeScale(); },
            set timeScale(v) {
                environment.setTimeScale(v);
                manRender.needsUpdate = true;
            }
        };

        this.worldFolder.add(timeState, "time", 0, 24, 0.01)
            .name("Time")
            .listen();
        this.worldFolder.add(timeState, "timeScale", 0, 100, 0.01)
            .name("Time Scale");

        const envSignsSkyState = {
            get signsSky() { return environment.getActiveEnv(); },
            set signsSky(v) {
                environment.setActiveEnv(Number(v) as 0 | 1 | 2);
                manRender.needsUpdate = true;
            }
        };

        this.worldFolder.add(envSignsSkyState, "signsSky", { "Normal": 0, "Dusk": 1, "Dawn": 2 })
            .name("Signs Sky");
    }

    public async addCharacterControls(): Promise<void> {
        const this_ = this, manAsset = this.manGame.getComponent("asset"), manPhys = this.manGame.getComponent("physics"), manRender = this.manGame.getComponent("render");
        const groups = await manAsset.getCharGroups();
        const state = { group: this.characterGroup, face: this.characterFace, hair: this.characterHair, hairColour: this.characterHairColour, chest: this.characterArmor.chest, legs: this.characterArmor.legs, gloves: this.characterArmor.gloves, boots: this.characterArmor.boots };
        const groupOptions: Record<string, number> = {};
        const folder = this.gui.addFolder("Character");

        for (const group of groups)
            groupOptions[group.name] = group.index;

        let faceControl: dat.GUIController = null;
        let hairControl: dat.GUIController = null;
        let hairColourControl: dat.GUIController = null;
        let armorControls: dat.GUIController[] = [];

        function applyCharacter(): Promise<void> {
            return manAsset.loadCharacter(manRender, this_.characterGroup, this_.characterFace, this_.characterHair, this_.characterHairColour, this_.characterArmor);
        }

        function buildArmorControls(): void {
            const group = groups[this_.characterGroup];

            for (const control of armorControls) folder.remove(control);
            armorControls = [];

            for (const slot of Object.keys(this_.characterArmor) as (keyof ICharacterArmorSelection)[]) {
                const options: Record<string, number> = { None: 0 };

                for (const item of group.armor[slot])
                    options[item.label] = item.id;

                state[slot] = this_.characterArmor[slot];
                armorControls.push(folder.add(state, slot, options).name(slot[0].toUpperCase() + slot.slice(1)).onChange(async v => {
                    this_.characterArmor[slot] = Number(v);
                    await applyCharacter();
                }));
            }
        }

        // a style only ships some of the colours, so the colour options get rebuilt whenever the style changes
        function buildColourControl(): void {
            const colours = groups[this_.characterGroup].hairColours[this_.characterHair];

            if (hairColourControl) folder.remove(hairColourControl);

            state.hairColour = this_.characterHairColour = colours.includes(this_.characterHairColour) ? this_.characterHairColour : colours[0];

            hairColourControl = folder.add(state, "hairColour", colours).name("Hair Color").onChange(async v => {
                this_.characterHairColour = Number(v);
                await applyCharacter();
            });
        }

        function buildVariantControls(): void {
            const group = groups[this_.characterGroup];

            if (faceControl) folder.remove(faceControl);
            if (hairControl) folder.remove(hairControl);

            state.face = this_.characterFace = Math.min(this_.characterFace, group.faceVariants - 1);
            state.hair = this_.characterHair = group.hairStyles.includes(this_.characterHair) ? this_.characterHair : group.hairStyles[0];

            const faceOptions = Array.from({ length: group.faceVariants }, (_, i) => i);

            faceControl = folder.add(state, "face", faceOptions).name("Face").onChange(async v => {
                this_.characterFace = Number(v);
                await applyCharacter();
            });

            hairControl = folder.add(state, "hair", group.hairStyles).name("Hair").onChange(async v => {
                this_.characterHair = Number(v);
                buildColourControl();
                await applyCharacter();
            });

            buildColourControl();
            buildArmorControls();
        }

        folder.add(state, "group", groupOptions).name("Character").onChange(async v => {
            this.characterGroup = Number(v);
            this.characterArmor = { chest: 0, legs: 0, gloves: 0, boots: 0 };
            buildVariantControls();
            await applyCharacter();
        });

        folder.add(this, "followPlayer").name("Follow Player").onChange(() => this.manGame.getComponent("input").setFollowPlayer(this.followPlayer));
        folder.add({ simulate: () => manPhys.simulatePawns() }, "simulate").name("Simulate Pawns");

        buildVariantControls();
        folder.open();
    }

    public addNpcControls(): void {
        const manRender = this.manGame.getComponent("render");
        const state = {
            selector: "Baium",
            selectedAttack: "random",
            selectedTarget: "player",
            spawn: async () => {
                const request = ++this.npcSpawnRequest;

                if (this.spawnedNpc) {
                    this.spawnedNpc.stopAttack();
                    manRender.removePawn(this.spawnedNpc);
                    this.spawnedNpc = null;
                }

                buildAttackControl(null);

                const npc = await manRender.spawnNpc(state.selector);

                if (request !== this.npcSpawnRequest) {
                    manRender.removePawn(npc);
                    return;
                }

                this.spawnedNpc = npc;
                buildAttackControl(npc);
            },
            kill: () => {
                ++this.npcSpawnRequest;

                const npc = this.spawnedNpc;

                if (!npc) return;

                npc.stopAttack();
                npc.playDeathAnimation(() => {
                    manRender.removePawn(npc);
                    if (this.spawnedNpc === npc) {
                        this.spawnedNpc = null;
                        buildAttackControl(null);
                    }
                });
            },
            attack: () => {
                const npc = this.spawnedNpc;

                if (!npc) return;

                const selection: NpcAttackSelection_T = state.selectedAttack === "random" ? "random" : Number(state.selectedAttack);

                npc.attack(state.selectedTarget === "self" ? npc : manRender.player, selection);
            },
            stop: () => this.spawnedNpc?.stopAttack()
        };
        const folder = this.gui.addFolder("NPC");
        let attackControl: dat.GUIController = null;

        function buildAttackControl(npc: BaseActor): void {
            const options: Record<string, string> = { Random: "random" };

            if (attackControl) folder.remove(attackControl);

            if (npc)
                npc.getNpcAttacks().forEach((attack, index) => options[attack.label] = String(index));

            state.selectedAttack = "random";
            attackControl = folder.add(state, "selectedAttack", options).name("NPC attacks");
        }

        folder.add(state, "selector").name("Name / ID");
        folder.add(state, "spawn").name("Spawn");
        folder.add(state, "kill").name("Kill");
        buildAttackControl(null);
        folder.add(state, "selectedTarget", { Player: "player", Self: "self" }).name("Attack target").onChange(state.stop);
        folder.add(state, "attack").name("Attack");
        folder.add(state, "stop").name("Stop");
        folder.open();
    }

    public addClippingRangeControls(): void {
        const manAsset = this.manGame.getComponent("asset"), manRender = this.manGame.getComponent("render");
        const clippingRange = manAsset.userConfig.clippingRange;

        this.qualityFolder.add(clippingRange, "actor", 1, 12, 0.5)
            .name("Emitter Range")
            .onChange(() => manRender.invalidateSectorVisibility());
    }

    public addDisplayGammaControls(): void {
        const manAsset = this.manGame.getComponent("asset"), manRender = this.manGame.getComponent("render");
        const display = manAsset.userConfig.display;
        display.gamma = 0;

        const steps = GAMMA_STEPS.reduce((acc, g) => (acc[g.toFixed(1)] = g, acc), { "off": 0 } as Record<string, number>);

        this.qualityFolder.add(display, "gamma", steps)
            .name("Gamma")
            .onChange(v => manRender.setDisplayGamma(display, v));
    }
}

export default UIManager;
