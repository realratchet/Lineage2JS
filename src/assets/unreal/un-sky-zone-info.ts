import UAActor from "./un-aactor";

class USkyZoneInfo extends UAActor {
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