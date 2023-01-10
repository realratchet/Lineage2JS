import * as _path from "path";

type SupportedExtensions_T = "UNR" | "UTX" | "USX" | "UAX" | "U" | "UKX" | "USK";
type SupportedPackages_T = "LEVEL" | "TEXTURE" | "STATIC_MESH" | "SOUND" | "SCRIPT" | "ANIMATION" | "EFFECT";

const extToType = Object.freeze(
    new Map([
        ["UNR", "LEVEL"],
        ["UTX", "TEXTURE"],
        ["USX", "STATIC_MESH"],
        ["UAX", "SOUND"],
        ["U", "SCRIPT"],
        ["UKX", "ANIMATION"],
        ["USK", "EFFECT"]
    ]) as Map<SupportedExtensions_T, SupportedPackages_T>
);

function getImpExtension(ext: SupportedExtensions_T, ...classList: string[]) {
    return classList.map(v => ([v, extToType.get(ext)] as [SupportedImports_T, SupportedPackages_T]))
}

const impToType = Object.freeze(
    new Map([
        ...getImpExtension("UNR", "Level"),
        ...getImpExtension("UTX", "Texture", "TexOscillator", "Shader", "ColorModifier", "FinalBlend", "TexEnvMap"),
        ...getImpExtension("UAX", "Sound"),
        ...getImpExtension("USX", "StaticMesh"),
        ...getImpExtension("UKX", "Animation", "SkeletalMesh", "VertMesh"),
        ...getImpExtension("USK", "Effect"),
        ...getImpExtension("U", "Script", "State", "Class", "Struct", "Function", "ObjectProperty", "StructProperty", "ByteProperty", "BoolProperty", "NameProperty", "FloatProperty", "ArrayProperty", "IntProperty", "ClassProperty", "Enum")
    ]) as Map<SupportedImports_T, SupportedPackages_T>
);

class AssetLoader {
    private packages = new Map<string, UPackage>();
    // private packageByName = new Map<string, UPackage>();

    static async Instantiate(assetList: IAssetListInfo) {
        const Library = await import(/* webpackChunkName: "modules/unreal" */ "@unreal/un-package");

        return new AssetLoader(assetList, Library);
    }

    private constructor(assetList: IAssetListInfo, { UPackage, UNativePackage }: typeof import("@unreal/un-package")) {
        this.packages.set("native/script", new UNativePackage(this));
        // this.packageByName.set("native", pkgNative);

        for (let [path, downloadPath] of Object.entries(assetList)) {
            const pkgName = pathToPkgName(path);

            if (this.packages.has(pkgName))
                throw new Error(`Package already registered: ${pkgName}`);

            // const pkgShortname = pkgName.slice(0, pkgName.indexOf("/"));

            this.packages.set(pkgName.toLowerCase(), new UPackage(this, `assets/${downloadPath}`));
            // this.packageByName.set(pkgShortname.toLowerCase(), pkg);
        }
    }

    public getPackage(pkgName: string, impType: SupportedImports_T): UPackage { return this.packages.get(importToPkgName(pkgName, impType)); }
    public hasPackage(pkgName: string, impType: SupportedImports_T) { return this.packages.has(importToPkgName(pkgName, impType)); }

    public getPackageByPath(path: string): UPackage { return this.packages.get(pathToPkgName(path).toLowerCase()); }
    public hasPackageByPath(path: string) { return this.packages.has(pathToPkgName(path).toLowerCase()); }

    public async load(pkg: UPackage): Promise<UPackage> {
        const pkgsToLoad = [pkg];

        while (pkgsToLoad.length > 0) {
            const pkg = pkgsToLoad.shift();

            if (pkg.isDecoded()) continue;

            await pkg.decode();

            for (const entry of pkg.imports.filter(imp => imp.className !== "Package")) {
                let entrypackage = pkg.getImportEntry(entry.idPackage);

                while (entrypackage.idPackage !== 0)
                    entrypackage = pkg.getImportEntry(entrypackage.idPackage);

                const packageName = entrypackage.objectName;
                const className = entry.className;

                if (!this.hasPackage(packageName, className as SupportedImports_T))
                    throw new Error(`Package '${packageName}' for type '${className}' does not exist.`);

                const dependency = this.getPackage(packageName, className as SupportedImports_T);

                if (!dependency)
                    debugger;

                if (pkgsToLoad.includes(dependency)) continue;

                pkgsToLoad.push(dependency);
            }
        }

        return pkg;
    }
}

export default AssetLoader;
export { AssetLoader };

function importToPkgName(pkgName: string, impType: SupportedImports_T) {
    if (!impToType.has(impType))
        throw new Error(`Unsupported package type '${impType}' for package '${pkgName}'`);

    const type = impToType.get(impType);
    const fullName = `${pkgName}/${type}`.toLowerCase();

    return fullName;
}

function pathToPkgName(path: string, withExt = true) {
    const ext = _path.extname(path);
    const extUpper = ext.slice(1).toUpperCase() as SupportedExtensions_T;

    if (!extToType.has(extUpper))
        throw new Error(`Unsupported package type '${ext}' for package '${_path.basename(path)}'`);

    return `${_path.basename(path, ext)}/${extToType.get(extUpper)}`;
};