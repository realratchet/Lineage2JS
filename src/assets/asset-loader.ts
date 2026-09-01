// import * as _path from "path";

import { AAssetLoader, APackage, type ANativePackage, type AssetListInfo_T, type CorePackageConstructor_T, type EnginePackageConstructor_T, type NativePackageConstructor_T, type PackageConstructor_T } from "@l2js/core";
import type { UCorePackage, UEnginePackage } from "@l2js/engine/un-package";

// type SupportedExtensions_T = "UNR" | "UTX" | "USX" | "UAX" | "U" | "UKX" | "USK" | "NATIVE";

// // const extToType = Object.freeze(
// //     new Map([
// //         ["UNR", "LEVEL"],
// //         ["UTX", "TEXTURE"],
// //         ["USX", "STATIC_MESH"],
// //         ["UAX", "SOUND"],
// //         ["U", "SCRIPT"],
// //         ["UKX", "ANIMATION"],
// //         ["USK", "EFFECT"]
// //     ]) as Map<SupportedExtensions_T, SupportedPackages_T>
// // );

// // function getImpExtension(ext: SupportedExtensions_T, ...classList: string[]) {
// //     return classList.map(v => ([v, extToType.get(ext)] as [SupportedImports_T, SupportedPackages_T]))
// // }


// const impProperties = ["ObjectProperty", "StructProperty", "ByteProperty", "BoolProperty", "NameProperty", "FloatProperty", "ArrayProperty", "IntProperty", "ClassProperty", "StrProperty"];

// // const impToType = Object.freeze(
// //     new Map([
// //         ...getImpExtension("UNR", "Level"),
// //         ...getImpExtension("UTX", "Texture", "TexOscillator", "Shader", "ColorModifier", "FinalBlend", "TexEnvMap"),
// //         ...getImpExtension("UAX", "Sound"),
// //         ...getImpExtension("USX", "StaticMesh"),
// //         ...getImpExtension("UKX", "Animation", "SkeletalMesh", "VertMesh"),
// //         ...getImpExtension("USK", "Effect"),
// //         ...getImpExtension("U", "Script", "State", "Class", "Struct", "Function", "Enum", ...impProperties, "Texture")
// //     ]) as Map<SupportedImports_T, SupportedPackages_T>
// // );

// const packageTypes = new Set<SupportedExtensions_T>(["UNR", "UTX", "USX", "UAX", "U", "UKX", "USK", "NATIVE"]);
// const extToTypes = new Map<SupportedExtensions_T, Set<SupportedImports_T>>([...packageTypes].map(v => {
//     return [v, new Set<SupportedImports_T>()] as [SupportedExtensions_T, Set<SupportedImports_T>];
// }));

// const impToTypes = new Map<SupportedImports_T, Set<SupportedExtensions_T>>();

// function addImpExtension(ext: SupportedExtensions_T, ...classList: string[]) {
//     for (const cls of classList) {
//         const impName = cls as SupportedImports_T

//         extToTypes.get(ext).add(impName);

//         if (!impToTypes.has(impName))
//             impToTypes.set(impName, new Set());

//         impToTypes.get(impName).add(ext);
//     }
// }

// addImpExtension("UNR", "Level");
// addImpExtension("UTX", "Texture", "TexOscillator", "Shader", "ColorModifier", "FinalBlend", "TexEnvMap", "Combiner", "TexCoordSource", "TexPanner");
// addImpExtension("UAX", "Sound");
// addImpExtension("USX", "StaticMesh");
// addImpExtension("UKX", "Animation", "SkeletalMesh", "VertMesh");
// addImpExtension("USK", "Effect");
// addImpExtension("U", "Script", "State", "Class", "Struct", "Function", "Enum", ...impProperties, "Texture");

// class AssetLoader {
//     // private packages = new Map<string, Map<SupportedExtensions_T, UPackage>>();
//     // // private packageByName = new Map<string, UPackage>();

//     // static async Instantiate(assetList: IAssetListInfo) {
//     //     const Library = await import(/* webpackChunkName: "modules/unreal" */ "@l2js/engine/un-package");

//     //     return new AssetLoader(assetList, Library);
//     // }

//     // private constructor(assetList: IAssetListInfo, { UPackage, UNativePackage }: typeof import("@l2js/engine/un-package")) {
//     //     this.packages.set("native", new Map([["U", new UNativePackage(this)]]))

//     //     for (let [path, downloadPath] of Object.entries(assetList)) {
//     //         const [pkgName, pkgExt] = pathToPkgName(path);

//     //         if (!this.packages.has(pkgName))
//     //             this.packages.set(pkgName, new Map());

//     //         const packages = this.packages.get(pkgName);

//     //         if (packages.has(pkgExt))
//     //             throw new Error(`Package already registered: ${pkgName}`);

//     //         packages.set(pkgExt, new UPackage(this, `assets/${downloadPath}`));

//     //     }
//     // }

//     // public getPackage(pkgName: string, impType: SupportedImports_T): UPackage {
//     //     const pkg = getPackage(this.packages, pkgName, impType);

//     //     if (pkg === null)
//     //         throw new Error(`Package '${pkgName}[${impType}]' not found!`);

//     //     return pkg;
//     // }

//     // public hasPackage(pkgName: string, impType: SupportedImports_T) {
//     //     return getPackage(this.packages, pkgName, impType) !== null;
//     // }

//     // public getPackageByPath(path: string): UPackage {
//     //     debugger;
//     //     return this.packages.get(pathToPkgName(path).toLowerCase());
//     // }
//     // public hasPackageByPath(path: string) {
//     //     debugger;
//     //     return this.packages.has(pathToPkgName(path).toLowerCase());
//     // }

//     // public async load(pkg: UPackage): Promise<UPackage> {
//     //     const pkgsToLoad = [pkg];

//     //     while (pkgsToLoad.length > 0) {
//     //         const pkg = pkgsToLoad.shift();

//     //         if (pkg.isDecoded()) continue;

//     //         await pkg.decode();

//     //         for (const entry of pkg.imports.filter(imp => imp.className !== "Package")) {
//     //             let entrypackage = pkg.getImportEntry(entry.idPackage);

//     //             while (entrypackage.idPackage !== 0)
//     //                 entrypackage = pkg.getImportEntry(entrypackage.idPackage);

//     //             const packageName = entrypackage.objectName;
//     //             const className = entry.className;

//     //             // if (packageName === "LineageEffectsTextures" && className === "Texture")
//     //             //     debugger;

//     //             // if (packageName === "Native" && className === "Class")
//     //             //     debugger;


//     //             if (!this.hasPackage(packageName, className as SupportedImports_T))
//     //                 throw new Error(`Package '${packageName}' for type '${className}' does not exist.`);

//     //             const dependency = this.getPackage(packageName, className as SupportedImports_T);

//     //             if (!dependency)
//     //                 debugger;

//     //             if (pkgsToLoad.includes(dependency)) continue;

//     //             pkgsToLoad.push(dependency);
//     //         }
//     //     }

//     //     return pkg;
//     // }
// }

// export default AssetLoader;
// export { AssetLoader };

// function importToPkgName(pkgName: string, impType: SupportedImports_T) {
//     if (!impToType.has(impType))
//         throw new Error(`Unsupported package type '${impType}' for package '${pkgName}'`);

//     const type = impToType.get(impType);
//     const fullName = `${pkgName}/${type}`.toLowerCase();

//     return fullName;
// }

// function pathToPkgName(path: string): [string, SupportedExtensions_T] {
//     const ext = _path.extname(path);
//     const extUpper = ext.slice(1).toUpperCase() as SupportedExtensions_T;

//     if (!packageTypes.has(extUpper))
//         throw new Error(`Unsupported package type '${ext}' for package '${_path.basename(path)}'`);

//     return [_path.basename(path, ext), extUpper];
// };

// function getPackage(allPackages: Map<string, Map<SupportedExtensions_T, UPackage>>, pkgName: string, impType: SupportedImports_T): UPackage {
//     const packages = allPackages.get(pkgName.toLowerCase());
//     const validExts = impToTypes.get(impType);

//     let pkg: UPackage = null;

//     for (const ext of validExts) {
//         if (!packages.has(ext)) continue;

//         pkg = packages.get(ext);
//         break;
//     }

//     return pkg;
// }


class AssetLoader extends AAssetLoader<APackage, UCorePackage, UEnginePackage, ANativePackage> {

    protected pkgRefCounts = new Map<string, number>();

    static async Instantiate(assetList: AssetListInfo_T) {
        const Library = await import(/* webpackChunkName: "modules/unreal" */ "@l2js/engine/un-package");

        return new AssetLoader().init(assetList, Library);
    }

    protected createNativePackage(UNativePackage: NativePackageConstructor_T<ANativePackage>): ANativePackage {
        return new UNativePackage(this);
    }

    protected createPackage(UPackage: PackageConstructor_T<APackage> | CorePackageConstructor_T<UCorePackage> | EnginePackageConstructor_T<UEnginePackage>, downloadPath: string): APackage {
        return new UPackage(this, `assets/${downloadPath}`);
    }

    public async using<T extends APackage = APackage>(pkg: T, props?: { neverUnload?: boolean }): Promise<T> {
        const _pkg = await this.load(pkg);
        const w = (props?.neverUnload ?? false) ? Infinity : 1;

        for (const dep of this.getDependencies(pkg)) {
            if (!this.pkgRefCounts.has(dep))
                this.pkgRefCounts.set(dep, 0);

            this.pkgRefCounts.set(dep, this.pkgRefCounts.get(dep) + w);
        }

        return _pkg;
    }

    public free<T extends APackage = APackage>(pkg: T) {
        const deref = new Array<string>();

        for (const dep of this.getDependencies(pkg)) {
            if (!this.pkgRefCounts.has(dep))
                continue

            const c = this.pkgRefCounts.get(dep);
            const nc = Math.max(0, this.pkgRefCounts.get(dep) - 1);

            if (c > 0 && nc === 0 && !deref.includes(dep))
                deref.push(dep);

            this.pkgRefCounts.set(dep, nc);
        }

        for (const path of deref)
            this.getPackage(path).free();
    }
}

export default AssetLoader;
export { AssetLoader };
