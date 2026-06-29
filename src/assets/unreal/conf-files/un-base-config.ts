import { UEncodedFile, BufferStream } from "@l2js/core";

let decoder: TextDecoder = null;

function getInstance() { return decoder = decoder ?? new TextDecoder("euc-kr"); }

abstract class BaseConfigFile extends UEncodedFile {
    protected decoder = getInstance();
    protected async readArrayBuffer() { return await BufferStream.initialize(this.path); }

    public toBuffer(): ArrayBuffer { throw new Error("Method not implemented."); }

    protected decodeConfig() { return this.decoder.decode(new Uint8Array(this.buffer, 28)); }

    public async decode(): Promise<this> {
        if (this.buffer) return this;
        if (this.promiseDecoding) {
            await this.promiseDecoding;
            return this;
        }

        const readable = this.asReadable();

        await readable._doDecode();

        Object.assign(this, readable, { isReadable: false });

        return this;
    }
}

export default BaseConfigFile;
export { BaseConfigFile };