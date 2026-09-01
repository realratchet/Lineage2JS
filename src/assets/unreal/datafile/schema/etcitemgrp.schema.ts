import type { ISchemaValue } from "./dat-schema";
import { SizedContainerType, UTF16PairContainerType } from "./dat-container";

export const SCHEMA_ETCITEMGRP_DAT: ISchemaValue[] = [
    { type: "uint32", name: "tag" },
    { type: "uint32", name: "id" },
    { type: "uint32", name: "drop_type" },
    { type: "uint32", name: "drop_anim_type" },
    { type: "uint32", name: "drop_radius" },
    { type: "uint32", name: "drop_height" },
    { type: "uint32", name: "UNK_0" },
    { type: "utf16", name: "drop_mesh1" },
    { type: "utf16", name: "drop_mesh2" },
    { type: "utf16", name: "drop_mesh3" },
    { type: "utf16", name: "drop_tex1" },
    { type: "utf16", name: "drop_tex2" },
    { type: "utf16", name: "drop_tex3" },
    { type: new SizedContainerType("utf16", 5), name: "icon" },
    { type: "int32", name: "durability" },
    { type: "uint32", name: "weight" },
    { type: "uint32", name: "material" },
    { type: "uint32", name: "crystallizable" },
    { type: "uint32", name: "type1" },
    { type: new UTF16PairContainerType(), name: "mesh_tex_pair" },
    { type: "utf16", name: "item_sound" },
    { type: "utf16", name: "equip_sound" },
    { type: "uint32", name: "stackable" },
    { type: "uint32", name: "family" },
    { type: "uint32", name: "grade" }
];

export default SCHEMA_ETCITEMGRP_DAT;
