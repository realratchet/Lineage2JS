const ALLOW_FAILED_OBJECTS = true;

class DecodeLibrary {
    public name: string = "Untitled";
    public loadMipmaps = true;                                                              // should mipmaps be loaded into decode library
    public anisotropy = -1;                                                                 // which anisotropy level to set when decoding
    public sector: [number, number];
    public helpersZoneBounds = false;
    public readonly bspNodes: IBSPNodeDecodeInfo_T[] = [];
    public readonly bspColliders: IBoxDecodeInfo[] = [];
    public readonly bspLeaves: IBSPLeafDecodeInfo_T[] = [];
    public readonly bspZones: IBSPZoneDecodeInfo_T[] = [];
    public readonly bspZoneIndexMap: GenericObjectContainer_T<number> = {};
    // public readonly zones: GenericObjectContainer_T<IBaseZoneDecodeInfo> = {};              // a dictionary containing all zone decode info
    public readonly geometries: GenericObjectContainer_T<IGeometryDecodeInfo> = {};         // a dictionary containing all geometry decode info
    public readonly geometryInstances: GenericObjectContainer_T<number> = {};               // a dictionary containing all geometray instance decode info
    public readonly materials: GenericObjectContainer_T<IBaseMaterialDecodeInfo> = {};      // a dictionary containing all material decode info
    public readonly materialModifiers: GenericObjectContainer_T<IMaterialModifier> = {};    // a dictionary containing all material modifiers

    public failed: any[] = [];
    public failedLoad: any[] = [];
    public failedDecode: any[] = [];
    public sun: ISunDecodeInfo_T;

    public static async fromPackage(pkg: UPackage, {
        loadBaseModel = true,
        loadStaticModels = true,
        loadStaticModelList = null,
        loadTerrain = true,
        helpersZoneBounds = false
    }: LoadSettings_T) {

        const impGroups = pkg.importGroups;
        const expGroups = pkg.exportGroups;

        const decodeLibrary = new DecodeLibrary();
        const uLevel = await pkg.fetchObject<ULevel>(expGroups.Level[0].index + 1);

        decodeLibrary.name = uLevel.url.map;
        decodeLibrary.helpersZoneBounds = helpersZoneBounds;

        const uLevelInfo = await pkg.fetchObject<ULevelInfo>(expGroups["LevelInfo"][0].index + 1);

        const sun = await pkg.fetchObject<UNSun>(expGroups["NSun"][0].index + 1);

        decodeLibrary.sun = await sun.getDecodeInfo(decodeLibrary);

        const sectorIndex = uLevel.url.map.split("_").map(v => parseInt(v.slice(0, 2))) as [number, number];

        const isNotSector = sectorIndex.some(x => typeof (x) !== "number" || !isFinite(x));

        if (isNotSector) debugger;

        decodeLibrary.sector = sectorIndex;

        if (loadBaseModel) {
            const uModel = await pkg.fetchObject<UModel>(uLevel.baseModelId); // base model
            await uModel.getDecodeInfo(decodeLibrary, uLevelInfo);
        }

        if (loadTerrain) {
            const uTerrainInfo = await pkg.fetchObject<UZoneInfo>(expGroups.TerrainInfo[0].index + 1);
            await uTerrainInfo.getDecodeInfo(decodeLibrary);
        }

        if (loadStaticModels) {
            let actorsToLoad: { index: number; export: UExport; }[];

            if (loadStaticModelList && loadStaticModelList.length)
                actorsToLoad = loadStaticModelList.map(i => { return { index: i - 1, export: pkg.exports[i - 1] } });
            else actorsToLoad = expGroups["StaticMeshActor"] || [];

            if (ALLOW_FAILED_OBJECTS) {
                const failed = decodeLibrary.failed, failedLoad = decodeLibrary.failedLoad, failedDecode = decodeLibrary.failedDecode;

                for (let exp of actorsToLoad) {
                    try {
                        const actor = await pkg.fetchObject<UStaticMeshActor>(exp.index + 1);
                        try {
                            await actor.onLoaded();

                            try {
                                await actor.getDecodeInfo(decodeLibrary)
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
                const uStaticMeshActorPromises = actorsToLoad.map(exp => pkg.fetchObject<UStaticMeshActor>(exp.index + 1));
                const uStaticMeshActors = await Promise.all(uStaticMeshActorPromises);

                await Promise.all(uStaticMeshActors.map(actor => actor.getDecodeInfo(decodeLibrary)));
            }
        }

        return decodeLibrary;
    }
}

export default DecodeLibrary;
export { DecodeLibrary };