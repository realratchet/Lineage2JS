import { MaterialContainerType } from "./dat-container";

const SCHEMA_RECIPE_C_DAT: ISchemaValue[] = [
    { type: "ASCF", name: "name" },
    { type: "uint32", name: "id_mk" },
    { type: "uint32", name: "id_recipe" },
    { type: "uint32", name: "level" },
    { type: "uint32", name: "id_item" },
    { type: "uint32", name: "count" },
    { type: "uint32", name: "mp_cost" },
    { type: "uint32", name: "success_rate" },
    { type: new MaterialContainerType(), name: "materials" }
];

export default SCHEMA_RECIPE_C_DAT;
export { SCHEMA_RECIPE_C_DAT };
