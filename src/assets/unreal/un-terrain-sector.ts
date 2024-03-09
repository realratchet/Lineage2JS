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
    declare public offsetX: number;
    declare public offsetY: number;
    declare public info: GA.FTerrainInfo;
    declare protected hasShadows: boolean;
    declare protected shadowCount: number;

    declare protected infoId: number;
    declare public quadsX: number;
    declare public quadsY: number;

    declare pkg: GA.UPackage;

    // likely mesh lights?
    declare protected lightInfos: FArray<FTerrainLightInfo>;

    declare protected shadowMaps: FPrimitiveArray<"uint8">[];
    declare protected shadowMapTimes: number[];

    declare protected texInfo: FPrimitiveArray<"uint16">;
    declare protected someSectorVisibilityMask: Int16Array;

    public getDecodeInfo(library: GD.DecodeLibrary, info: GA.FTerrainInfo, { data, info: iTerrainMap, edgeTurns }: HeightMapInfo_T): IStaticMeshObjectDecodeInfo {
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

                if (edgeTurns[offset >> 5] & (1 << (offset & 0x1f))) {
                    // 124, 423
                } else {
                    // 123, 134
                }


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

        // for (let i = 0, len = this.lightInfos.length; i < len; i++) {
        //     const lightInfo = this.lightInfos[i];

        //     // if()

        //     debugger;
        // }

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

        this.someSectorVisibilityMask = new Int16Array(32);
        if (verLicense >= 8) {
            for (let i = 0; i < 32; i++) {
                this.someSectorVisibilityMask[i] = pkg.read(int16).value;
            }
        } else this.someSectorVisibilityMask.fill(-1);

        if (verLicense > 10)
            this.texInfo = new FPrimitiveArray(BufferValue.uint16).load(pkg);

        this.readHead = pkg.tell();

        return this;
    }

    protected getVertex(x: number, y: number): FVector {
        const info = this.info;
        const vertices = info.vertices;
        const offset = info.getGlobalVertex(x, y);

        return vertices[offset];
    }

    protected getVertexColor(x: number, y: number): GA.FColor {
        const info = this.info;
        const colors = info.vertexColors;
        const offset = info.getGlobalVertex(x, y);

        return colors[offset];
    }

    protected getVertexNormal(x: number, y: number): FVector {
        const info = this.info;
        const ox = this.offsetX, oy = this.offsetY;
        const tx = (ox === 240 && x === 16) ? 15 : x;
        const ty = (oy === 240 && y === 16) ? 15 : y;
        const normal = info.getVertexNormal(ox + tx, oy + ty);

        return normal;
    }



    public generateTriangles() {
        const info = this.info;
        const invSize = 1 / 4096;
        const hmx = info.heightmapX, hmy = info.heightmapY;

        const vertexCount = (this.quadsX + 1) * (this.quadsY + 1);
        const vertices = new Float32Array(vertexCount * 3);
        const normals = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const colors = new Float32Array(vertexCount * 4);

        for (let y = 0, it3 = 0, it2 = 0, it4 = 0; y <= this.quadsY; y++) {
            for (let x = 0; x <= this.quadsX; x++, it4 += 4, it3 += 3, it2 += 2) {
                const vertex = this.getVertex(x, y);
                const normal = this.getVertexNormal(x, y);
                const color = this.getVertexColor(x, y);

                const ix = this.offsetX + x, iy = this.offsetY + y;
                const hix = ix + 0.5, hiy = iy + 0.5;
                const u = hix / hmx - (ix >= 240 ? (ix - 240) * invSize : 0);
                const v = hiy / hmy - (iy >= 240 ? (iy - 240) * invSize : 0);

                vertices[it3 + 0] = vertex.x;
                vertices[it3 + 1] = vertex.y;
                vertices[it3 + 2] = vertex.z;

                normals[it3 + 0] = normal.x;
                normals[it3 + 1] = normal.y;
                normals[it3 + 2] = normal.z;

                colors[it4 + 0] = color.r / 255;
                colors[it4 + 1] = color.g / 255;
                colors[it4 + 2] = color.b / 255;
                colors[it4 + 3] = color.a / 255;

                uvs[it2 + 0] = u;
                uvs[it2 + 1] = v;
            }
        }

        
        const layers = info.layers, layerCount = layers.length;
        const layerIndices = new Array<number>(); // expected: 0, 1, 4, 5, 7

        for (let index = 0; index < layerCount; index++) {
            if (!info.layers[index] || this.isSectorAll(index, 0))
                continue;

            for (let indexOther = index + 1; indexOther < layerCount; indexOther++) {
                const other = info.layers[indexOther]?.loadSelf();

                if (!other?.map?.isTransparent() && this.isSectorAll(indexOther, 255))
                    continue;

            }

            layerIndices.push(index);
        }

        debugger;
    }

    protected isSectorAll(index: number, alphaValue: number) {
        const info = this.info;
        const layer = info.layers[index]?.loadSelf();

        if (!layer) return false;

        const sectorFlag = this.someSectorVisibilityMask[index];

        if (sectorFlag !== -1)
            return alphaValue === sectorFlag;

        // there's some stuff here related to edges

        const alphaMap = layer.alphaMap;

        if (!alphaMap) return false;

        const ratio = (alphaMap.width || 0) / info.heightmapX;

        const minx = Math.floor(ratio * this.offsetX), maxx = Math.ceil(ratio * (this.offsetX + this.quadsX));
        const miny = Math.floor(ratio * this.offsetY), maxy = Math.ceil(ratio * (this.offsetY + this.quadsY));

        for (let x = minx; x < maxx; x++) {
            for (let y = miny; y < maxy; y++) {
                const layerAlphaValue = info.getLayerAlpha(x, y, -2, alphaMap);

                if (layerAlphaValue !== alphaValue)
                    return false;
            }
        }

        return true;
    }
}


export default UTerrainSector;
export { UTerrainSector };

type HeightMapInfo_T = { data: Uint16Array, info: GD.ITextureDecodeInfo, edgeTurns: Int32Array };