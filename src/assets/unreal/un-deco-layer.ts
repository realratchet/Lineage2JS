import UObject from "./un-object";
import { PropertyTag } from "./un-property";
import { Euler } from "three";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;
type UTexture = import("./un-texture").UTexture;
type UStaticMesh = import("./static-mesh/un-static-mesh").UStaticMesh;
type FRangeVector = import("./un-range").FRangeVector;

class UDecoLayer extends UObject {
    public static readonly typeSize: number = 128;
    protected showOnTerrain: number;
    protected scaleMap: UTexture;
    protected densityMap: UTexture;
    protected colorMap: UTexture;
    protected staticMesh: UStaticMesh;
    protected scaleMultiplier: FRangeVector;
    protected ambientRandom: string;
    protected rotator: Euler;
    protected leaf: number;
    protected ambientSoundType: number[];

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "ShowOnTerrain": "showOnTerrain",
            "ScaleMap": "scaleMap",
            "DensityMap": "densityMap",
            "ColorMap": "colorMap",
            "StaticMesh": "staticMesh",
            "ScaleMultiplier": "scaleMultiplier",
            "AmbientRandom": "ambientRandom",
            "Rotator": "rotator",
            "iLeaf": "leaf",
            "AmbientSoundType": "ambientSoundType"
        });
    }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + 182;

        await this.readNamedProps(pkg);

        pkg.seek(this.readTail, "set");

        return this;
    }
}

export default UDecoLayer;
export { UDecoLayer };