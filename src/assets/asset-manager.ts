import type AssetLoader from "@client/assets/asset-loader";
import * as schemas from "@unreal/datafile/schema/schema-types";
import UDataFile from "@unreal/datafile/un-datafile";
import UConfigEnv from "@unreal/conf-files/un-conf-env";
import UPackage, { UCorePackage, UEnginePackage, UNativePackage } from "@unreal/un-package";
import RenderManager from "@client/rendering/render-manager";
import { WebGLCapabilities } from "three/src/renderers/webgl/WebGLCapabilities";
import DecodeLibrary from "@client/assets/unreal/decode-library";
import { decodePackage } from "@client/assets/decoders/object3d-decoder";
import decodeEnv from "@client/assets/decoders/env-decoder";
import { APackage } from "@l2js/core";
import { Vector3 } from "three";

const tmpCameraPosition = new Vector3();

class AssetManager {
    protected isTicking: boolean = false;
    protected assetLoader: AssetLoader;
    protected loadSettings: GD.LoadSettings_T;
    protected glCapabilities: WebGLCapabilities

    public constructor(loadSettings: GD.LoadSettings_T, assetLoader: AssetLoader) {
        this.loadSettings = loadSettings;
        this.assetLoader = assetLoader;
    }

    public async initialize(renderManager: RenderManager): Promise<void> {
        this.glCapabilities = renderManager.renderer.capabilities;

        const assetLoader = this.assetLoader;
        const loadSettings = this.loadSettings;
        const pkgNative = await assetLoader.using(assetLoader.getNativePackage(), { neverUnload: true });
        const pkgCore = await assetLoader.using(assetLoader.getCorePackage(), { neverUnload: true });
        const pkgEngine = await assetLoader.using(assetLoader.getEnginePackage(), { neverUnload: true });

        pkgCore.loadNativeClasses();

        const datMusicInfo = await _decodeDatFile(schemas.SCHEMA_MUSICINFO_DAT, "assets/system/musicinfo.dat");
        const pkgL2Skies = await assetLoader.using(assetLoader.getPackage("l2_skies", "Texture"), { neverUnload: true });
        const envConfig = (await _decodeEnvConfig("assets/system/env.int", pkgNative, pkgEngine, pkgL2Skies)).getDecodeInfo();
        const pkgSkyLevel = await assetLoader.using(assetLoader.getPackage("skylevel", "Level"), { neverUnload: true });
        const skyLevel = await _decodePackage(this.glCapabilities, assetLoader, pkgSkyLevel, {
            ...loadSettings, isSkyLevel: true,
            loadTerrain: true,
            loadBaseModel: true,
            loadStaticModels: false,
            loadEmitters: false,
            loadStaticModelList: undefined,
            loadAudio: false,
            batching: { staticMeshes: false, terrain: false }
        });

        renderManager.setEnv(decodeEnv(envConfig));
        renderManager.setSky(skyLevel);
        renderManager.audioManager.setMusicInfo(
            Object.fromEntries(datMusicInfo.datarows.map(x => [
                x.id,
                (x.sounds as string[]).map(x => assetLoader.getPackage(x, "Music").path)
            ]))
        );
    }

    public async setAlwaysLoaded(renderManager: RenderManager, pkg: APackage) {
        renderManager.addSector(await _decodePackage(this.glCapabilities, this.assetLoader, pkg, this.loadSettings, { neverUnload: true }));
    }

    protected async loadSector(renderManager: RenderManager, pkg: APackage) {
        renderManager.addSector(await _decodePackage(this.glCapabilities, this.assetLoader, pkg, this.loadSettings));
    }

    public async tick(renderManager: RenderManager) {
        if (this.isTicking) return; // avoid too many ticks running at the same time as the tick is done on before render so we defer sector loading

        try {
            this.isTicking = true;

            const cameraPosition = renderManager.camera.getWorldPosition(tmpCameraPosition);
            const [sx, sy] = renderManager.getSectorId(cameraPosition);
            const originIdx = `${sx}_${sy}`;
            const validSectors = [originIdx];
            const sectorsToLoad = [];
            const sectorsLoaded = renderManager.getLoadedSectors();
            const sectorsLoadedIds = sectorsLoaded.map(({ index }) => `${index.x}_${index.y}`)
            const isValidOrigin = this.assetLoader.hasPackage(originIdx, "Level");

            for (let x = sx - 1, xmax = sx + 1; x <= xmax; x++) {
                for (let y = sy - 1, ymax = sy + 1; y <= ymax; y++) {
                    const levelIdx = `${x}_${y}`;

                    if (levelIdx === originIdx || !this.assetLoader.hasPackage(levelIdx, "Level"))
                        continue; // skip origin and invalid sectors

                    validSectors.push(levelIdx);

                    if (!sectorsLoadedIds.includes(levelIdx))
                        sectorsToLoad.push(levelIdx);
                }
            }

            const sectorsToUnload = sectorsLoaded.filter(({ index }) => {
                const levelIdx = `${index.x}_${index.y}`;

                return !validSectors.includes(levelIdx);
            })

            if (isValidOrigin && !sectorsLoadedIds.includes(originIdx))
                await this.loadSector(renderManager, this.assetLoader.getPackage(originIdx, "Level"));


            // for (const secIdx of sectorsToLoad) { // commented out until loading is more on-demand instead of laggy
            //     try {
            //         await this.loadSector(renderManager, this.assetLoader.getPackage(secIdx, "Level"));
            //     } catch (e) {
            //         console.error(`failed to load terrain: ${secIdx}`, e);
            //     }
            // }

            // console.log(validSectors.join(", "))

        } finally {
            this.isTicking = false;
        }
    }
}

export default AssetManager;
export { AssetManager };

async function _decodeDatFile(schema: ISchemaValue[], path: string) {
    // const ini = await (new UEncodedFile("assets/system/l2.ini").asReadable()).decode();

    const file = await (new UDataFile(schema, path).asReadable()).decode();

    return file;
}

async function _decodeEnvConfig(path: string, pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage, pkgL2Skies: C.APackage): Promise<UConfigEnv> {
    const envFile = await (new UConfigEnv(path).asReadable()).decode();

    return await envFile.load(pkgNative, pkgEngine, pkgL2Skies);
}

async function _decodePackage(glCapabilities: WebGLCapabilities, assetLoader: AssetLoader, pkg: string | C.APackage, settings: GD.LoadSettings_T, pkgProps?: { neverUnload?: boolean }) {
    if (typeof (pkg) === "string") pkg = assetLoader.getPackage(pkg, "Level");

    pkg = await assetLoader.using(pkg, pkgProps);

    const decodeLibrary = DecodeLibrary.fromPackage(pkg, settings);

    // debugger;

    decodeLibrary.anisotropy = glCapabilities.getMaxAnisotropy();

    console.log(`Decode library '${decodeLibrary.name}' created, building scene.`)


    return decodePackage(decodeLibrary);
}