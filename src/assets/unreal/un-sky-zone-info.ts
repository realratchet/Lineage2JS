import UObject from "./un-object";
import UAActor from "./un-aactor";
import { PropertyTag } from "./un-property";

class USkyZoneInfo extends UAActor {
    protected readHeadOffset: number = 17;

    protected panSpeedU: number;
    protected panSpeedV: number;

    protected lensFlare = new Set();
    protected lensFlareOffset = new Set();
    protected lensFlareScale = new Set();

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "TexUPanSpeed": "panSpeedU",
            "TexVPanSpeed": "panSpeedV",
            "LensFlare": "lensFlare",
            "LensFlareOffset": "lensFlareOffset",
            "LensFlareScale": "lensFlareScale",
        });
    }
}

export default USkyZoneInfo;
export { USkyZoneInfo };