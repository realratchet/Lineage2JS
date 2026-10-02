import type { ISchemaValue } from "./dat-schema";

export const SCHEMA_CREDITGRP_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: "ASCF", name: "html" },
    { type: "ASCF", name: "image" },
    { type: "uint32", name: "time" },
    { type: "uint32", name: "align" }
];

export default SCHEMA_CREDITGRP_E_DAT;
