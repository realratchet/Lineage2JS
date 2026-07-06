import AssetLoader from "@client/assets/asset-loader";
import DecodeLibrary from "@client/assets/unreal/decode-library";
import { buildStaticMeshBatchData } from "@client/assets/decoders/batch-data";
import { convertDDSMaterialsToRGBA } from "@client/assets/decoders/dxt-decode";
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
    const cached = await loadCachedLibrary(sectorName, settings);

    if (cached) {
        convertDDSMaterialsToRGBA(cached); /* the cache stores DDS (4-8x smaller than RGBA) */
        refreshSoundBlobUris(cached);      /* blob URLs are session-scoped */

        return { library: cached, fromCache: true };
    }

    const pkg = await assetLoader.using(assetLoader.getPackage(sectorName, "Level"));
    const library = DecodeLibrary.fromPackage(pkg, settings);

    buildStaticMeshBatchData(library);

    /*
     * Sanitize before caching so the cache only ever sees plain data; this pass's
     * transfer list is discarded (the DXT conversion below swaps texture buffers).
     * storeCachedLibrary serializes now and writes in the background.
     */
    prepareLibraryForTransfer(library, collectPackageBuffers());
    storeCachedLibrary(sectorName, settings, library);

    convertDDSMaterialsToRGBA(library);

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
                post({ type: "decode-error", requestId: msg.requestId, message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
    }
}

/* process messages strictly in order - a decode must not start before init finishes */
let queue: Promise<void> = Promise.resolve();

function onMessage(event: MessageEvent<MainToWorkerMessage>) {
    queue = queue.then(handleMessage.bind(null, event.data));
}

ctx.onmessage = onMessage;
