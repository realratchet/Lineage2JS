import type { ISchemaValue } from "./dat-schema";
const SCHEMA_NPCNAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: "ASCF", name: "name" },
    { type: "ASCF", name: "description" },
    { type: "uint8", name: "red" },
    { type: "uint8", name: "green" },
    { type: "uint8", name: "blue" },
    { type: "uint8", name: "reserved" }
];

export default SCHEMA_NPCNAME_E_DAT;
export { SCHEMA_NPCNAME_E_DAT };
