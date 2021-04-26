import UObject from "./un-object";
import UTexture from "./un-texture";
import { PropertyTag } from "./un-property";
import UTerrainLayer from "./un-terrain-layer";

type Vector3 = import("three/src/math/Vector3").Vector3;
type UExport = import("./un-export").UExport;
type UPackage = import("./un-package").UPackage;

class UTerrainInfo extends UObject {
    protected readHeadOffset: number = 17;

    protected terrainMap: UTexture;
    protected terrainScale: Vector3;
    protected layer: Set<UTerrainLayer> = new Set<UTerrainLayer>();

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "TerrainMap": "terrainMap",
            "TerrainScale": "terrainScale",
            "Layers": "layer"
        });
    }

    public async load(pkg: UPackage, exp: UExport) {
        this.readHead = exp.offset.value as number;
        this.readTail = this.readHead + (exp.size.value as number);

        // const tag = await PropertyTag.from(pkg, this.readHead);

        debugger;

        await super.load(pkg, exp);

        debugger;

        // const tag = [
        //     await PropertyTag.from(pkg, pkg.tell()),
        //     await PropertyTag.from(pkg, pkg.tell()),
        //     await PropertyTag.from(pkg, pkg.tell()),
        //     await PropertyTag.from(pkg, pkg.tell()),
        //     await PropertyTag.from(pkg, pkg.tell()),
        //     await PropertyTag.from(pkg, pkg.tell()),
        //     await PropertyTag.from(pkg, pkg.tell()),
        //     await PropertyTag.from(pkg, pkg.tell())
        // ];

        debugger;

        return this;
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