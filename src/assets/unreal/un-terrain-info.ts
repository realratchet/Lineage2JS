import UTerrainLayer from "./un-terrain-layer";
import UDecoLayer from "./un-deco-layer";
import { BufferValue } from "@l2js/core";
import UAActor from "./un-aactor";
import FTIntMap from "./un-tint-map";
import FColor from "./un-color";
import FBox from "./un-box";
import FCoords from "./un-coords";
import AInfo from "./un-info";
import { FObjectArray } from "@l2js/core/src/unreal/un-array";

const MAP_SIZE_X = 128 * 256;
const MAP_SIZE_Y = 128 * 256;

class FTerrainInfo extends AInfo {
    declare public terrainMap: GA.UTexture;
    declare public terrainScale: GA.FVector;
    declare public readonly layers: GA.UTerrainLayer[];

    // protected decoLayers: FArray<UDecoLayer> = new FArray(UDecoLayer);
    // protected showOnTerrain: number;
    // public readonly quadVisibilityBitmap: FPrimitiveArray<"uint32"> = new FPrimitiveArray(BufferValue.uint32);
    // public readonly edgeTurnBitmap: FPrimitiveArray<"uint32"> = new FPrimitiveArray(BufferValue.uint32);
    // protected mapX: number;
    // protected mapY: number;
    // public readonly quadVisibilityBitmapOrig: FPrimitiveArray<"uint32"> = new FPrimitiveArray(BufferValue.uint32);
    // public readonly edgeTurnBitmapOrig: FPrimitiveArray<"uint32"> = new FPrimitiveArray(BufferValue.uint32);
    // protected generatedSectorCounter: number;
    // protected numIntMap: number;
    // protected autoTimeGeneration: boolean;
    // protected tIntMap: FArray<FTIntMap> = new FArray(FTIntMap);
    // protected tickTime: number;
    // protected sectors: UTerrainSector[] = [];
    // protected showOnInvisibleTerrain: boolean;
    // protected litDirectional: boolean;
    // protected disregardTerrainLighting: boolean;
    // protected randomYaw: boolean;
    // protected bForceRender: boolean;

    // public readonly isTerrainInfo = true;

    // protected sectorsX: number;
    // protected sectorsY: number;
    // public readonly terrainCoords = new FCoords();
    // protected unkIntArr1: number[];
    // protected unkInt2: number;
    // protected unkInt3: number;
    // protected unkColorArr = new FArray(FColor);

    // public readonly boundingBox = new FBox();
    // public heightmapMin: number;
    // public heightmapMax: number;

    // protected hasDynamicLight: boolean;
    // protected forcedRegion: number;

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
            //         "DecoLayers": "decoLayers",
            //         "QuadVisibilityBitmap": "quadVisibilityBitmap",
            //         "EdgeTurnBitmap": "edgeTurnBitmap",
            //         "MapX": "mapX",
            //         "MapY": "mapY",
            //         "QuadVisibilityBitmapOrig": "quadVisibilityBitmapOrig",
            //         "EdgeTurnBitmapOrig": "edgeTurnBitmapOrig",
            //         "GeneratedSectorCounter": "generatedSectorCounter",
            //         "NumIntMap": "numIntMap",
            //         "bAutoTimeGeneration": "autoTimeGeneration",
            //         "TIntMap": "tIntMap",
            //         "TickTime": "tickTime",
            //         "ShowOnInvisibleTerrain": "showOnInvisibleTerrain",
            //         "LitDirectional": "litDirectional",
            //         "DisregardTerrainLighting": "disregardTerrainLighting",
            //         "RandomYaw": "randomYaw",
            //         "bForceRender": "bForceRender",
            //         "bDynamicLight": "hasDynamicLight",
            //         "ForcedRegion": "forcedRegion",

            //         "TerrainSectorSize": "_terrainSectorSize",
            //         "DecoLayerOffset": "_decoLayerOffset",
            //         "Inverted": "_inverted",
            //         "bKCollisionHalfRes": "_bKCollisionHalfRes",
            //         "JustLoaded": "_justLoaded",
            //         "DecoLayerData": "_decoLayerData",
            //         "Sectors": "_sectors",
            //         "Vertices": "_vertices",
            //         "HeightmapX": "_heightmapX",
            //         "HeightmapY": "_heightmapY",
            //         "SectorsX": "_sectorsX",
            //         "SectorsY": "_sectorsY",
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

        if (verLicense >= 0x11) {
            const sectors = new FObjectArray<GA.UTerrainSector>().load(pkg);

            this.readHead = pkg.tell();

            sectors.forEach(object => {
                object.info = this;

                this.boundingBox.expandByPoint(object.boundingBox.min);
                this.boundingBox.expandByPoint(object.boundingBox.max);

                this.sectors.push(object);
            });

            pkg.seek(this.readHead, "set");

            this.sectorsX = pkg.read(int32).value as number;
            this.sectorsY = pkg.read(int32).value as number;
        } else {
            console.warn("Unsupported yet");
            debugger;
        }

        if (verArchive >= 0x53) {
            this.terrainCoords.load(pkg);
            this.unkIntArr1 = new Array(12).fill(1).map(() => pkg.read(float).value as number);
        } else {
            console.warn("Unsupported yet");
            debugger;
        }

        if (verArchive >= 0x4C) {
            this.unkInt2 = pkg.read(int32).value as number;
            this.unkInt3 = pkg.read(int32).value as number;
        } else {
            console.warn("Unsupported yet");
            debugger;
        }

        if (verArchive <= 0x4A) {
            console.warn("Unsupported yet");
            debugger;
        } else {
            if (verArchive >= 0x52) {
                if (verArchive >= 0x56) {
                    if (verArchive <= 0x57) {
                        console.warn("Unsupported yet");
                        debugger;
                    } else {
                        if (verArchive >= 0x73) {
                            if (verArchive >= 0x77) {
                                if (verArchive >= 0x75) this.unkColorArr.load(pkg, null);
                                else {
                                    console.warn("Unsupported yet");
                                    debugger;
                                }
                            } else {
                                console.warn("Unsupported yet");
                                debugger;
                            }
                        } else {
                            console.warn("Unsupported yet");
                            debugger;
                        }
                    }
                } else {
                    console.warn("Unsupported yet");
                    debugger;
                }
            } else {
                console.warn("Unsupported yet");
                debugger;
            }
        }

        this.readHead = pkg.tell();


        return this;
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