
import BaseConfigFile from "./un-base-config";
import { consumeNextValue, skipToNextToken } from "./conf-parser";
import fetchAsset from "../../asset-source";

export type ClippingRangeConfig_T = {
    staticMesh: number;
    staticMeshLod: number;
    pawn: number;
    terrain: number;
    actor: number;
    projector: number;
    antiPortal: number;
    pawnMin: number;
    pawnMax: number;
};

export type DisplayConfig_T = { brightness: number; contrast: number; gamma: number; };
export type GameConfig_T = { pawnShadow: boolean; useColorCursor: boolean; autoTrackingPawn: boolean; arrowMode: boolean; showZoneTitle: boolean; systemMsgWnd: boolean; systemMsgWndDamage: boolean; systemMsgWndExpendableItem: boolean; transparencyMode: boolean; partyLooting: number; enterChatting: boolean; oldChatting: boolean; myName: boolean; npcName: boolean; groupName: boolean; pledgeMemberName: boolean; partyMemberName: boolean; otherPCName: boolean; };
export type AudioConfig_T = { soundVolume: number; musicVolume: number; wavVoiceVolume: number; oggVoiceVolume: number; };
export type UserConfig_T = { audio: AudioConfig_T; clippingRange: ClippingRangeConfig_T; display: DisplayConfig_T; game: GameConfig_T; cameraViewHeightAdjust: number; useAutoTrackingPawn: boolean; autoTrackingPawnSpeed: number; minZoomingDist: number; maxZoomingDist: number; };

export class UConfigSystem extends BaseConfigFile {
    // Option.ini only overrides keys it defines.
    public readonly definedClippingKeys = new Set<string>();
    public readonly definedDisplayKeys = new Set<string>();

    public clippingRange: ClippingRangeConfig_T = {
        staticMesh: 4.0,
        staticMeshLod: 5.0,
        pawn: 2.0,
        terrain: 8.0,
        actor: 4.0,
        projector: 0.2,
        antiPortal: 1.5,
        pawnMin: 1.5,
        pawnMax: 3.0
    };

    public display: DisplayConfig_T = {
        brightness: 0.8,
        contrast: 0.7,
        gamma: 0.8
    };

    public audio: AudioConfig_T = { soundVolume: 0.8, musicVolume: 1, wavVoiceVolume: 0.6, oggVoiceVolume: 0.6 }; // ALAudio.dll Init 0x1000a1b4/0x1000a1e0/0x1000a20c/0x1000a238.

    public game: GameConfig_T = { pawnShadow: true, useColorCursor: true, autoTrackingPawn: false, arrowMode: true, showZoneTitle: true, systemMsgWnd: true, systemMsgWndDamage: true, systemMsgWndExpendableItem: true, transparencyMode: true, partyLooting: 0, enterChatting: false, oldChatting: true, myName: true, npcName: true, groupName: true, pledgeMemberName: true, partyMemberName: true, otherPCName: true }; // Core.dll GL2SystemMsgWnd and GIsTransparencyMode initialise to 1 when Option.ini has no key.
    public readonly definedGameKeys = new Set<keyof GameConfig_T>();
    public cameraViewHeightAdjust = 0;
    public useAutoTrackingPawn = false;
    public autoTrackingPawnSpeed = 0;
    public minZoomingDist: number = null;
    public maxZoomingDist: number = null;

    public async load(): Promise<this> {
        const fileContents = this.decodeConfig();

        this.loadNumbers(fileContents, "Audio", this.audio, new Set<string>());

        for (const [key, value] of Object.entries(this.audio))
            if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Invalid audio option '${key}'.`);

        this.loadNumbers(fileContents, "ClippingRange", this.clippingRange, this.definedClippingKeys);

        // C4 UClient::Init overrides the l2.ini config field with Option.ini [Video] Gamma.
        this.loadNumbers(fileContents, "WinDrv.WindowsClient", this.display, this.definedDisplayKeys);
        this.loadNumbers(fileContents, "Video", this.display, this.definedDisplayKeys);

        this.loadSection(fileContents, "Video", (key, value) => {
            if (key.toLowerCase() === "pawnshadow") {
                this.game.pawnShadow = value.toLowerCase() === "true";
                this.definedGameKeys.add("pawnShadow");
                return;
            }
            if (key.toLowerCase() !== "usecolorcursor") return;

            this.game.useColorCursor = value.toLowerCase() === "true";
            this.definedGameKeys.add("useColorCursor");
        });

        this.loadSection(fileContents, "Game", (key, value) => {
            switch (key.toLowerCase()) {
                case "autotrackingpawn": this.game.autoTrackingPawn = value.toLowerCase() === "true"; this.definedGameKeys.add("autoTrackingPawn"); break;
                case "arrowmode": this.game.arrowMode = value.toLowerCase() === "true"; this.definedGameKeys.add("arrowMode"); break;
                case "showzonetitle": this.game.showZoneTitle = value.toLowerCase() === "true"; this.definedGameKeys.add("showZoneTitle"); break;
                case "systemmsgwnddamage": this.game.systemMsgWndDamage = value.toLowerCase() === "true"; this.definedGameKeys.add("systemMsgWndDamage"); break;
                case "systemmsgwndexpendableitem": this.game.systemMsgWndExpendableItem = value.toLowerCase() === "true"; this.definedGameKeys.add("systemMsgWndExpendableItem"); break;
                case "systemmsgwnd": this.game.systemMsgWnd = value.toLowerCase() === "true"; this.definedGameKeys.add("systemMsgWnd"); break;
                case "transparencymode": this.game.transparencyMode = value.toLowerCase() === "true"; this.definedGameKeys.add("transparencyMode"); break;
                case "partylooting": this.game.partyLooting = parseInt(value, 10); this.definedGameKeys.add("partyLooting"); break;
                case "oldchatting": this.game.oldChatting = value.toLowerCase() === "true"; this.definedGameKeys.add("oldChatting"); break;
                case "enterchatting": this.game.enterChatting = value.toLowerCase() === "true"; this.definedGameKeys.add("enterChatting"); break;
                case "myname": this.game.myName = value.toLowerCase() === "true"; this.definedGameKeys.add("myName"); break;
                case "npcname": this.game.npcName = value.toLowerCase() === "true"; this.definedGameKeys.add("npcName"); break;
                case "groupname": this.game.groupName = value.toLowerCase() === "true"; this.definedGameKeys.add("groupName"); break;
                case "pledgemembername": this.game.pledgeMemberName = value.toLowerCase() === "true"; this.definedGameKeys.add("pledgeMemberName"); break;
                case "partymembername": this.game.partyMemberName = value.toLowerCase() === "true"; this.definedGameKeys.add("partyMemberName"); break;
                case "otherpcname": this.game.otherPCName = value.toLowerCase() === "true"; this.definedGameKeys.add("otherPCName"); break;
            }
        });

        return this;
    }

    public async loadCamera(): Promise<this> {
        const fileContents = this.decodeConfig();

        this.loadSection(fileContents, "Engine.LineagePlayerController", (key, value) => {
            const name = key.toLowerCase();

            if (name === "minzoomingdist" || name === "maxzoomingdist") {
                const field = name === "minzoomingdist" ? "minZoomingDist" : "maxZoomingDist";

                this[field] = Math.fround(Number(value));
                if (!Number.isFinite(this[field])) throw new Error(`Invalid camera zoom limit '${value}'.`);
                return;
            }
            if (key.toLowerCase() === "buseautotrackingpawn") { this.useAutoTrackingPawn = value.toLowerCase() === "true"; return; }
            if (key.toLowerCase() === "autotrackingpawnspeed") {
                this.autoTrackingPawnSpeed = Math.fround(Number(value));
                if (!Number.isFinite(this.autoTrackingPawnSpeed)) throw new Error(`Invalid camera tracking speed '${value}'.`);
                return;
            }
            if (key.toLowerCase() !== "cameraviewheightadjust") return;
            this.cameraViewHeightAdjust = Math.fround(Number(value));
            if (!Number.isFinite(this.cameraViewHeightAdjust)) throw new Error(`Invalid camera view height '${value}'.`);
        });

        return this;
    }

    protected loadNumbers(fileContents: string, section: string, target: object, definedKeys: Set<string>): void {
        this.loadSection(fileContents, section, (key, value) => {
            const val = parseFloat(value);

            if (!isNaN(val)) {
                Object.keys(target).forEach(k => {
                    if (k.toLowerCase() === key.toLowerCase()) {
                        (target as any)[k] = val;
                        definedKeys.add(k);
                    }
                });
            }
        });
    }

    protected loadSection(fileContents: string, section: string, onValue: (key: string, value: string) => void): void {
        const sectionHeader = `[${section}]\r\n`;
        const sectionOffset = fileContents.indexOf(sectionHeader);

        if (sectionOffset === -1) return;

        let readOffset = sectionOffset + sectionHeader.length;

        while (true) {
            let nextOffset = skipToNextToken(fileContents, readOffset);
            if (nextOffset >= fileContents.length || fileContents[nextOffset] === "[") break;

            readOffset = nextOffset;

            let nameMax: string, nameVal: string, readContent: number;

            try {
                [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);
            } catch { break; }

            readOffset += readContent;

            const key = nameMax;//.toLowerCase();

            onValue(key, nameVal);
        }
    }
}

export async function getUserConfig(): Promise<UserConfig_T> {
    const defaults = new UConfigSystem("assets/system/l2.ini");
    const options = new UConfigSystem("assets/system/Option.ini");
    const user = new UConfigSystem("assets/system/user.ini");
    const hasOptions = (await fetchAsset(options.path)).ok; // retail writes Option.ini on first run, a fresh install has none

    await Promise.all([defaults.decode(), hasOptions && options.decode(), user.decode()]);
    await Promise.all([defaults.load(), hasOptions && options.load(), user.loadCamera()]);

    for (const key of options.definedClippingKeys)
        (defaults.clippingRange as any)[key] = (options.clippingRange as any)[key];

    for (const key of options.definedDisplayKeys)
        (defaults.display as any)[key] = (options.display as any)[key];

    for (const key of options.definedGameKeys)
        (defaults.game as any)[key] = options.game[key];

    for (const key of ["autoTrackingPawn", "arrowMode", "showZoneTitle", "myName", "npcName", "groupName", "pledgeMemberName", "partyMemberName", "otherPCName", "oldChatting", "systemMsgWndDamage", "systemMsgWndExpendableItem"] as const)
        defaults.game[key] = options.game[key];

    return { audio: options.audio, clippingRange: defaults.clippingRange, display: defaults.display, game: defaults.game, cameraViewHeightAdjust: user.cameraViewHeightAdjust, useAutoTrackingPawn: user.useAutoTrackingPawn, autoTrackingPawnSpeed: user.autoTrackingPawnSpeed, minZoomingDist: user.minZoomingDist, maxZoomingDist: user.maxZoomingDist };
}

export default UConfigSystem;
