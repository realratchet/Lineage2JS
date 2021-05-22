import UObject from "./un-object";
import { PropertyTag } from "./un-property";
import BufferValue from "../buffer-value";
import { Plane, Vector3 } from "three";

type Euler = import("three/src/math/Euler").Euler;
type Matrix4 = import("three/src/math/Matrix4").Matrix4;
type UTexture = import("./un-texture").UTexture;
type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UTerrainLayer extends UObject {
    public map: UTexture = null;
    public alphaMap: UTexture = null;
    public scaleW: number;
    public scaleH: number;
    protected panW: number;
    protected panH: number;
    protected mapAxis: number;
    protected mapRotation: number;
    protected layerRotation: Euler;
    protected terrainMatrix: Matrix4;
    protected zPlane: Plane;
    protected wPlane: Plane;
    protected level: number[];
    protected friction: number;
    protected restitution: number;
    protected weightMap: UTexture;
    protected scale: Vector3;
    protected toWorld = new Set();
    protected toMaskmap = new Set();
    protected useAlpha: boolean;
    protected unkNum0: number;
    protected z: number;

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
            "ZPlane": "zPlane",
            "WPlane": "wPlane",
            "TextureMapAxis": "mapAxis",
            "TextureRotation": "mapRotation",
            "LayerRotation": "layerRotation",
            "TerrainMatrix": "terrainMatrix",
            "Level": "level",
            "KFriction": "friction",
            "KRestitution": "restitution",
            "LayerWeightMap": "weightMap",
            "Scale": "scale",
            "ToWorld": "toWorld",
            "ToMaskmap": "toMaskmap",
            "bUseAlpha": "useAlpha",
            "Z": "z"
        });
    }

    public async load(pkg: UPackage, exp: UExport) {
        await this.readNamedProps(pkg);

        const uint16 = new BufferValue(BufferValue.uint16);

        this.unkNum0 = pkg.read(uint16).value as number;

        this.readHead = pkg.tell();

        do {
            const tag = await PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid()) break;

            const postState = pkg.tell() + tag.dataSize;

            await this.loadProperty(pkg, tag);

            this.readHead = postState;

        } while (this.readHead < this.readTail);

        this.readHead = pkg.tell();

        await this.readNamedProps(pkg);

        this.readHead = this.readTail;
        pkg.seek(this.readTail, "set");

        // debugger;

        return this;
    }
}

export default UTerrainLayer;
export { UTerrainLayer };