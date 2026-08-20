const LOGONGRP_RECORD_COUNT = 26;

const SCHEMA_LOGONGRP_DAT: ISchemaValue[] = [
    { type: "int32", name: "x" },
    { type: "int32", name: "y" },
    { type: "int32", name: "z" },
    { type: "int32", name: "yaw" }
];

export default SCHEMA_LOGONGRP_DAT;
export { LOGONGRP_RECORD_COUNT, SCHEMA_LOGONGRP_DAT };
