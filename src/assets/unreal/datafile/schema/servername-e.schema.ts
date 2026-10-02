import type { ISchemaValue } from "./dat-schema";

export const SCHEMA_SERVERNAME_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "server_id" },
    { type: "uint32", name: "tag_?" },
    { type: "ASCF", name: "server_name" },
    { type: "ASCF", name: "server_desc" }
];

export default SCHEMA_SERVERNAME_E_DAT;