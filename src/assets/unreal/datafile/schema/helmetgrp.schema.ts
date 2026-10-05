import type { ISchemaValue } from "./dat-schema";
import { SizedContainerType } from "./dat-container";

export const SCHEMA_HELMETGRP_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: new SizedContainerType("int32", 15 * 15 * 2), name: "hair" } // FL2HairData::Serialize 0x702330: 15 bodies, 15 styles, interleaved front/back indices.
];

export const SCHEMA_HAIRACCESSARYGRP_DAT = SCHEMA_HELMETGRP_DAT;
