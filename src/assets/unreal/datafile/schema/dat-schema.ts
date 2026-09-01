import type { UEncodedFile, ValidTypes_T, ValueTypeNames_T } from "@l2js/core";
type IDatContainerType = {
    isContainerType: boolean;
    read(pkg: UEncodedFile, values: Record<string, any>): any;
};

type ISchemaValue = {
    type: ValidTypes_T<any> | IDatContainerType | ValueTypeNames_T | "ASCF";
    name: string;
};

export type { IDatContainerType, ISchemaValue };
