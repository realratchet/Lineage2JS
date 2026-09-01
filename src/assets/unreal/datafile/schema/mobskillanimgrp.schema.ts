import type { ISchemaValue } from "./dat-schema";

export const SCHEMA_MOBSKILLANIMGRP_DAT: ISchemaValue[] = [
    { type: "uint32", name: "npc_id" },
    { type: "uint32", name: "skill_id" },
    { type: "utf16", name: "seq_name" },
    { type: "ASCF", name: "skill_name" },
    { type: "ASCF", name: "npc_name" },
    { type: "ASCF", name: "npc_class" }
];

export default SCHEMA_MOBSKILLANIMGRP_DAT;
