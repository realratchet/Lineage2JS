import UObject from "@l2js/core";
import FBox from "./un-box";
import { BufferValue } from "@l2js/core";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import { selectByTime, terrainAmbient } from "./un-time-list";
import FVector from "./un-vector";
import timeOfDay, { indexToTime } from "./un-time-of-day-helper";
import FArray, { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";

class FTerrainLightInfo implements C.IConstructable {
    public lightIndex: number;
    public someData = new FPrimitiveArray(BufferValue.uint8);

    public load(pkg: GA.UPackage): this {

        const compat32 = new BufferValue(BufferValue.compat32);

        this.lightIndex = pkg.read(compat32).value;
        this.someData.load(pkg);

        return this;
    }
}

class UTerrainSector extends UObject {
    declare public boundingBox: FBox;
    declare protected offsetX: number;
    declare protected offsetY: number;
    declare public info: GA.FTerrainInfo;
    declare protected cellNum: number;
    declare protected sectorWidth: number;

    declare protected infoId: number;
    declare protected unkNum0: number;
    declare protected unkNum1: number;
    declare protected unkNum2: number;

    declare protected unkBuf0: any;

    // likely mesh lights?
    declare protected likelySegmentLights: FArray<FTerrainLightInfo>;

    declare protected shadowMaps: [
        FPrimitiveArray<"uint8">,
        FPrimitiveArray<"uint8">,
        FPrimitiveArray<"uint8">,
        FPrimitiveArray<"uint8">,
        FPrimitiveArray<"uint8">,
        FPrimitiveArray<"uint8">,
        FPrimitiveArray<"uint8">,
        FPrimitiveArray<"uint8">
    ];

    declare protected texInfo: FPrimitiveArray<"uint16">;
    declare protected unk64Bytes: Int32Array;

    public getDecodeInfo(library: GD.DecodeLibrary, info: GA.FTerrainInfo, { data, info: iTerrainMap }: HeightMapInfo_T): IStaticMeshObjectDecodeInfo {
        const center = this.boundingBox.getCenter();
        const { x: ox, y: oz, z: oy } = center;

        if (this.uuid in library.geometries) return {
            uuid: this.uuid,
            name: this.objectName,
            type: "TerrainSegment",
            geometry: this.uuid,
            materials: this.uuid,
            position: [ox, oy, oz]
        };

        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        const vertexCount = 17 * 17;
        const width = iTerrainMap.width;
        const TypedIndicesArray = getTypedArrayConstructor(vertexCount);

        const positions = new Float32Array(vertexCount * 3), colors = new Float32Array(17 * 17 * 3);
        const indices = new TypedIndicesArray(16 * 16 * 6);
        const ambient = selectByTime(timeOfDay, terrainAmbient).getColor();

        const trueBoundingBox = new FBox();
        const tmpVector = new FVector();

        let validShadowmap: C.FPrimitiveArray<any> = null;
        for (let i = 0, len = this.shadowMaps.length; i < len; i++) {
            const timeForIndex = indexToTime(i, len);

            if (timeForIndex > timeOfDay && this.shadowMaps[i].getElemCount() >= vertexCount) {
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

                positions[idxVertOffset + 0] = px - ox;
                positions[idxVertOffset + 1] = py - oy;
                positions[idxVertOffset + 2] = pz - oz;

                trueBoundingBox.expandByPoint(tmpVector.set(px, py, pz));

                const shadowMap = validShadowmap ? validShadowmap.getElem(idxOffset) / 255 : 1;

                colors[idxVertOffset + 0] = ambient[0] * shadowMap;
                colors[idxVertOffset + 1] = ambient[1] * shadowMap;
                colors[idxVertOffset + 2] = ambient[2] * shadowMap;

                // {
                //     const hmx = x + this.offsetX;
                //     const hmy = y + this.offsetY;

                //     const vertexIndex = Math.min(hmy, (width - 1)) * width + Math.min(hmx, (width - 1));
                //     const indexOffset = vertexIndex >> 5;
                //     const vertexMask = 1 << (vertexIndex & 0x1F);

                //     const isVisible = (info.quadVisibilityBitmap.getElem(indexOffset) & vertexMask);

                //     const idxOffset = y * 17 + x;
                //     const idxVertOffset = idxOffset * 3;

                //     if (isVisible > 32)
                //         debugger;

                //     colors[idxVertOffset + 0] = 0;
                //     colors[idxVertOffset + 1] = Number(isVisible === 32);
                //     colors[idxVertOffset + 2] = Number(isVisible === 0);
                // }
            }
        }


        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                let isVisible = true;
                const idxOffset = (y * 16 + x) * 6;

                {
                    const hmx = x + this.offsetX;
                    const hmy = y + this.offsetY;

                    const vertexIndex = Math.min(hmy, (width - 1)) * width + Math.min(hmx, (width - 1));
                    const indexOffset = vertexIndex >> 5;
                    const vertexMask = 1 << (vertexIndex & 0x1F);

                    isVisible = (info.quadVisibilityBitmap.getElem(indexOffset) & vertexMask) !== 0;

                    // const idxOffset = y * 17 + x;
                    // const idxVertOffset = idxOffset * 3;

                    // colors[idxVertOffset + 0] = 0;
                    // colors[idxVertOffset + 1] = 0;
                    // colors[idxVertOffset + 2] = Number(!isVisible);
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
        const layers = info.layers.filter(x => x);
        const layerCount = layers.length;
        const uvs = new Float32Array(uvOffset * (layerCount + 1));

        // debugger;

        for (let k = 0; k < layerCount; k++) {
            const layer = layers[k].loadSelf();

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
                    min: this.boundingBox.min.sub(center).getVectorElements() as GD.Vector3Arr,
                    max: this.boundingBox.max.sub(center).getVectorElements() as GD.Vector3Arr
                } : null
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
            } as GD.IDataTextureDecodeInfo
        } as GD.IMaterialTerrainSegmentDecodeInfo;

        return {
            uuid: this.uuid,
            name: this.objectName,
            type: "TerrainSegment",
            geometry: this.uuid,
            materials: this.uuid,
            position: [ox, oy, oz]
        };
    }

    public doLoad(pkg: GA.UPackage, exp: C.UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        // if (verArchive <= 0x5E) {
        //     console.warn("Unsupported yet");
        //     debugger;
        // }

        // if (verArchive >= 0x75) {
        //     console.warn("Unsupported yet");
        //     debugger;
        // }

        // if (verArchive < 0x59) {
        //     console.warn("Unsupported yet");
        //     debugger;
        // }

        // if (verArchive < 0x75) {
        //     console.warn("Unsupported yet");
        //     debugger;
        // }

        // if (verLicense >= 4) {
        //     console.warn("Unsupported yet");
        //     debugger;
        // }

        // if (verLicense < 8) {
        //     console.warn("Unsupported yet");
        //     debugger;
        // } else {
        //     console.warn("Unsupported yet");
        //     debugger;
        // }

        // if (verLicense < 10) {
        //     console.warn("Unsupported yet");
        //     debugger;
        // }

        // debugger;

        this.boundingBox = pkg.makeCoreStruct("Box");

        // pkg.dump(1, true, false);
        pkg.seek(1);

        this.infoId = pkg.read(new BufferValue(BufferValue.compat32)).value;
        this.info = pkg.fetchObject(this.infoId);

        // const uint16 = new BufferValue(BufferValue.uint16);
        // const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);

        // pkg.dump(1, true, false);

        this.unkNum0 = pkg.read(uint32).value;
        this.unkNum1 = pkg.read(uint32).value;

        // console.log(this.unkNum0, this.unkNum1)

        // this.unkNum2 = pkg.read(uint16).value as number;

        // debugger;

        this.offsetX = pkg.read(uint32).value;
        this.offsetY = pkg.read(uint32).value;

        // console.log(this.offsetX, this.offsetY);

        // debugger;

        this.boundingBox.load(pkg);

        // debugger;
        this.likelySegmentLights = new FArray(FTerrainLightInfo);
        this.likelySegmentLights.load(pkg);


        this.cellNum = pkg.read(uint32).value;
        this.sectorWidth = pkg.read(uint32).value;

        this.readHead = pkg.tell();

        this.shadowMaps = [
            new FPrimitiveArray(BufferValue.uint8).load(pkg),
            new FPrimitiveArray(BufferValue.uint8).load(pkg),
            new FPrimitiveArray(BufferValue.uint8).load(pkg),
            new FPrimitiveArray(BufferValue.uint8).load(pkg),
            new FPrimitiveArray(BufferValue.uint8).load(pkg),
            new FPrimitiveArray(BufferValue.uint8).load(pkg),
            new FPrimitiveArray(BufferValue.uint8).load(pkg),
            new FPrimitiveArray(BufferValue.uint8).load(pkg)
        ];

        this.unk64Bytes = new Int32Array(pkg.read(BufferValue.allocBytes(64)).bytes.buffer);

        this.texInfo = new FPrimitiveArray(BufferValue.uint16).load(pkg);

        this.readHead = pkg.tell();

        return this;
    }
}

export default UTerrainSector;
export { UTerrainSector };

type HeightMapInfo_T = { data: Uint16Array, info: GD.ITextureDecodeInfo };