
import BaseConfigFile from "./un-base-config";
import { consumeNextValue, findSection } from "./conf-parser";

class UConfigSystem extends BaseConfigFile {
    // Option.ini only overrides keys it defines.
    public readonly definedClippingKeys = new Set<string>();

    public clippingRange: GA.IClippingRangeConfig = {
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

    public async load(): Promise<this> {
        const fileContents = this.decodeConfig();

        this._loadSection(fileContents, "ClippingRange", this.clippingRange, this.definedClippingKeys);

        return this;
    }

    private _loadSection(fileContents: string, section: string, target: object, definedKeys: Set<string>): void {
        let readOffset = findSection(fileContents, section);
        if (readOffset === -1) return;

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

async function getUserConfig(): Promise<GA.IUserConfig> {
    const defaults = new UConfigSystem("assets/system/l2.ini");
    const options = new UConfigSystem("assets/system/Option.ini");

    await Promise.all([defaults.decode(), options.decode()]);
    await Promise.all([defaults.load(), options.load()]);

    for (const key of options.definedClippingKeys)
        (defaults.clippingRange as any)[key] = (options.clippingRange as any)[key];

    return { clippingRange: defaults.clippingRange };
}

export default UConfigSystem;
export { getUserConfig };
