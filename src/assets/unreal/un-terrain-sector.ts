import UObject from "@l2js/core";
import FBox from "./un-box";
import { BufferValue } from "@l2js/core";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import FArray, { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";
import FVector from "@client/assets/unreal/un-vector";
import { indexToTime } from "@client/assets/unreal/un-l2env";
import { ETerrainRenderMethod_T } from "@client/assets/unreal/un-terrain-info";

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

class FTerrainSectorRenderPass {
    public info: GA.ATerrainInfo;
    public renderCombinationNum: number;

    public indices: number[];
    public numTriangles: number;
    public numIndices: number;
    public minIndex: number;
    public maxIndex: number;
}

abstract class UTerrainSector extends UObject {
    declare public boundingBox: FBox;
    declare public offsetX: number;
    declare public offsetY: number;
    declare public info: GA.ATerrainInfo;
    declare protected hasShadows: boolean;
    declare protected shadowCount: number;

    declare protected infoId: number;
    declare public quadsX: number;
    declare public quadsY: number;

    declare public quadsXActual: number;
    declare public quadsYActual: number;

    declare pkg: GA.UPackage;

    // likely mesh lights?
    declare protected lightInfos: FArray<FTerrainLightInfo>;

    declare protected shadowMaps: FPrimitiveArray<"uint8">[];
    declare protected shadowMapTimes: number[];

    declare protected texInfo: FPrimitiveArray<"uint16">;
    declare protected someSectorVisibilityMask: Int16Array;
    declare protected renderPasses: FTerrainSectorRenderPass[];

    public getDecodeInfo(library: GD.DecodeLibrary, info: GA.ATerrainInfo, { data, info: iTerrainMap, edgeTurns }: HeightMapInfo_T): IStaticMeshObjectDecodeInfo {
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

        let quadsX = this.quadsX, quadsY = this.quadsY;

        if (this.offsetX >= 240)
            quadsX = 15;

        if (this.offsetY >= 240)
            quadsY = 15;

        // why does it set to 15 during serialization but during triangulization this is 16 again?
        // this.quadsX = 15;
        // this.quadsY = 15;
        this.quadsXActual = quadsX;
        this.quadsYActual = quadsY;

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
        const info = this.info.loadSelf();
        const invSize = 1 / 4096;
        const hmx = info.heightmapX, hmy = info.heightmapY;

        const vertexCount = (this.quadsX + 1) * (this.quadsY + 1);
        const vertices = new Float32Array(vertexCount * 3);
        const normals = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const colors = new Float32Array(vertexCount * 4);

        if (info.texModifyInfo.loadSelf().colorOp !== 1) {
            debugger;
            throw new Error("not implemented");
        }

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
            const layer = info.layers[index]?.loadSelf();

            if (!layer || !layer.map || !layer.alphaMap)
                break;

            if (this.isSectorAll(index, 0))
                continue;

            for (let indexOther = index + 1; indexOther < layerCount; indexOther++) {
                const other = info.layers[indexOther]?.loadSelf();

                if (!other || !other.map || !other.alphaMap)
                    break;

                if (!other.map.isTransparent() && this.isSectorAll(indexOther, 255))
                    continue;

            }

            layerIndices.push(index);
        }

        const passLayers = new Array<number>();
        this.renderPasses = [];

        for (const i of layerIndices) {
            passLayers.push(i);

            const pass = new FTerrainSectorRenderPass();

            this.renderPasses.push(pass);
            pass.renderCombinationNum = info.getRenderCombination(passLayers, ETerrainRenderMethod_T.RM_AlphaMap);

            passLayers.length = 0;
        }

        for (let i = 0, len = this.renderPasses.length; i < len; i++) {
            const pass = this.renderPasses[i];

            pass.info = info;
            pass.indices = [];
            pass.numTriangles = 0;

            this.triangulateLayer(i);

            pass.numIndices = pass.indices.length;

            if (pass.numIndices > 0) {
                pass.minIndex = Number.MAX_SAFE_INTEGER;
                pass.maxIndex = 0;

                for (let j = 0, numIndices = pass.numIndices; j < numIndices; j++) {
                    pass.minIndex = Math.min(pass.indices[j], pass.minIndex);
                    pass.maxIndex = Math.max(pass.indices[j], pass.maxIndex);
                }
            } else {
                debugger;
                // remove passess without triangles and adjust iterator
                this.renderPasses.splice(i);

                len = len - 1;
                i = i - 1;
            }
        }

        // TODO: update decorators
    }

    protected getLocalVertex(x: number, y: number): number { return x + y * (this.quadsX + 1); }

    protected triangulateLayer(passIndex: number) {
        const info = this.info;
        const pass = this.renderPasses[passIndex];
        const indices = pass.indices;
        const texInfo = this.texInfo;

        for (let y = 0; y < this.quadsY; y++) {
            for (let x = 0; x < this.quadsX; x++) {
                // when non-seamless it would use "QuadVisibilityBitmap" instead

                const isQuadVis = info.getQuadVisibilityBitmapOrig(x + this.offsetX, y + this.offsetY);

                if (!isQuadVis) {
                    continue;
                }

                const v1 = this.getLocalVertex(x, y);
                const v2 = v1 + 1;
                const v3 = this.getLocalVertex(x + 1, y + 1);
                const v4 = v3 - 1;
                const texOffset = x + 16 * y; // differs from ue


                let trianglePassed = false;

                const isEdgeTurn = info.getEdgeTurnBitmapOrig(x + this.offsetX, y + this.offsetY);

                if (this.offsetX === 240 && x === 15 || this.offsetY === 240 && y == 15) {
                    if (passIndex === 0 || this.passShouldRenderTriangle(passIndex, x, y, 0, isEdgeTurn) || this.passShouldRenderTriangle(passIndex, x, y, 1, isEdgeTurn)) {
                        trianglePassed = true;
                    }
                } else {
                    if (passIndex === 0) {
                        trianglePassed = true;
                    } else {
                        trianglePassed = texInfo.getElem(texOffset) !== 0;
                    }
                }

                if (!trianglePassed) continue;


                if (isEdgeTurn)
                    indices.push(/* tri1 */ v1, v4, v2, /* tri2 */ v4, v3, v2);
                else
                    indices.push(/* tri1 */ v1, v4, v3, /* tri2 */ v1, v3, v2);

                pass.numTriangles = pass.numTriangles + 2;
            }
        }
    }

    protected passShouldRenderTriangle(passIndex: number, x: number, y: number, triIndex: number, isTurned: boolean): boolean {
        // UE implementation looks the same, so just ported it directly
        const info = this.info;
        const layers = info.layers;
        const pass = this.renderPasses[passIndex];
        const comb = info.renderCombinations[pass.renderCombinationNum];

        if (comb.method === ETerrainRenderMethod_T.RM_AlphaMap) {
            let transparent = true;

            // 1. Check if this triangle is completely transparent in all layers in this pass.
            for (const layerIndex of comb.layers) {
                if (this.isTriangleAll(layerIndex, x, y, triIndex, isTurned, 0)) continue;

                transparent = false;
                break;
            }

            if (transparent) return false;

            for (let p = passIndex + 1, pCount = this.renderPasses.length; p < pCount; p++) {
                const otherPass = this.renderPasses[p];
                const otherComb = info.renderCombinations[otherPass.renderCombinationNum];

                for (const layerIndex of otherComb.layers) {
                    const layer = layers[layerIndex];
                    if (!layer.map.isTransparent() && this.isTriangleAll(layerIndex, x, y, triIndex, isTurned, 255)) {
                        return false;
                    }
                }
            }

            return true;
        } else {

        }
    }

    protected isTriangleAll(layerIndex: number, x: number, y: number, triIndex: number, isTurned: boolean, alphaValue: number): boolean {
        const info = this.info;
        const alphaMap = info.layers[layerIndex].alphaMap;

        if (alphaMap.width === info.heightmapX) {
            // Special-case 1:1 alphamap:heightmap ratio for performance

            const ox = x + this.offsetX;
            const oy = y + this.offsetY;

            if (isTurned) {
                if (triIndex) {
                    // 432
                    if (info.getLayerAlpha(ox, oy + 1, -2, alphaMap) !== alphaValue ||
                        info.getLayerAlpha(ox + 1, oy + 1, -2, alphaMap) !== alphaValue ||
                        info.getLayerAlpha(ox + 1, oy, -2, alphaMap) !== alphaValue)
                        return false;
                }
                else {
                    // 142
                    if (info.getLayerAlpha(ox, oy, -2, alphaMap) !== alphaValue ||
                        info.getLayerAlpha(ox, oy + 1, -2, alphaMap) !== alphaValue ||
                        info.getLayerAlpha(ox + 1, oy, -2, alphaMap) !== alphaValue)
                        return false;
                }
            }
            else {
                if (triIndex) {
                    // 132
                    if (info.getLayerAlpha(ox, oy, -2, alphaMap) !== alphaValue ||
                        info.getLayerAlpha(ox + 1, oy + 1, -2, alphaMap) !== alphaValue ||
                        info.getLayerAlpha(ox + 1, oy, -2, alphaMap) !== alphaValue)
                        return false;
                }
                else {
                    // 143
                    if (info.getLayerAlpha(ox, oy, -2, alphaMap) !== alphaValue ||
                        info.getLayerAlpha(ox, oy + 1, -2, alphaMap) !== alphaValue ||
                        info.getLayerAlpha(ox + 1, oy + 1, -2, alphaMap) !== alphaValue)
                        return false;
                }
            }
        } else {
            let ratio = alphaMap.width / info.heightmapX;

            let minX = Math.floor(ratio * (x + this.offsetX));
            let maxX = Math.ceil(ratio * (x + this.offsetX + 1));
            let minY = Math.floor(ratio * (y + this.offsetY));
            let range = maxX - minX;

            if (isTurned) {
                if (triIndex) {
                    // 432
                    for (let ox = 0; ox <= range; ox++)
                        for (let oy = range; oy >= range - ox; oy--)
                            if (info.getLayerAlpha(ox + minX, oy + minY, -2, alphaMap) !== alphaValue)
                                return false;
                }
                else {
                    // 142
                    for (let ox = 0; ox <= range; ox++)
                        for (let oy = 0; oy <= range - ox; oy++)
                            if (info.getLayerAlpha(ox + minX, oy + minY, -2, alphaMap) !== alphaValue)
                                return false;
                }
            }
            else {
                if (triIndex) {
                    // 132
                    for (let ox = 0; ox <= range; ox++)
                        for (let oy = 0; oy <= ox; oy++)
                            if (info.getLayerAlpha(ox + minX, oy + minY, -2, alphaMap) !== alphaValue)
                                return false;
                }
                else {
                    // 143
                    for (let ox = 0; ox <= range; ox++)
                        for (let oy = range; oy >= ox; oy--)
                            if (info.getLayerAlpha(ox + minX, oy + minY, -2, alphaMap) !== alphaValue)
                                return false;
                }
            }
        }

        return true;
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