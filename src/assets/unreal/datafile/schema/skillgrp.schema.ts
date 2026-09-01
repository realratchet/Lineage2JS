import type { ISchemaValue } from "./dat-schema";
const SCHEMA_SKILLGRP_DAT: ISchemaValue[] = [
    { type: "uint32", name: "skill_id" },
    { type: "uint32", name: "skill_level" },
    { type: "uint32", name: "oper_type" },
    { type: "uint32", name: "mp_consume" },
    { type: "int32", name: "cast_range" },
    { type: "uint32", name: "cast_style" },
    { type: "float", name: "hit_time" },
    { type: "int32", name: "is_magic" },
    { type: "utf16", name: "ani_char" },
    { type: "utf16", name: "desc" },
    { type: "utf16", name: "icon_name" },
    { type: "uint32", name: "extra_eff" },
    { type: "uint32", name: "is_ench" },
    { type: "uint32", name: "ench_skill_id" },
    { type: "uint32", name: "hp_consume" },
    { type: "int32", name: "UNK_0" },
    { type: "int32", name: "UNK_1" }
];

export default SCHEMA_SKILLGRP_DAT;
export { SCHEMA_SKILLGRP_DAT };
