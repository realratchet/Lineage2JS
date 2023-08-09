import FZoneInfo from "./un-zone-info";

abstract class ULevelInfo extends FZoneInfo/* implements IInfo*/ {
    declare protected l2env: GA.UL2NEnvLight;

    public setL2Env(l2env: GA.UL2NEnvLight) { this.l2env = l2env; }
    public getL2Env() { return this.l2env; }

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