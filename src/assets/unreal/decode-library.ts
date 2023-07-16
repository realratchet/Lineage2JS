const ALLOW_FAILED_OBJECTS = false;

class DecodeLibrary {
    public name: string = "Untitled";
    public loadMipmaps = true;                                                              // should mipmaps be loaded into decode library
    public anisotropy = -1;                                                                 // which anisotropy level to set when decoding
    public sector: [number, number];
    public helpersZoneBounds = false;
    public readonly bspNodes: GD.IBSPNodeDecodeInfo_T[] = [];
    public readonly bspColliders: GD.IBoxDecodeInfo[] = [];
    public readonly bspLeaves: GD.IBSPLeafDecodeInfo_T[] = [];
    public readonly bspZones: GD.IBSPZoneDecodeInfo_T[] = [];
    public readonly bspZoneIndexMap: Record<string, number> = {};
    // public readonly zones: Record<string, IBaseZoneDecodeInfo> = {};              // a dictionary containing all zone decode info
    public readonly geometries: Record<string, GD.IGeometryDecodeInfo> = {};         // a dictionary containing all geometry decode info
    public readonly geometryInstances: Record<string, number> = {};               // a dictionary containing all geometray instance decode info
    public readonly materials: Record<string, GD.IBaseMaterialDecodeInfo> = {};      // a dictionary containing all material decode info
    public readonly materialModifiers: Record<string, GD.IMaterialModifier> = {};    // a dictionary containing all material modifiers

    public failed: any[] = [];
    public failedLoad: any[] = [];
    public failedDecode: any[] = [];
    public sun: GD.ISunDecodeInfo_T;

    public static async fromPackage(pkg: C.APackage, {
        env,
        loadBaseModel = true,
        loadStaticModels = true,
        loadStaticModelList = null,
        loadTerrain = true,
        helpersZoneBounds = false,
        loadEmitters = true
    }: GD.LoadSettings_T) {

        const impGroups = pkg.importGroups;
        const expGroups = pkg.exportGroups;

        const decodeLibrary = new DecodeLibrary();
        const uLevelInfo = pkg.fetchObject<GA.ULevelInfo>(expGroups["LevelInfo"][0].index + 1).loadSelf();
        const uLevel = pkg.fetchObject<GA.ULevel>(expGroups.Level[0].index + 1).loadSelf();

        uLevel.setInfo(uLevelInfo);

        decodeLibrary.name = uLevel.url.map;
        decodeLibrary.helpersZoneBounds = helpersZoneBounds;

        const sun = pkg.fetchObject<GA.UNSun>(expGroups["NSun"][0].index + 1).loadSelf();

        // debugger;

        decodeLibrary.sun = sun.getDecodeInfo(decodeLibrary);

        // debugger;

        const sectorIndex = uLevel.url.map.split("_").map(v => parseInt(v.slice(0, 2))) as [number, number];

        const isNotSector = sectorIndex.some(x => typeof (x) !== "number" || !isFinite(x));

        if (isNotSector) debugger;

        decodeLibrary.sector = sectorIndex;

        const uModel = pkg.fetchObject<GA.UModel>(uLevel.baseModelId).loadSelf(); // base model

        if (loadBaseModel) uModel.getDecodeInfo(decodeLibrary, uLevelInfo);
        else uModel.getZoneDecodeInfo(decodeLibrary, uLevelInfo);

        if (loadTerrain) {
            const terrainInfo = pkg.fetchObject<GA.FZoneInfo>(expGroups.TerrainInfo[0].index + 1).loadSelf();
            terrainInfo.getDecodeInfo(decodeLibrary);
        }

        if (loadEmitters) {
            const actorsToLoad = expGroups["Emitter"] || [];
            const uEmitters = actorsToLoad.map(exp => pkg.fetchObject<GA.UEmitter>(exp.index + 1).loadSelf());

            for (const actor of uEmitters)
                actor.getDecodeInfo(decodeLibrary);
        }

        if (loadStaticModels) {
            let actorsToLoad: { index: number; export: C.UExport; }[];

            if (loadStaticModelList && loadStaticModelList.length)
                actorsToLoad = loadStaticModelList.map(i => {
                    i = typeof i === "number" ? i : pkg.exports.find(x => x.objectName === i).index + 1

                    return { index: i - 1, export: pkg.exports[i - 1] };
                });
            else actorsToLoad = expGroups["StaticMeshActor"] || [];

            if (ALLOW_FAILED_OBJECTS) {
                const failed = decodeLibrary.failed, failedLoad = decodeLibrary.failedLoad, failedDecode = decodeLibrary.failedDecode;

                for (let exp of actorsToLoad) {
                    try {
                        const actor = pkg.fetchObject<GA.UStaticMeshActor>(exp.index + 1).loadSelf();
                        try {
                            try {
                                actor.getDecodeInfo(decodeLibrary)
                            } catch (e) { failedDecode.push([actor, e]); }
                        } catch (e) {
                            failedLoad.push([actor, e]);
                        }
                    } catch (e) {
                        failed.push([exp, e]);
                    }
                }

                if (failed.length > 0 || failedLoad.length > 0 || failedDecode.length > 0) {
                    console.warn("Some objects failed to load");
                    debugger;
                }
            } else {
                const uStaticMeshActors = actorsToLoad.map(exp => pkg.fetchObject<GA.UStaticMeshActor>(exp.index + 1).loadSelf());

                for (const actor of uStaticMeshActors) {
                    actor.setL2Env(env);
                    actor.getDecodeInfo(decodeLibrary);
                }
            }
        }

        // debugger;

        // throw new Error("error")

        return decodeLibrary;
    }
}

export default DecodeLibrary;
export { DecodeLibrary };