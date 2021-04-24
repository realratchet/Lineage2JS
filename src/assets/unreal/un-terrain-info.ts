import UObject from "./un-object";
import UTexture from "./un-texture";
import { PropertyTag } from "./un-property";
import UTerrainLayer from "./un-terrain-layer";

type Vector3 = import("three/src/math/Vector3").Vector3;
type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UTerrainInfo extends UObject {
    protected terrainMap: UTexture = null;
    protected terrainScale: Vector3 = null;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "TerrainMap": "terrainMap",
            "TerrainScale": "terrainScale"
        })
    };

    public async load(pkg: UPackage, exp: UExport) {
        let curOffset = exp.offset.value as number + 17;
        const endOffset = curOffset + (exp.size.value as number);

        do {
            const tag = await PropertyTag.from(pkg, curOffset);

            if (!tag.isValid()) break;

            await this.loadProperty(pkg, tag);

            curOffset = pkg.tell();
        } while (curOffset < endOffset);

        debugger;

        return this;
    }

    protected async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> {
        switch (tag.structName) {
            case "TerrainLayer": return await new UTerrainLayer().load(pkg, null);
        }

        return super.readStruct(pkg, tag);
    }

}

export default UTerrainInfo;
export { UTerrainInfo };