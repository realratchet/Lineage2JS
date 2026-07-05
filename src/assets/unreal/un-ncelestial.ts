import UAActor from "./un-aactor";

abstract class UNCelestial extends UAActor {
    declare protected radius: number;
    declare protected limitMaxRadius: number;
    declare protected lat: number;
    declare protected lon: number;

    declare protected isMakingLightmap: boolean;

    declare protected celestialScale: number;
    declare protected celestialPosition: GA.FVector;

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

    /**
     * Get common celestial decode info
     */
    protected getCelestialDecodeInfo() {
        const self = this.loadSelf();

        let position: [number, number, number] | undefined;
        if (self.celestialPosition) {
            position = self.celestialPosition.getElements() as [number, number, number];
        }

        return {
            lat: self.lat,
            lon: self.lon,
            radius: self.radius,
            limitMaxRadius: self.limitMaxRadius,
            // Use actor's drawScale as the base visual size
            // celestialScale is a time-based modifier applied by the game at runtime
            drawScale: self.drawScale ?? 1,
            celestialScale: self.celestialScale ?? 1,
            position,
            objectName: self.objectName
        };
    }
}

export default UNCelestial;
export { UNCelestial };