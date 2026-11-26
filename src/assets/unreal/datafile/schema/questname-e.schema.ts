import type { ISchemaValue } from "./dat-schema";
import { SizedContainerType } from "./dat-container";

export const SCHEMA_QUESTNAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "tag" },
    { type: "uint32", name: "quest_id" },
    { type: "uint32", name: "quest_prog" },
    { type: "ASCF", name: "main_name" },
    { type: "ASCF", name: "prog_name" },
    { type: "ASCF", name: "description" },
    { type: "compat32", name: "cnt1" },
    { type: new SizedContainerType("int32", "cnt1"), name: "tab1" },
    { type: "compat32", name: "cnt2" },
    { type: new SizedContainerType("int32", "cnt2"), name: "tab2" },
    { type: "float", name: "quest_x" },
    { type: "float", name: "quest_y" },
    { type: "float", name: "quest_z" },
    { type: "uint32", name: "min_level" },
    { type: "uint32", name: "max_level" },
    { type: "uint32", name: "classification" },
    { type: "ASCF", name: "entity_name" },
    { type: "uint32", name: "is_hunting_target" },
    { type: "uint32", name: "shows_progress_complete" },
    { type: "uint32", name: "shows_items_complete" },
    { type: "uint32", name: "start_npc_id" },
    { type: "float", name: "entity_x" },
    { type: "float", name: "entity_y" },
    { type: "float", name: "entity_z" },
    { type: "ASCF", name: "race_restricion" },
    { type: "ASCF", name: "short_description" }
];

export default SCHEMA_QUESTNAME_E_DAT;
