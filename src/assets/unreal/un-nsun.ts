import UNCelestial from "./un-ncelestial";

abstract class UNSun extends UNCelestial {
    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "SunScale": "celestialScale",
        });
    }

    public getDecodeInfo(library: GD.DecodeLibrary) {
        const sprites = this.loadSelf().skins?.map(skin => skin.loadSelf().getDecodeInfo(library));

        return {
            type: "Sun",
            sprites
        };
    }
}

export default UNSun;
export { UNSun };