import type { UEncodedFile, ValidTypes_T, ValueTypeNames_T } from "@l2js/core";
interface IDatContainerType {
    isContainerType: boolean;
    read(pkg: UEncodedFile, values: Record<string, any>): any;
}

interface ISchemaValue {
    type: ValidTypes_T<any> | IDatContainerType | ValueTypeNames_T | "ASCF";
    name: string;
}
