import UObject from "./un-object";
import UTexture from "./un-texture";
import UTerrainLayer from "./un-terrain-layer";
import FArray from "./un-array";
import UDecoLayer from "./un-deco-layer";
import FNumber from "./un-number";
import BufferValue from "../buffer-value";
import { PropertyTag } from "./un-property";
import FUnknownStruct from "./un-unknown-struct";
// import { Group } from "three/src/objects/Group";
import UAActor from "./un-aactor";
// import FColor from "./un-color";
import FVector from "./un-vector";

const MAP_SIZE_X = 128 * 256;
const MAP_SIZE_Y = 128 * 256;

class UTerrainInfo extends UAActor {
    protected readHeadOffset: number = 17;

    public terrainMap: UTexture;
    public terrainScale: FVector;

    public readonly layers: Set<UTerrainLayer> = new Set<UTerrainLayer>();
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
    protected sectors: UExport<UTerrainSector>[];
    protected showOnInvisibleTerrain: boolean;
    protected litDirectional: boolean;
    protected disregardTerrainLighting: boolean;
    protected randomYaw: boolean;
    protected bForceRender: boolean;

    protected isSelected: boolean;

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

        for (let exp of this.sectors) {
            try {
                this.promisesLoading.push(pkg.createObject(pkg, exp, "TerrainSector", this));
            } catch (e) { console.error(e); }
        }

        return this;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<IBaseObjectDecodeInfo> {
        await Promise.all(this.promisesLoading);
        await this.terrainMap.getDecodeInfo(library);

        return {
            type: "TerrainInfo",
            name: this.objectName,
            position: [this.location.x, 0, this.location.z],
            children: await Promise.all(this.sectors.map(sector => (sector.object as UTerrainSector).getDecodeInfo(library)))
        };
    }

    public async decodeMesh() {

        const terrain = new Group();
        const terrainMap = await this.terrainMap.decodeMipmap(0);

        // debugger;

        for (let exp of this.sectors) {
            if (!exp.object) continue;

            const segment = await exp.object.decodeMesh(terrainMap);

            terrain.add(segment);
        }

        terrain.position.set(this.location.x, 0, this.location.z);

        // for (let i = 1, len = this.decoLayers.getElemCount(); i < len; i++) {
        //     const layer = this.decoLayers.getElem(i);
        //     const mesh = await layer.staticMesh.decodeMesh();

        //     terrain.add(mesh);

        //     mesh.material.wireframe = true;
        // }

        return terrain;
    }
}

export default UTerrainInfo;
export { UTerrainInfo };