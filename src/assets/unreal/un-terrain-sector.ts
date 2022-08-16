import UObject from "./un-object";
import FBox from "./un-box";
import BufferValue from "../buffer-value";
import FArray, { FPrimitiveArray } from "./un-array";
import FUnknownStruct from "./un-unknown-struct";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import { selectByTime, terrainAmbient } from "./un-time-list";
import FVector from "./un-vector";
import timeOfDay, { indexToTime } from "./un-time-of-day-helper";

class UTerrainSector extends UObject {
    protected readHeadOffset = 0;
    public readonly boundingBox: FBox = new FBox();
    protected offsetX: number;
    protected offsetY: number;
    public info: UTerrainInfo;
    protected cellNum: number;
    protected sectorWidth: number;

    protected infoId: number;
    protected unkNum0: number;
    protected unkNum1: number;
    protected unkNum2: number;

    protected unkBuf0: any;

    protected unkArr8: FArray<FUnknownStruct> = new FArray(class FUnknownStructExt extends FUnknownStruct {
        constructor() { super(40); }

        public load(pkg: UPackage): this {

            const start = pkg.tell();

            // debugger;

            const compat32 = new BufferValue(BufferValue.compat32);

            const d = pkg.read(compat32).value as number;

            // debugger;

            // pkg.read(this.buffer);

            pkg.seek(start + 40, "set");

            return this;
        }
    });

    protected shadowMaps = [
        new FPrimitiveArray(BufferValue.uint8),
        new FPrimitiveArray(BufferValue.uint8),
        new FPrimitiveArray(BufferValue.uint8),
        new FPrimitiveArray(BufferValue.uint8),
        new FPrimitiveArray(BufferValue.uint8),
        new FPrimitiveArray(BufferValue.uint8),
        new FPrimitiveArray(BufferValue.uint8),
        new FPrimitiveArray(BufferValue.uint8)
    ];

    protected texInfo: FPrimitiveArray<"uint16"> = new FPrimitiveArray(BufferValue.uint16);
    protected unk64Bytes: Int32Array;

    public async getDecodeInfo(library: DecodeLibrary, info: UTerrainInfo, { data, info: iTerrainMap }: HeightMapInfo_T): Promise<IStaticMeshObjectDecodeInfo> {
        if (this.uuid in library.geometries) return {
            type: "TerrainSegment",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid,
        } as IStaticMeshObjectDecodeInfo;

        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        await this.onLoaded();


        const width = iTerrainMap.width;
        const TypedIndicesArray = getTypedArrayConstructor(17 * 17);

        const positions = new Float32Array(17 * 17 * 3), colors = new Float32Array(17 * 17 * 3);
        const indices = new TypedIndicesArray(16 * 16 * 6);
        const ambient = selectByTime(timeOfDay, terrainAmbient).getColor();

        const trueBoundingBox = new FBox();
        const tmpVector = new FVector();

        let validShadowmap: FPrimitiveArray = null;
        for (let i = 0, len = this.shadowMaps.length; i < len; i++) {
            const timeForIndex = indexToTime(i, len);

            if ((Number(timeForIndex < timeOfDay) << 0x8 | Number(timeForIndex === timeOfDay) << 0xe) === 0x0) {
                validShadowmap = this.shadowMaps[i];
                break;
            }
        }

        const v = new FVector();

        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const offset = Math.min(hmy, (width - 1)) * width + Math.min(hmx, (width - 1));
                const idxOffset = y * 17 + x;
                const idxVertOffset = idxOffset * 3;

                const { x: px, y: pz, z: py } = v.set(hmx, hmy, data[offset]).transformBy(info.terrainCoords);

                const shadowMap = validShadowmap.getElem(idxOffset) / 255;

                positions[idxVertOffset + 0] = px;
                positions[idxVertOffset + 1] = py;
                positions[idxVertOffset + 2] = pz;

                trueBoundingBox.expandByPoint(tmpVector.set(px, py, pz));


                colors[idxVertOffset + 0] = ambient[0] * shadowMap;
                colors[idxVertOffset + 1] = ambient[1] * shadowMap;
                colors[idxVertOffset + 2] = ambient[2] * shadowMap;
            }
        }


        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                let isVisible = true;
                const idxOffset = (y * 16 + x) * 6;

                {
                    const hmx = x + this.offsetX;
                    const hmy = y + this.offsetY;

                    const offset = Math.min(hmy, (width - 1)) * width + Math.min(hmx, (width - 1));

                    let ecx = offset;
                    let edx = offset;

                    ecx = ecx & 0x1F;

                    let cl = ecx;
                    let edi = 1;

                    edi = edi << cl;
                    edx = edx >> 5;

                    let eax = info.quadVisibilityBitmap.getElem(edx);

                    eax = eax & edi;
                    // eax = 0xFFFFFFFF - eax + 1;

                    // debugger;

                    isVisible = eax !== 0;
                }

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

        const uvMultiplier = 2;
        const uvOffset = 17 * 17 * uvMultiplier;
        const itLayer = info.layers.values();
        const layerCount = info.layers.size;
        const uvs = new Float32Array(uvOffset * (layerCount + 1));

        for (let k = 0; k < layerCount; k++) {
            const layer = itLayer.next().value as UTerrainLayer;

            if (!layer.alphaMap && !layer.map)
                continue;

            const layerOffset = uvOffset * k;

            for (let y = 0; y < 17; y++) {
                for (let x = 0; x < 17; x++) {
                    const hmx = x + this.offsetX;
                    const hmy = y + this.offsetY;
                    const idxOffset = (y * 17 + x) * uvMultiplier;

                    uvs[layerOffset + idxOffset + 0] = hmx / layer.scaleW * (layer.scale.x / info.terrainScale.x) * 2.0;
                    uvs[layerOffset + idxOffset + 1] = hmy / layer.scaleH * (layer.scale.z / info.terrainScale.z) * 2.0;
                }
            }
        }

        // alpha uvs
        const layerOffset = uvOffset * layerCount;
        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const idxOffset = (y * 17 + x) * uvMultiplier;

                uvs[layerOffset + idxOffset + 0] = hmx / 255;
                uvs[layerOffset + idxOffset + 1] = hmy / 255;
            }
        }

        library.geometries[this.uuid] = {
            attributes: {
                positions,
                colors,
                // uvs
            },
            indices,
            bounds: {
                box: trueBoundingBox.isValid ? {
                    min: trueBoundingBox.min.toArray() as Vector3Arr,
                    max: trueBoundingBox.max.toArray() as Vector3Arr
                } : null
                // box: this.boundingBox.isValid ? {
                //     min: this.boundingBox.min.getVectorElements(),
                //     max: this.boundingBox.min.getVectorElements()
                // } : null
            }
        };

        library.materials[this.uuid] = {
            materialType: "terrainSegment",
            terrainMaterial: info.uuid,
            uvs: {
                textureType: "float",
                buffer: uvs,
                materialType: "texture",
                width: 17 * 17,
                height: layerCount + 1,
                format: "rg"
            } as IDataTextureDecodeInfo
        } as IMaterialTerrainSegmentDecodeInfo;

        return {
            uuid: this.uuid,
            name: this.objectName,
            type: "TerrainSegment",
            geometry: this.uuid,
            materials: this.uuid
        };
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        // pkg.seek(exp.offset.value as number, "set");
        // console.info(exp.objectName);

        this.setReadPointers(exp);
        pkg.seek(this.readHead, "set");

        // pkg.dump(1, true, false);
        pkg.seek(1);

        this.infoId = pkg.read(new BufferValue(BufferValue.compat32)).value as number;

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

        // if (this.unkArr8.length > 0)
        //     debugger;

        this.cellNum = pkg.read(uint32).value as number;
        this.sectorWidth = pkg.read(uint32).value as number;

        this.readHead = pkg.tell();

        // pkg.seek(1);

        // const buff = pkg.buffer.slice(this.readHead, this.readTail);
        // const blob = new Blob([buff], { type: "application/octet-stream" });
        // const url = URL.createObjectURL(blob);
        // window.open(url, "_blank");

        // debugger;

        this.shadowMaps.forEach(sm => sm.load(pkg));

        this.unk64Bytes = new Int32Array(pkg.read(BufferValue.allocBytes(64)).bytes.buffer);


        this.texInfo.load(pkg);

        this.readHead = pkg.tell();

        return this;
    }
}

export default UTerrainSector;
export { UTerrainSector };

type HeightMapInfo_T = { data: Uint16Array, info: ITextureDecodeInfo };