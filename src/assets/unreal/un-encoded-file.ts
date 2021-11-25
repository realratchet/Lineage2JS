import BufferValue from "../buffer-value";

class UEncodedFile {
    public readonly path: string;
    public readonly isReadable = false;

    protected handle: this = null;
    protected promiseDecoding: Promise<BufferValue>;
    protected buffer: ArrayBuffer = null;
    protected isEncrypted = false;
    protected cryptKey = new BufferValue(BufferValue.uint8);
    protected offset = 0;
    protected contentOffset = 0;

    constructor(path: string) {
        this.path = path;
    }

    public asReadable(): this {
        class Readable { }

        Object.assign(Readable.prototype, UEncodedFile.prototype);
        
        const instance = Object.assign(new Readable(), this, { isReadable: true, handle: this });


        return instance;
    }

    public ensureReadable() {
        if (!this.isReadable)
            throw new Error("Stream is not readable!");
    }

    public seek(offset: number, origin: Seek_T = "current") {
        this.ensureReadable();

        switch (origin) {
            case "current": this.offset = this.offset + offset; break;
            case "set": this.offset = offset + this.contentOffset; break;
            default: throw new Error(`Seek type not supported: ${origin}`);
        }
    }

    public read<T extends ValueTypeNames_T>(target: BufferValue<T> | number) {
        this.ensureReadable();

        const cryptKey = this.cryptKey.value as number;
        const _target = typeof (target) === "number" ? BufferValue.allocBytes(target) : target as BufferValue<T>;

        this.offset += _target.readValue(this.buffer, this.offset, this.isEncrypted, cryptKey);

        return _target;
    }

    public tell() { return this.offset - this.contentOffset; }

    public dump(lineCount: number = 1, restore: boolean = true, printHeaders: boolean = true) {
        this.ensureReadable();

        let oldHeader = this.offset;
        let constructedString = "";
        let divisor = 0XF, lineCountHex = 1;

        do {
            if ((lineCount / divisor) < 1) break;
            divisor = divisor * 0X10 + 0XF; // shift divisor
            lineCountHex++;
        } while (true);

        const offsetHeader = printHeaders ? new Array(5 + lineCountHex).fill("-").join("") : null;

        if (printHeaders) {
            console.log(`${offsetHeader}--------------------------------------------------------`);
            console.log(`${offsetHeader}------------------- Dumping lines ----------------------`);
            console.log(`${offsetHeader}--------------------------------------------------------`);
        }

        for (let i = 0; i < lineCount; i++) {
            const bytes = Math.min(this.buffer.byteLength - this.offset, 8);
            const groups = new Array(bytes).fill('.').map(() => this.read(2));

            const string1 = groups.map(g => g.hex.slice(2)).join(" ");
            const string2 = groups.map(g => g.string).join("");

            constructedString += string2;
            constructedString = constructedString.slice(-100);

            if (lineCount <= 256) {
                if (true || string1.match(/(^0005)|(^0077)|(^0007)/)) {

                    const extraArgs = [];

                    let finalString = string1;

                    if (finalString.match(/(^0005)|(^0077)|(^0007)/)) {
                        finalString = finalString
                            .replace(/^0005/, "%c0005%c")
                            .replace(/^0077/, "%c0077%c")
                            .replace(/^0007/, "%c0007%c");
                        extraArgs.push("color: red; font-weight:bold", "color: black");
                    }

                    if (finalString.match(/((?<=\ )10)|(10(?=\ ))/)) {
                        finalString = finalString
                            .replace(/((?<=\ )10)|(10(?=\ ))/, "%c10%c");
                        extraArgs.push("color: blue; font-weight:bold", "color: black");
                    }

                    if (finalString.match(/((?<=\ )0F)|(0F(?=\ ))/)) {
                        finalString = finalString
                            .replace(/((?<=\ )0F)|(0F(?=\ ))/, "%c0F%c");
                        extraArgs.push("color: green; font-weight:bold", "color: black");
                    }

                    // if (finalString.match(/(00 00)|((?<=\ )0000(?=\ ))/)) {
                    //     finalString = finalString
                    //         .replace(/00 00/, "%c00 00%c")
                    //         .replace(/(?<=\ )0000(?=\ )/, "%c0000%c");
                    //     extraArgs.push("color: purple; font-weight:bold", "color: black");
                    // }

                    const bits = i.toString(16).toUpperCase();
                    const head = new Array(lineCountHex - bits.length).fill("0").join("");

                    console.log(
                        [
                            `(0x${head}${bits})`,
                            finalString,
                            string2,
                        ].join(" "),
                        ...extraArgs
                    );
                } else {
                    console.log(
                        string1,
                        string2
                    );
                }
            }
        }

        if (printHeaders)
            console.log(`${offsetHeader}--------------------------------------------------------`);

        if (restore) this.offset = oldHeader;
    }

    public async decode(): Promise<this> {
        if (this.buffer) return this;
        if (!this.promiseDecoding) await this._doDecode();
        else await this.promiseDecoding;

        return this;
    }

    protected _doDecode(): Promise<BufferValue> {
        this.ensureReadable();

        if (this.promiseDecoding) return this.promiseDecoding;

        return this.handle.promiseDecoding = this.promiseDecoding = new Promise(async resolve => {
            const response = await fetch(this.path);

            if (!response.ok) throw new Error(response.statusText);

            this.buffer = await response.arrayBuffer();

            const signature = this.read(new BufferValue(BufferValue.uint32));
            const HEADER_SIZE = 28;

            if (signature.value == 0x0069004C) {
                this.seek(HEADER_SIZE, "set");
                this.read(this.cryptKey);

                this.cryptKey.value = 0xC1 ^ (this.cryptKey.value as number);

                this.isEncrypted = true;
                this.contentOffset = HEADER_SIZE;
                this.seek(0, "set");
                this.read(signature);
            }

            resolve(signature);
        });
    }
}

export default UEncodedFile;
export { UEncodedFile };