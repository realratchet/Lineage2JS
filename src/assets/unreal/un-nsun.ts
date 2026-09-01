import UNCelestial from "./un-ncelestial";
import type { DecodeLibraryBuilder } from "./decode-library-builder";

export abstract class UNSun extends UNCelestial {
    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "SunScale": "celestialScale",
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        const self = this.loadSelf();
        const sprites = self.skins?.map(skin => builder.pullMaterial(skin));

        // debugger;

        return {
            type: "Sun",
            sprites,
            ...this.getCelestialDecodeInfo()
        };
    }
}

export default UNSun;
