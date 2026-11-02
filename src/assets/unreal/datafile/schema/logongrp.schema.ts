import type { ISchemaValue } from "./dat-schema";

export const LOGONGRP_RECORD_COUNT = 26;

export const SCHEMA_LOGONGRP_DAT: ISchemaValue[] = [ // Engine.dll FL2GameData loader 0x10441bc5 reads four floats per record.
    { type: "float", name: "x" },
    { type: "float", name: "y" },
    { type: "float", name: "z" },
    { type: "float", name: "yaw" }
];

export default SCHEMA_LOGONGRP_DAT;
