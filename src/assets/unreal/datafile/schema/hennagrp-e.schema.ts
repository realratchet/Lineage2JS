import type { ISchemaValue } from "./dat-schema";
const SCHEMA_HENNAGRP_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: "uint32", name: "dye_id" },
    { type: "ASCF", name: "name" },
    { type: "ASCF", name: "icon" },
    { type: "ASCF", name: "symbol_add_name" },
    { type: "ASCF", name: "symbol_add_desc" }
];

export default SCHEMA_HENNAGRP_E_DAT;
export { SCHEMA_HENNAGRP_E_DAT };
