import { UTF16ContainerType } from "@client/assets/unreal/datafile/schema/dat-container";

const SCHEMA_MUSICINFO_DAT = [
    { type: "uint32", name: "id" },
    { type: new UTF16ContainerType(), name: "sounds" },
] as const as ISchemaValue[];

export default SCHEMA_MUSICINFO_DAT;
export { SCHEMA_MUSICINFO_DAT };