import { SizedContainerType } from "@client/assets/unreal/datafile/schema/dat-container";

const SCHEMA_SYSTEMMSG_E_DAT: ISchemaValue[] = [
    { type: "uint32", name: "id" },
    { type: "uint32", name: "UNK_0" },
    { type: "ASCF", name: "message" },
    { type: "uint32", name: "group" },
    { type: new SizedContainerType("uint8", 3), name: "rgb" },
    { type: "int8", name: "UNK_1" },
    { type: "ASCF", name: "item_sound" },
    { type: "ASCF", name: "sys_msg_ref" }
];

export default SCHEMA_SYSTEMMSG_E_DAT;
export { SCHEMA_SYSTEMMSG_E_DAT };
