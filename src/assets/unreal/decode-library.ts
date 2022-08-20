const ALLOW_FAILED_OBJECTS = true;

class DecodeLibrary {
    public name: string = "Untitled";
    public loadMipmaps = true;                                                              // should mipmaps be loaded into decode library
    public anisotropy = -1;                                                                 // which anisotropy level to set when decoding
    public sector: string = null;                                                           // sector zone id
    public helpersZoneBounds = false;
    public readonly bspNodes: IBSPNodeDecodeInfo_T[] = [];
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

    public static async fromPackage(pkg: UPackage, {
        loadBaseModel = true,
        loadStaticModels = true,
        loadStaticModelList = null,
        loadTerrain = true,
        helpersZoneBounds = false
    }: LoadSettings_T) {
        // const impGroups = pkg.imports.reduce((accum, imp, index) => {
        //     const impType = imp.className;
        //     const list = accum[impType] = accum[impType] || [];

        //     list.push({ import: imp, index: -index - 1 });

        //     return accum;
        // }, {} as GenericObjectContainer_T<{ import: UImport, index: number }[]>);

        const decodeLibrary = new DecodeLibrary();
        const expGroups = pkg.exports.reduce((accum, exp, index) => {

            const expType = pkg.getPackageName(exp.idClass.value as number);
            const list = accum[expType] = accum[expType] || [];

            list.push({ index, export: exp });

            return accum;
        }, {} as GenericObjectContainer_T<{ index: number, export: UExport }[]>);

        const uLevel = await pkg.fetchObject<ULevel>(expGroups.Level[0].index + 1);

        decodeLibrary.name = uLevel.url.map;
        decodeLibrary.helpersZoneBounds = helpersZoneBounds;

        const uLevelInfo = await pkg.fetchObject<ULevelInfo>(expGroups["LevelInfo"][0].index + 1);
        const uZonesInfo = await Promise.all((expGroups["ZoneInfo"] || []).map(exp => pkg.fetchObject<UZoneInfo>(exp.index + 1)));

        await Promise.all((uZonesInfo as IInfo[]).concat(uLevelInfo).map(z => z.getDecodeInfo(decodeLibrary)));

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