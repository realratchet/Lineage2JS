import FZoneInfo from "./un-zone-info";

abstract class ULevelInfo extends FZoneInfo implements GD.IInfo {
    declare protected l2env: GA.UL2NEnvManager;
    declare protected level: GA.ULevel;

    public setL2Env(l2env: GA.UL2NEnvManager) { this.l2env = l2env; }
    public getL2Env() { return this.l2env; }

    public setLevel(level: GA.ULevel) { this.level = level; }
    public getLevel() { return this.level; }

    public getDecodeInfo(library: GD.DecodeLibrary): GD.IBaseZoneDecodeInfo {
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