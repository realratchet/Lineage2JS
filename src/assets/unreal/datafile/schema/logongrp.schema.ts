import type { ISchemaValue } from "./dat-schema";

export const LOGONGRP_RECORD_COUNT = 26;

export const SCHEMA_LOGONGRP_DAT: ISchemaValue[] = [
    { type: "int32", name: "x" },
    { type: "int32", name: "y" },
    { type: "int32", name: "z" },
    { type: "int32", name: "yaw" }
];

export default SCHEMA_LOGONGRP_DAT;
