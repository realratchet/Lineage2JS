import FZoneInfo, { type IInfo, type IBaseZoneDecodeInfo } from "./un-zone-info";
import type { ULevel } from "./un-level";
import type { DecodeLibrary } from "./decode-library";

export abstract class ULevelInfo extends FZoneInfo implements IInfo {
    declare protected level: ULevel;

    public setLevel(level: ULevel) { this.level = level; }
    public getLevel() { return this.level; }

    public setSkyZoneInfo(skyZone: any) { this.skyZone = skyZone; }
    public getSkyZoneInfo() { return this.skyZone; }

    public getDecodeInfo(library: DecodeLibrary): IBaseZoneDecodeInfo {
        return {
            type: "Sector",
            uuid: this.uuid,
            name: this.objectName,
            bounds: {
                isValid: false,
                min: [Infinity, Infinity, Infinity],
                max: [-Infinity, -Infinity, -Infinity]
            },
            children: [],
            fog: null
        };
    }
}

export default ULevelInfo;
