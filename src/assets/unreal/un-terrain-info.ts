import BufferValue from "../buffer-value";
import UObject from "./un-object";
import UTexture from "./un-texture";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UTerrainInfo extends UObject {
    private terrainMap: UTexture = null;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap()), {
            "TerrainMap": "terrainMap"
        }
    };

    public async load(pkg: UPackage, exp: UExport) {
        const prop = await this.loadProperty(pkg, exp.offset.value as number + 17);

        // const compat = new BufferValue(BufferValue.compat32);
        // const info = new BufferValue(BufferValue.int8);
        // buffer.seek(data.offset.value as number + 0, 0);
        // for (let i = 0; i < 40; i++) {
        //     buffer.read(compat);
        //     console.log(buffer.offset, compat.value, compat.value as number > 0 ? buffer.nameTable[compat.value as number].name.string : "None");
        // }
        // const prop = compat.value as number > 0 && buffer.nameTable.length
        //     ? buffer.nameTable[compat.value as number].name.string
        //     : "None";

        // if (!prop || prop === "None") {
        //     throw new Error("Wrong prop.");
        // }

        // buffer.read(info);

        // // const isArray = info.value as number &

        // console.log(info);
        debugger;
        throw new Error("Method not implemented.");

        return this;
    }

}

export default UTerrainInfo;
export { UTerrainInfo };