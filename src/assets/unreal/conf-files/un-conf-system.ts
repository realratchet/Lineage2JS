
import BaseConfigFile from "./un-base-config";
import { consumeNextValue } from "./conf-parser";

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
export type UserConfig_T = { clippingRange: ClippingRangeConfig_T; display: DisplayConfig_T; };

class UConfigSystem extends BaseConfigFile {
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

    public async load(): Promise<this> {
        const fileContents = this.decodeConfig();

        this._loadSection(fileContents, "ClippingRange", this.clippingRange, this.definedClippingKeys);

        // C4 UClient::Init overrides the l2.ini config field with Option.ini [Video] Gamma.
        this._loadSection(fileContents, "WinDrv.WindowsClient", this.display, this.definedDisplayKeys);
        this._loadSection(fileContents, "Video", this.display, this.definedDisplayKeys);

        return this;
    }

    private _loadSection(fileContents: string, section: string, target: object, definedKeys: Set<string>): void {
        const sectionHeader = `[${section}]\r\n`;
        const sectionOffset = fileContents.indexOf(sectionHeader);

        if (sectionOffset === -1) return;

        let readOffset = sectionOffset + sectionHeader.length;

        while (true) {
            let nextOffset = this._skipToNextToken(fileContents, readOffset);
            if (nextOffset >= fileContents.length || fileContents[nextOffset] === "[") break;

            readOffset = nextOffset;

            let nameMax: string, nameVal: string, readContent: number;

            try {
                [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);
            } catch { break; }

            readOffset += readContent;

            const key = nameMax;//.toLowerCase();
            const val = parseFloat(nameVal);

            if (!isNaN(val)) {
                Object.keys(target).forEach(k => {
                    if (k.toLowerCase() === key.toLowerCase()) {
                        (target as any)[k] = val;
                        definedKeys.add(k);
                    }
                });
            }
        }
    }

    private _skipToNextToken(fileContents: string, offset: number): number {
        while (offset < fileContents.length) {
            if (fileContents[offset] === ';') {
                const eol = fileContents.indexOf('\r\n', offset);
                if (eol === -1) return fileContents.length;
                offset = eol + 2;
                continue;
            }
            if (/\s/.test(fileContents[offset])) {
                offset++;
                continue;
            }
            break;
        }
        return offset;
    }
}

async function getUserConfig(): Promise<UserConfig_T> {
    const defaults = new UConfigSystem("assets/system/l2.ini");
    const options = new UConfigSystem("assets/system/Option.ini");

    await Promise.all([defaults.decode(), options.decode()]);
    await Promise.all([defaults.load(), options.load()]);

    for (const key of options.definedClippingKeys)
        (defaults.clippingRange as any)[key] = (options.clippingRange as any)[key];

    for (const key of options.definedDisplayKeys)
        (defaults.display as any)[key] = (options.display as any)[key];

    return { clippingRange: defaults.clippingRange, display: defaults.display };
}

export default UConfigSystem;
export { UConfigSystem, getUserConfig };