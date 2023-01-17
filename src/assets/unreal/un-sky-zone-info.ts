import DecodeLibrary from "./decode-library";
import UAActor from "./un-aactor";

class USkyZoneInfo extends UAActor implements IInfo {
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

    public getDecodeInfo(library: DecodeLibrary): ISkyZoneDecodeInfo {
        return {
            uuid: this.uuid,
            type: "Sky",
            name: this.objectName,
            bounds: { isValid: false, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
            children: []
        }
    }
}

export default USkyZoneInfo;
export { USkyZoneInfo };