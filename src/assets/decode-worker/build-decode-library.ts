import DecodeLibrary from "@client/assets/unreal/decode-library";
import DecodeLibraryBuilder from "@client/assets/unreal/decode-library-builder";

/**
 * Builds a DecodeLibrary from a decoded level package (formerly
 * DecodeLibrary.fromPackage). Lives in the decode worker bundle so no ue2 asset code
 * ever reaches the renderer bundle.
 */

function buildDecodeLibrary(pkg: C.APackage, sectorName: string, settings: GD.LoadSettings_T) {
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
