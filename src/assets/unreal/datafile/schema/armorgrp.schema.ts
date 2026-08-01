import { UTF16ContainerType } from "@client/assets/unreal/datafile/schema/dat-container";

const characterGroups = ["m_human_fighter", "f_human_fighter", "m_dark_elf", "f_dark_elf", "m_dwarf", "f_dwarf", "m_elf", "f_elf", "m_human_mystic", "f_human_mystic", "m_orc_fighter", "f_orc_fighter", "m_orc_mystic", "f_orc_mystic"];

const SCHEMA_ARMORGRP_DAT: ISchemaValue[] = [
    { type: "uint32", name: "tag" },
    { type: "uint32", name: "id" },
    { type: "uint32", name: "drop_type" },
    { type: "uint32", name: "drop_anim_type" },
    { type: "uint32", name: "drop_radius" },
    { type: "uint32", name: "drop_height" },
    { type: "uint32", name: "unknown_0" },
    { type: "utf16", name: "drop_mesh_1" },
    { type: "utf16", name: "drop_mesh_2" },
    { type: "utf16", name: "drop_mesh_3" },
    { type: "utf16", name: "drop_texture_1" },
    { type: "utf16", name: "drop_texture_2" },
    { type: "utf16", name: "drop_texture_3" },
    { type: "utf16", name: "icon" },
    { type: "utf16", name: "icon_2" },
    { type: "utf16", name: "icon_3" },
    { type: "utf16", name: "icon_4" },
    { type: "utf16", name: "icon_5" },
    { type: "int32", name: "durability" },
    { type: "uint32", name: "weight" },
    { type: "uint32", name: "material" },
    { type: "uint32", name: "crystallizable" },
    { type: "uint32", name: "property_params" },
    { type: "uint32", name: "body_part" },
];

for (const group of characterGroups) {
    SCHEMA_ARMORGRP_DAT.push({ type: new UTF16ContainerType(), name: `${group}_mesh` });
    SCHEMA_ARMORGRP_DAT.push({ type: new UTF16ContainerType(), name: `${group}_texture` });
    SCHEMA_ARMORGRP_DAT.push({ type: new UTF16ContainerType(), name: `${group}_additional_mesh` });
    SCHEMA_ARMORGRP_DAT.push({ type: new UTF16ContainerType(), name: `${group}_additional_texture` });
}

SCHEMA_ARMORGRP_DAT.push(
    { type: new UTF16ContainerType(), name: "unknown_mesh" },
    { type: new UTF16ContainerType(), name: "unknown_texture" },
    { type: new UTF16ContainerType(), name: "npc_mesh" },
    { type: new UTF16ContainerType(), name: "npc_texture" },
    { type: new UTF16ContainerType(), name: "accessory_mesh" },
    { type: new UTF16ContainerType(), name: "accessory_texture" },
    { type: "utf16", name: "attack_effect" },
    { type: new UTF16ContainerType(), name: "item_sound" },
    { type: "utf16", name: "drop_sound" },
    { type: "utf16", name: "equip_sound" },
    { type: "uint32", name: "unknown_1" },
    { type: "uint32", name: "unknown_2" },
    { type: "uint32", name: "armor_type" },
    { type: "uint32", name: "crystal_type" },
    { type: "uint32", name: "avoid_modifier" },
    { type: "uint32", name: "physical_defence" },
    { type: "uint32", name: "magical_defence" },
    { type: "uint32", name: "mp_bonus" }
);

export default SCHEMA_ARMORGRP_DAT;
export { SCHEMA_ARMORGRP_DAT };
