import FZoneInfo from "./un-zone-info";

abstract class ULevelInfo extends FZoneInfo/* implements IInfo*/ {
    public getDecodeInfo(library: GD.DecodeLibrary): GD.ISectorDecodeInfo {
        return {
            uuid: this.uuid,
            type: "Sector",
            bounds: { isValid: false, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
            name: this.objectName,
            children: []
        };
    }
}

export default ULevelInfo;
export { ULevelInfo };