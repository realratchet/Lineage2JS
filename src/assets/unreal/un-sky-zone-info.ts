import DecodeLibrary from "./decode-library";
import UZoneInfo from "./un-zone-info";

class USkyZoneInfo extends UZoneInfo/* implements IInfo*/ {
    // public getDecodeInfo(library: DecodeLibrary): ISkyZoneDecodeInfo {
    //     return {
    //         uuid: this.uuid,
    //         type: "Sky",
    //         name: this.objectName,
    //         bounds: { isValid: false, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
    //         children: []
    //     }
    // }
}

export default USkyZoneInfo;
export { USkyZoneInfo };