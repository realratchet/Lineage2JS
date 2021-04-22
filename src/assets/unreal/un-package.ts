import BufferValue from "../buffer-value";
import UHeader from "./un-header";
import UGeneration from "./un-generation";
import UExport from "./un-export";
import UName from "./un-name";
import UImport from "./un-import";
import UProperty from "./un-property";
import UTexture from "./un-texture";
import UObject from "./un-object";

type AssetLoader = import("../asset-loader").AssetLoader;

class UPackage {
    public readonly path: string;
    public readonly loader: AssetLoader;

    private buffer: ArrayBuffer = null;
    private isEncrypted = false;
    private cryptKey = new BufferValue(BufferValue.uint8);
    private offset = 0;
    private contentOffset = 0;

    public exports: readonly UExport[];
    public imports: readonly UImport[];
    public nameTable: readonly UName[];

    constructor(loader: AssetLoader, path: string) {
        this.path = path;
        this.loader = loader;
    }

    public seek(offset: number, origin: Seek_T = "current") {
        switch (origin) {
            case "current": this.offset = this.offset + offset; break;
            case "set": this.offset = offset + this.contentOffset; break;
            default: throw new Error(`Seek type not supported: ${origin}`);
        }
    }

    public read<T extends ValueTypeNames_T>(target: BufferValue<T> | number) {
        const cryptKey = this.cryptKey.value as number;
        const _target = typeof (target) === "number" ? BufferValue.allocBytes(target) : target as BufferValue<T>;

        this.offset += _target.readValue(this.buffer, this.offset, this.isEncrypted, cryptKey);

        return _target;
    }

    public tell() { return this.offset; }

    public dump(lineCount: number, restore: boolean = true) {
        let oldHeader = this.offset;

        console.log("--------------------------------------------------------");
        console.log(`------------------- Dumping lines ----------------------`);
        console.log("--------------------------------------------------------");
        let constructedString = "";
        for (let i = 0; i < lineCount; i++) {
            const bytes = Math.min(this.buffer.byteLength - this.offset, 8);
            const groups = new Array(bytes).fill('.').map(() => this.read(2));

            const string1 = groups.map(g => g.hex.slice(2)).join(" ");
            const string2 = groups.map(g => g.string).join("");

            constructedString += string2;

            if (constructedString.match(/TerrainMap|TerrainScale/)) {
                console.log(
                    i, this.offset,
                    string1,
                    string2,
                    constructedString
                );
                constructedString = "";
            }

            constructedString = constructedString.slice(-100);

            // break

            if (lineCount <= 256) {
                console.log(
                    string1,
                    string2
                );
            }
        }

        console.log("--------------------------------------------------------");

        if (restore) this.offset = oldHeader;
    }

    public async decode(): Promise<this> {
        if (this.buffer) return this;

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

        if (this.path === "assets/maps/20_21.unr") {
            console.assert(header.getVersionLWORD() === 123);
            console.assert(header.packageFlags.value === 0x1);
            console.assert(header.nameCount.value === 12165);
            console.assert(header.nameOffset.value === 0x40);
            console.assert(header.exportCount.value === 11379);
            console.assert(header.exportOffset.value === 0xFB1BF5);
            console.assert(header.importCount.value === 490);
            console.assert(header.importOffset.value === 0xFB0712);
        }

        if (header.getVersionLWORD() < 68) {
            this.read(header.heritageCount);
            this.read(header.heritageOffset);
        } else {
            this.read(header.guid);

            const generationCount = this.read(new BufferValue(BufferValue.int32));

            if (this.path === "assets/maps/20_21.unr") {
                console.assert(generationCount.value === 1);
            }

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
        this.nameTable = Object.freeze(nameTable);

        return this;
    }

    public async fetchObject(index: number) {
        if (index < 0) {
            let imp = this.imports[-index - 1], mainImp = imp;
            while (imp.idPackage.value as number !== 0)
                imp = this.imports[-imp.idPackage.value as number - 1];

            if (!this.loader.hasPackage(imp.objectName))
                throw new Error(`Unable to locate package: ${imp.objectName}`);

            const pkg = this.loader.getPackage(imp.objectName);

            if (!pkg.buffer)
                await this.loader.load(pkg);

            const exp = pkg.exports.find(exp => exp.objectName === mainImp.objectName && pkg.getPackageName(exp.idClass.value as number) === mainImp.className);

            if (!exp) throw new Error("Missing export");

            if (exp.object)
                return exp.object;

            exp.object = await this.createObject(pkg, exp, mainImp.className as UObjectTypes_T);

            return exp.object;
        } else {
            throw new Error("Not yet implemented");
        }
    }

    protected async createObject(pkg: UPackage, data: UExport, className: UObjectTypes_T): Promise<UObject> {
        let Constructor: typeof UObject = null;

        switch (className) {
            case "Texture": Constructor = UTexture; break;
            default: throw new Error(`Unknown object type: ${className}`);
        }

        return await new Constructor().load(pkg, data);
    }

    protected getPackageName(index: number) {
        return index < 0
            ? this.imports[-index - 1].objectName as string
            : index > 0
                ? this.exports[index].objectName as string
                : "Class";
    }

    protected loadImports(header: UHeader, nameTable: UName[]) {
        this.seek(header.importOffset.value as number, "set");

        const imports: UImport[] = [];
        const index = new BufferValue(BufferValue.compat32);

        for (let i = 0, ic = header.importCount.value; i < ic; i++) {
            const uimport = new UImport();

            this.read(index);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(index.value === 5553);

            uimport.classPackage = nameTable[index.value as number].name.string;
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uimport.classPackage === "Core");

            this.read(index);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(index.value === 11089);

            uimport.className = nameTable[index.value as number].name.string;
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uimport.className === "Package");

            this.read(uimport.idPackage);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uimport.className === "Package");

            this.read(index);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(index.value === 11086);

            uimport.objectName = nameTable[index.value as number].name.string;
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uimport.objectName === "Engine");

            imports.push(uimport);
        }

        return imports;
    }

    protected loadNames(header: UHeader) {
        this.seek(header.nameOffset.value as number, "set");

        const nameTable: UName[] = [];

        for (let i = 0, nc = header.nameCount.value as number; i < nc; i++) {
            const uname = new UName();

            this.read(uname.name);
            this.read(uname.flags);

            nameTable.push(uname);

            // console.log(`Name[${i}]: "${(uname.name.string)}"`);
        }

        return nameTable;
    }

    protected loadExports(header: UHeader, nameTable: UName[]) {
        this.seek(header.exportOffset.value as number, "set");

        const exports: UExport[] = [];
        const index = new BufferValue(BufferValue.compat32);

        for (let i = 0, ec = header.exportCount.value as number; i < ec; i++) {
            const uexport = new UExport();

            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(this.offset === 16456721);

            this.read(uexport.idClass);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uexport.idClass.value === -344);

            this.read(uexport.idSuper);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uexport.idSuper.value === 0);

            this.read(uexport.idPackage);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uexport.idPackage.value === 0);

            this.read(index);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(index.value === 315);

            uexport.objectName = nameTable[index.value as number].name.string;
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uexport.objectName === "LevelInfo0")

            this.read(uexport.flags);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uexport.flags.value === 0x2070001);

            this.read(uexport.size);
            if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uexport.size.value === 0xe1)

            if (uexport.size.value as number > 0) {
                this.read(uexport.offset);
                if (this.path === "assets/maps/20_21.unr" && i === 0) console.assert(uexport.offset.value === 0x47121);
            }

            exports.push(uexport);
        }

        return exports;
    }
}

export default UPackage;
export { UPackage };

(global.console as any).assert = function (cond: Function, text: string, dontThrow: boolean) {
    if (cond) return;
    if (dontThrow) {
        debugger;
    } else {
        throw new Error(text || "Assertion failed!");
    }
};