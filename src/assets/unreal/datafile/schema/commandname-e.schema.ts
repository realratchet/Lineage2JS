import type { ISchemaValue } from "./dat-schema";
const SCHEMA_COMMANDNAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "nbr" },
    { type: "uint32", name: "id" },
    { type: "ASCF", name: "name" }
];

export default SCHEMA_COMMANDNAME_E_DAT;
export { SCHEMA_COMMANDNAME_E_DAT };
