import DecodeLibrary from "@client/assets/unreal/decode-library";

/**
 * Builds a DecodeLibrary from a decoded level package (formerly
 * DecodeLibrary.fromPackage). Lives in the decode worker bundle so no ue2 asset code
 * ever reaches the renderer bundle.
 */

const ALLOW_FAILED_OBJECTS = false;

function buildDecodeLibrary(pkg: C.APackage, {
    loadBaseModel = true,
    loadStaticModels = true,
    loadStaticModelList = null,
    loadTerrain = true,
    loadAudio = true,
    helpersZoneBounds = false,
    loadEmitters = true,
    loadEmitterList = null,
    isSkyLevel = false,
    batching = { terrain: true, staticMeshes: true }
}: GD.LoadSettings_T) {

    const impGroups = pkg.importGroups;
    const expGroups = pkg.exportGroups;

    const decodeLibrary = new DecodeLibrary();

    const uLevel = pkg.fetchObject<GA.ULevel>(expGroups.Level[0].index + 1).loadSelf();
    const uLevelInfo = uLevel.levelInfo.loadSelf();

    decodeLibrary.brightness = uLevelInfo.brightness;

    decodeLibrary.name = uLevel.url.map;
    (decodeLibrary as any).isSkyLevel = isSkyLevel;
    decodeLibrary.helpersZoneBounds = helpersZoneBounds;
    decodeLibrary.batching.terrain = batching?.terrain !== false;
    decodeLibrary.batching.staticMeshes = batching?.staticMeshes !== false;

    // const sun = pkg.fetchObject<GA.UNSun>(expGroups["NSun"][0].index + 1).loadSelf();

    // decodeLibrary.sun = sun.getDecodeInfo(decodeLibrary);

    // debugger;

    let sectorIndex = uLevel.url.map.split("_").map(v => parseInt(v.slice(0, 2))) as [number, number];

    const isNotSector = sectorIndex.some(x => typeof (x) !== "number" || !isFinite(x));

    if (isNotSector) {
        // 23_17's LevelInfo url.map doesn't parse - the filename is authoritative; [17,25] stays as the skylevel placeholder
        sectorIndex = pkg.path.split("/").pop().split("_").map(v => parseInt(v.slice(0, 2))) as [number, number];

        if (sectorIndex.some(x => typeof (x) !== "number" || !isFinite(x)))
            sectorIndex = [17, 25]
        // debugger;
    }

    decodeLibrary.sector = sectorIndex;

    const uModel = pkg.fetchObject<GA.UModel>(uLevel.baseModelId); // base model

    uModel.setLevelInfo(uLevelInfo).loadSelf();

    if (loadBaseModel) uModel.getDecodeInfo(decodeLibrary, uLevelInfo);
    else uModel.getZoneDecodeInfo(decodeLibrary, uLevelInfo);

    if (loadTerrain && expGroups?.TerrainInfo?.length > 0) {
        const terrainInfo = pkg.fetchObject<GA.FZoneInfo>(expGroups.TerrainInfo[0].index + 1).loadSelf();
        terrainInfo.getDecodeInfo(decodeLibrary);
    }

    {
        const actorTypesToLoad = ["Light", "NMovableSunLight"];
        const uActorsToLoad = actorTypesToLoad.map(t => expGroups[t] ?? []).flat();

        uActorsToLoad
            .map(exp => {
                const uActor = pkg.fetchObject<GA.ULight>(exp.index + 1).loadSelf();
                const dActor = uActor.getDecodeInfo(decodeLibrary);

                decodeLibrary.lightActors.push(dActor);
            });
    }

    {
        if (isSkyLevel) { // Load skylevel
            const celestialTypes = ["NSun", "NMoon"];
            const uCelestialsToLoad = celestialTypes.map(t => expGroups[t] ?? []).flat();

            uCelestialsToLoad.forEach(exp => {
                const uActor = pkg.fetchObject<any>(exp.index + 1).loadSelf();
                if (uActor.getDecodeInfo) {
                    decodeLibrary.celestials.push(uActor.getDecodeInfo(decodeLibrary));
                }
            });
        }

        const skyZoneTypes = ["SkyZoneInfo"];
        const uSkyZones = skyZoneTypes.map(t => expGroups[t] ?? []).flat();
        uSkyZones.forEach(exp => {
            const uActor = pkg.fetchObject<any>(exp.index + 1).loadSelf();
            if (uActor.getDecodeInfo) {
                decodeLibrary.skyZoneInfos.push(uActor.getDecodeInfo(decodeLibrary));
            }
        });
    }

    {
        const fogTypes = ["L2FogInfo"];
        const uFogsToLoad = fogTypes.map(t => expGroups[t] ?? []).flat();

        uFogsToLoad.forEach(exp => {
            const uActor = pkg.fetchObject<any>(exp.index + 1).loadSelf();
            if (uActor.getDecodeInfo) {
                decodeLibrary.fogInfos.push(uActor.getDecodeInfo(decodeLibrary));
            }
        });
    }



    if (loadEmitters) {
        const actorsToLoad = expGroups["Emitter"] || [];
        const uEmitters = actorsToLoad.map(exp => pkg.fetchObject<GA.UEmitter>(exp.index + 1).loadSelf());

        for (const actor of uEmitters) {
            // debug whitelist, see core.ts loadSettings.loadEmitterList
            if (loadEmitterList && loadEmitterList.length) {
                const entry = loadEmitterList.find(e => e.name === actor.objectName);
                if (!entry) continue;
                (actor as any).__subEmitterFilter = entry.emitters ?? null; // read by un-emitter.ts's getDecodeInfo
            }

            actor.getDecodeInfo(decodeLibrary);
        }
    }

    if (loadStaticModels) {
        let actorsToLoad: { index: number; export: C.UExport; }[];

        if (loadStaticModelList && loadStaticModelList.length)
            actorsToLoad = loadStaticModelList.map(i => {
                i = typeof i === "number" ? i : pkg.exports.find(x => x.objectName === i).index + 1

                return { index: i - 1, export: pkg.exports[i - 1] };
            });
        else actorsToLoad = [...expGroups["StaticMeshActor"] || [], ...expGroups["Mover"] || []];

        if (ALLOW_FAILED_OBJECTS) {
            const failed = decodeLibrary.failed, failedLoad = decodeLibrary.failedLoad, failedDecode = decodeLibrary.failedDecode;

            for (let exp of actorsToLoad) {
                try {
                    const actor = pkg.fetchObject<GA.UStaticMeshActor>(exp.index + 1).loadSelf();

                    if (actor.isDeleteMe)
                        continue;

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
                if (actor.isDeleteMe)
                    continue;

                actor.getDecodeInfo(decodeLibrary);
            }
        }
    }

    if (loadAudio) {
        const musicVolumeExports = expGroups["MusicVolume"] ?? [];
        musicVolumeExports.forEach(exp => {
            const uActor = pkg.fetchObject<GA.UMusicVolume>(exp.index + 1).loadSelf();
            const musicInfo = uActor.getDecodeInfo(decodeLibrary);
            decodeLibrary.audioList.push(musicInfo);
        });

        const ambientSoundExports = expGroups["AmbientSoundObject"] ?? [];
        ambientSoundExports.forEach(exp => {
            try {
                const uActor = pkg.fetchObject<any>(exp.index + 1).loadSelf();
                if (uActor.getDecodeInfo) {
                    uActor.getDecodeInfo(decodeLibrary);
                }
            } catch (e) {
                // Skip ambient sounds that fail to load (e.g. missing sound reference)
            }
        });
    }

    // debugger;

    // throw new Error("error")

    return decodeLibrary;
}

export default buildDecodeLibrary;
export { buildDecodeLibrary };
