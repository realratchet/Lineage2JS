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
import DecodeWorkerClient from "@client/assets/decode-worker/decode-worker-client";
import { APackage } from "@l2js/core";
import { Vector3 } from "three";

const tmpCameraPosition = new Vector3();

const FAILED_SECTOR_RETRY_MS = 30_000;

class AssetManager {
    protected isTicking: boolean = false;
    protected assetLoader: AssetLoader;
    protected loadSettings: GD.LoadSettings_T;
    protected glCapabilities: WebGLCapabilities
    protected decodeWorker: DecodeWorkerClient = null;
    protected isWorkerReady = false;
    protected failedSectors = new Map<string, number>(); // sector id -> retry-after timestamp

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

        /*
         * Kick off the sector decode worker after main-thread init so both sides don't
         * race to populate the OPFS cache with core/engine packages. Ticks fall back to
         * synchronous decoding if it never comes up.
         */
        this.decodeWorker = new DecodeWorkerClient();
        this.decodeWorker.ready.then(
            () => {
                this.isWorkerReady = true;
                console.log("Sector decode worker ready.");
            },
            e => console.warn("Sector decode worker unavailable, falling back to main-thread decoding:", e)
        );
    }

    public async setAlwaysLoaded(renderManager: RenderManager, pkg: APackage) {
        renderManager.addSector(await _decodePackage(this.glCapabilities, this.assetLoader, pkg, this.loadSettings, { neverUnload: true }));
    }

    protected async loadSector(renderManager: RenderManager, pkg: APackage) {
        renderManager.addSector(await _decodePackage(this.glCapabilities, this.assetLoader, pkg, this.loadSettings));
    }

    /**
     * Decodes the sector off the main thread; only the three.js instantiation
     * (decodePackage) runs here. Falls back to the synchronous path if the worker died.
     * Returns true when a load was attempted (successfully or not), false when the
     * sector was skipped (failure cooldown, worker still initializing).
     */
    protected async requestSector(renderManager: RenderManager, sectorIdx: string): Promise<boolean> {
        const retryAt = this.failedSectors.get(sectorIdx);

        if (retryAt !== undefined && performance.now() < retryAt) return false;

        if (this.decodeWorker?.isDead) {
            await this.loadSector(renderManager, this.assetLoader.getPackage(sectorIdx, "Level"));
            return true;
        }

        if (!this.isWorkerReady) return false; // still initializing - retry on a later tick

        try {
            const decodeLibrary = await this.decodeWorker.decodeSector(sectorIdx, this.loadSettings);

            decodeLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();

            renderManager.addSector(decodePackage(decodeLibrary));
            this.failedSectors.delete(sectorIdx);
        } catch (e) {
            console.error(`Failed to decode sector '${sectorIdx}':`, e);
            this.failedSectors.set(sectorIdx, performance.now() + FAILED_SECTOR_RETRY_MS);
        }

        return true;
    }

    public async tick(renderManager: RenderManager) {
        if (this.isTicking) return; // avoid too many ticks running at the same time as the tick is done on before render so we defer sector loading

        try {
            this.isTicking = true;

            const cameraPosition = renderManager.camera.getWorldPosition(tmpCameraPosition);
            const [sx, sy] = renderManager.getSectorId(cameraPosition);
            const originIdx = `${sx}_${sy}`;
            const validSectors = [originIdx];
            const sectorsLoaded = renderManager.getLoadedSectors();
            const sectorsLoadedIds = sectorsLoaded.map(({ index }) => `${index.x}_${index.y}`)
            const isValidOrigin = this.assetLoader.hasPackage(originIdx, "Level");

            /*
             * Sectors wanted this tick, most-important first: the sector the camera is
             * in, then unloaded neighbours nearest-first. Only one is requested per tick
             * (isTicking stays up while it decodes), so the origin always wins and
             * neighbours trickle in one by one; recomputing the list every tick makes
             * crossing a boundary immediately re-prioritize the new origin.
             */
            const sectorsToLoad: string[] = [];

            if (isValidOrigin && !sectorsLoadedIds.includes(originIdx))
                sectorsToLoad.push(originIdx);

            const sectorSize = 256 * 128;
            const neighbours: { idx: string, distSq: number }[] = [];

            for (let x = sx - 1, xmax = sx + 1; x <= xmax; x++) {
                for (let y = sy - 1, ymax = sy + 1; y <= ymax; y++) {
                    const levelIdx = `${x}_${y}`;

                    if (levelIdx === originIdx || !this.assetLoader.hasPackage(levelIdx, "Level"))
                        continue; // skip origin and invalid sectors

                    validSectors.push(levelIdx);

                    if (!sectorsLoadedIds.includes(levelIdx)) {
                        /* same sector -> world mapping as RenderManager.getSectorId */
                        const dx = cameraPosition.x - (x - 20 + 0.5) * sectorSize;
                        const dy = cameraPosition.y - (y - 18 + 0.5) * sectorSize;

                        neighbours.push({ idx: levelIdx, distSq: dx * dx + dy * dy });
                    }
                }
            }

            neighbours.sort((a, b) => a.distSq - b.distSq);

            /* prefetch only makes sense off-thread - the sync fallback would freeze a frame per sector */
            if (this.isWorkerReady && !this.decodeWorker?.isDead)
                sectorsToLoad.push(...neighbours.map(n => n.idx));

            const sectorsToUnload = sectorsLoaded.filter(({ index }) => {
                const levelIdx = `${index.x}_${index.y}`;

                return !validSectors.includes(levelIdx);
            })

            for (const secIdx of sectorsToLoad) {
                if (await this.requestSector(renderManager, secIdx))
                    break; // one sector per tick - the rest re-enter the list next tick
            }

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