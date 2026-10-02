import { APackage, UExport } from "@l2js/core";
import FZoneInfo, { type IBaseZoneDecodeInfo } from "./un-zone-info";
import type { DecodeLibrary } from "./decode-library";

export abstract class USkyZoneInfo extends FZoneInfo/* implements IInfo*/ {
    protected postLoad(pkg: APackage, _exp: UExport): void {
        this.levelInfo.setSkyZoneInfo(this);

        return super.postLoad(pkg, _exp);
    }

    public getDecodeInfo(library: DecodeLibrary): IBaseZoneDecodeInfo {
        const info = super.getDecodeInfo(library);
        info.type = "Sky";
        return info;
    }
}

export default USkyZoneInfo;
