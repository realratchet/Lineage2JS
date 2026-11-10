
import BaseConfigFile from "./un-base-config";
import { consumeNextValue, skipToNextToken } from "./conf-parser";

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
export type GameConfig_T = { renderActorLimitOpt: number; antiAliasing: number; textureDetail: number; useTrilinear: boolean; renderDeco: boolean; pawnShadow: boolean; sortTransparent: boolean; skillEffectLighting: boolean; useColorCursor: boolean; autoTrackingPawn: boolean; arrowMode: boolean; showZoneTitle: boolean; systemMsgWnd: boolean; systemMsgWndDamage: boolean; systemMsgWndExpendableItem: boolean; transparencyMode: boolean; partyLooting: number; enterChatting: boolean; oldChatting: boolean; myName: boolean; npcName: boolean; groupName: boolean; pledgeMemberName: boolean; partyMemberName: boolean; otherPCName: boolean; };
export type BackgroundAudio_T = "all" | "combat" | "notices" | "none";
export type AudioVolumeConfig_T = { soundVolume: number; musicVolume: number; wavVoiceVolume: number; oggVoiceVolume: number; };
export type AudioConfig_T = AudioVolumeConfig_T & { backgroundAudio: BackgroundAudio_T; };
export type ALAudioConfig_T = { channels: number; ambientVolume: number; rollOff: number; };
export type CharacterDisplayConfig_T = { name: boolean; dist: number; };
export type UserConfig_T = { audio: AudioVolumeConfig_T; alAudio: ALAudioConfig_T; characterDisplay: CharacterDisplayConfig_T; clippingRange: ClippingRangeConfig_T; display: DisplayConfig_T; game: GameConfig_T; cameraViewHeightAdjust: number; useAutoTrackingPawn: boolean; autoTrackingPawnSpeed: number; minZoomingDist: number; maxZoomingDist: number; fixedDefaultCamera: Record<string, number | number[]>; };

export class UConfigSystem extends BaseConfigFile {
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

    public audio: AudioVolumeConfig_T = { soundVolume: 0.8, musicVolume: 1, wavVoiceVolume: 0.6, oggVoiceVolume: 0.6 }; // ALAudio.dll Init 0x1000a1b4/0x1000a1e0/0x1000a20c/0x1000a238.

    public alAudio: ALAudioConfig_T = { channels: 32, ambientVolume: 1, rollOff: 0.5 };
    public characterDisplay: CharacterDisplayConfig_T = { name: true, dist: 1000 };

    public game: GameConfig_T = { renderActorLimitOpt: 6, antiAliasing: 0, textureDetail: 0, useTrilinear: true, renderDeco: true, pawnShadow: true, sortTransparent: true, skillEffectLighting: true, useColorCursor: true, autoTrackingPawn: false, arrowMode: true, showZoneTitle: true, systemMsgWnd: true, systemMsgWndDamage: true, systemMsgWndExpendableItem: true, transparencyMode: true, partyLooting: 0, enterChatting: false, oldChatting: true, myName: true, npcName: true, groupName: true, pledgeMemberName: true, partyMemberName: true, otherPCName: true }; // Core.dll GL2SystemMsgWnd and GIsTransparencyMode initialise to 1 when Option.ini has no key.
    public cameraViewHeightAdjust = 0;
    public useAutoTrackingPawn = false;
    public autoTrackingPawnSpeed = 0;
    public minZoomingDist: number = null;
    public maxZoomingDist: number = null;
    public readonly fixedDefaultCamera: Record<string, number | number[]> = {};

    public async load(): Promise<this> {
        const fileContents = this.decodeConfig();

        this.loadConfig(fileContents, "ALAudio.ALAudioSubsystem", this.audio);
        this.loadConfig(fileContents, "ALAudio.ALAudioSubsystem", this.alAudio);

        for (const [key, value] of Object.entries(this.audio))
            if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Invalid audio option '${key}'.`);

        this.loadConfig(fileContents, "CharacterDisplay", this.characterDisplay);
        this.loadConfig(fileContents, "ClippingRange", this.clippingRange);
        this.loadConfig(fileContents, "WinDrv.WindowsClient", this.display);

        return this;
    }

    public async loadCamera(): Promise<this> {
        const fileContents = this.decodeConfig();

        this.loadSection(fileContents, "Engine.LineagePlayerController", (key, value) => {
            const name = key.toLowerCase();

            if (name === "fixeddefaultviewnum") {
                const count = Number(value);

                if (!Number.isInteger(count) || count < 0 || count > 10) throw new Error(`Invalid fixed camera count '${value}'.`);
                this.fixedDefaultCamera.FixedDefaultViewNum = count;
                return;
            }
            const preset = /^(FixedDefaultCamera(?:Yaw|Pitch|Dist|ViewHeight|HidePlayer|DisableZoom))\[(\d+)\]$/i.exec(key);

            if (preset) {
                const field = ["FixedDefaultCameraYaw", "FixedDefaultCameraPitch", "FixedDefaultCameraDist", "FixedDefaultCameraViewHeight", "FixedDefaultCameraHidePlayer", "FixedDefaultCameraDisableZoom"].find(field => field.toLowerCase() === preset[1].toLowerCase());
                const index = Number(preset[2]), number = field === "FixedDefaultCameraDist" || field === "FixedDefaultCameraViewHeight" ? Math.fround(Number(value)) : Math.trunc(Number(value));

                if (index >= 10 || !Number.isFinite(number)) throw new Error(`Invalid fixed camera '${key}=${value}'.`);
                if (!this.fixedDefaultCamera[field]) this.fixedDefaultCamera[field] = [];
                (this.fixedDefaultCamera[field] as number[])[index] = number;
                return;
            }

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

    protected loadConfig(fileContents: string, section: string, target: object): void {
        this.loadSection(fileContents, section, (key, value) => {
            Object.keys(target).forEach(k => {
                if (k.toLowerCase() !== key.toLowerCase()) return;

                if (typeof (target as any)[k] === "boolean") (target as any)[k] = value.toLowerCase() === "true";
                else if (!isNaN(parseFloat(value))) (target as any)[k] = parseFloat(value);
            });
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
    const user = new UConfigSystem("assets/system/user.ini");

    await Promise.all([defaults.decode(), user.decode()]);
    await Promise.all([defaults.load(), user.loadCamera()]);

    return { audio: defaults.audio, alAudio: defaults.alAudio, characterDisplay: defaults.characterDisplay, clippingRange: defaults.clippingRange, display: defaults.display, game: defaults.game, cameraViewHeightAdjust: user.cameraViewHeightAdjust, useAutoTrackingPawn: user.useAutoTrackingPawn, autoTrackingPawnSpeed: user.autoTrackingPawnSpeed, minZoomingDist: user.minZoomingDist, maxZoomingDist: user.maxZoomingDist, fixedDefaultCamera: user.fixedDefaultCamera };
}

export default UConfigSystem;
