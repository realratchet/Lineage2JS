import type { ISchemaValue } from "./dat-schema";

export const SCHEMA_SYMBOLNAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: "ASCF", name: "filename" },
    { type: "ASCF", name: "alias" },
    { type: "uint32", name: "tag" }
];

export default SCHEMA_SYMBOLNAME_E_DAT;
