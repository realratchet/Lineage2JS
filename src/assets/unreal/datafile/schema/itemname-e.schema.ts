import { BufferValue } from "@l2js/core";

const SCHEMA_ITEMNAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: "utf16", name: "name" },
    { type: "utf16", name: "add_name" },
    { type: BufferValue.char, name: "description" },
    { type: "int32", name: "popup" }
];

export default SCHEMA_ITEMNAME_E_DAT;
export { SCHEMA_ITEMNAME_E_DAT };
