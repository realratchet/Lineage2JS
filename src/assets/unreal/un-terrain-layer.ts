import UObject from "./un-object";

class UTerrainLayer extends UObject {
    public map: UTexture = null;
    public alphaMap: UTexture = null;
    public scaleW: number;
    public scaleH: number;
    protected panW: number;
    protected panH: number;
    protected mapAxis: number;
    protected mapRotation: number;
    protected layerRotation: FRotator;
    protected terrainMatrix: UMatrix;
    protected zPlane: FPlane;
    protected wPlane: FPlane;
    protected level: number[];
    protected friction: number;
    protected restitution: number;
    protected weightMap: UTexture;
    public scale: FVector;
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
            "bUseAlpha": "useAlpha"
        });
    }

    public preLoad(pkg: UPackage, exp: UExport) { }

    public doLoad(pkg: UPackage, exp: UExport) {
        // debugger;

        // const startOffset = pkg.tell();

        pkg.seek(this.readHead, "set");
        this.readNamedProps(pkg);

        // if (!this.map || !this.alphaMap)
        //     debugger;

        // console.log(`Bytes left: ${this.readTail - pkg.tell()}`);

        console.assert((this.readTail - pkg.tell()) === 0);

        // const uint16 = new BufferValue(BufferValue.uint16);

        // this.unkNum0 = await pkg.read(uint16).value as number;

        // this.readHead = pkg.tell();

        // debugger;

        // console.log(`Bytes left: ${this.readTail - pkg.tell()}`);

        // do {
        //     const tag = await PropertyTag.from(pkg, this.readHead);

        //     if (!tag.isValid()) break;

        //     const postState = pkg.tell() + tag.dataSize;

        //     await this.loadProperty(pkg, tag);

        //     this.readHead = postState;

        //     console.log(`Bytes left: ${this.readTail - pkg.tell()}`);

        // } while (this.readHead < this.readTail);

        // this.readHead = pkg.tell();

        // await this.readNamedProps(pkg);

        // this.readHead = this.readTail;
        // pkg.seek(this.readTail, "set");

        // console.log(`Bytes left: ${this.readTail - pkg.tell()}`);

        // debugger;

        // this.bytesUnread

        return this;
    }
}

export default UTerrainLayer;
export { UTerrainLayer };