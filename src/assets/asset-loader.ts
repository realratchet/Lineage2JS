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

const impToType = Object.freeze(
    new Map([
        ["Level", extToType.get("UNR")],
        ...[ // textures
            "Texture",
            "TexOscillator",
            "Shader",
            "ColorModifier",
            "FinalBlend",
            "TexEnvMap"
        ].map(v => ([v, extToType.get("UTX")] as [SupportedImports_T, SupportedPackages_T])),
        ["Sound", extToType.get("UAX")],
        ["StaticMesh", extToType.get("USX")],
        ["Animation", extToType.get("UKX")],
        ["Effect", extToType.get("USK")],
        ...[ // engine
            "Script",
            "State",
            "Class",
            "Struct",
            "Function"
        ].map(v => ([v, extToType.get("U")] as [SupportedImports_T, SupportedPackages_T])),
    ]) as Map<SupportedImports_T, SupportedPackages_T>
);

class AssetLoader {
    private packages = new Map<string, Promise<UPackage>>();

    constructor(assetList: IAssetListInfo) {
        this.packages.set("native/script", new Promise(async resolve => {
            const { UNativePackage } = await import(/* webpackChunkName: "modules/unreal" */ "@unreal/un-package");
            const pkg = new UNativePackage(this);

            resolve(pkg as any);
        }));

        for (let [path, downloadPath] of Object.entries(assetList)) {
            const pkgName = pathToPkgName(path);

            if (this.packages.has(pkgName))
                throw new Error(`Package already registered: ${pkgName}`);

            this.packages.set(pkgName.toLowerCase(), new Promise(async resolve => {
                const { UPackage } = await import(/* webpackChunkName: "modules/unreal" */ "@unreal/un-package");
                const pkg = new UPackage(this, `assets/${downloadPath}`);

                resolve(pkg);
            }));
        }
    }

    public getPackage(pkgName: string, impType: SupportedImports_T): Promise<UPackage> { return this.packages.get(importToPkgName(pkgName, impType)); }
    public hasPackage(pkgName: string, impType: SupportedImports_T) { return this.packages.has(importToPkgName(pkgName, impType)); }

    public getPackageByPath(path: string): Promise<UPackage> { return this.packages.get(pathToPkgName(path).toLowerCase()); }
    public hasPackageByPath(path: string) { return this.packages.has(pathToPkgName(path).toLowerCase()); }

    public async load(pkgOrPromise: Promise<UPackage> | UPackage): Promise<UPackage> {
        return await (await pkgOrPromise).decode();
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

function pathToPkgName(path: string) {
    const ext = _path.extname(path);
    const extUpper = ext.slice(1).toUpperCase() as SupportedExtensions_T;

    if (!extToType.has(extUpper))
        throw new Error(`Unsupported package type '${ext}' for package '${_path.basename(path)}'`);

    return `${_path.basename(path, ext)}/${extToType.get(extUpper)}`;
};