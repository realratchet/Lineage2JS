import type { ISchemaValue } from "./dat-schema";
import { UTF16ContainerType } from "./dat-container";

export const SCHEMA_MUSICINFO_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: new UTF16ContainerType(), name: "sounds" },
];

export default SCHEMA_MUSICINFO_DAT;
