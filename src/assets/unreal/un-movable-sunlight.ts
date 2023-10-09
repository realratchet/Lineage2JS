import { saturationToBrightness } from "@client/utils/hsv-to-rgb";
import ULight from "./un-light";

abstract class UNMovableSunLight extends ULight {
    // public lightness: number = 128;
    // public type = 0x13;

    // protected getPropertyMap() {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         "LightBrightness": "lightness"
    //     });
    // }

    // protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
    //     super.doLoad(pkg, exp);

    //     this.readHead = pkg.tell();
    // }

    public getDecodeInfo(library: GD.DecodeLibrary): any {
        return {
            type: "Sunlight",
            name: this.objectName,
            light: this,
            position: this.location.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            scale: this.scale.getVectorElements(),
            color: this.getColor(),
            lightness: saturationToBrightness(this.brightness),
            lightType: this.type,
            lightEffect: this.effect
        };
    }
}

export default UNMovableSunLight;
export { UNMovableSunLight };