import AssetLoader from "@client/assets/asset-loader";
import UConfigEnv from "@unreal/conf-files/un-conf-env";
import UDataFile from "@unreal/datafile/un-datafile";
import { SCHEMA_MUSICINFO_DAT } from "@unreal/datafile/schema/schema-types";
import { buildStaticMeshBatchData } from "@client/assets/decoders/batch-data";
import { convertDDSMaterialsToRGBA } from "@client/assets/decoders/dxt-decode";
import buildDecodeLibrary from "./build-decode-library";
import prepareLibraryForTransfer from "./collect-transferables";
import { loadCachedLibrary, storeCachedLibrary, sweepDecodeCache, refreshSoundBlobUris } from "./decode-cache";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./decode-protocol";

/**
 * Dedicated worker that owns its own AssetLoader (packages are shared with the main
 * thread at the OPFS file level, not in memory) and runs the full sector decode -
 * deserialization, decode-info generation, batch merging and DXT->RGBA conversion -
 * then transfers the plain-data DecodeLibrary back to the main thread.
 */

const ctx = self as any;

/* webpack-dev-server injects its live-reload client into this worker too (target
   "webworker" counts as a web target), and WorkerLocation has no reload() - without
   this it throws uncaught on every save */
if (typeof ctx.location.reload !== "function") {
    ctx.location.reload = () => { };
}

let assetLoader: AssetLoader = null;
let hasSweptCache = false;

function post(message: WorkerToMainMessage, transfer?: Transferable[]) {
    ctx.postMessage(message, transfer ?? []);
}

async function initialize(): Promise<void> {
    const assetList = await (await fetch("asset-list.json")).json();

    assetLoader = await AssetLoader.Instantiate(assetList.supported);

    /* same bootstrap AssetManager.initialize performs before any level decode */
    await assetLoader.using(assetLoader.getNativePackage(), { neverUnload: true });
    const pkgCore = await assetLoader.using(assetLoader.getCorePackage(), { neverUnload: true });
    await assetLoader.using(assetLoader.getEnginePackage(), { neverUnload: true });

    pkgCore.loadNativeClasses();
}

/**
 * Every ArrayBuffer of a package decoded so far - used by the transfer walk to make
 * sure no library value ever transfers (= detaches) a package buffer.
 */
function collectPackageBuffers(): Set<ArrayBuffer> {
    const buffers = new Set<ArrayBuffer>();

    for (const path of (assetLoader as any).pkgDependencies.keys()) {
        try {
            const buffer = (assetLoader.getPackage(path) as any)?.buffer;

            if (buffer instanceof ArrayBuffer) buffers.add(buffer);
        } catch (e) { } // path not resolvable - nothing to exclude
    }

    return buffers;
}

async function decodeSector(sectorName: string, settings: GD.LoadSettings_T): Promise<{ library: any, fromCache: boolean }> {
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

    const pkg = await assetLoader.using(assetLoader.getPackage(sectorName, "Level"));
    const library = buildDecodeLibrary(pkg, settings);

    buildStaticMeshBatchData(library);

    /*
     * Sanitize before caching so the cache only ever sees plain data; this pass's
     * transfer list is discarded (the DXT conversion below swaps texture buffers).
     * storeCachedLibrary serializes now and writes in the background.
     */
    prepareLibraryForTransfer(library, collectPackageBuffers());

    if (cacheable) storeCachedLibrary(sectorName, settings, library);

    if (convertToRGBA) convertDDSMaterialsToRGBA(library);

    return { library, fromCache: false };
}

async function handleMessage(msg: MainToWorkerMessage) {
    switch (msg.type) {
        case "init": {
            try {
                await initialize();
                post({ type: "ready" });
            } catch (e) {
                console.error("[decode-worker] initialization failed:", e);
                post({ type: "init-error", message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
        case "decode": {
            try {
                if (!hasSweptCache) {
                    hasSweptCache = true;
                    void sweepDecodeCache(msg.settings);
                }

                console.log(`[decode-worker] decoding sector '${msg.sectorName}'`);

                const start = performance.now();
                const { library, fromCache } = await decodeSector(msg.sectorName, msg.settings);
                const transfer = prepareLibraryForTransfer(library, collectPackageBuffers());

                console.log(`[decode-worker] sector '${msg.sectorName}' decoded in ${(performance.now() - start).toFixed(0)}ms${fromCache ? " (from cache)" : ""} (${transfer.length} buffers transferred)`);

                post({ type: "decoded", requestId: msg.requestId, library }, transfer);
            } catch (e) {
                console.error(`[decode-worker] failed to decode sector '${msg.sectorName}':`, e);
                post({ type: "decode-error", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "free": {
            try {
                assetLoader.free(assetLoader.getPackage(msg.sectorName, "Level"));
            } catch (e) { } // sector was decoded from cache - its packages were never loaded here
            break;
        }
        case "decode-env": {
            try {
                const info = await decodeEnvConfig();
                const transfer = prepareLibraryForTransfer(info, collectPackageBuffers());

                post({ type: "env-decoded", requestId: msg.requestId, info }, transfer);
            } catch (e) {
                console.error("[decode-worker] failed to decode env config:", e);
                post({ type: "decode-error", requestId: msg.requestId, message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
        case "music-info": {
            try {
                post({ type: "music-info-decoded", requestId: msg.requestId, music: await decodeMusicInfo() });
            } catch (e) {
                console.error("[decode-worker] failed to decode music info:", e);
                post({ type: "decode-error", requestId: msg.requestId, message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
    }
}

async function decodeEnvConfig(): Promise<any> {
    const pkgL2Skies = await assetLoader.using(assetLoader.getPackage("l2_skies", "Texture"), { neverUnload: true });
    const envFile = await (new UConfigEnv("assets/system/env.int").asReadable()).decode();
    const envConfig = await envFile.load(assetLoader.getNativePackage(), assetLoader.getEnginePackage(), pkgL2Skies);

    return envConfig.getDecodeInfo();
}

async function decodeMusicInfo(): Promise<Record<number, string[]>> {
    const file = await (new UDataFile(SCHEMA_MUSICINFO_DAT, "assets/system/musicinfo.dat").asReadable()).decode();

    return Object.fromEntries(file.datarows.map((row: any) => [
        row.id,
        (row.sounds as string[]).map(sound => assetLoader.getPackage(sound, "Music").path)
    ]));
}

/* process messages strictly in order - a decode must not start before init finishes */
let queue: Promise<void> = Promise.resolve();

function onMessage(event: MessageEvent<MainToWorkerMessage>) {
    queue = queue.then(handleMessage.bind(null, event.data));
}

ctx.onmessage = onMessage;
