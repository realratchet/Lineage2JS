import UObject from "./un-object";
import UTexture from "./un-texture";
import UTerrainLayer from "./un-terrain-layer";
import FArray from "./un-array";
import UDecoLayer from "./un-deco-layer";
import FNumber from "./un-number";
import BufferValue from "../buffer-value";
import { PropertyTag } from "./un-property";
import FUnknownStruct from "./un-unknown-struct";

type Vector3 = import("three/src/math/Vector3").Vector3;
type UExport = import("./un-export").UExport;
type UPackage = import("./un-package").UPackage;

class UTerrainInfo extends UObject {
    protected readHeadOffset: number = 17;

    protected terrainMap: UTexture;
    protected terrainScale: Vector3;
    protected layers: Set<UTerrainLayer> = new Set<UTerrainLayer>();
    protected decoLayers: FArray<UDecoLayer> = new FArray(UDecoLayer);
    protected showOnTerrain: number;
    protected quadVisibilityBitmap: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.int32) as any);
    protected edgeTurnBitmap: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.int32) as any);
    protected mapX: number;
    protected mapY: number;
    protected quadVisibilityBitmapOrig: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.int32) as any);
    protected edgeTurnBitmapOrig: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.int32) as any);
    protected generatedSectorCounter: number;
    protected numIntMap: number;
    protected autoTimeGeneration: boolean;
    protected tIntMap: FArray<FUnknownStruct> = new FArray(FUnknownStruct);
    protected tickTime: number;
    protected dynamicActorFilterState: boolean;

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
            "bDynamicActorFilterState": "dynamicActorFilterState"
        });
    }

    protected async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> {
        switch (tag.structName) {
            case "TerrainLayer": return await new UTerrainLayer(pkg.tell(), pkg.tell() + tag.dataSize).load(pkg, null);
        }

        return super.readStruct(pkg, tag);
    }
}

export default UTerrainInfo;
export { UTerrainInfo };