import fetchAssetHandle from "../../asset-handle";
import { ASCFType } from "./schema/dat-container";
import { UEncodedFile, BufferValue } from "@l2js/core";

class UDataFile extends UEncodedFile {
    public datarows: Record<string, any>[];
    public readonly schema: readonly ISchemaValue[];
    protected readonly recordCount: number | null;

    public constructor(schema: readonly ISchemaValue[], path: string, recordCount: number | null = null) {
        super(path);

        this.schema = schema;
        this.recordCount = recordCount;
    }

    protected async readArrayBuffer() {
        const response = await fetchAssetHandle(this.path);
        const readable = await response.getReadable();

        return readable.buffer;
    }

    public toBuffer(): ArrayBuffer { throw new Error("Method not implemented."); }

    public async decode(): Promise<this> {
        await super.decode();

        const readable = this.asReadable();
        const signature = this.signature;

        if (signature !== 0x69004c)
            throw new Error(`Invalid signature: '0x${signature.toString(16).toUpperCase()}' expected '0x9E2A83C1'`);

        const rowCount = this.recordCount === null ? readable.read("uint32") : this.recordCount;
        const rows = [] as Record<string, any>[];

        for (let i = 0; i < rowCount; i++) {
            const values = {} as Record<string, any>;

            for (let { type, name } of this.schema) {
                values[name] = loadSingleValue(readable, type, values);
            }

            rows.push(values);
        }

        this.datarows = rows;

        return this;
    }
}

function loadSingleValue(readable: UDataFile, type: C.ValidTypes_T<any> | IDatContainerType | C.ValueTypeNames_T | "ASCF", values: Record<string, any>) {
    if (typeof type === "string") {
        if (type === "ASCF") return new ASCFType().read(readable);

        const schemaValue = type === "utf16" ? readable.read(new BufferValue(BufferValue.utf16)).value : readable.read(type as any);
        const value = schemaValue;

        return value as any;
    } else if (!(type as IDatContainerType).isContainerType) {
        const schemaValue = readable.read(new BufferValue(type as C.ValidTypes_T<C.ValueTypeNames_T>));
        const value = schemaValue.value;

        return value as any;
    } else return (type as IDatContainerType).read(readable, values);
}

export default UDataFile;
export { UDataFile };
