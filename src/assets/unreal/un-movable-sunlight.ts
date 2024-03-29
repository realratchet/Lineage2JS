import ULight from "./un-light";

class UNMovableSunLight extends ULight {
    public lightness: number = 128;
    public type = 0x13;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "LightBrightness": "lightness"
        });
    }

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();
    }

    public getDecodeInfo(library: DecodeLibrary): any {
        // debugger;

        return {
            type: "Sunlight",
            name: this.objectName,
            position: this.location.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            scale: this.scale.getVectorElements(),
            lightness: this.lightness / 255,
            lightType: this.type
        };
    }
}

export default UNMovableSunLight;
export { UNMovableSunLight };