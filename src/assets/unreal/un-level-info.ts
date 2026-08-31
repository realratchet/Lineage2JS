import FZoneInfo from "./un-zone-info";
import type { ULevel } from "./un-level";
import type { DecodeLibrary } from "./decode-library";

abstract class ULevelInfo extends FZoneInfo implements GD.IInfo {
    declare protected level: ULevel;

    public setLevel(level: ULevel) { this.level = level; }
    public getLevel() { return this.level; }

    public setSkyZoneInfo(skyZone: any) { this.skyZone = skyZone; }
    public getSkyZoneInfo() { return this.skyZone; }

    public getDecodeInfo(library: DecodeLibrary): GD.IBaseZoneDecodeInfo {
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
export { ULevelInfo };
