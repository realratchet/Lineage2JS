import BufferValue from "../../buffer-value";
import UEncodedFile from "../un-encoded-file";
import * as schemas from "./schema/schema-types";

class UDataFile extends UEncodedFile {
    public datarows: Record<string, any>[];

    public async decode(): Promise<this> {
        if (this.buffer) return this;
        if (this.promiseDecoding) {
            await this.promiseDecoding;
            return this;
        }

        const readable = this.asReadable();
        const signature = await readable._doDecode();

        if (signature.value !== 0x69004c)
            throw new Error(`Invalid signature: '0x${signature.toString(16).toUpperCase()}' expected '0x9E2A83C1'`);

        const uint16 = new BufferValue(BufferValue.uint32);
        const rowCount = readable.read(uint16).value as number;
        const schema = schemas.SCHEMA_NPCGRP_DAT;
        const rows = [] as Record<string, any>[];

        for (let i = 0; i < rowCount; i++) {
            const values = {} as Record<string, any>;

            for (let { type, name } of schema) {
                if (!(type as IDatContainerType).isContainerType) {
                    const schemaValue = readable.read(new BufferValue(type as ValidTypes_T<any>));
                    const value = schemaValue.value;

                    values[name] = value as any;
                } else values[name] = (type as IDatContainerType).read(readable);
            }

            rows.push(values);
        }

        this.datarows = rows;

        return this;
    }
}

export default UDataFile;
export { UDataFile };