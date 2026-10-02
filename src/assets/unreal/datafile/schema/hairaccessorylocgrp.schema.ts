import type { ISchemaValue } from "./dat-schema";
import { SizedContainerType } from "./dat-container";

export const SCHEMA_HAIRACCESSORYLOCGRP_DAT: ISchemaValue[] = [
    { type: "utf16", name: "name" }
];

for (let i = 0x1; i < 0x10; i++) {
    const suffix = i.toString(16);

    SCHEMA_HAIRACCESSORYLOCGRP_DAT.push({ type: new SizedContainerType("float", 3), name: `floats_${suffix}` });
    SCHEMA_HAIRACCESSORYLOCGRP_DAT.push({ type: new SizedContainerType("int32", 3), name: `ints_${suffix}` });
}

export default SCHEMA_HAIRACCESSORYLOCGRP_DAT;
