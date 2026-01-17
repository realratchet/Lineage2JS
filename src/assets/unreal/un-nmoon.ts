import UNCelestial from "./un-ncelestial";

abstract class UNMoon extends UNCelestial {
    public readonly careUnread: boolean = false;

    protected isMoonLight: boolean;
    protected envType: any;
    protected flame: any;
    protected lightHue: any;
    protected lightSaturation: any;
    protected lightBrightness: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "MoonScale": "celestialScale",
            "bMoonLight": "isMoonLight",
            "EnvType": "envType",
            "Flame": "flame",
            "LightHue": "lightHue",
            "LightSaturation": "lightSaturation",
            "LightBrightness": "lightBrightness"
        });
    }

    public getDecodeInfo(library: GD.DecodeLibrary) {
        const sprites = this.loadSelf().skins?.map(skin => skin.loadSelf().getDecodeInfo(library));

        return {
            type: "Moon",
            sprites
        };
    }
}

export default UNMoon;
export { UNMoon };