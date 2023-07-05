// import * as _path from "path";

import { AAssetLoader } from "@l2js/core";

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
//     //     const Library = await import(/* webpackChunkName: "modules/unreal" */ "@unreal/un-package");

//     //     return new AssetLoader(assetList, Library);
//     // }

//     // private constructor(assetList: IAssetListInfo, { UPackage, UNativePackage }: typeof import("@unreal/un-package")) {
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


class AssetLoader extends AAssetLoader<GA.UPackage, GA.UCorePackage, GA.UEnginePackage, GA.UNativePackage> {

    static async Instantiate(assetList: C.IAssetListInfo) {
        const Library = await import(/* webpackChunkName: "modules/unreal" */ "@unreal/un-package");

        return new AssetLoader().init(assetList, Library);
    }

    protected createNativePackage(UNativePackage: C.ANativePackageConstructor<GA.UNativePackage>): GA.UNativePackage {
        return new UNativePackage(this);
    }

    protected createPackage(UPackage: C.APackageConstructor<GA.UPackage> | C.ACorePackageConstructor<GA.UCorePackage> | C.AEnginePackageConstructor<GA.UEnginePackage>, downloadPath: string): GA.UPackage {
        return new UPackage(this, `assets/${downloadPath}`);
    }
}

export default AssetLoader;
export { AssetLoader };