import * as schemas from "./schema/schema-types";
import { UEncodedFile, BufferValue } from "@l2js/core";

class UDataFile extends UEncodedFile {
    public datarows: Record<string, any>[];

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

        const uint32 = new BufferValue(BufferValue.uint32);
        const rowCount = readable.read(uint32).value;
        const schema = schemas.SCHEMA_NPCGRP_DAT;
        const rows = [] as Record<string, any>[];

        for (let i = 0; i < rowCount; i++) {
            const values = {} as Record<string, any>;

            for (let { type, name } of schema) {
                if (!(type as IDatContainerType).isContainerType) {
                    const schemaValue = readable.read(new BufferValue(type as C.ValidTypes_T<any>));
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