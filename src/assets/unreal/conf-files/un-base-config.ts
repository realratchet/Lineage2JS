import fetchAssetHandle from "../asset-handle";
import { UEncodedFile } from "@l2js/core";

let decoder: TextDecoder = null;

function getInstance() { return decoder = decoder ?? new TextDecoder("euc-kr"); }

abstract class BaseConfigFile extends UEncodedFile {
    protected decoder = getInstance();
    protected async readArrayBuffer() {
        const response = await fetchAssetHandle(this.path);
        const readable = await response.getReadable();

        return readable.buffer;
    }

    public toBuffer(): ArrayBuffer { throw new Error("Method not implemented."); }

    protected decodeConfig() { return this.decoder.decode(new Uint8Array(this.buffer, this.contentOffset)); }

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
