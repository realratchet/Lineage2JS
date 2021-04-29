import UObject from "./un-object";
import { PropertyTag } from "./un-property";
import FArray from "./un-array";
import BufferValue from "../buffer-value";

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

    constructor(readHead: number, readTail: number) {
        super();

        this.readHead = readHead;
        this.readTail = readTail;
    }

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
        do {
            const tag = await PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid()) break;

            await this.loadProperty(pkg, tag);

            this.readHead = pkg.tell();

        } while (this.readHead < this.readTail);

        do {
            const tag = await PropertyTag.from(pkg, this.readHead);
            // if (tag.name !== "None")
            //     console.log(pkg.tell(), tag.name);

            // this.readHead = pkg.tell();
            this.readHead += 1;
        } while (this.readHead < this.readTail);

        pkg.seek(this.readTail, "set");

        // debugger;

        return this;
    }
}

export default UTerrainLayer;
export { UTerrainLayer };