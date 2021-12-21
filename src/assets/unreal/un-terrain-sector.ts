import UPackage from "./un-package";
import UObject from "./un-object";
import FBox from "./un-box";
import BufferValue from "../buffer-value";
import FArray, { FPrimitiveArray } from "./un-array";
import FUnknownStruct from "./un-unknown-struct";
import FNumber from "./un-number";
// import { Object3D, Texture, DataTexture, BufferGeometry, Float32Attribute, Uint16BufferAttribute, MeshBasicMaterial, Mesh, Float32BufferAttribute, DoubleSide, Sphere, Box3 } from "three";

// type UExport = import("./un-export").UExport;
// type UTerrainInfo = import("./un-terrain-info").UTerrainInfo;
// type UTerrainLayer = import("./un-terrain-layer").UTerrainLayer;

class UTerrainSector extends UObject {
    protected readHeadOffset = 0;
    protected boundingBox: FBox = new FBox();
    protected offsetX: number;
    protected offsetY: number;
    protected info: UTerrainInfo;
    protected cellNum: number;
    protected sectorWidth: number;

    protected unkId0: number;
    protected unkNum0: number;
    protected unkNum1: number;
    protected unkNum2: number;

    protected unkBuf0: any;

    protected unkArr8: FArray<FNumber> = new FArray(class FUnknownStructExt extends FUnknownStruct {
        public static readonly typeSize = 40;

        constructor() {
            super(40);
        }
    });

    // likely lightning
    protected unkArr0: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);
    protected unkArr1: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);
    protected unkArr2: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);
    protected unkArr3: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);
    protected unkArr4: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);
    protected unkArr5: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);
    protected unkArr6: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);
    protected unkArr7: FPrimitiveArray<"uint8"> = new FPrimitiveArray(BufferValue.uint8);

    protected texInfo: FPrimitiveArray<"uint16"> = new FPrimitiveArray(BufferValue.uint16);

    public constructor(terrainInfo: UTerrainInfo) {
        super();

        // debugger;

        this.info = terrainInfo;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IStaticMeshObjectDecodeInfo> {
        if (this.uuid in library.geometries) return {
            type: "TerrainSegment",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid,
        } as IStaticMeshObjectDecodeInfo;

        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        await this.onLoaded();

        const iTerrainMap = library.materials[this.info.terrainMap.uuid] as ITextureDecodeInfo;
        const width = iTerrainMap.width;
        const data = new Uint16Array(iTerrainMap.buffer);
        const vertices = new Float32Array(17 * 17 * 3), indices = new Uint16Array(16 * 16 * 6);
        const { x: sx, y: sy, z: sz } = this.info.terrainScale;

        // const sectorX = this.offsetX / 2 / 2048;
        // const sectorY = this.offsetY / 2 / 2048;

        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const offset = Math.min(hmy, 255) * width + Math.min(hmx, 255);
                const height = (data[offset] - 32768) / 128;
                const idxOffset = (y * 17 + x) * 3;

                vertices[idxOffset + 0] = hmx * sx;
                vertices[idxOffset + 1] = height * sz / 2;
                vertices[idxOffset + 2] = hmy * sy;
            }
        }

        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                // const quadX = sectorX * 16 + x;
                // const quadY = sectorY * 16 + y;
                // const quadIndex = quadY * 256 + quadX;
                // const quadValue = this.info.quadVisibilityBitmap.getElem(quadIndex >> 3);
                // const isVisible = quadValue & (0x00000001 << (quadIndex % 8));
                const isVisible = true;
                const idxOffset = (y * 16 + x) * 6;

                if (!isVisible) {

                    indices[idxOffset + 0] = y * 17 + x;
                    indices[idxOffset + 1] = y * 17 + x;
                    indices[idxOffset + 2] = y * 17 + x;

                    indices[idxOffset + 3] = y * 17 + x;
                    indices[idxOffset + 4] = y * 17 + x;
                    indices[idxOffset + 5] = y * 17 + x;
                    continue;
                }

                indices[idxOffset + 0] = (y * 17 + x);
                indices[idxOffset + 1] = ((y + 1) * 17 + x);
                indices[idxOffset + 2] = (y * 17 + (x + 1));

                indices[idxOffset + 3] = (y * 17 + (x + 1));
                indices[idxOffset + 4] = ((y + 1) * 17 + x);
                indices[idxOffset + 5] = ((y + 1) * 17 + (x + 1));
            }
        }

        const itLayer = this.info.layers.values();
        const layerCount = this.info.layers.size;
        const uvs: Float32Array[] = new Array(layerCount);

        for (let k = 0; k < layerCount; k++) {
            const layer = itLayer.next().value as UTerrainLayer;
            const uv = uvs[k] = new Float32Array(17 * 17 * 2)

            if (!layer.alphaMap && !layer.map)
                continue;

            // const usx = layer.scaleW * sx * 2.0;
            // const usy = layer.scaleH * sy * 2.0;

            const layerWidth = layer.map.width, layerHeight = layer.map.height;

            for (let y = 0; y < 17; y++) {
                for (let x = 0; x < 17; x++) {
                    const hmx = x + this.offsetX;
                    const hmy = y + this.offsetY;
                    const idxOffset = (y * 17 + x) * 2;

                    uv[idxOffset + 0] = hmx / layerWidth;
                    uv[idxOffset + 1] = hmy / layerHeight;
                }
            }
        }

        library.geometries[this.uuid] = {
            attributes: {
                positions: vertices,
                uvs
            },
            indices,
            bounds: this.decodeBoundsInfo()
        };

        return {
            type: "TerrainSegment",
            geometry: this.uuid,
            materials: this.info.uuid
        };
    }

    public decodeBoundsInfo(): IBoundsDecodeInfo {
        return {
            box: this.boundingBox.isValid ? {
                min: [this.boundingBox.min.x, this.boundingBox.min.z, this.boundingBox.min.y],
                max: [this.boundingBox.max.x, this.boundingBox.max.z, this.boundingBox.max.y]
            } : null
        };
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        // pkg.seek(exp.offset.value as number, "set");
        // console.info(exp.objectName);

        this.setReadPointers(exp);
        pkg.seek(this.readHead, "set");

        // pkg.dump(1, true, false);
        pkg.seek(1);

        this.unkId0 = pkg.read(new BufferValue(BufferValue.compat32)).value as number;

        // const uint16 = new BufferValue(BufferValue.uint16);
        // const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);

        // pkg.dump(1, true, false);

        this.unkNum0 = pkg.read(uint32).value as number;
        this.unkNum1 = pkg.read(uint32).value as number;

        // console.log(this.unkNum0, this.unkNum1)

        // this.unkNum2 = pkg.read(uint16).value as number;

        // debugger;

        this.offsetX = pkg.read(uint32).value as number;
        this.offsetY = pkg.read(uint32).value as number;

        // console.log(this.offsetX, this.offsetY);

        // debugger;

        this.boundingBox.load(pkg);
        this.unkArr8.load(pkg);

        this.cellNum = pkg.read(uint32).value as number;
        this.sectorWidth = pkg.read(uint32).value as number;

        this.readHead = pkg.tell();

        // pkg.seek(1);

        // const buff = pkg.buffer.slice(this.readHead, this.readTail);
        // const blob = new Blob([buff], { type: "application/octet-stream" });
        // const url = URL.createObjectURL(blob);
        // window.open(url, "_blank");

        // debugger;

        this.unkArr0.load(pkg);

        this.unkArr1.load(pkg);
        this.unkArr2.load(pkg);
        this.unkArr3.load(pkg);
        this.unkArr4.load(pkg);
        this.unkArr5.load(pkg);
        this.unkArr6.load(pkg);
        this.unkArr7.load(pkg);

        pkg.seek(64); // unknown 

        this.texInfo.load(pkg);

        return this;
    }
}

export default UTerrainSector;
export { UTerrainSector };