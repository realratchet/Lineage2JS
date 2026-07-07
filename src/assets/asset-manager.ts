import RenderManager from "@client/rendering/render-manager";
import { WebGLCapabilities } from "three/src/renderers/webgl/WebGLCapabilities";
import { decodePackage } from "@client/assets/decoders/object3d-decoder";
import decodeEnv from "@client/assets/decoders/env-decoder";
import DecodeWorkerClient from "@client/assets/decode-worker/decode-worker-client";
import { Vector3 } from "three";
import type { SectorObject } from "@client/objects/zone-object";

const tmpCameraPosition = new Vector3();

const FAILED_SECTOR_RETRY_MS = 30_000;
const RETIRED_SECTOR_DISPOSE_MS = 30_000;
const SECTOR_WORLD_SIZE = 256 * 128;

/**
 * Streams the world in and out around the camera. All ue2 asset decoding happens in
 * the decode worker (its own webpack bundle) - this side only ever sees plain decoded
 * data and instantiates three.js objects from it.
 */
class AssetManager {
    protected isTicking: boolean = false;
    protected loadSettings: GD.LoadSettings_T;
    protected glCapabilities: WebGLCapabilities
    protected decodeWorker: DecodeWorkerClient = null;
    protected isWorkerReady = false;
    protected failedSectors = new Map<string, number>(); // sector id -> retry-after timestamp
    protected retiredSectors = new Map<string, { sector: SectorObject, retiredAt: number }>(); // hidden, awaiting disposal
    protected readonly levelSectors = new Set<string>(); // sector ids that have a level package

    /**
     * Sectors whose bounds intersect this radius around the camera get loaded. At half
     * a sector this needs at most 4 sectors (own + up to 3 at a corner); unloading only
     * kicks in past the larger radius so boundary crossings don't thrash.
     */
    protected readonly renderDistance = SECTOR_WORLD_SIZE / 2;
    protected readonly unloadDistance = SECTOR_WORLD_SIZE;

    public constructor(loadSettings: GD.LoadSettings_T, assetList: Record<string, string>) {
        this.loadSettings = loadSettings;

        /* level packages are <x>_<y>.unr - keep the sector ids for map-edge validity checks */
        for (const path of Object.keys(assetList)) {
            if (!path.endsWith(".unr")) continue;

            this.levelSectors.add(path.slice(path.lastIndexOf("/") + 1, -".unr".length));
        }
    }

    public hasSector(sectorIdx: string): boolean {
        return this.levelSectors.has(sectorIdx.toLowerCase());
    }

    public async initialize(renderManager: RenderManager): Promise<void> {
        this.glCapabilities = renderManager.renderer.capabilities;

        /* everything below comes out of the decode worker - the app cannot run without it */
        this.decodeWorker = new DecodeWorkerClient();
        await this.decodeWorker.ready;
        this.isWorkerReady = true;

        const envInfo = await this.decodeWorker.decodeEnv();
        const musicInfo = await this.decodeWorker.getMusicInfo();
        const skyLibrary = await this.decodeWorker.decodeSector("skylevel", {
            ...this.loadSettings, isSkyLevel: true,
            loadTerrain: true,
            loadBaseModel: true,
            loadStaticModels: false,
            loadEmitters: false,
            loadStaticModelList: undefined,
            loadAudio: false,
            batching: { staticMeshes: false, terrain: false }
        });

        skyLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();

        renderManager.setEnv(decodeEnv(envInfo));
        renderManager.setSky(decodePackage(skyLibrary));
        renderManager.audioManager.setMusicInfo(musicInfo);
    }

    public async setAlwaysLoaded(renderManager: RenderManager, sectorName: string) {
        const decodeLibrary = await this.decodeWorker.decodeSector(sectorName, this.loadSettings);

        decodeLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();

        const sector = decodePackage(decodeLibrary);

        sector.neverUnload = true;
        renderManager.addSector(sector);
    }

    /**
     * Decodes the sector in the worker; only the three.js instantiation (decodePackage)
     * runs here. Returns true when a load was attempted (successfully or not), false
     * when the sector was skipped (failure cooldown, worker not available).
     */
    protected async requestSector(renderManager: RenderManager, sectorIdx: string): Promise<boolean> {
        const retired = this.retiredSectors.get(sectorIdx);

        if (retired) {
            /* still in its disposal grace period - reuse it as is, no re-decode */
            this.retiredSectors.delete(sectorIdx);
            renderManager.addSector(retired.sector);
            return true;
        }

        const retryAt = this.failedSectors.get(sectorIdx);

        if (retryAt !== undefined && performance.now() < retryAt) return false;

        if (!this.isWorkerReady || this.decodeWorker.isDead) return false;

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

    /**
     * Hides the sector immediately but keeps it (and its package refcounts) intact for
     * RETIRED_SECTOR_DISPOSE_MS - returning within that window re-adds the retained
     * object with no re-decode. destroyExpiredSectors does the real cleanup afterwards.
     */
    protected retireSector(renderManager: RenderManager, sector: SectorObject) {
        const sectorIdx = `${sector.index.x}_${sector.index.y}`;

        console.log(`Retiring sector '${sectorIdx}'.`);

        renderManager.removeSector(sector);
        this.retiredSectors.set(sectorIdx, { sector, retiredAt: performance.now() });
    }

    /**
     * Disposes retired sectors past their grace period and releases the package
     * refcounts they took in the decode worker.
     */
    protected destroyExpiredSectors(renderManager: RenderManager) {
        const now = performance.now();

        for (const [sectorIdx, { sector, retiredAt }] of this.retiredSectors) {
            if (now - retiredAt < RETIRED_SECTOR_DISPOSE_MS) continue;

            console.log(`Disposing sector '${sectorIdx}'.`);

            this.retiredSectors.delete(sectorIdx);
            renderManager.disposeSector(sector);

            this.decodeWorker?.freeSector(sectorIdx);
        }
    }

    public async tick(renderManager: RenderManager) {
        if (this.isTicking) return; // avoid too many ticks running at the same time as the tick is done on before render so we defer sector loading

        try {
            this.isTicking = true;

            const cameraPosition = renderManager.camera.getWorldPosition(tmpCameraPosition);
            const [sx, sy] = renderManager.getSectorId(cameraPosition);
            const originIdx = `${sx}_${sy}`;
            const sectorsLoaded = renderManager.getLoadedSectors();
            const sectorsLoadedIds = sectorsLoaded.map(({ index }) => `${index.x}_${index.y}`)
            const isValidOrigin = this.hasSector(originIdx);

            /*
             * Retire sectors past the unload radius; the gap between renderDistance and
             * unloadDistance keeps boundary crossings from thrashing. Retired sectors
             * stay reusable for a grace period before actually being disposed.
             */
            for (const sector of sectorsLoaded) {
                if (sector.neverUnload || !sector.index) continue;
                if (sectorDistance(cameraPosition, sector.index.x, sector.index.y) <= this.unloadDistance) continue;

                this.retireSector(renderManager, sector);
            }

            this.destroyExpiredSectors(renderManager);

            /*
             * Sectors wanted this tick, most-important first: the sector the camera is
             * in, then any sector whose bounds intersect renderDistance, nearest-first.
             * Only one is requested per tick (isTicking stays up while it decodes), so
             * the origin always wins and the rest trickle in one by one; recomputing the
             * list every tick makes crossing a boundary re-prioritize the new origin.
             */
            const sectorsToLoad: string[] = [];

            if (isValidOrigin && !sectorsLoadedIds.includes(originIdx))
                sectorsToLoad.push(originIdx);

            const ring = Math.ceil(this.renderDistance / SECTOR_WORLD_SIZE);
            const neighbours: { idx: string, dist: number }[] = [];

            for (let x = sx - ring, xmax = sx + ring; x <= xmax; x++) {
                for (let y = sy - ring, ymax = sy + ring; y <= ymax; y++) {
                    const levelIdx = `${x}_${y}`;

                    if (levelIdx === originIdx || !this.hasSector(levelIdx))
                        continue; // skip origin and invalid sectors

                    if (sectorsLoadedIds.includes(levelIdx)) continue;

                    const dist = sectorDistance(cameraPosition, x, y);

                    if (dist <= this.renderDistance)
                        neighbours.push({ idx: levelIdx, dist });
                }
            }

            neighbours.sort((a, b) => a.dist - b.dist);
            sectorsToLoad.push(...neighbours.map(n => n.idx));

            for (const secIdx of sectorsToLoad) {
                if (await this.requestSector(renderManager, secIdx))
                    break; // one sector per tick - the rest re-enter the list next tick
            }
        } finally {
            this.isTicking = false;
        }
    }
}

export default AssetManager;
export { AssetManager };

/**
 * Distance from the camera to a sector's bounds (0 inside it), using the same
 * sector -> world mapping as RenderManager.getSectorId.
 */
function sectorDistance(cameraPosition: THREE.Vector3, x: number, y: number): number {
    const minX = (x - 20) * SECTOR_WORLD_SIZE, maxX = minX + SECTOR_WORLD_SIZE;
    const minY = (y - 18) * SECTOR_WORLD_SIZE, maxY = minY + SECTOR_WORLD_SIZE;

    const dx = Math.max(minX - cameraPosition.x, 0, cameraPosition.x - maxX);
    const dy = Math.max(minY - cameraPosition.y, 0, cameraPosition.y - maxY);

    return Math.sqrt(dx * dx + dy * dy);
}
