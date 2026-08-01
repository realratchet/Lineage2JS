interface IDatContainerType {
    isContainerType: boolean;
    read(pkg: C.UEncodedFile, values: Record<string, any>): any[];
}

interface ISchemaValue {
    type: C.ValidTypes_T<any> | IDatContainerType | C.ValueTypeNames_T,
    name: string,
    array?: boolean
}
