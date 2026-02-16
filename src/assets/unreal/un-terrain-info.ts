import { APackage, BufferValue, } from "@l2js/core";
import AInfo from "./un-info";
import FArray, { FObjectArray, FPrimitiveArray } from "@l2js/core/src/unreal/un-array";

import FBox from "@client/assets/unreal/un-box";
import FCoords from "@client/assets/unreal/un-coords";
import FColor from "@client/assets/unreal/un-color";
import UTexture from "@client/assets/unreal/un-texture";
import ETextureFormat from "@client/assets/unreal/un-tex-format";
import GMath from "@client/assets/unreal/un-gmath";
import FRotator from "@client/assets/unreal/un-rotator";
import FVector from "@client/assets/unreal/un-vector";
import { TextureMapAxis_T } from "@client/assets/unreal/un-terrain-layer";
import PropertyTag from "@l2js/core/src/unreal/un-property/un-property-tag";
import FPlane from "@client/assets/unreal/un-plane";

const MAP_SIZE_X = 128 * 256;
const MAP_SIZE_Y = 128 * 256;

enum ETerrainRenderMethod_T {
    RM_WeightMap = 0,
    RM_CombinedWeightMap = 1,
    RM_AlphaMap = 2
}

class FTerrainNormalPair implements C.IConstructable {
    public normal1 = FVector.make();
    public normal2 = FVector.make();

    public load(pkg: APackage): this {
        this.normal1.load(pkg);
        this.normal2.load(pkg);

        return this;
    }

}

class FTerrainRenderCombination {
    public readonly layers: number[];
    public readonly method: ETerrainRenderMethod_T;

    public constructor(layers: number[], method: ETerrainRenderMethod_T) {
        this.layers = layers.slice();
        this.method = method;
    }
}

abstract class ATerrainInfo extends AInfo {
    declare public readonly terrainMap: GA.UTexture;
    declare public readonly terrainScale: GA.FVector;
    declare public readonly layers: GA.UTerrainLayer[];

    declare protected readonly decoLayers: C.FArray<GA.UDecoLayer>
    declare protected readonly showOnTerrain: number;
    declare public readonly quadVisibilityBitmap: C.FPrimitiveArray<"int32">;
    declare public readonly edgeTurnBitmap: C.FPrimitiveArray<"int32">;
    declare protected readonly mapX: number;
    declare protected readonly mapY: number;
    declare public readonly quadVisibilityBitmapOrig: C.FPrimitiveArray<"int32">;
    declare public readonly edgeTurnBitmapOrig: C.FPrimitiveArray<"int32">;
    declare protected readonly generatedSectorCounter: number;
    declare protected readonly numIntMap: number;
    declare protected readonly autoTimeGeneration: boolean;
    declare protected readonly tIntMap: C.FArray<GA.FTIntMap>;
    declare protected readonly tickTime: number;
    declare protected sectors: C.FObjectArray<GA.UTerrainSector>;
    declare protected readonly showOnInvisibleTerrain: boolean;
    declare protected readonly litDirectional: boolean;
    declare protected readonly disregardTerrainLighting: boolean;
    declare protected readonly randomYaw: boolean;
    declare protected readonly bForceRender: boolean;
    declare public renderCombinations: FTerrainRenderCombination[];

    public readonly isTerrainInfo = true;

    declare protected sectorsX: number;
    declare protected sectorsY: number;
    declare public toWorld: GA.FCoords;
    declare protected toHeightMap: GA.FCoords;
    declare public heightmapX: number;
    declare public heightmapY: number;

    declare public boundingBox: GA.FBox;
    // public heightmapMin: number;
    // public heightmapMax: number;

    declare protected readonly hasDynamicLight: boolean;
    declare protected readonly forcedRegion: number;
    declare protected readonly inverted: boolean;

    declare public vertices: Array<FVector>;
    declare public faceNormals: Array<FTerrainNormalPair>;
    declare public vertexColors: C.FArray<GA.FColor>;

    // protected _terrainSectorSize: any;
    // protected _decoLayerOffset: any;
    // protected _inverted: any;
    // protected _bKCollisionHalfRes: any;
    // protected _justLoaded: any;
    // protected _decoLayerData: any;
    // protected _sectors: any;
    // protected _vertices: any;
    // protected _heightmapX: any;
    // protected _heightmapY: any;
    // protected _sectorsX: any;
    // protected _sectorsY: any;
    // protected _primitive: any;
    // protected _faceNormals: any;
    // protected _toWorld: any;
    // protected _toHeightmap: any;
    // protected _selectedVertices: any;
    // protected _showGrid: any;
    // protected _quadDomMaterialBitmap: any;
    // protected _renderCombinations: any;
    // protected _vertexStreams: any;
    // protected _vertexColors: any;
    // protected _paintedColor: any;
    // protected _oldTerrainMap: any;
    // protected _oldHeightmap: any;
    // protected _baseHeight: any;
    // protected _vTGruop: any;
    // protected _vTGroupOrig: any;
    // protected _bUpdatedHEdge: any;
    // protected _bUpdatedVEdge: any;
    // protected _bUpdatedZ: any;
    // protected _sectorsOrig: any;
    // protected _toHeightmapOrig: any;
    // protected _nightMapStart: any;
    // protected _dayMapStart: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "TerrainMap": "terrainMap",
            "TerrainScale": "terrainScale",
            "Layers": "layers",

            "SectorsX": "sectorsX",
            "SectorsY": "sectorsY",

            "Sectors": "sectors",

            "DecoLayers": "decoLayers",
            "MapX": "mapX",
            "MapY": "mapY",

            "QuadVisibilityBitmap": "quadVisibilityBitmap",         // non-seamless bitamps
            "EdgeTurnBitmap": "edgeTurnBitmap",

            "QuadVisibilityBitmapOrig": "quadVisibilityBitmapOrig", // seamless bitmaps
            "EdgeTurnBitmapOrig": "edgeTurnBitmapOrig",

            "GeneratedSectorCounter": "generatedSectorCounter",
            "NumIntMap": "numIntMap",
            "bAutoTimeGeneration": "autoTimeGeneration",
            "TIntMap": "tIntMap",
            "TickTime": "tickTime",
            "ShowOnInvisibleTerrain": "showOnInvisibleTerrain",
            "LitDirectional": "litDirectional",
            "DisregardTerrainLighting": "disregardTerrainLighting",
            "RandomYaw": "randomYaw",
            "bForceRender": "bForceRender",
            "bDynamicLight": "hasDynamicLight",
            "ForcedRegion": "forcedRegion",

            "Inverted": "inverted",

            "Vertices": "vertices",
            "FaceNormals": "faceNormals",

            //         "TerrainSectorSize": "_terrainSectorSize",
            //         "DecoLayerOffset": "_decoLayerOffset",
            //         "Inverted": "_inverted",
            //         "bKCollisionHalfRes": "_bKCollisionHalfRes",
            //         "JustLoaded": "_justLoaded",
            //         "DecoLayerData": "_decoLayerData",

            //         "HeightmapX": "_heightmapX",
            //         "HeightmapY": "_heightmapY",

            //         "Primitive": "_primitive",
            //         "ToWorld": "_toWorld",
            //         "ToHeightmap": "_toHeightmap",
            //         "SelectedVertices": "_selectedVertices",
            //         "ShowGrid": "_showGrid",
            //         "QuadDomMaterialBitmap": "_quadDomMaterialBitmap",
            //         "RenderCombinations": "_renderCombinations",
            //         "VertexStreams": "_vertexStreams",
            //         "VertexColors": "_vertexColors",
            //         "PaintedColor": "_paintedColor",
            //         "OldTerrainMap": "_oldTerrainMap",
            //         "OldHeightmap": "_oldHeightmap",
            //         "BaseHeight": "_baseHeight",
            //         "VTGruop": "_vTGruop",
            //         "VTGroupOrig": "_vTGroupOrig",
            //         "bUpdatedHEdge": "_bUpdatedHEdge",
            //         "bUpdatedVEdge": "_bUpdatedVEdge",
            //         "bUpdatedZ": "_bUpdatedZ",
            //         "SectorsOrig": "_sectorsOrig",
            //         "ToHeightmapOrig": "_toHeightmapOrig",
            //         "NightMapStart": "_nightMapStart",
            //         "DayMapStart": "_dayMapStart",
        });
    }

    // protected readStruct(pkg: UPackage, tag: PropertyTag): any {
    //     const exp = new UExport();

    //     exp.objectName = `${tag.name}[Struct]`;
    //     exp.offset = pkg.tell();
    //     exp.size = tag.dataSize;

    //     switch (tag.structName) {
    //         case "TerrainLayer": return new UTerrainLayer().load(pkg, exp);
    //     }

    //     return super.readStruct(pkg, tag);
    // }

    public getFromBitmap(bitmap: FPrimitiveArray<"int32">, x: number, y: number): boolean {
        let bitIndex = x + y * this.heightmapX;

        return (bitmap.getElem(bitIndex >> 5) & (1 << (bitIndex & 0x1F))) ? true : false;
    }

    public getQuadVisibilityBitmap(x: number, y: number): boolean { return this.getFromBitmap(this.quadVisibilityBitmap, x, y); }
    public getQuadVisibilityBitmapOrig(x: number, y: number): boolean { return this.getFromBitmap(this.quadVisibilityBitmapOrig, x, y); }
    public getEdgeTurnBitmap(x: number, y: number): boolean { return this.getFromBitmap(this.edgeTurnBitmap, x, y); }
    public getEdgeTurnBitmapOrig(x: number, y: number): boolean { return this.getFromBitmap(this.edgeTurnBitmapOrig, x, y); }


    public getLayerAlpha(x: number, y: number, layer: number, alphaMap: GA.UTexture) {
        const texture = alphaMap
            ? alphaMap
            : (layer === -1 ? this.terrainMap : this.layers[layer].alphaMap);

        if (!texture) return 0;

        texture.loadSelf();

        switch (texture.format) {
            case ETextureFormat.TEXF_L8:
            case ETextureFormat.TEXF_P8:
            case ETextureFormat.TEXF_RGB8:
                break;
            default: return 0;
        }

        if (layer !== -2) {
            x = x * texture.width / this.heightmapX;
            y = y * texture.height / this.heightmapY;
        }

        if (texture.mipmaps.getElemCount() <= 0) return 0;

        const data = texture.mipmaps.getElem(0)?.dataArray;

        if (!data) return 0;

        const offset = x + y * texture.width;

        switch (texture.format) {
            case ETextureFormat.TEXF_L8: return data.getElem(offset);
            case ETextureFormat.TEXF_P8: return texture.palette.colors[data.getElem(offset)].r;
            case ETextureFormat.TEXF_RGB8: return data.getElem(offset * 4 + 3);
            default: debugger; throw new Error("invalid");
        }
    }

    public getRenderCombination(layers: number[], method: ETerrainRenderMethod_T): number {
        // TODO: this can be rewriten without labels
        nextCombo: for (let i = 0, len = this.renderCombinations.length; i < len; i++) {
            const combo = this.renderCombinations[i];
            if (combo.method === method && combo.layers.length === layers.length) {
                for (let j = 0, jLen = layers.length; j < jLen; j++) {
                    if (layers[j] !== combo.layers[j]) {
                        continue nextCombo;
                    }
                }

                return i;
            }
        }

        const newCombo = new FTerrainRenderCombination(layers, method);

        this.renderCombinations.push(newCombo);

        return this.renderCombinations.length - 1;
    }

    public doLoad(pkg: C.APackage, exp: C.UExport<ATerrainInfo>) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        // console.assert(verArchive === 123, "Archive version differs, will likely not work.");
        // console.assert(verLicense === 23, "Licensee version differs, will likely not work.");

        super.doLoad(pkg, exp);


        this.readHead = pkg.tell();

        this.renderCombinations = [];
        this.boundingBox = FBox.make();
        this.toWorld = FCoords.make();
        this.toHeightMap = FCoords.make();
        this.vertexColors = new FArray(FColor.class());

        if (verLicense >= 17) {
            this.sectors = new FObjectArray<GA.UTerrainSector>().load(pkg).loadSelf();

            this.readHead = pkg.tell();

            this.sectors.forEach(sector => {
                this.boundingBox.expandByPoint(sector.boundingBox.min);
                this.boundingBox.expandByPoint(sector.boundingBox.max);
            });

            pkg.seek(this.readHead, "set");

            this.sectorsX = pkg.read("int32");
            this.sectorsY = pkg.read("int32");
        } else {
            console.warn("Unsupported yet");
            debugger;
        }

        if (verArchive < 0x53) {
            console.warn("Unsupported yet");
            debugger;
        }

        this.toWorld.load(pkg);
        this.toHeightMap.load(pkg);

        if (verArchive < 0x4c) {
            console.warn("Unsupported yet");
            debugger;
        }

        this.heightmapX = pkg.read("int32");
        this.heightmapY = pkg.read("int32");

        if (verArchive > 74 && verArchive < 82) {
            console.warn("Unsupported yet");
            debugger;
        }

        if (verArchive === 86 || verArchive === 87) {
            console.warn("Unsupported yet");
            debugger;
        }

        if (verArchive < 115) {
            console.warn("Unsupported yet");
            debugger;
        }

        if (verArchive < 119) {
            console.warn("Unsupported yet");
            debugger;
        }

        if (verArchive >= 117) this.vertexColors.load(pkg);

        this.readHead = pkg.tell();
        // debugger;

        return this;
    }

    protected precomputeLayerWeights() {
        // do we even need this?

        // let numLayers = 0;

        // for (let lcount = this.layers.length; numLayers < lcount; numLayers++) {
        //     const layer = this.layers[numLayers];

        //     if (!layer || !layer.map || !layer.alphaMap || (layer.map.isAlphaTexture || layer.map.isMasked) || !(layer.map instanceof UTexture))
        //         break;

        //     const layerWeightMap = layer.weightMap;

        //     if (
        //         !layerWeightMap ||
        //         layerWeightMap.width != layer.alphaMap.width ||
        //         layerWeightMap.height != layer.alphaMap.height ||
        //         layerWeightMap.format != ETextureFormat.TEXF_RGBA8
        //     ) {
        //         // calculate
        //     }

        //     debugger;
        // }

        // if (!numLayers)
        //     return;
    }
    protected calcLayerTexCoords() {
        // Ground truth implementation from leaked UE source code
        // This matches exactly what the engine does

        const toHeightmapTransposed = this.toHeightMap.transpose();
        for (let i = 0, lcount = this.layers.length; i < lcount; i++) {
            const layer = this.layers[i];

            if (!layer || !layer.map || !layer.alphaMap) continue;

            if (layer.alphaMap.loadSelf().format === ETextureFormat.TEXF_P8) {
                const palette = layer.alphaMap.palette.loadSelf();

                for (let p = 0; p < 256; p++) {
                    const colr = palette.colors[p];

                    colr.a = colr.r;
                }
            }

            // Exact implementation from UE source:
            // FCoords TexCoords = ( GMath.UnitCoords / FRotator( 0.f, Layers[i].TextureRotation, 0.f) );
            const rotator = FRotator.make(0, layer.mapRotation, 0);
            const texCoords = GMath().unitCoords.div(rotator);

            // TexCoords *= ToHeightmap.Transpose();
            texCoords.mul(toHeightmapTransposed);

            // TexCoords.XAxis /= Layers[i].UScale;
            // TexCoords.YAxis /= Layers[i].VScale;
            texCoords.xAxis = texCoords.xAxis.divideScalar(layer.scaleW);
            texCoords.yAxis = texCoords.yAxis.divideScalar(layer.scaleH);

            // TexCoords.Origin += FVector( Layers[i].UPan*Layers[i].UScale, Layers[i].VPan*Layers[i].VScale, 0.f ).TransformVectorBy(ToWorld);
            const addOrigin = FVector.make(layer.panW * layer.scaleW, layer.panH * layer.scaleH, 0).transformVectorBy(this.toWorld);
            texCoords.origin = texCoords.origin.add(addOrigin);

            // Handle map axis transformations (exact from UE source)
            switch (layer.mapAxis) {
                case TextureMapAxis_T.TEXMAPAXIS_XY:
                    // No transformation needed for XY
                    break;
                case TextureMapAxis_T.TEXMAPAXIS_XZ:
                    // Exchange Y and Z components
                    [texCoords.origin.y, texCoords.origin.z] = [texCoords.origin.z, texCoords.origin.y];
                    [texCoords.origin.x, texCoords.origin.z] = [texCoords.origin.z, texCoords.origin.x];
                    [texCoords.xAxis.x, texCoords.xAxis.z] = [texCoords.xAxis.z, texCoords.xAxis.x];
                    [texCoords.yAxis.x, texCoords.yAxis.y] = [texCoords.yAxis.y, texCoords.yAxis.x];
                    [texCoords.zAxis.y, texCoords.zAxis.z] = [texCoords.zAxis.z, texCoords.zAxis.y];
                    break;
                case TextureMapAxis_T.TEXMAPAXIS_YZ:
                    // Exchange X and Z components
                    [texCoords.origin.x, texCoords.origin.z] = [texCoords.origin.z, texCoords.origin.x];
                    [texCoords.xAxis.x, texCoords.xAxis.z] = [texCoords.xAxis.z, texCoords.xAxis.x];
                    [texCoords.zAxis.x, texCoords.zAxis.z] = [texCoords.zAxis.z, texCoords.zAxis.x];
                    break;
            }

            // TexCoords = TexCoords * ( GMath.UnitCoords / Layers[i].LayerRotation );
            const layerRotInverse = GMath().unitCoords.div(layer.layerRotation);
            texCoords.mul(layerRotInverse);

            // Layers[i].TextureMatrix = TexCoords.Matrix();
            const terrainMatrix = texCoords.matrix();
            layer.terrainMatrix = terrainMatrix;
        }
    }

    public static LoadedTerrains: Record<string, ATerrainInfo> = {};

    public getGlobalVertex(x: number, y: number) { return x + y * (this.heightmapX + 1); }
    protected heightmapToWorld(H: FVector) { return H.transformPointBy(this.toWorld); }

    // Stitching logic to handle seamless terrain edges
    public stitchRightEdge(other: ATerrainInfo) {
        if (!other || !other.vertices) return;

        const myEdgeX = this.heightmapX;
        const otherEdgeX = 0;

        for (let y = 0; y <= this.heightmapY; y++) {
            const myIdx = this.getGlobalVertex(myEdgeX, y);
            const otherIdx = other.getGlobalVertex(otherEdgeX, y);

            this.vertices[myIdx] = other.vertices[otherIdx];

            // Stitch normals for seamless lighting
            const myNormal = this.faceNormals[myIdx];
            const otherNormal = other.faceNormals[otherIdx];

            if (myNormal && otherNormal) {
                myNormal.normal1 = otherNormal.normal1;
                myNormal.normal2 = otherNormal.normal2;
            }
        }

        // Update affected sectors (Rightmost column)
        this.sectors.forEach(sector => {
            if (sector.offsetX >= 240) {
                sector.generateTriangles();
            }
        });
    }

    public stitchBottomEdge(other: ATerrainInfo) {
        if (!other || !other.vertices) return;

        const myEdgeY = this.heightmapY;
        const otherEdgeY = 0;

        for (let x = 0; x <= this.heightmapX; x++) {
            const myIdx = this.getGlobalVertex(x, myEdgeY);
            const otherIdx = other.getGlobalVertex(x, otherEdgeY);

            this.vertices[myIdx] = other.vertices[otherIdx];

            // Stitch normals for seamless lighting
            const myNormal = this.faceNormals[myIdx];
            const otherNormal = other.faceNormals[otherIdx];

            if (myNormal && otherNormal) {
                myNormal.normal1 = otherNormal.normal1;
                myNormal.normal2 = otherNormal.normal2;
            }
        }

        // Update affected sectors (Bottommost row)
        this.sectors.forEach(sector => {
            if (sector.offsetY >= 240) {
                sector.generateTriangles();
            }
        });
    }

    protected getHeightmap(x: number, y: number) {

        x = Math.min(x, this.heightmapX - 1);
        y = Math.min(y, this.heightmapY - 1);

        const width = this.terrainMap.width;
        const array = this.terrainMap.mipmaps[0].dataArray;

        switch (this.terrainMap.format) {
            case ETextureFormat.TEXF_G16:
                const offset = (x + y * width) * 2;     // our byte array is uint16
                const bitA = array.getElem(offset);     // least significant bit
                const bitB = array.getElem(offset + 1); // most significant bit

                return (bitB << 8) + bitA;
            case ETextureFormat.TEXF_P8:
                return 256 * this.terrainMap.mipmaps[0].dataArray.getElem(x + y * width);
            case ETextureFormat.TEXF_RGB8:
                // L2 implementation has more assembly compared to UE
                break;
            default: return 0;
        }

        throw new Error("not yet implemented");
    }

    public getVertexNormal(x: number, y: number): FVector {

        try {
            if (x === 0) {
                const left = ATerrainInfo.LoadedTerrains[`${this.mapX - 1}_${this.mapY}`];
                if (left && left.vertices && left.vertices.length > left.heightmapX * left.heightmapY) {
                    return left.getVertexNormal(left.heightmapX, y);
                }
            }

            if (y === 0) {
                const top = ATerrainInfo.LoadedTerrains[`${this.mapX}_${this.mapY - 1}`];
                if (top && top.vertices && top.vertices.length > top.heightmapX * top.heightmapY) {
                    return top.getVertexNormal(x, top.heightmapY);
                }
            }
        } catch (e) {
            console.error(`[TerrainInfo] Error getting neighbor normal at ${x},${y} Map:${this.mapX}_${this.mapY}`, e);
            return FVector.make(0, 0, 1);
        }

        const v = this.getGlobalVertex(x, y);
        const fn = this.faceNormals[v];

        let n = fn.normal1.add(fn.normal2);

        if (x > 0) {
            const fn = this.faceNormals[v - 1];

            n = n.add(fn.normal1).add(fn.normal2);
        }

        if (y > 0) {
            const v = this.getGlobalVertex(x, y - 1);
            const fn = this.faceNormals[v];

            n = n.add(fn.normal1).add(fn.normal2);

            if (x > 0) {
                const fn = this.faceNormals[v - 1];

                n = n.add(fn.normal1).add(fn.normal2);
            }
        }

        n = n.normalized();

        if (this.inverted)
            n = n.negate();

        return n;
    }

    public updateLeftEdge() {
        this.sectors.forEach(sector => {
            if (sector.offsetX === 0) {
                sector.generateTriangles();
            }
        });
    }

    public updateTopEdge() {
        this.sectors.forEach(sector => {
            if (sector.offsetY === 0) {
                sector.generateTriangles();
            }
        });
    }

    protected updateVertices(startX: number, startY: number, endX: number, endY: number) {

        if (!this.terrainMap)
            return;

        const vCount = (this.heightmapX + 1) * (this.heightmapY + 1);
        const vertices = new Array<FVector>(vCount);
        const faceNormals = new Array<FTerrainNormalPair>(vCount);

        const terrain = this.terrainMap.loadSelf();

        for (let i = 0; i < vCount; i++)
            faceNormals[i] = new FTerrainNormalPair();

        // debugger;

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                vertices[this.getGlobalVertex(x, y)] = this.heightmapToWorld(FVector.make(x, y, this.getHeightmap(x, y)));

                if (x > 0 && y > 0) {
                    const normIdx = this.getGlobalVertex(x - 1, y - 1);
                    const faceNormal = faceNormals[normIdx] = new FTerrainNormalPair();
                    if (this.getEdgeTurnBitmapOrig(x - 1, y - 1)) {
                        // 124, 423
                        faceNormal.normal1 = FPlane.fromPoints(vertices[this.getGlobalVertex(x - 1, y - 1)], vertices[this.getGlobalVertex(x, y - 1)], vertices[this.getGlobalVertex(x - 1, y)]).vector().normalized();
                        faceNormal.normal2 = FPlane.fromPoints(vertices[this.getGlobalVertex(x - 1, y)], vertices[this.getGlobalVertex(x, y - 1)], vertices[this.getGlobalVertex(x, y)]).vector().normalized();
                    } else {
                        // 123, 134
                        faceNormal.normal1 = FPlane.fromPoints(vertices[this.getGlobalVertex(x - 1, y - 1)], vertices[this.getGlobalVertex(x, y - 1)], vertices[this.getGlobalVertex(x, y)]).vector().normalized();
                        faceNormal.normal2 = FPlane.fromPoints(vertices[this.getGlobalVertex(x - 1, y - 1)], vertices[this.getGlobalVertex(x, y)], vertices[this.getGlobalVertex(x - 1, y)]).vector().normalized();
                    }
                }
            }
        }
        this.vertices = vertices;
        this.faceNormals = faceNormals;
    }

    public getSWMapXY(s: number, w: number): [number, number] {
        // 1 / 32768 -> 0.000030517578125
        const x = Math.floor((s + 360448.0) * 0.000030517578125 + 9.0);
        const y = Math.floor((w + 294912.0) * 0.000030517578125 + 9.0);

        return [x, y];
    }

    protected updateTriangles(startX: number, startY: number, endX: number, endY: number) {
        //!! make this faster
        for (const sector of this.sectors) {
            sector.loadSelf();

            if (
                sector.offsetX > endX ||
                sector.offsetY > endY ||
                sector.offsetX + sector.quadsX < startX ||
                sector.offsetY + sector.quadsY < startY
            )
                continue;

            // if( UpdateLighting )
            //     Sectors(i)->StaticLight(1);
            // Sectors(i)->GenerateTriangles();

            sector.generateTriangles();
        }
    }

    protected combineLayerWeights() { throw new Error("not yet implemented"); }

    public diagnoseAlphaSeam(other: ATerrainInfo) {
        if (!this.layers || !other.layers) return;

        for (let i = 0; i < Math.min(this.layers.length, other.layers.length); i++) {
            const l1 = this.layers[i];
            const l2 = other.layers[i];

            if (!l1 || !l2 || !l1.alphaMap || !l2.alphaMap) continue;

            // Check assume loading implies mipmaps are available
            const m1 = l1.alphaMap.loadSelf().mipmaps[0];
            const m2 = l2.alphaMap.loadSelf().mipmaps[0];

            if (!m1 || !m2) continue;

            const w1 = l1.alphaMap.width;
            // const w2 = l2.alphaMap.width;

            // Check a few rows
            const rowsToCheck = [0, 128, 255];

            try {
                const data1 = m1.dataArray.getTypedArray() as Uint8Array;
                const data2 = m2.dataArray.getTypedArray() as Uint8Array;

                // console.log(`[AlphaSeam] Layer ${i} WrapS: ${l1.alphaMap.wrapS} / ${l2.alphaMap.wrapS}`);

                if (!data1 || !data2) continue;

                if (l1.alphaMap.wrapS !== 1 || l2.alphaMap.wrapS !== 1) { // 1 = TC_Clamp
                    console.warn(`[AlphaSeam] Layer ${i} is NOT Clamped! WrapS: ${l1.alphaMap.wrapS} / ${l2.alphaMap.wrapS}`);
                }

                for (const y of rowsToCheck) {
                    const idx1 = (w1 * y) + (w1 - 1); // My Right Edge
                    const idx2 = (l2.alphaMap.width * y) + 0; // Other Left Edge

                    const val1 = data1[idx1];
                    const val2 = data2[idx2];

                    if (val1 !== val2) {
                        console.warn(`[AlphaSeam] Mismatch Layer ${i} Row ${y}: Me[${w1 - 1}]=${val1} Other[0]=${val2}`);
                        // return; // Don't return, create noise for all mismatches
                    }
                }
            } catch (e) {
                // ignore
            }
        }
        // console.log(`[AlphaSeam] Verified Layer Edges Match for ${this.mapX}_${this.mapY} -> ${other.mapX}_${other.mapY}`);
    }

    public postLoad(pkg: C.APackage, exp: C.UExport<C.UObject>) {
        super.postLoad(pkg, exp);

        let startX = 0, startY = 0;
        let endX = this.heightmapX + 1, endY = this.heightmapY + 1;

        // this.precomputeLayerWeights(); -- not used in seamless terrain
        this.calcLayerTexCoords();
        this.updateVertices(startX, startY, endX, endY);
        this.updateTriangles(startX, startY, this.heightmapX, this.heightmapY);
        // this.combineLayerWeights(); -- not used in seamless terrain

        // const xy = this.getSWMapXY(this.location.x, this.location.y);

        // Register for Stitching
        console.log(`[TerrainStitch] Registering Terrain ${this.mapX}_${this.mapY} (Loc: ${this.location.x}, ${this.location.y})`);
        ATerrainInfo.LoadedTerrains[`${this.mapX}_${this.mapY}`] = this;

        // Stitch with Right Neighbor (X+1)
        const right = ATerrainInfo.LoadedTerrains[`${this.mapX + 1}_${this.mapY}`];
        if (right) {
            this.stitchRightEdge(right);
            right.updateLeftEdge();
            this.diagnoseAlphaSeam(right);
        }

        // Stitch with Left Neighbor (X-1)
        const left = ATerrainInfo.LoadedTerrains[`${this.mapX - 1}_${this.mapY}`];
        if (left) {
            left.stitchRightEdge(this);
            this.updateLeftEdge();
        }

        // Stitch with Bottom Neighbor (Y+1)
        const bottom = ATerrainInfo.LoadedTerrains[`${this.mapX}_${this.mapY + 1}`];
        if (bottom) {
            this.stitchBottomEdge(bottom);
            bottom.updateTopEdge();
        }

        // Stitch with Top Neighbor (Y-1)
        const top = ATerrainInfo.LoadedTerrains[`${this.mapX}_${this.mapY - 1}`];
        if (top) {
            top.stitchBottomEdge(this);
            this.updateTopEdge();
        }

        // debugger;
    }

    public getDecodeInfo(library: GD.DecodeLibrary): string {
        const terrainLayers = this.layers.filter(x => x);
        const layerCount = terrainLayers.length;

        const terrainUuid = this.terrainMap.loadSelf().getDecodeInfo(library);
        const iTerrainMap = library.materials[terrainUuid] as GD.ITextureDecodeInfo;
        const terrainData = new Uint16Array(iTerrainMap.buffer);
        const edgeTurnBitmap = this.edgeTurnBitmapOrig.getTypedArray();
        const heightmapData = { info: iTerrainMap, data: terrainData, edgeTurns: edgeTurnBitmap };

        const layers: { map: string, alphaMap: string }[] = new Array(layerCount);

        for (let k = 0; k < layerCount; k++) {
            const layer = terrainLayers[k].loadSelf();

            if (!layer.map && !layer.alphaMap) {
                layers[k] = { map: null, alphaMap: null };
                continue;
            }

            if (layer.map?.loadSelf().mipmaps.getElemCount() === 0 && layer.alphaMap?.loadSelf().mipmaps.getElemCount() === 0) {
                layers[k] = { map: null, alphaMap: null };
                debugger;
                continue;
            }

            layers[k] = {
                map: layer.map?.loadSelf().getDecodeInfo(library) || null,
                alphaMap: layer.alphaMap?.loadSelf().getDecodeInfo(library) || null
            };

            if (layers[k].alphaMap && !layers[k].map)
                debugger;
        }

        library.materials[this.uuid] = {
            name: this.uuid,
            materialType: "terrain",
            layers
        } as GD.IMaterialTerrainDecodeInfo;

        const zoneInfo = library.bspZones[library.bspZoneIndexMap[this.getZone().uuid]].zoneInfo;
        const children = this.sectors.map(sector => sector.loadSelf().getDecodeInfo(library, this, heightmapData));

        const decodeInfo = {
            uuid: this.uuid,
            type: "TerrainInfo",
            name: this.objectName,
            // position,
            children
        } as GD.IBaseObjectDecodeInfo;

        zoneInfo.children.push(decodeInfo);
        zoneInfo.bounds.isValid = true;

        children.forEach(({ geometry: uuid }) => {
            const { min, max } = library.geometries[uuid].bounds.box;

            [[Math.min, zoneInfo.bounds.min], [Math.max, zoneInfo.bounds.max]].forEach(
                ([fn, arr]: [(...values: number[]) => number, GD.Vector3Arr]) => {
                    for (let i = 0; i < 3; i++)
                        arr[i] = fn(arr[i], min[i], max[i]);
                }
            );
        });

        // debugger;

        return this.uuid;
    }
}

export default ATerrainInfo;
export { ATerrainInfo, ETerrainRenderMethod_T };