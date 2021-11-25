import UEncodedFile from "./constr-un-encoded-file";

class UPackage extends UEncodedFile {
    public readonly loader: AssetLoader;

    public exports: readonly UExport[];
    public imports: readonly UImport[];
    public nameTable: readonly UName[];
    public header: UHeader;

    public constructor(loader: AssetLoader, path: string) {
        super(path);
        this.loader = loader;
    }

    public async fetchObject(index: number): Promise<UObject> { throw new Error("Mixin not loaded."); }
    public async createObject<T extends UObject = UObject>(pkg: UPackage, exp: UExport<T>, className: UObjectTypes_T, ...params: any[]): Promise<T> { throw new Error("Mixin not loaded."); }
    public getPackageName(index: number): string { throw new Error("Mixin not loaded."); }

    protected async getImport(index: number): Promise<UObject> { throw new Error("Mixin not loaded."); }
    protected async getExport(index: number): Promise<UObject> { throw new Error("Mixin not loaded."); }
    protected loadImports(header: UHeader, nameTable: UName[]): UImport[] { throw new Error("Mixin not loaded."); }
    protected loadNames(header: UHeader): UName[] { throw new Error("Mixin not loaded."); }
    protected loadExports(header: UHeader, nameTable: UName[]): UExport<UObject>[] { throw new Error("Mixin not loaded."); }
}

export default UPackage;
export { UPackage };