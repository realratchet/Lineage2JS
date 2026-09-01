import type { ISchemaValue } from "./dat-schema";
const SCHEMA_SKILLNAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: "uint32", name: "level" },
    { type: "ASCF", name: "name" },
    { type: "ASCF", name: "description" },
    { type: "ASCF", name: "desc_add1" },
    { type: "ASCF", name: "desc_add2" }
];

export default SCHEMA_SKILLNAME_E_DAT;
export { SCHEMA_SKILLNAME_E_DAT };
