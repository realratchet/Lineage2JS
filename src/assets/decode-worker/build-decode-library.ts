import type { APackage } from "@l2js/core";
import DecodeLibrary from "@l2js/engine/decode-library";
import DecodeLibraryBuilder from "@l2js/engine/decode-library-builder";

function buildDecodeLibrary(pkg: APackage, sectorName: string, settings: GD.LoadSettings_T) {
    const decodeLibrary = new DecodeLibrary();
    const builder = new DecodeLibraryBuilder(decodeLibrary, settings);

    const uLevel = pkg.fetchObject<GA.ULevel>(pkg.exportGroups.Level[0].index + 1).loadSelf();

    // const sun = pkg.fetchObject<GA.UNSun>(pkg.exportGroups["NSun"][0].index + 1).loadSelf();
    // decodeLibrary.sun = sun.getDecodeInfo(decodeLibrary);
    // debugger;

    builder.pullLevel(uLevel, sectorName);

    // debugger;

    // throw new Error("error")

    return decodeLibrary;
}

export default buildDecodeLibrary;
export { buildDecodeLibrary };
