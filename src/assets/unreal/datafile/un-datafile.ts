
import { UEncodedFile, BufferValue } from "@l2js/core";

class UDataFile extends UEncodedFile {
    public datarows: Record<string, any>[];
    public readonly schema: readonly ISchemaValue[];

    public constructor(schema: ISchemaValue[], path: string) {
        super(path);

        this.schema = schema;
    }

    protected async readArrayBuffer(): Promise<ArrayBuffer> {
        const response = await fetch(this.path);

        if (!response.ok) throw new Error(response.statusText);

        const buffer = await response.arrayBuffer();

        return buffer;
    }

    public toBuffer(): ArrayBuffer { throw new Error("Method not implemented."); }

    public async decode(): Promise<this> {
        await super.decode();

        const readable = this.asReadable();
        const signature = this.signature;

        if (signature !== 0x69004c)
            throw new Error(`Invalid signature: '0x${signature.toString(16).toUpperCase()}' expected '0x9E2A83C1'`);

        const rowCount = readable.read("uint32");
        const rows = [] as Record<string, any>[];

        for (let i = 0; i < rowCount; i++) {
            const values = {} as Record<string, any>;

            for (let { type, name } of this.schema) {
                values[name] = loadSingleValue(readable, type);
            }

            rows.push(values);
        }

        this.datarows = rows;

        return this;
    }
}

export default UDataFile;
export { UDataFile };

function loadSingleValue(readable: UDataFile, type: C.ValidTypes_T<any> | IDatContainerType | C.ValueTypeNames_T) {
    if (typeof type === "string") {
        const schemaValue = readable.read(type as any);
        const value = schemaValue;

        return value as any;
    } else if (!(type as IDatContainerType).isContainerType) {
        const schemaValue = readable.read(new BufferValue(type as C.ValidTypes_T<C.ValueTypeNames_T>));
        const value = schemaValue.value;

        return value as any;
    } else return (type as IDatContainerType).read(readable);
}