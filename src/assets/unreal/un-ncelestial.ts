import UAActor from "./un-aactor";
import { FObjectArray } from "./un-array";

abstract class UNCelestial extends UAActor {
    protected skins = new FObjectArray<UTexture>();

    protected radius: number;
    protected limitMaxRadius: number;
    protected lat: any;
    protected lon: any;

    protected isMakingLightmap: boolean;

    protected celestialScale: any;
    protected celestialPosition: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Radius": "radius",
            "LimitMaxRadius": "limitMaxRadius",

            "Latitude": "lat",
            "Longitude": "lon",

            "bMakeLightmap": "isMakingLightmap",
            "Position": "celestialPosition"
        });
    }
}

export default UNCelestial;
export { UNCelestial };