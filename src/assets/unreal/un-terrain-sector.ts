import UPackage from "./un-package";
import UObject from "./un-object";
import UBox from "./un-box";
import BufferValue from "../buffer-value";
import { PropertyTag } from "./un-property";
import FArray from "./un-array";
import FUnknownStruct from "./un-unknown-struct";
import FNumber from "./un-number";
import { Object3D, Texture, DataTexture, BufferGeometry, Float32Attribute, Uint16BufferAttribute, MeshBasicMaterial, Mesh, Float32BufferAttribute, DoubleSide } from "three";

type UExport = import("./un-export").UExport;
type UTerrainInfo = import("./un-terrain-info").UTerrainInfo;

class UTerrainSector extends UObject {
    protected readHeadOffset = 0;
    protected boundingBox: UBox = new UBox();
    protected unkNum0: number;
    protected offsetX: number;
    protected offsetY: number;
    protected info: UTerrainInfo;
    protected cellNum: number;
    protected sectorWidth: number;

    protected unkArr8: FArray<FNumber> = new FArray(class FUnknownStructExt extends FUnknownStruct {
        public static readonly typeSize = 40;

        constructor() {
            super(40);
        }
    });

    // likely lightning
    protected unkArr0: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr1: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr2: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr3: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr4: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr5: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr6: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);
    protected unkArr7: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint8) as any);

    protected texInfo: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.uint16) as any);

    public constructor(terrainInfo: UTerrainInfo) {
        super();

        this.info = terrainInfo;
    }

    public async decodeMesh(heightMap: DataTexture) {
        const scale = 128;
        // const [sectorX, sectorY] = [this.offsetX, this.offsetY].map(v => v / 256);
        const vertices = new Float32Array(17 * 17 * 3);
        const { data, width, height } = heightMap.image;

        // console.log(sectorX, sectorY, this.offsetX, this.offsetY);

        // debugger;

        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const offset = Math.min(hmy, 255) * width + Math.min(hmx, 255);
                const height = data[offset];

                // if (y === 0 && x === 0 || y === 16 && x === 16)
                //     console.log(this.offsetX, this.offsetY, hmx, hmy, offset);

                vertices[(y * 17 + x) * 3 + 0] = hmx * scale;
                vertices[(y * 17 + x) * 3 + 1] = height * this.info.terrainScale.z / 2 + this.info.location.y;
                vertices[(y * 17 + x) * 3 + 2] = hmy * scale;
            }

            // debugger;
        }

        const indices = new Uint16Array(16 * 16 * 6);

        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                // const quadX = sectorX * 16 + x;
                // const quadZ = sectorY * 16 + y;
                // const quadIndex = quadZ * 256 + quadX;
                // const quadValue = this.info.quadVisibilityBitmap.getElem(quadIndex >> 3).value;
                // const isVisible = quadValue & (0x00000001 << (quadIndex % 8));
                const isVisible = true;

                if (!isVisible) {
                    indices[(y * 16 + x) * 6 + 0] = y * 17 + x;
                    indices[(y * 16 + x) * 6 + 1] = y * 17 + x;
                    indices[(y * 16 + x) * 6 + 2] = y * 17 + x;

                    indices[(y * 16 + x) * 6 + 3] = y * 17 + x;
                    indices[(y * 16 + x) * 6 + 4] = y * 17 + x;
                    indices[(y * 16 + x) * 6 + 5] = y * 17 + x;
                    continue;
                }

                indices[(y * 16 + x) * 6 + 0] = (y * 17 + x);
                indices[(y * 16 + x) * 6 + 1] = ((y + 1) * 17 + x);
                indices[(y * 16 + x) * 6 + 2] = (y * 17 + (x + 1));

                indices[(y * 16 + x) * 6 + 3] = (y * 17 + (x + 1));
                indices[(y * 16 + x) * 6 + 4] = ((y + 1) * 17 + x);
                indices[(y * 16 + x) * 6 + 5] = ((y + 1) * 17 + (x + 1));
            }
        }

        const material = new MeshBasicMaterial({ color: Math.round(0xffffff * Math.random()) });
        const geometry = new BufferGeometry();
        const attrPosition = new Float32BufferAttribute(vertices, 3);
        const attrIndices = new Uint16BufferAttribute(indices, 1);
        const mesh = new Mesh(geometry, material);

        geometry.setAttribute("position", attrPosition);
        geometry.setIndex(attrIndices);

        return mesh;
    }

    public async load(pkg: UPackage, exp: UExport) {
        pkg.seek(exp.offset.value as number, "set");
        console.info(exp.objectName);

        this.setReadPointers(exp);
        pkg.seek(this.readHead, "set");

        pkg.seek(1);
        this.readHead = pkg.tell();

        do {
            const tag = await PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid())
                break;

            await this.loadProperty(pkg, tag);

            this.readHead = pkg.tell();

        } while (this.readHead < this.readTail);

        this.unkNum0 = pkg.read(new BufferValue(BufferValue.int32)).value as number;

        const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);

        this.offsetX = pkg.read(int32).value as number;
        this.offsetY = pkg.read(int32).value as number;

        await this.boundingBox.load(pkg);

        await this.unkArr8.load(pkg);

        this.cellNum = pkg.read(uint32).value as number;
        this.sectorWidth = pkg.read(uint32).value as number;
   
        await this.unkArr0.load(pkg);
     
        await this.unkArr1.load(pkg);
        await this.unkArr2.load(pkg);
        await this.unkArr3.load(pkg);
        await this.unkArr4.load(pkg);
        await this.unkArr5.load(pkg);
        await this.unkArr6.load(pkg);
        await this.unkArr7.load(pkg);

        pkg.seek(64); // unknown 

        await this.texInfo.load(pkg);

        return this;
    }
}

export default UTerrainSector;
export { UTerrainSector };