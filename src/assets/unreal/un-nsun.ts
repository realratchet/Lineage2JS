import UNCelestial from "./un-ncelestial";

abstract class UNSun extends UNCelestial {
    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "SunScale": "celestialScale",
        });
    }

    public getDecodeInfo(library: GD.DecodeLibrary) {
        const self = this.loadSelf();
        const sprites = self.skins?.map(skin => skin.loadSelf().getDecodeInfo(library));

        // debugger;

        return {
            type: "Sun",
            sprites,
            ...this.getCelestialDecodeInfo()
        };
    }
}

export default UNSun;
export { UNSun };