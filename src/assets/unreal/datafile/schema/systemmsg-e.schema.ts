import type { ISchemaValue } from "./dat-schema";
import { SizedContainerType } from "./dat-container";

export const SCHEMA_SYSTEMMSG_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: "uint32", name: "tag" },
    { type: "ASCF", name: "message" },
    { type: "uint32", name: "group" },
    { type: new SizedContainerType("uint8", 3), name: "rgb" },
    { type: "int8", name: "alpha" },
    { type: "ASCF", name: "sound" },
    { type: "ASCF", name: "voice" }
];

export default SCHEMA_SYSTEMMSG_E_DAT;