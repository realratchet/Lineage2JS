import { SizedContainerType } from "@client/assets/unreal/datafile/schema/dat-container";

const SCHEMA_HAIRACCESSORYLOCGRP_DAT: ISchemaValue[] = [
    { type: "utf16", name: "name" }
];

for (const suffix of ["1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"]) {
    SCHEMA_HAIRACCESSORYLOCGRP_DAT.push({ type: new SizedContainerType("float", 3), name: `floats_${suffix}` });
    SCHEMA_HAIRACCESSORYLOCGRP_DAT.push({ type: new SizedContainerType("int32", 3), name: `ints_${suffix}` });
}

export default SCHEMA_HAIRACCESSORYLOCGRP_DAT;
export { SCHEMA_HAIRACCESSORYLOCGRP_DAT };
