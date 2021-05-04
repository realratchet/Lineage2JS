import UObject from "./un-object";
import UTexture from "./un-texture";
import UTerrainLayer from "./un-terrain-layer";
import FArray from "./un-array";
import UDecoLayer from "./un-deco-layer";
import FNumber from "./un-number";
import BufferValue from "../buffer-value";
import { PropertyTag } from "./un-property";
import FUnknownStruct from "./un-unknown-struct";
import UTerrainSector from "./un-terrain-sector";
import { Group, Vector3 } from "three";

type UExport<T extends UObject = UObject> = import("./un-export").UExport<T>;
type Vector3 = import("three/src/math/Vector3").Vector3;
type ULevelInfo = import("./un-level-info").ULevelInfo;
type UPackage = import("./un-package").UPackage;
type UTerrainSector = import("./un-terrain-sector").UTerrainSector;

const MAP_SIZE_X = 128 * 256;
const MAP_SIZE_Y = 128 * 256;

class UTerrainInfo extends UObject {
    protected readHeadOffset: number = 17;

    protected terrainMap: UTexture;
    public terrainScale: Vector3;
    public readonly location: Vector3 = new Vector3();
    protected layers: Set<UTerrainLayer> = new Set<UTerrainLayer>();
    protected decoLayers: FArray<UDecoLayer> = new FArray(UDecoLayer);
    protected showOnTerrain: number;
    public readonly quadVisibilityBitmap: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.int32) as any);
    public readonly edgeTurnBitmap: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.int32) as any);
    protected mapX: number;
    protected mapY: number;
    public readonly quadVisibilityBitmapOrig: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.int32) as any);
    public readonly edgeTurnBitmapOrig: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.int32) as any);
    protected generatedSectorCounter: number;
    protected numIntMap: number;
    protected autoTimeGeneration: boolean;
    protected tIntMap: FArray<FUnknownStruct> = new FArray(FUnknownStruct);
    protected tickTime: number;
    protected dynamicActorFilterState: boolean;
    protected level: ULevelInfo;
    protected sectors: UExport<UTerrainSector>[];
    protected showOnInvisibleTerrain: boolean;
    protected litDirectional: boolean;
    protected disregardTerrainLighting: boolean;
    protected randomYaw: boolean;
    protected bForceRender: boolean;

    constructor(sectors: UExport<UTerrainSector>[]) {
        super();

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
            "bDynamicActorFilterState": "dynamicActorFilterState",
            "Level": "level",
            "ShowOnInvisibleTerrain": "showOnInvisibleTerrain",
            "LitDirectional": "litDirectional",
            "DisregardTerrainLighting": "disregardTerrainLighting",
            "RandomYaw": "randomYaw",
            "bForceRender": "bForceRender"
        });
    }

    protected async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> {
        switch (tag.structName) {
            case "TerrainLayer": return await new UTerrainLayer(pkg.tell(), pkg.tell() + tag.dataSize).load(pkg, null);
        }

        return super.readStruct(pkg, tag);
    }

    public async load(pkg: UPackage, exp: UExport<UTerrainInfo>) {

        // likely lightning
        // pkg.seek(exp.offset.value as number, "set");
        // const header = pkg.read(BufferValue.allocBytes(17));

        await super.load(pkg, exp);

        this.location.x = (this.mapX - 20) * MAP_SIZE_X;
        this.location.z = (this.mapY - 18) * MAP_SIZE_Y;

        for (let exp of this.sectors) {
            try {
                await pkg.createObject(pkg, exp, "TerrainSector", this);
            } catch (e) { console.error(e); }
        }

        return this;
    }

    public async decodeMesh() {
        const terrain = new Group();
        const terrainMap = await this.terrainMap.decodeMipmap(0);

        // debugger;

        for (let exp of this.sectors) {
            console.log("--------------------------");
            if (exp.object) terrain.add(await exp.object.decodeMesh(terrainMap));
            // debugger;
        }

        return terrain;
    }
}

export default UTerrainInfo;
export { UTerrainInfo };