import BufferValue from "../buffer-value";
import UAActor from "./un-aactor";
import FArray, { FObjectArray } from "./un-array";
import FNumber from "./un-number";

class UNSun extends UAActor {
    protected radius: number;
    protected limitMaxRadius: number;
    protected isDirectional: boolean;
    protected skins = new FObjectArray<UTexture>();

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Radius": "radius",
            "LimitMaxRadius": "limitMaxRadius",
            "Skins": "skins",
            "bDirectional": "isDirectional"
        });
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);
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