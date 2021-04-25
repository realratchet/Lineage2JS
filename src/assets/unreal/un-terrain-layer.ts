import UObject from "./un-object";
import { PropertyTag } from "./un-property";

type Euler = import("three/src/math/Euler").Euler;
type Matrix4 = import("three/src/math/Matrix4").Matrix4;
type UTexture = import("./un-texture").UTexture;
type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UTerrainLayer extends UObject {
    protected map: UTexture = null;
    protected alphaMap: UTexture = null;
    protected scaleW: number;
    protected scaleH: number;
    protected panW: number;
    protected panH: number;
    protected mapAxis: number;
    protected mapRotation: number;
    protected layerRotation: Euler;
    protected terrainMatrix: Matrix4;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Texture": "map",
            "AlphaMap": "alphaMap",
            "UScale": "scaleW",
            "VScale": "scaleH",
            "UPan": "panW",
            "VPan": "panH",
            "TextureMapAxis": "mapAxis",
            "TextureRotation": "mapRotation",
            "LayerRotation": "layerRotation",
            "TerrainMatrix": "terrainMatrix"
        });
    }

    public async load(pkg: UPackage, exp: UExport) {
        let curOffset = pkg.tell();

        do {
            const tag = await PropertyTag.from(pkg, curOffset);

            if (!tag.isValid())
                break;

            await this.loadProperty(pkg, tag);

            curOffset = pkg.tell();

        } while (true);

        return this;
    }
}

export default UTerrainLayer;
export { UTerrainLayer };