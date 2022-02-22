import UObject from "./un-object";
import UTexture from "./un-texture";
import UTerrainLayer from "./un-terrain-layer";
import FArray, { FPrimitiveArray } from "./un-array";
import UDecoLayer from "./un-deco-layer";
import FNumber from "./un-number";
import BufferValue from "../buffer-value";
import { PropertyTag } from "./un-property";
import FUnknownStruct from "./un-unknown-struct";
// import { Group } from "three/src/objects/Group";
import UAActor from "./un-aactor";
// import FColor from "./un-color";
import FVector from "./un-vector";
import FTIntMap from "./un-tint-map";

const MAP_SIZE_X = 128 * 256;
const MAP_SIZE_Y = 128 * 256;

class UTerrainInfo extends UAActor {
    protected readHeadOffset: number = 17;

    public terrainMap: UTexture;
    public terrainScale: FVector;

    public readonly layers: Set<UTerrainLayer> = new Set<UTerrainLayer>();
    protected decoLayers: FArray<UDecoLayer> = new FArray(UDecoLayer);
    protected showOnTerrain: number;
    public readonly quadVisibilityBitmap: FPrimitiveArray<"int32"> = new FPrimitiveArray(BufferValue.int32);
    public readonly edgeTurnBitmap: FPrimitiveArray<"int32"> = new FPrimitiveArray(BufferValue.int32);
    protected mapX: number;
    protected mapY: number;
    public readonly quadVisibilityBitmapOrig: FPrimitiveArray<"int32"> = new FPrimitiveArray(BufferValue.int32);
    public readonly edgeTurnBitmapOrig: FPrimitiveArray<"int32"> = new FPrimitiveArray(BufferValue.int32);
    protected generatedSectorCounter: number;
    protected numIntMap: number;
    protected autoTimeGeneration: boolean;
    protected tIntMap: FArray<FTIntMap> = new FArray(FTIntMap);
    protected tickTime: number;
    protected sectors: UExport<UTerrainSector>[];
    protected showOnInvisibleTerrain: boolean;
    protected litDirectional: boolean;
    protected disregardTerrainLighting: boolean;
    protected randomYaw: boolean;
    protected bForceRender: boolean;

    protected isSelected: boolean;

    public readonly isTerrainInfo = true;

    constructor(sectors: UExport<UTerrainSector>[]) {
        super();

        // debugger;

        this.sectors = sectors;
    }

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
            "bForceRender": "bForceRender",
            "bSelected": "isSelected"
        });
    }

    protected readStruct(pkg: UPackage, tag: PropertyTag): any {
        switch (tag.structName) {
            case "TerrainLayer": return new UTerrainLayer(pkg.tell(), pkg.tell() + tag.dataSize).load(pkg, null);
        }

        return super.readStruct(pkg, tag);
    }

    public doLoad(pkg: UPackage, exp: UExport<UTerrainInfo>) {

        // likely lightning
        // pkg.seek(exp.offset.value as number, "set");
        // const header = pkg.read(BufferValue.allocBytes(17));

        // debugger;

        super.doLoad(pkg, exp);

        // debugger;

        this.location.x = (this.mapX - 20) * MAP_SIZE_X;
        this.location.z = (this.mapY - 18) * MAP_SIZE_Y;

        // debugger;

        if (!this.sectors) {
            const expTerrainSectors = pkg.exports
                .filter(exp => {
                    const expType = pkg.getPackageName(exp.idClass.value as number);

                    return expType === "TerrainSector";
                })
                .sort(({ objectName: na }, { objectName: nb }) => {
                    const a = parseInt(na.replace("TerrainSector", ""));
                    const b = parseInt(nb.replace("TerrainSector", ""));
                    return a - b;
                });

            this.sectors = expTerrainSectors as UExport<UTerrainSector>[];
        } else {
            console.warn("Terrain already has sectors?");
            debugger;
        }

        this.readHead = pkg.tell();

        try {
            for (let i = this.readHead; i < this.readTail; i++) {
                pkg.seek(i, "set");

                const prop = PropertyTag.from(pkg, i);

                if (!prop.isValid()) continue;

                console.log(prop);

                if (
                    !prop.name.includes("LightMap") &&
                    prop.name !== "bDynamicActorFilterState" &&
                    prop.name !== "Level" &&
                    prop.name !== "Region" &&
                    prop.name !== "bSunAffect" &&
                    prop.name !== "Tag" &&
                    prop.name !== "PhysicsVolume" &&
                    prop.name !== "Location" &&
                    prop.name !== "DrawScale" &&
                    prop.name !== "TexModifyInfo"

                ) continue;

                debugger;
            }
        } catch (e) {

        }

        debugger;

        // this.readNamedProps(pkg);
        // debugger;

        for (let exp of this.sectors) {
            try {
                this.promisesLoading.push(pkg.createObject(pkg, exp, "TerrainSector", this));
            } catch (e) { console.error(e); }
        }

        debugger;

        return this;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IBaseObjectDecodeInfo> {
        await this.onLoaded();

        const itLayer = this.layers.values();
        const layerCount = this.layers.size;
        const terrainLayers: UTerrainLayer[] = new Array(this.layers.size);

        for (let i = 0; i < layerCount; i++)
            terrainLayers[i] = itLayer.next().value as UTerrainLayer;

        await Promise.all(terrainLayers.map(x => x.onLoaded()));
        await this.terrainMap.getDecodeInfo(library);

        const layers: { map: string, alphaMap: string }[] = new Array(layerCount);

        for (let k = 0; k < layerCount; k++) {
            const layer = terrainLayers[k];

            // if (layer.alphaMap === null || layer.map === null)
            //     debugger;

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

        return {
            type: "TerrainInfo",
            name: this.objectName,
            position: [this.location.x, 0, this.location.z],
            children: await Promise.all(this.sectors.map(sector => (sector.object as UTerrainSector).getDecodeInfo(library)))
        };
    }
}

export default UTerrainInfo;
export { UTerrainInfo };