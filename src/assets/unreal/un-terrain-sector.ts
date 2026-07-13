import UObject from "@l2js/core";
import FBox from "./un-box";
import { BufferValue } from "@l2js/core";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import FArray, { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";
import FVector from "@client/assets/unreal/un-vector";
import { ETerrainRenderMethod_T } from "@client/assets/unreal/un-terrain-info";

class FTerrainLightInfo implements C.IConstructable {
    public lightIndex: number;
    public light: GA.ULight;
    public visibilityBitmap = new FPrimitiveArray(BufferValue.uint8);

    public load(pkg: C.APackage): this {
        this.lightIndex = pkg.read("compat32");

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

    declare pkg: C.APackage;

    // likely mesh lights?
    declare protected lightInfos: FArray<FTerrainLightInfo>;

    declare protected shadowMaps: FPrimitiveArray<"uint8">[];
    declare protected shadowMapTimes: number[];

    declare protected texInfo: FPrimitiveArray<"uint16">;
    declare protected someSectorVisibilityMask: Int16Array; // zoneVisibilityMask - 64-zone PVS mask
    declare protected renderPasses: FTerrainSectorRenderPass[];

    public getDecodeInfo(library: GD.DecodeLibrary, info: GA.ATerrainInfo, { data, info: iTerrainMap, edgeTurns }: HeightMapInfo_T): GD.ITerrainSegmentDecodeInfo {
        const center = this.boundingBox.getCenter();
        const { x: ox, y: oy, z: oz } = center;


        if (this.uuid in library.geometries) return {
            uuid: this.uuid,
            name: this.objectName,
            type: "TerrainSegment",
            geometry: this.uuid,
            materials: this.uuid,
            position: [ox, oy, oz]
        } as GD.ITerrainSegmentDecodeInfo;

        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        // Generate triangulation data on demand
        this.generateTriangles();

        const vertexCount = 17 * 17;
        const width = iTerrainMap.width;
        const TypedIndicesArray = getTypedArrayConstructor(vertexCount);

        const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), colors = new Uint8ClampedArray(17 * 17 * 3);
        const indices = new TypedIndicesArray(16 * 16 * 6);

        const trueBoundingBox = FBox.make();
        const tmpVector = FVector.make();


        const v = FVector.make();

        let iii = 0;

        normals.set(this.triangles.normals)

        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const offset = Math.min(hmy, (width - 1)) * width + Math.min(hmx, (width - 1));
                const idxOffset = y * 17 + x;
                const idxVertOffset = idxOffset * 3;

                const { x: px, y: py, z: pz } = v.set(hmx, hmy, data[offset]).transformBy(info.toWorld);
                // const [nx, nz, ny] = [
                //     this.triangles.normals[0 + 3 * iii],
                //     this.triangles.normals[1 + 3 * iii],
                //     this.triangles.normals[2 + 3 * iii]
                // ];
                // const [ xxx, zzz, yyy ] = [
                //     this.triangles.vertices[0 + 3 * iii],
                //     this.triangles.vertices[1 + 3 * iii],
                //     this.triangles.vertices[2 + 3 * iii]
                // ]

                // console.log(xxx-px,yyy-py,zzz-pz, "|",  x, y, "|", info.getGlobalVertex(x, y), "|", iii)

                // iii++;

                // debugger;

                if (edgeTurns[offset >> 5] & (1 << (offset & 0x1f))) {
                    // 124, 423
                } else {
                    // 123, 134
                }


                positions[idxVertOffset + 0] = px - ox;
                positions[idxVertOffset + 1] = py - oy;
                positions[idxVertOffset + 2] = pz - oz;

                trueBoundingBox.expandByPoint(tmpVector.set(px, py, pz));

                // Initialize vertex colors to black (lighting will be applied later)
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

                const v1 = (y * 17 + x);
                const v2 = (y * 17 + (x + 1));
                const v3 = ((y + 1) * 17 + (x + 1));
                const v4 = ((y + 1) * 17 + x);

                const isEdgeTurn = info.getEdgeTurnBitmapOrig(x + this.offsetX, y + this.offsetY);

                if (isEdgeTurn) {
                    // Turned (Diagonal 2): v4-v2 split (CCW)
                    indices[idxOffset + 0] = v1;
                    indices[idxOffset + 1] = v4;
                    indices[idxOffset + 2] = v2;

                    indices[idxOffset + 3] = v4;
                    indices[idxOffset + 4] = v3;
                    indices[idxOffset + 5] = v2;
                } else {
                    // Normal (Diagonal 1): v1-v3 split (CCW)
                    indices[idxOffset + 0] = v1;
                    indices[idxOffset + 1] = v4;
                    indices[idxOffset + 2] = v3;

                    indices[idxOffset + 3] = v1;
                    indices[idxOffset + 4] = v3;
                    indices[idxOffset + 5] = v2;
                }
            }
        }

        const uvMultiplier = 2;
        const uvOffset = 17 * 17 * uvMultiplier;
        const layers = info.layers.filter(x => x);
        const layerCount = layers.length; // blended layers
        const uvs = new Float32Array(uvOffset * (layerCount + 2)); // base + blended + heightmap

        const terrainIndices = new Float32Array(17 * 17);

        // Row 0: Base Terrain Alignment UVs (used for triangulation)
        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const idxOffset = (y * 17 + x) * uvMultiplier;
                const vIdx = y * 17 + x;

                uvs[idxOffset + 0] = (hmx / info.terrainScale.x) * 2.0;
                uvs[idxOffset + 1] = (hmy / info.terrainScale.y) * 2.0;

                terrainIndices[vIdx] = vIdx;
            }
        }

        // Rows 1..layerCount: Blended Layers
        for (let k = 0; k < layerCount; k++) {
            const layer = layers[k].loadSelf();

            if (!layer.alphaMap && !layer.map)
                continue;

            const layerOffset = uvOffset * (k + 1);

            for (let y = 0; y < 17; y++) {
                for (let x = 0; x < 17; x++) {
                    const hmx = x + this.offsetX;
                    const hmy = y + this.offsetY;
                    const idxOffset = (y * 17 + x) * uvMultiplier;

                    // let u = (hmx / layer.scaleW) * (layer.scale.x / info.terrainScale.x) * 2.0 + layer.panW;
                    // let uvV = (hmy / layer.scaleH) * (layer.scale.y / info.terrainScale.y) * 2.0 + layer.panH;

                    const offset = Math.min(hmy, (width - 1)) * width + Math.min(hmx, (width - 1));

                    // Reconstruct the Unified World Space vertex (Z-up) for this point
                    // We reuse 'v' scratch vector if possible or create new one contextually. 
                    // Note: 'v' is defined in outer scope but we should be careful. 
                    // Let's use a new temporary vector to be safe/clean or reuse `v`.
                    // The outer `v` is used in the geometry loop, this is the UV loop.

                    // We must use info.toWorld to get the correct absolute position
                    const worldVert = FVector.make(hmx, hmy, data[offset]).transformBy(info.toWorld);

                    // Transform by the layer's texture matrix to get UVs
                    const uvVert = worldVert.applyMatrix4(layer.terrainMatrix);

                    uvs[layerOffset + idxOffset + 0] = uvVert.x;
                    uvs[layerOffset + idxOffset + 1] = uvVert.y;
                }
            }
        }

        // Last Row: heightmap uvs
        const hmLayerOffset = uvOffset * (layerCount + 1);
        for (let y = 0; y < 17; y++) {
            for (let x = 0; x < 17; x++) {
                const hmx = x + this.offsetX;
                const hmy = y + this.offsetY;
                const idxOffset = (y * 17 + x) * uvMultiplier;

                uvs[hmLayerOffset + idxOffset + 0] = hmx / info.heightmapX;
                uvs[hmLayerOffset + idxOffset + 1] = hmy / info.heightmapY;
            }
        }

        library.geometries[this.uuid] = {
            attributes: {
                positions,
                colors,
                normals,
                terrainIndex: terrainIndices
            } as any,
            indices,
            bounds: {
                box: trueBoundingBox.isValid ? {
                    min: this.boundingBox.min.sub(center).getElements() as GD.Vector3Arr,
                    max: this.boundingBox.max.sub(center).getElements() as GD.Vector3Arr
                } : null
            }
        };

        // debugger;

        library.materials[this.uuid] = {
            name: this.uuid,
            materialType: "terrainSegment",
            terrainMaterial: info.uuid,
            uvs: {
                textureType: "float",
                buffer: uvs,
                materialType: "texture",
                width: 17 * 17,
                height: layerCount + 2,
                format: "rg"
            } as GD.IDataTextureDecodeInfo
        } as GD.IMaterialTerrainSegmentDecodeInfo;

        return {
            uuid: this.uuid,
            name: this.objectName,
            terrainInfoUuid: info.uuid,
            type: "TerrainSegment",
            geometry: this.uuid,
            materials: this.uuid,
            position: [ox, oy, oz],
            lighting: {
                /* .slice(): the library must not alias the package buffer (see collect-transferables.ts) */
                lights: this.lightInfos.map(li => ({
                    light: li.light?.objectName,
                    flags: (li.visibilityBitmap.getTypedArray() as Uint8Array).slice()
                })).filter(li => li.light),
                shadowMaps: this.shadowMaps?.map(sm => (sm.getTypedArray() as Uint8Array).slice()) ?? [],
                shadowMapTimes: this.shadowMapTimes ?? []
            },
            mapX: info.mapX,
            mapY: info.mapY,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            heightmapX: info.heightmapX,
            heightmapY: info.heightmapY
        } as any;
    }

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        this.boundingBox = FBox.make();

        super.doLoad(pkg, exp);

        if (verArchive < 94) {
            debugger;
            throw new Error("not implemented");
        }

        this.infoId = pkg.read("compat32");
        this.info = pkg.fetchObject(this.infoId);

        // pkg.dump(1, true, false);

        this.quadsX = pkg.read("int32");
        this.quadsY = pkg.read("int32");

        // console.log(this.unkNum0, this.unkNum1)

        // this.unkNum2 = pkg.read("uint16");

        // debugger;

        this.offsetX = pkg.read("int32");
        this.offsetY = pkg.read("int32");

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

        // if(this.lightInfos.length === 4)
        //     debugger;

        // if (this.lightInfos.length > 0) {
        //     debugger;
        // }

        if (verLicense >= 4) {
            const hasShadows = pkg.read("int32");

            this.hasShadows = hasShadows !== 0;

            if (hasShadows !== 0 && hasShadows !== 1)
                debugger;

            if (this.hasShadows && this.info) {
                this.shadowCount = pkg.read("int32");
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
                this.someSectorVisibilityMask[i] = pkg.read("int16");
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
        // const colors = new Float32Array(vertexCount * 4);

        if (info.texModifyInfo.loadSelf().colorOp !== 1) {
            debugger;
            throw new Error("not implemented");
        }

        for (let y = 0, it3 = 0, it2 = 0, it4 = 0; y <= this.quadsY; y++) {
            for (let x = 0; x <= this.quadsX; x++, it4 += 4, it3 += 3, it2 += 2) {
                const vertex = this.getVertex(x, y);
                const normal = this.getVertexNormal(x, y);

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

                // non-texture maps (shaders) don't expose isTransparent, assume transparent
                if (other.map.isTransparent?.() === false && this.isSectorAll(indexOther, 255))
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
                // debugger;
                // remove passess without triangles and adjust iterator
                this.renderPasses.splice(i, 1);

                len = len - 1;
                i = i - 1;
            }
        }

        this.triangles = {
            this: this,
            vertices,
            normals,
            uvs
        };

        // if (this.objectName === "TerrainSector127")
        //     debugger;

        // TODO: update decorators

    }

    protected getLocalVertex(x: number, y: number): number { return x + y * (this.quadsX + 1); }

    // Get appropriate shadow map based on time of day
    protected getShadowMapForTime(timeOfDay: number): FPrimitiveArray<"uint8"> {
        if (!this.hasShadows || !this.shadowMaps || this.shadowMaps.length === 0) {
            return null;
        }

        // Use generic time-to-index conversion (works with explicit times or evenly distributed slots)
        const shadowIndex = timeToIndex(timeOfDay, this.shadowMapTimes);

        return this.shadowMaps[shadowIndex];
    }

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
                    if (layer.map?.isTransparent?.() === false && this.isTriangleAll(layerIndex, x, y, triIndex, isTurned, 255)) {
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