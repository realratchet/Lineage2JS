class UEncodedFile {
    public readonly path: string;

    protected buffer: ArrayBuffer = null;
    protected isEncrypted = false;
    protected cryptKey: BufferValue<"uint8">;
    protected offset = 0;
    protected contentOffset = 0;

    constructor(path: string) { this.path = path; }

    public seek(offset: number, origin: Seek_T = "current") { throw new Error("Mixin not loaded."); }
    public read<T extends ValueTypeNames_T>(target: BufferValue<T> | number) { throw new Error("Mixin not loaded."); }
    public tell() { throw new Error("Mixin not loaded."); }
    public dump(lineCount: number = 1, restore: boolean = true, printHeaders: boolean = true) { throw new Error("Mixin not loaded."); }
    public async decode(): Promise<this> { throw new Error("Mixin not loaded."); }
    protected async _doDecode(): Promise<BufferValue> { throw new Error("Mixin not loaded."); }
}

export default UEncodedFile;
export { UEncodedFile };