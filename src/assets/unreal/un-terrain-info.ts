import UTerrainLayer from "./un-terrain-layer";
import FArray, { FPrimitiveArray } from "./un-array";
import UDecoLayer from "./un-deco-layer";
import BufferValue from "../buffer-value";
import UAActor from "./un-aactor";
import FTIntMap from "./un-tint-map";
import FNumber from "./un-number";
import FColor from "./un-color";
import FBox from "./un-box";
import FCoords from "./un-coords";

const MAP_SIZE_X = 128 * 256;
const MAP_SIZE_Y = 128 * 256;

class UTerrainInfo extends UAActor {
    protected readHeadOffset: number = 17;

    public terrainMap: UTexture;
    public terrainScale: FVector;

    public readonly layers: Set<UTerrainLayer> = new Set<UTerrainLayer>();
    protected decoLayers: FArray<UDecoLayer> = new FArray(UDecoLayer);
    protected showOnTerrain: number;
    public readonly quadVisibilityBitmap: FPrimitiveArray<"uint32"> = new FPrimitiveArray(BufferValue.uint32);
    public readonly edgeTurnBitmap: FPrimitiveArray<"uint32"> = new FPrimitiveArray(BufferValue.uint32);
    protected mapX: number;
    protected mapY: number;
    public readonly quadVisibilityBitmapOrig: FPrimitiveArray<"uint32"> = new FPrimitiveArray(BufferValue.uint32);
    public readonly edgeTurnBitmapOrig: FPrimitiveArray<"uint32"> = new FPrimitiveArray(BufferValue.uint32);
    protected generatedSectorCounter: number;
    protected numIntMap: number;
    protected autoTimeGeneration: boolean;
    protected tIntMap: FArray<FTIntMap> = new FArray(FTIntMap);
    protected tickTime: number;
    protected sectors: UTerrainSector[] = [];
    protected showOnInvisibleTerrain: boolean;
    protected litDirectional: boolean;
    protected disregardTerrainLighting: boolean;
    protected randomYaw: boolean;
    protected bForceRender: boolean;

    public readonly isTerrainInfo = true;

    protected sectorsX: number;
    protected sectorsY: number;
    public readonly terrainCoords = new FCoords();
    protected unkIntArr1: number[];
    protected unkInt2: number;
    protected unkInt3: number;
    protected unkColorArr = new FArray(FColor);

    public readonly boundingBox = new FBox();
    public heightmapMin: number;
    public heightmapMax: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "TerrainMap": "terrainMap",
            "TerrainScale": "terrainScale",
            "Layers": "layers",
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
            "bForceRender": "bForceRender"
        });
    }

    protected readStruct(pkg: UPackage, tag: PropertyTag): any {
        switch (tag.structName) {
            case "TerrainLayer": return new UTerrainLayer(pkg.tell(), pkg.tell() + tag.dataSize).load(pkg, null);
        }

        return super.readStruct(pkg, tag);
    }

    public doLoad(pkg: UPackage, exp: UExport<UTerrainInfo>) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const int32 = new BufferValue(BufferValue.int32);
        const float = new BufferValue(BufferValue.float);

        console.assert(verArchive === 123, "Archive version differs, will likely not work.");
        console.assert(verLicense === 23, "Licensee version differs, will likely not work.");

        super.doLoad(pkg, exp);

        this.location.x = (this.mapX - 20) * MAP_SIZE_X;
        this.location.z = (this.mapY - 18) * MAP_SIZE_Y;

        this.readHead = pkg.tell();

        if (verLicense >= 0x11) {
            const sectorIds = new FArray(FNumber.forType(BufferValue.compat32) as any)
                .load(pkg, null)
                .map(id => id.value) as number[];

            this.readHead = pkg.tell();

            this.promisesLoading.push(Promise.all(sectorIds.map(async id => {
                const object = await pkg.fetchObject<UTerrainSector>(id);

                object.info = this;

                this.boundingBox.expandByPoint(object.boundingBox.min);
                this.boundingBox.expandByPoint(object.boundingBox.max);

                this.sectors.push(object);
            })));

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

    public async getDecodeInfo(library: DecodeLibrary): Promise<string> {
        await this.onLoaded();

        const itLayer = this.layers.values();
        const layerCount = this.layers.size;
        const terrainLayers: UTerrainLayer[] = new Array(this.layers.size);

        for (let i = 0; i < layerCount; i++)
            terrainLayers[i] = itLayer.next().value as UTerrainLayer;

        await Promise.all(terrainLayers.map(x => x.onLoaded()));

        const terrainUuid = await this.terrainMap.getDecodeInfo(library);
        const iTerrainMap = library.materials[terrainUuid] as ITextureDecodeInfo;
        const terrainData = new Uint16Array(iTerrainMap.buffer);
        const heightmapData = { info: iTerrainMap, data: terrainData };

        const layers: { map: string, alphaMap: string }[] = new Array(layerCount);

        for (let k = 0; k < layerCount; k++) {
            const layer = terrainLayers[k];

            if (!layer.map && !layer.alphaMap) {
                layers[k] = { map: null, alphaMap: null };
                continue;
            }

            if (layer.map?.mipmaps.getElemCount() === 0 && layer.alphaMap?.mipmaps.getElemCount() === 0) {
                layers[k] = { map: null, alphaMap: null };
                debugger;
                continue;
            }

            layers[k] = {
                map: await layer.map?.getDecodeInfo(library) || null,
                alphaMap: await layer.alphaMap?.getDecodeInfo(library) || null
            };

            if (layers[k].alphaMap && !layers[k].map)
                debugger;
        }

        library.materials[this.uuid] = {
            materialType: "terrain",
            layers
        } as IMaterialTerrainDecodeInfo;

        const zoneInfo = library.zones[this.getZone().uuid];
        const children = (await Promise.all(this.sectors.map(sector => sector.getDecodeInfo(library, this, heightmapData))));

        const decodeInfo = {
            uuid: this.uuid,
            type: "TerrainInfo",
            name: this.objectName,
            // position,
            children
        } as IBaseObjectDecodeInfo;

        zoneInfo.children.push(decodeInfo);
        zoneInfo.bounds.isValid = true;

        children.forEach(({ geometry: uuid }) => {
            const { min, max } = library.geometries[uuid].bounds.box;

            [[Math.min, zoneInfo.bounds.min], [Math.max, zoneInfo.bounds.max]].forEach(
                ([fn, arr]: [(...values: number[]) => number, Vector3Arr]) => {
                    for (let i = 0; i < 3; i++)
                        arr[i] = fn(arr[i], min[i], max[i]);
                }
            );
        });

        return this.uuid;
    }
}

export default UTerrainInfo;
export { UTerrainInfo };