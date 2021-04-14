import BufferValue from "./buffer-value";
import UHeader from "./unreal/un-header";
import UGeneration from "./unreal/un-generation";
import UExport from "./unreal/un-export";
import UName from "./unreal/un-name";

class AssetBuffer {
    private buffer: ArrayBuffer;
    private isEncrypted = false;
    private cryptKey = new BufferValue(BufferValue.uint8);
    private offset = 0;
    private contentOffset = 0;

    public exports: readonly UExport[];
    public imports: readonly UImport[];

    constructor(arrayBuffer: ArrayBuffer) {
        this.buffer = arrayBuffer;//.slice(0, 20480);
    }

    protected seek(offset: number, origin = SEEK_T.SEEK_CUR) {
        switch (origin) {
            case SEEK_T.SEEK_CUR:
                this.offset = this.offset + offset
                break;
            case SEEK_T.SEEK_SET:
                this.offset = offset + this.contentOffset;
                break;
            default: throw new Error(`Seek type not supported: ${origin}`);
        }
    }
    protected read<T extends ValueTypeNames_T>(target: BufferValue<T> | number) {
        const cryptKey = this.cryptKey.value as number;
        const _target = typeof (target) === "number" ? BufferValue.allocBytes(target) : target as BufferValue<T>;

        this.offset += _target.readValue(this.buffer, this.offset, this.isEncrypted, cryptKey);

        return _target;
    }

    private dump(lineCount: number, restore: boolean = true) {
        let oldHeader = this.offset;

        console.log("--------------------------------------------------------");
        console.log(`------------------- Dumping lines ----------------------`);
        console.log("--------------------------------------------------------");
        for (let i = 0; i < lineCount; i++) {
            const groups = new Array(8).fill(8).map(() => this.read(2));

            const string1 = groups.map(g => g.hex.slice(2)).join(" ");
            const string2 = groups.map(g => g.string).join("");

            console.log(
                string1,
                string2
            );
        }

        console.log("--------------------------------------------------------");

        if (restore) this.offset = oldHeader;
    }

    public async decode(): Promise<this> {
        const signature = this.read(new BufferValue(BufferValue.uint32));
        const HEADER_SIZE = 28;

        if (signature.value == 0x0069004C) {
            this.seek(HEADER_SIZE, SEEK_T.SEEK_SET);
            this.read(this.cryptKey);

            this.cryptKey.value = 0xC1 ^ (this.cryptKey.value as number);

            if (this.cryptKey.value !== 0xAC)
                throw new Error("yo");

            this.isEncrypted = true;
            this.contentOffset = HEADER_SIZE;
            this.seek(0, SEEK_T.SEEK_SET);
            this.read(signature);
        }

        if (signature.value !== 0x9E2A83C1)
            throw new Error(`Invalid signature: '0x${signature.toString(16).toUpperCase()}' expected '0x9E2A83C1'`);

        const header = new UHeader();

        this.read(header.version);
        this.read(header.packageFlags);
        this.read(header.nameCount);
        this.read(header.nameOffset);
        this.read(header.exportCount);
        this.read(header.exportOffset);
        this.read(header.importCount);
        this.read(header.importOffset);

        const dbgNameCount = header.nameCount.value;
        const dbgNameOffset = header.nameOffset.value.toString(16).toUpperCase();
        const dbgExportCount = header.exportCount.value;
        const dbgExportOffset = header.exportOffset.value.toString(16).toUpperCase();
        const dbgImportCount = header.importCount.value;
        const dbgImportOffset = header.importOffset.value.toString(16).toUpperCase();

        console.log(`Names:${dbgNameOffset}[${dbgNameCount}] Exports:${dbgExportOffset}[${dbgExportCount}] Imports:${dbgImportOffset}[${dbgImportCount}]`);

        console.assert(header.getVersionLWORD() === 123);
        console.assert(header.packageFlags.value === 0x1);
        console.assert(header.nameCount.value === 12165);
        console.assert(header.nameOffset.value === 0x40);
        console.assert(header.exportCount.value === 11379);
        console.assert(header.exportOffset.value === 0xFB1BF5);
        console.assert(header.importCount.value === 490);
        console.assert(header.importOffset.value === 0xFB0712);

        if (header.getVersionLWORD() < 68) {
            this.read(header.heritageCount);
            this.read(header.heritageOffset);
        } else {
            this.read(header.guid);

            const generationCount = this.read(new BufferValue(BufferValue.int32));

            console.assert(generationCount.value === 1);

            for (let i = 0, gc = generationCount.value as number; i < gc; i++) {
                const gen = new UGeneration();

                this.read(gen.exportCount);
                this.read(gen.nameCount);

                header.generations.push(gen);
            }
        }

        const nameTable = this.loadNames(header);
        const exports = this.loadExports(header, nameTable);
        const imports = this.loadImports(header, nameTable);

        this.exports = Object.freeze(exports);
        this.imports = Object.freeze(imports);

        return this;
    }

    loadImports(header: UHeader, nameTable: UName[]) {
        this.seek(header.importOffset.value as number, SEEK_T.SEEK_SET);

        const imports: UImport[] = [];
        const index = new BufferValue(BufferValue.compat32);

        for (let i = 0, ic = header.importCount.value; i < ic; i++) {
            const uimport = new UImport();

            this.read(index);
            if (i === 0) console.assert(index.value === 5553);

            uimport.classPackage = (nameTable[index.value as number].name.value as string).slice(0, -1);
            if (i === 0) console.assert(uimport.classPackage === "Core");

            this.read(index);
            if (i === 0) console.assert(index.value === 11089);

            uimport.className = (nameTable[index.value as number].name.value as string).slice(0, -1);
            if (i === 0) console.assert(uimport.className === "Package");

            this.read(uimport.packageIndex);
            if (i === 0) console.assert(uimport.className === "Package");

            this.read(index);
            if (i === 0) console.assert(index.value === 11086);

            uimport.objectName = (nameTable[index.value as number].name.value as string).slice(0, -1);
            if (i === 0) console.assert(uimport.objectName === "Engine");

            imports.push(uimport);
        }

        return imports;
    }

    loadNames(header: UHeader) {
        this.seek(header.nameOffset.value as number, SEEK_T.SEEK_SET);

        const nameTable: UName[] = [];

        for (let i = 0, nc = header.nameCount.value as number; i < nc; i++) {
            const uname = new UName();

            this.read(uname.name);
            this.read(uname.flags);

            nameTable.push(uname);

            // console.log(`Name[${i}]: "${(uname.name.value as string).slice(1, -1)}"`);
        }

        return nameTable;
    }

    loadExports(header: UHeader, nameTable: UName[]) {
        this.seek(header.exportOffset.value as number, SEEK_T.SEEK_SET);

        const exports: UExport[] = [];
        const index = new BufferValue(BufferValue.compat32);

        for (let i = 0, ec = header.exportCount.value as number; i < ec; i++) {
            const uexport = new UExport();

            if (i === 0) console.assert(this.offset === 16456721);

            this.read(uexport.idClass);
            if (i === 0) console.assert(uexport.idClass.value === -344);

            this.read(uexport.idSuper);
            if (i === 0) console.assert(uexport.idSuper.value === 0);

            this.read(uexport.idPackage);
            if (i === 0) console.assert(uexport.idPackage.value === 0);

            this.read(index);
            if (i === 0) console.assert(index.value === 315);

            uexport.name = (nameTable[index.value as number].name.value as string).slice(0, -1);
            if (i === 0) console.assert(uexport.name === "LevelInfo0")

            this.read(uexport.flags);
            if (i === 0) console.assert(uexport.flags.value === 0x2070001);

            this.read(uexport.size);
            if (i === 0) console.assert(uexport.size.value === 0xe1)

            if (uexport.size.value as number > 0) {
                this.read(uexport.offset);
                if (i === 0) console.assert(uexport.offset.value === 0x47121);
            }

            exports.push(uexport);
        }

        return exports;
    }
}

export default AssetBuffer;
export { AssetBuffer };

enum SEEK_T {
    SEEK_SET = 0,   /* set file offset to offset */
    SEEK_CUR = 1,   /* set file offset to current plus offset */
    // SEEK_END = 2    /* set file offset to EOF plus offset */
}






class UImport {
    public className: string = null;
    public packageIndex = new BufferValue(BufferValue.int32);
    public objectName: string = null;
    public classPackage: string = null;
}

(global.console as any).assert = function (cond: Function, text: string, dontThrow: boolean) {
    if (cond) return;
    if (dontThrow) {
        debugger;
    } else {
        throw new Error(text || "Assertion failed!");
    }
};