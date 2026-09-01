import type { ISchemaValue } from "./dat-schema";
import { SizedContainerType } from "./dat-container";

const SCHEMA_QUESTNAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "tag_?" },
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
    { type: "uint32", name: "UNK_npc1_?" },
    { type: "uint32", name: "UNK_npc2_?" },
    { type: "uint32", name: "UNK_npc3_?" },
    { type: "ASCF", name: "entity_name" },
    { type: "uint32", name: "UNK_0" },
    { type: "uint32", name: "UNK_1" },
    { type: "uint32", name: "UNK_2" },
    { type: "uint32", name: "UNK_3" },
    { type: "float", name: "entity_x_?" },
    { type: "float", name: "entity_y_?" },
    { type: "float", name: "entity_z_?" },
    { type: "ASCF", name: "race_restricion" },
    { type: "ASCF", name: "short_description" }
];

export default SCHEMA_QUESTNAME_E_DAT;
export { SCHEMA_QUESTNAME_E_DAT };
