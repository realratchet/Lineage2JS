import type PackageCache from "./package-cache";
import type { APackage } from "@l2js/core";
import DecodeLibrary from "@l2js/engine/decode-library";
import DecodeLibraryBuilder from "@l2js/engine/decode-library-builder";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";
import type { ULevel } from "@l2js/engine/un-level";

export function buildDecodeLibrary(pkg: APackage, sectorName: string, settings: LoadSettings_T, packageCache: PackageCache = null) {
    const decodeLibrary = new DecodeLibrary();
    const builder = new DecodeLibraryBuilder(decodeLibrary, settings, packageCache);

    // const sun = pkg.fetchObject<GA.UNSun>(pkg.exportGroups["NSun"][0].index + 1).loadSelf();
    // decodeLibrary.sun = sun.getDecodeInfo(decodeLibrary);
    // debugger;

    const loader = pkg.loader as any;
    const previous = loader.decodeLibraryBuilder;
    loader.decodeLibraryBuilder = builder;
    try {
        const uLevel = pkg.fetchObject<ULevel>(pkg.exportGroups.Level[0].index + 1).loadSelf();
        builder.pullLevel(uLevel, sectorName);
    } finally {
        loader.decodeLibraryBuilder = previous;
    }

    // debugger;

    // throw new Error("error")

    return decodeLibrary;
}

export default buildDecodeLibrary;
