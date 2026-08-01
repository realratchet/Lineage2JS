
import fetchAssetHandle from "@client/assets/asset-handle";
import { UEncodedFile, BufferValue } from "@l2js/core";

const SAFE_PACKAGE_FOOTER = [12, 83, 97, 102, 101, 80, 97, 99, 107, 97, 103, 101, 0];

class UDataFile extends UEncodedFile {
    public datarows: Record<string, any>[];
    public readonly schema: readonly ISchemaValue[];
    protected readonly hasRowCount: boolean;

    public constructor(schema: ISchemaValue[], path: string, hasRowCount: boolean = true) {
        super(path);

        this.schema = schema;
        this.hasRowCount = hasRowCount;
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

        const dataLength = this.buffer.byteLength - this.contentOffset;
        const view = new DataView(this.buffer, this.contentOffset);
        const rowCount = this.hasRowCount ? readable.read("uint32") : Number.MAX_SAFE_INTEGER;
        const rows = [] as Record<string, any>[];

        for (let i = 0; i < rowCount; i++) {
            if (isSafePackageFooter(view, readable.tell(), dataLength)) break;

            // DAT files without a row count end in zero padding.
            if (!this.hasRowCount && (readable.tell() + 4 > dataLength || view.getUint32(readable.tell(), true) === 0)) break;

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

export default UDataFile;
export { UDataFile };

function loadSingleValue(readable: UDataFile, type: C.ValidTypes_T<any> | IDatContainerType | C.ValueTypeNames_T, values: Record<string, any>) {
    if (typeof type === "string") {
        const schemaValue = readable.read(type as any);
        const value = schemaValue;

        return value as any;
    } else if (!(type as IDatContainerType).isContainerType) {
        const schemaValue = readable.read(new BufferValue(type as C.ValidTypes_T<C.ValueTypeNames_T>));
        const value = schemaValue.value;

        return value as any;
    } else return (type as IDatContainerType).read(readable, values);
}

function isSafePackageFooter(view: DataView, offset: number, dataLength: number): boolean {
    if (dataLength - offset < SAFE_PACKAGE_FOOTER.length) return false;

    for (let i = 0; i < SAFE_PACKAGE_FOOTER.length; i++)
        if (view.getUint8(offset + i) !== SAFE_PACKAGE_FOOTER[i]) return false;

    return true;
}
