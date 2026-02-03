import { APackage, UExport } from "@l2js/core";
import FZoneInfo from "./un-zone-info";

abstract class USkyZoneInfo extends FZoneInfo/* implements IInfo*/ {
    protected postLoad(pkg: APackage, _exp: UExport): void {
        this.levelInfo.setSkyZoneInfo(this);

        return super.postLoad(pkg, _exp);
    }

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