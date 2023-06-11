import UAActor from "./un-aactor";

abstract class UNCelestial extends UAActor {
    declare protected skins: C.FObjectArray<GA.UTexture>;

    declare protected radius: number;
    declare protected limitMaxRadius: number;
    declare protected lat: any;
    declare protected lon: any;

    declare protected isMakingLightmap: boolean;

    declare protected celestialScale: any;
    declare protected celestialPosition: any;

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