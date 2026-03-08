import UBrush from "./un-brush";

abstract class UVolume extends UBrush {
    declare protected locationPriority: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "LocationPriority": "locationPriority"
        })
    }

    public getDecodeInfo(library?: any): any {
        return {
            uuid: this.uuid,
            type: "Volume",
            name: this.objectName,
            bounds: this.brush.loadSelf().decodeBoundsInfo()
        };
    }
}

export default UVolume;
export { UVolume };