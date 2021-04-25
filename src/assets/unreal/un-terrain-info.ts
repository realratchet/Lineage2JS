import UObject from "./un-object";
import UTexture from "./un-texture";
import { PropertyTag } from "./un-property";
import UTerrainLayer from "./un-terrain-layer";

type Vector3 = import("three/src/math/Vector3").Vector3;
type UPackage = import("./un-package").UPackage;

class UTerrainInfo extends UObject {
    protected terrainMap: UTexture = null;
    protected terrainScale: Vector3 = null;
    protected readHeadOffset: number = 17;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "TerrainMap": "terrainMap",
            "TerrainScale": "terrainScale"
        })
    };

    protected async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> {
        switch (tag.structName) {
            case "TerrainLayer": return await new UTerrainLayer().load(pkg, null);
        }

        return super.readStruct(pkg, tag);
    }

}

export default UTerrainInfo;
export { UTerrainInfo };