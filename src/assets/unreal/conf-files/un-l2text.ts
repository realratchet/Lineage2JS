import BaseConfigFile from "./un-base-config";

let decoder: TextDecoder = null;

export class UL2Text extends BaseConfigFile {
    public getText(): string {
        const text = (decoder = decoder ?? new TextDecoder("utf-16le")).decode(new Uint8Array(this.buffer, this.contentOffset));
        const end = text.toUpperCase().lastIndexOf("</HTML>");

        if (end < 0) throw new Error(`'${this.path}' has no </HTML>.`);

        return text.slice(text.charCodeAt(0) === 0xfeff ? 1 : 0, end + 7);
    }
}

export default UL2Text;
