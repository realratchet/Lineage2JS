import UObject from "@l2js/core";
import FBox from "./un-box";
import { BufferValue } from "@l2js/core";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import FArray, { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";
import FVector from "@client/assets/unreal/un-vector";
import { indexToTime } from "@client/assets/unreal/un-l2env";

class FTerrainLightInfo implements C.IConstructable {
    public lightIndex: number;
    public light: GA.ULight;
    public visibilityBitmap = new FPrimitiveArray(BufferValue.uint8);

    public load(pkg: GA.UPackage): this {

        const compat32 = new BufferValue(BufferValue.compat32);

        this.lightIndex = pkg.read(compat32).value;

        if (this.lightIndex !== 0) this.light = pkg.fetchObject(this.lightIndex);

        this.visibilityBitmap.load(pkg);

        return this;
    }
}

abstract class UTerrainSector extends UObject {
    declare public boundingBox: FBox;
    declare protected offsetX: number;
    declare protected offsetY: number;
    declare public info: GA.FTerrainInfo;
    declare protected hasShadows: boolean;
    declare protected shadowCount: number;

    declare protected infoId: number;
    declare protected quadsX: number;
    declare protected quadsY: number;
    declare protected unkNum2: number;

    declare protected unkBuf0: any;

    declare pkg: GA.UPackage;

    // likely mesh lights?
    declare protected lightInfos: FArray<FTerrainLightInfo>;

    declare protected shadowMaps: FPrimitiveArray<"uint8">[];
    declare protected shadowMapTimes: number[];

    declare protected texInfo: FPrimitiveArray<"uint16">;
    declare protected unkElements: Int16Array;

    public getDecodeInfo(library: GD.DecodeLibrary, info: GA.FTerrainInfo, { data, info: iTerrainMap }: HeightMapInfo_T): IStaticMeshObjectDecodeInfo {
        const center = this.boundingBox.getCenter();
        const { x: ox, y: oz, z: oy } = center;

        const env = info.levelInfo.getL2Env();

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

        const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), colors = new Float32Array(17 * 17 * 3);
        const indices = new TypedIndicesArray(16 * 16 * 6);
        const ambient = env.getAmbientPlaneTerrainLight();

        const trueBoundingBox = FBox.make();
        const tmpVector = FVector.make();

        let validShadowmap: C.FPrimitiveArray<"uint8"> = null;
        if (this.shadowCount > 0) {
            let idx = 0;
            do {
                if (env.timeOfDay < this.shadowMapTimes[idx])
                    break;
                idx++;

            } while (idx < this.shadowCount)
            validShadowmap = this.shadowMaps[idx];
        }

        const v = FVector.make();

        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const offset = Math.min(hmy, (width - 1)) * width + Math.min(hmx, (width - 1));
                const idxOffset = y * 17 + x;
                const idxVertOffset = idxOffset * 3;

                const { x: px, y: pz, z: py } = v.set(hmx, hmy, data[offset]).transformBy(info.toWorld);

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

        for (let i = 0, len = this.lightInfos.length; i < len; i++) {
            const lightInfo = this.lightInfos[i];

            // if()

            debugger;
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

        this.boundingBox = FBox.make();

        super.doLoad(pkg, exp);

        if (verArchive < 94) {
            debugger;
            throw new Error("not implemented");
        }

        this.infoId = pkg.read(new BufferValue(BufferValue.compat32)).value;
        this.info = pkg.fetchObject(this.infoId);

        const int16 = new BufferValue(BufferValue.int16);
        const int32 = new BufferValue(BufferValue.int32);

        // pkg.dump(1, true, false);

        this.quadsX = pkg.read(int32).value;
        this.quadsY = pkg.read(int32).value;

        // console.log(this.unkNum0, this.unkNum1)

        // this.unkNum2 = pkg.read(uint16).value as number;

        // debugger;

        this.offsetX = pkg.read(int32).value;
        this.offsetY = pkg.read(int32).value;

        // console.log(this.offsetX, this.offsetY);

        // debugger;

        if (verArchive >= 117)
            this.boundingBox.load(pkg);
        else {
            debugger;
            throw new Error("not implemented");
        }

        this.lightInfos = new FArray(FTerrainLightInfo);
        this.lightInfos.load(pkg);

        // if (this.lightInfos.length > 0) {
        //     debugger;
        // }

        if (verLicense >= 4) {
            const hasShadows = pkg.read(int32).value;

            this.hasShadows = hasShadows !== 0;

            if (hasShadows !== 0 && hasShadows !== 1)
                debugger;

            if (this.hasShadows && this.info) {
                this.shadowCount = pkg.read(int32).value;
                this.shadowMaps = new Array<FPrimitiveArray<"uint8">>(this.shadowCount);
                this.shadowMapTimes = new Array<number>(this.shadowCount);

                for (let i = 0; i < this.shadowCount; i++) {
                    this.shadowMaps[i] = new FPrimitiveArray(BufferValue.uint8).load(pkg);
                    this.shadowMapTimes[i] = i * 24 / this.shadowCount + 12 / this.shadowCount
                }
            }
        }

        this.unkElements = new Int16Array(32);
        if (verLicense >= 8) {
            for (let i = 0; i < 32; i++) {
                this.unkElements[i] = pkg.read(int16).value;
            }
        } else this.unkElements.fill(-1);

        if (verLicense > 10)
            this.texInfo = new FPrimitiveArray(BufferValue.uint16).load(pkg);

        this.readHead = pkg.tell();

        return this;
    }
}


export default UTerrainSector;
export { UTerrainSector };

type HeightMapInfo_T = { data: Uint16Array, info: GD.ITextureDecodeInfo };