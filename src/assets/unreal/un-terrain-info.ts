import { APackage, BufferValue, } from "@l2js/core";
import AInfo from "./un-info";
import FArray, { FObjectArray } from "@l2js/core/src/unreal/un-array";

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

class FTerrainNormalPair implements C.IConstructable {
    public normal1 = FVector.make();
    public normal2 = FVector.make();

    public load(pkg: APackage): this {
        this.normal1.load(pkg);
        this.normal2.load(pkg);

        return this;
    }

}

abstract class FTerrainInfo extends AInfo {
    declare public readonly terrainMap: GA.UTexture;
    declare public readonly terrainScale: GA.FVector;
    declare public readonly layers: GA.UTerrainLayer[];

    declare protected readonly decoLayers: C.FArray<GA.UDecoLayer>
    declare protected readonly showOnTerrain: number;
    declare public readonly quadVisibilityBitmap: C.FPrimitiveArray<"uint32">;
    declare public readonly edgeTurnBitmap: C.FPrimitiveArray<"uint32">;
    declare protected readonly mapX: number;
    declare protected readonly mapY: number;
    declare public readonly quadVisibilityBitmapOrig: C.FPrimitiveArray<"uint32">;
    declare public readonly edgeTurnBitmapOrig: C.FPrimitiveArray<"uint32">;
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

    public readonly isTerrainInfo = true;

    declare protected sectorsX: number;
    declare protected sectorsY: number;
    declare public toWorld: GA.FCoords;
    declare protected toHeightMap: GA.FCoords;
    declare protected heightmapX: number;
    declare protected heightmapY: number;
    declare protected vertexColors: C.FArray<GA.FColor>;

    declare public boundingBox: GA.FBox;
    // public heightmapMin: number;
    // public heightmapMax: number;

    declare protected readonly hasDynamicLight: boolean;
    declare protected readonly forcedRegion: number;

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
            "QuadVisibilityBitmap": "quadVisibilityBitmap",
            "EdgeTurnBitmap": "edgeTurnBitmap",
            "MapX": "mapX",
            "MapY": "mapY",
            "QuadVisibilityBitmapOrig": "quadVisibilityBitmapOrig",
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

            //         "TerrainSectorSize": "_terrainSectorSize",
            //         "DecoLayerOffset": "_decoLayerOffset",
            //         "Inverted": "_inverted",
            //         "bKCollisionHalfRes": "_bKCollisionHalfRes",
            //         "JustLoaded": "_justLoaded",
            //         "DecoLayerData": "_decoLayerData",

            //         "Vertices": "_vertices",
            //         "HeightmapX": "_heightmapX",
            //         "HeightmapY": "_heightmapY",

            //         "Primitive": "_primitive",
            //         "FaceNormals": "_faceNormals",
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

    public doLoad(pkg: GA.UPackage, exp: C.UExport<FTerrainInfo>) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const int32 = new BufferValue(BufferValue.int32);
        const float = new BufferValue(BufferValue.float);

        // console.assert(verArchive === 123, "Archive version differs, will likely not work.");
        // console.assert(verLicense === 23, "Licensee version differs, will likely not work.");

        super.doLoad(pkg, exp);


        this.readHead = pkg.tell();

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

            this.sectorsX = pkg.read(int32).value;
            this.sectorsY = pkg.read(int32).value;
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

        this.heightmapX = pkg.read(int32).value;
        this.heightmapY = pkg.read(int32).value;

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
        // seems to be precomputed in lineage2 but keep algo for the moment

        // const toHeightmapTransposed = this.toHeightMap.transpose();
        // for (let i = 0, lcount = this.layers.length; i < lcount; i++) {
        //     const layer = this.layers[i];

        //     if (!layer || !layer.map || !layer.alphaMap) continue;

        //     if (layer.alphaMap.loadSelf().format === ETextureFormat.TEXF_P8) {
        //         const palette = layer.alphaMap.palette.loadSelf();

        //         for (let p = 0; p < 256; p++) {
        //             const colr = palette.colors[p];

        //             colr.a = colr.r;
        //         }
        //     }

        //     const rotator = FRotator.make(0, layer.mapRotation, 0);
        //     const texCoords = GMath().unitCoords.div(rotator).mul(toHeightmapTransposed);
        //     const addOrigin = FVector.make(layer.panW * layer.scaleW, layer.panH * layer.scaleH, 0).transformVectorBy(this.toWorld);

        //     texCoords.xAxis = texCoords.xAxis.divideScalar(layer.scaleW);
        //     texCoords.yAxis = texCoords.yAxis.divideScalar(layer.scaleH);
        //     texCoords.origin = texCoords.origin.add(addOrigin);


        //     switch (layer.mapAxis) {
        //         case TextureMapAxis_T.TEXMAPAXIS_XZ:
        //             [texCoords.origin.y, texCoords.origin.z] = [texCoords.origin.z, texCoords.origin.y];
        //             [texCoords.origin.x, texCoords.origin.z] = [texCoords.origin.z, texCoords.origin.x];
        //             [texCoords.xAxis.x, texCoords.xAxis.z] = [texCoords.xAxis.z, texCoords.xAxis.x];
        //             [texCoords.yAxis.x, texCoords.yAxis.y] = [texCoords.yAxis.y, texCoords.yAxis.x];
        //             [texCoords.zAxis.y, texCoords.zAxis.z] = [texCoords.zAxis.z, texCoords.zAxis.y];
        //             break;
        //         case TextureMapAxis_T.TEXMAPAXIS_YZ:
        //             [texCoords.origin.x, texCoords.origin.z] = [texCoords.origin.z, texCoords.origin.x];
        //             [texCoords.xAxis.x, texCoords.xAxis.z] = [texCoords.xAxis.z, texCoords.xAxis.x];
        //             [texCoords.zAxis.x, texCoords.zAxis.z] = [texCoords.zAxis.z, texCoords.zAxis.x];
        //             break;
        //     }

        //     const texCoordsFinal = texCoords.mul(GMath().unitCoords.div(layer.layerRotation));

        //     layer.terrainMatrix = texCoordsFinal.matrix();
        // }
    }

    protected getGlobalVertex(x: number, y: number) { return x + y * this.heightmapX; }
    protected heightmapToWorld(H: FVector) { return H.transformPointBy(this.toWorld); }
    protected getHeightmap(x: number, y: number) {
        const width = this.terrainMap.width;
        switch (this.terrainMap.format) {
            case ETextureFormat.TEXF_G16:
                return this.terrainMap.mipmaps[0].dataArray.getElem((x + y * width) * 2);
            case ETextureFormat.TEXF_P8:
                return 256 * this.terrainMap.mipmaps[0].dataArray.getElem(x + y * width);
        }
        return 0;
    }

    public getEdgeTurnBitmap(x: number, y: number) {
        let BitIndex = x + y * this.heightmapX;
        return (this.edgeTurnBitmap.getElem(BitIndex >> 5) & (1 << (BitIndex & 0x1f))) ? 1 : 0;
    }

    protected updateVertices(startX: number, startY: number, endX: number, endY: number) {

        if (!this.terrainMap)
            return;

        const vCount = this.heightmapX * this.heightmapY;
        const vertices = new Array<FVector>(vCount);
        const faceNormals = new Array<FTerrainNormalPair>(vCount);

        const terrain = this.terrainMap.loadSelf();

        for (let i = 0; i < vCount; i++)
            faceNormals[i] = new FTerrainNormalPair();

        debugger;

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                vertices[this.getGlobalVertex(x, y)] = this.heightmapToWorld(FVector.make(x, y, this.getHeightmap(x, y)));

                if (x > 0 && y > 0) {
                    const normIdx = this.getGlobalVertex(x - 1, y - 1);
                    const faceNormal = faceNormals[normIdx] = new FTerrainNormalPair();
                    if (this.getEdgeTurnBitmap(x - 1, y - 1)) {
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
    }

    protected updateTriangles(startX: number, startY: number, endX: number, endY: number) {
        //!! make this faster
        for (let i = 0, len = this.sectors.length; i < len; i++) {
            const sector = this.sectors[i];
            if (
                sector.offsetX > endX ||
                sector.offsetY > endY ||
                sector.offsetX + sector.quadsX < startX ||
                sector.offsetY + sector.quadsY < startY
            )
                continue;

            debugger;

            // if( UpdateLighting )
            //     Sectors(i)->StaticLight(1);
            // Sectors(i)->GenerateTriangles();
        }
    }


    protected combineLayerWeights() { throw new Error("not yet implemented"); }

    public postLoad(pkg: GA.UPackage, exp: C.UExport<C.UObject>) {
        super.postLoad(pkg, exp);

        let startX = 0, startY = 0;
        let endX = this.heightmapX, endY = this.heightmapY;

        // debugger;
        this.precomputeLayerWeights();
        // debugger;
        this.calcLayerTexCoords();
        // debugger;
        this.updateVertices(startX, startY, endX, endY);
        // debugger;
        this.updateTriangles(startX, startY, endX, endY);
        debugger;
        this.combineLayerWeights();
        debugger;
    }

    public getDecodeInfo(library: GD.DecodeLibrary): string {
        const terrainLayers = this.layers.filter(x => x);
        const layerCount = terrainLayers.length;

        const terrainUuid = this.terrainMap.loadSelf().getDecodeInfo(library);
        const iTerrainMap = library.materials[terrainUuid] as GD.ITextureDecodeInfo;
        const terrainData = new Uint16Array(iTerrainMap.buffer);
        const heightmapData = { info: iTerrainMap, data: terrainData };

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

        return this.uuid;
    }
}

export default FTerrainInfo;
export { FTerrainInfo };