import type { ISchemaValue } from "./dat-schema";

export const SCHEMA_ZONENAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "nbr" },
    { type: "uint32", name: "zone_color_id" },
    { type: "uint32", name: "x_world_grid" },
    { type: "uint32", name: "y_world_grid" },
    { type: "float", name: "top_z" },
    { type: "float", name: "bottom_z" },
    { type: "ASCF", name: "zone_name" }
];

export default SCHEMA_ZONENAME_E_DAT;