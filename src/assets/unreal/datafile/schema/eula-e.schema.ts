import type { ISchemaValue } from "./dat-schema";

export const EULA_E_RECORD_COUNT = 1;

export const SCHEMA_EULA_E_DAT: ISchemaValue[] = [
    { type: "ASCF", name: "eula" },
    { type: "ASCF", name: "fin" }
];

export default SCHEMA_EULA_E_DAT;
