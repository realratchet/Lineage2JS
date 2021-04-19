import AssetBuffer from "../asset-buffer";
import BufferValue from "../buffer-value";

type UExport = import("./un-export").UExport;

class UTerrainInfo {
    static fromAsset(buffer: AssetBuffer, data: UExport) {
        const prop = buffer.loadProperty(data.offset.value as number + 17);

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
    }

}

export default UTerrainInfo;
export { UTerrainInfo };