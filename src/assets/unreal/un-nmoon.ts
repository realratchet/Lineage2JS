import UNCelestial from "./un-ncelestial";
import type { DecodeLibraryBuilder } from "./decode-library-builder";

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

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        const self = this.loadSelf();
        const sprites = self.skins?.map(skin => builder.pullMaterial(skin));

        return {
            type: "Moon",
            sprites,
            envType: self.envType,
            ...this.getCelestialDecodeInfo()
        };
    }
}

export default UNMoon;
export { UNMoon };
