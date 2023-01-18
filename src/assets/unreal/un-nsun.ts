import UNCelestial from "./un-ncelestial";

class UNSun extends UNCelestial {
    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "SunScale": "celestialScale",
        });
    }

    public getDecodeInfo(library: any): any {
        const sprites = this.skins.map(skin => skin.loadSelf().getDecodeInfo(library));

        return {
            type: "Sun",
            sprites
        };
    }
}

export default UNSun;
export { UNSun };