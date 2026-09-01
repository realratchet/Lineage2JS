import type { ISchemaValue } from "./dat-schema";
import { SizedContainerType } from "./dat-container";

const SCHEMA_ACTIONNAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "tag" },
    { type: "uint32", name: "id" },
    { type: "int32", name: "type" },
    { type: "uint32", name: "category" },
    { type: "compat32", name: "cat2_cnt" },
    { type: new SizedContainerType("int32", "cat2_cnt"), name: "c" },
    { type: "ASCF", name: "cmd" },
    { type: "ASCF", name: "icon" },
    { type: "ASCF", name: "name" },
    { type: "utf16", name: "desc" }
];

export default SCHEMA_ACTIONNAME_E_DAT;
export { SCHEMA_ACTIONNAME_E_DAT };
