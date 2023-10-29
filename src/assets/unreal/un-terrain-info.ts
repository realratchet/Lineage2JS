import { BufferValue } from "@l2js/core";
import AInfo from "./un-info";
import FArray, { FObjectArray } from "@l2js/core/src/unreal/un-array";
import FVector from "@client/assets/unreal/un-vector";
import FBox from "@client/assets/unreal/un-box";
import FCoords from "@client/assets/unreal/un-coords";
import FColor from "@client/assets/unreal/un-color";

const MAP_SIZE_X = 128 * 256;
const MAP_SIZE_Y = 128 * 256;

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
        debugger;

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