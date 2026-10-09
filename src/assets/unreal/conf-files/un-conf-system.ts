
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
export type GameConfig_T = { systemMsgWnd: boolean; transparencyMode: boolean; partyLooting: number; };
export type UserConfig_T = { clippingRange: ClippingRangeConfig_T; display: DisplayConfig_T; game: GameConfig_T; };

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

    public game: GameConfig_T = { systemMsgWnd: true, transparencyMode: true, partyLooting: 0 }; // Core.dll GL2SystemMsgWnd and GIsTransparencyMode initialise to 1 when Option.ini has no key.
    public readonly definedGameKeys = new Set<keyof GameConfig_T>();

    public async load(): Promise<this> {
        const fileContents = this.decodeConfig();

        this.loadNumbers(fileContents, "ClippingRange", this.clippingRange, this.definedClippingKeys);

        // C4 UClient::Init overrides the l2.ini config field with Option.ini [Video] Gamma.
        this.loadNumbers(fileContents, "WinDrv.WindowsClient", this.display, this.definedDisplayKeys);
        this.loadNumbers(fileContents, "Video", this.display, this.definedDisplayKeys);

        this.loadSection(fileContents, "Game", (key, value) => {
            switch (key.toLowerCase()) {
                case "systemmsgwnd": this.game.systemMsgWnd = value.toLowerCase() === "true"; this.definedGameKeys.add("systemMsgWnd"); break;
                case "transparencymode": this.game.transparencyMode = value.toLowerCase() === "true"; this.definedGameKeys.add("transparencyMode"); break;
                case "partylooting": this.game.partyLooting = parseInt(value, 10); this.definedGameKeys.add("partyLooting"); break;
            }
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

    await Promise.all([defaults.decode(), options.decode()]);
    await Promise.all([defaults.load(), options.load()]);

    for (const key of options.definedClippingKeys)
        (defaults.clippingRange as any)[key] = (options.clippingRange as any)[key];

    for (const key of options.definedDisplayKeys)
        (defaults.display as any)[key] = (options.display as any)[key];

    for (const key of options.definedGameKeys)
        (defaults.game as any)[key] = options.game[key];

    return { clippingRange: defaults.clippingRange, display: defaults.display, game: defaults.game };
}

export default UConfigSystem;