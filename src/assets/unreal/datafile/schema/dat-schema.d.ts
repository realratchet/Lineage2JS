interface IDatContainerType {
    isContainerType: boolean;
    read(pkg: UEncodedFile): any[];
}

interface ISchemaValue {
    type: ValidTypes_T<any> | IDatContainerType,
    name: string
}