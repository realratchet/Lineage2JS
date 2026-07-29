import AssetLoader from "@client/assets/asset-loader";
import UConfigEnv from "@unreal/conf-files/un-conf-env";
import UDataFile from "@unreal/datafile/un-datafile";
import { SCHEMA_MUSICINFO_DAT } from "@unreal/datafile/schema/schema-types";
import { buildStaticMeshBatchData } from "@client/assets/decoders/batch-data";
import { convertDDSMaterialsToRGBA } from "@client/assets/decoders/dxt-decode";
import buildDecodeLibrary from "./build-decode-library";
import prepareLibraryForTransfer from "./collect-transferables";
import { hasCachedLibrary, loadCachedLibrary, loadCachedLibraryBuffer, storeCachedLibrary, storeCachedLibraryDurable, storeCachedLibraryBufferDurable, sweepDecodeCache, refreshSoundBlobUris } from "./decode-cache";
import { serializeLibrary, deserializeLibrary } from "./library-serializer";
import type { PrecacheResult_T } from "./decode-protocol";

type BinarySector_T = { buffer: ArrayBuffer, fromCache: boolean };

/**
 * Owns an AssetLoader and runs the full sector decode - deserialization, decode-info
 * generation, batch merging and DXT->RGBA conversion. Used by decode.worker.ts (message
 * driven, its own webpack bundle) and directly by DecodeWorkerClient on the main thread
 * when its pool size is 0, so a decode can be stepped through in regular devtools
 * instead of a worker context.
 */
class DecodeEngine {
    protected assetLoader: AssetLoader = null;
    protected hasSweptCache = false;

    public async initialize(): Promise<void> {
        const assetList = await (await fetch("asset-list.json")).json();

        this.assetLoader = await AssetLoader.Instantiate(assetList.supported);

        /* same bootstrap AssetManager.initialize performs before any level decode */
        await this.assetLoader.using(this.assetLoader.getNativePackage(), { neverUnload: true });
        const pkgCore = await this.assetLoader.using(this.assetLoader.getCorePackage(), { neverUnload: true });
        await this.assetLoader.using(this.assetLoader.getEnginePackage(), { neverUnload: true });

        pkgCore.loadNativeClasses();
    }

    /**
     * Every ArrayBuffer of a package decoded so far - used by the transfer walk to make
     * sure no library value ever transfers (= detaches) a package buffer.
     */
    protected collectPackageBuffers(): Set<ArrayBuffer> {
        const buffers = new Set<ArrayBuffer>();

        for (const packages of (this.assetLoader as any).packages.values()) {
            for (const pkg of packages.values()) {
                const buffer = (pkg as any).buffer;

                if (buffer instanceof ArrayBuffer) buffers.add(buffer);
            }
        }

        return buffers;
    }

    public async decodeSector(sectorName: string, settings: GD.LoadSettings_T): Promise<{ library: any, fromCache: boolean }> {
        if (!this.hasSweptCache) {
            await sweepDecodeCache(settings);
            this.hasSweptCache = true;
        }

        console.log(`[decode] decoding sector '${sectorName}'`);

        const start = performance.now();
        const result = await this.decodeSectorCore(sectorName, settings);

        console.log(`[decode] sector '${sectorName}' decoded in ${(performance.now() - start).toFixed(0)}ms${result.fromCache ? " (from cache)" : ""}`);

        return result;
    }

    public async decodeSectorBinary(sectorName: string, settings: GD.LoadSettings_T): Promise<BinarySector_T> {
        if (!this.hasSweptCache) {
            await sweepDecodeCache(settings);
            this.hasSweptCache = true;
        }

        console.log(`[decode] decoding sector '${sectorName}'`);

        const start = performance.now();
        const result = await this.decodeSectorBinaryCore(sectorName, settings);

        console.log(`[decode] sector '${sectorName}' decoded in ${(performance.now() - start).toFixed(0)}ms${result.fromCache ? " (from cache)" : ""}`);

        return result;
    }

    public async precacheSector(sectorName: string, settings: GD.LoadSettings_T): Promise<PrecacheResult_T> {
        if (!this.hasSweptCache) {
            await sweepDecodeCache(settings);
            this.hasSweptCache = true;
        }

        if (await hasCachedLibrary(sectorName, settings))
            return { cached: true, bytes: 0 };

        try {
            const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
            const library = buildDecodeLibrary(pkg, sectorName, settings);

            buildStaticMeshBatchData(library);
            prepareLibraryForTransfer(library, this.collectPackageBuffers());

            return { cached: false, bytes: await storeCachedLibraryDurable(sectorName, settings, library) };
        } finally {
            this.freeSector(sectorName);
        }
    }

    protected async decodeSectorCore(sectorName: string, settings: GD.LoadSettings_T): Promise<{ library: any, fromCache: boolean }> {
        const convertToRGBA = (settings as any).rgbaTextures !== false; // false = client uploads DDS as-is (s3tc)

        // never cache the skylevel, sky renderer matches its sections against env config
        // material uuids which are session-random - a cached skylevel never matches
        const cacheable = !(settings as any).isSkyLevel;

        const cached = cacheable ? await loadCachedLibrary(sectorName, settings) : null;

        if (cached) {
            if (convertToRGBA) convertDDSMaterialsToRGBA(cached); /* the cache stores DDS (4-8x smaller than RGBA) */
            refreshSoundBlobUris(cached);                         /* blob URLs are session-scoped */

            return { library: cached, fromCache: true };
        }

        const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
        const library = buildDecodeLibrary(pkg, sectorName, settings);

        buildStaticMeshBatchData(library);

        /*
         * Sanitize before caching so the cache only ever sees plain data; this pass's
         * transfer list is discarded (the DXT conversion below swaps texture buffers).
         * storeCachedLibrary serializes now and writes in the background.
         */
        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if (cacheable) storeCachedLibrary(sectorName, settings, library);

        if (convertToRGBA) convertDDSMaterialsToRGBA(library);

        return { library, fromCache: false };
    }

    protected async decodeSectorBinaryCore(sectorName: string, settings: GD.LoadSettings_T): Promise<BinarySector_T> {
        const convertToRGBA = (settings as any).rgbaTextures !== false;
        const cacheable = !(settings as any).isSkyLevel;
        const cachedBuffer = cacheable ? await loadCachedLibraryBuffer(sectorName, settings) : null;

        if (cachedBuffer) {
            if (!convertToRGBA) return { buffer: cachedBuffer, fromCache: true };

            const library = deserializeLibrary(cachedBuffer);

            convertDDSMaterialsToRGBA(library);

            return { buffer: serializeLibrary(library).buffer as ArrayBuffer, fromCache: true };
        }

        const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
        const library = buildDecodeLibrary(pkg, sectorName, settings);

        buildStaticMeshBatchData(library);
        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        let buffer: ArrayBuffer = null;

        if (cacheable) {
            buffer = serializeLibrary(library).buffer as ArrayBuffer;
            await storeCachedLibraryBufferDurable(sectorName, settings, buffer);
        }

        if (convertToRGBA) {
            buffer = null;
            convertDDSMaterialsToRGBA(library);
        }

        if (!buffer) buffer = serializeLibrary(library).buffer as ArrayBuffer;

        return { buffer, fromCache: false };
    }

    public freeSector(sectorName: string) {
        try {
            this.assetLoader.free(this.assetLoader.getPackage(sectorName, "Level"));
        } catch (e) { } // sector was decoded from cache - its packages were never loaded here
    }

    public async decodeEnvConfig(): Promise<any> {
        const pkgL2Skies = await this.assetLoader.using(this.assetLoader.getPackage("l2_skies", "Texture"), { neverUnload: true });
        const envFile = await (new UConfigEnv("assets/system/env.int").asReadable()).decode();
        const envConfig = await envFile.load(this.assetLoader.getNativePackage(), this.assetLoader.getEnginePackage(), pkgL2Skies);

        return envConfig.getDecodeInfo();
    }

    public async decodeMusicInfo(): Promise<Record<number, string[]>> {
        const file = await (new UDataFile(SCHEMA_MUSICINFO_DAT, "assets/system/musicinfo.dat").asReadable()).decode();

        return Object.fromEntries(file.datarows.map((row: any) => [
            row.id,
            (row.sounds as string[]).map(sound => this.assetLoader.getPackage(sound, "Music").path)
        ]));
    }

    /* postMessage transfer list for a value already produced by this engine - the sanitize
       pass inside decodeSectorCore already ran, this only needs to (re)walk for buffers */
    public collectTransferables(value: any): ArrayBuffer[] {
        return prepareLibraryForTransfer(value, this.collectPackageBuffers());
    }
}

export default DecodeEngine;
export { DecodeEngine };
