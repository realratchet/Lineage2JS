
import BaseConfigFile from "./un-base-config";
import { consumeNextValue, findSection } from "./conf-parser";

export interface ClippingRangeConfig {
    StaticMesh: number;
    StaticMeshLod: number;
    Pawn: number;
    Terrain: number;
    Actor: number;
    Projector: number;
    AntiPortal: number;
    PawnMin: number;
    PawnMax: number;
}

class UConfigSystem extends BaseConfigFile {
    public clippingRange: ClippingRangeConfig = {
        StaticMesh: 4.0,
        StaticMeshLod: 5.0,
        Pawn: 2.0,
        Terrain: 8.0,
        Actor: 4.0,
        Projector: 0.2,
        AntiPortal: 1.5,
        PawnMin: 1.5,
        PawnMax: 3.0
    };

    public async load(): Promise<this> {
        const fileContents = this.decodeConfig();

        // Parse [ClippingRange]
        this._loadClippingRange(fileContents);

        return this;
    }

    private _loadClippingRange(fileContents: string): void {
        let readOffset = findSection(fileContents, "ClippingRange");
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
                // Case-insensitive matching effectively
                Object.keys(this.clippingRange).forEach(k => {
                    if (k.toLowerCase() === key.toLowerCase()) {
                        (this.clippingRange as any)[k] = val;
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

export default UConfigSystem;
