import type { UEncodedFile, ValidTypes_T, ValueTypeNames_T } from "@l2js/core";

export type IDatContainerType = {
    isContainerType: boolean;
    read(pkg: UEncodedFile, values: Record<string, any>): any;
};

export type ISchemaValue = {
    type: ValidTypes_T<any> | IDatContainerType | ValueTypeNames_T | "ASCF";
    name: string;
};

