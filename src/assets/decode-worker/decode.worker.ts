import DecodeEngine from "./decode-engine";
import type { MainToWorkerMessage, WorkerToMainMessage } from "./decode-protocol";

/**
 * Dedicated worker that wires a DecodeEngine up to postMessage. Packages are shared
 * with the main thread at the OPFS file level, not in memory - this file only handles
 * the message protocol, the engine owns the actual decode.
 */

const ctx = self as any;

/* webpack-dev-server injects its live-reload client into this worker too (target
   "webworker" counts as a web target), and WorkerLocation has no reload() - without
   this it throws uncaught on every save */
if (typeof ctx.location.reload !== "function") {
    ctx.location.reload = () => { };
}

const engine = new DecodeEngine();

function post(message: WorkerToMainMessage, transfer?: Transferable[]) {
    ctx.postMessage(message, transfer ?? []);
}

async function handleMessage(msg: MainToWorkerMessage) {
    switch (msg.type) {
        case "init": {
            try {
                await engine.initialize();
                post({ type: "ready" });
            } catch (e) {
                console.error("[decode-worker] initialization failed:", e);
                post({ type: "initError", message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
        case "decode": {
            try {
                const { library } = await engine.decodeSector(msg.sectorName, msg.settings);
                const transfer = engine.collectTransferables(library);

                post({ type: "decoded", requestId: msg.requestId, library }, transfer);
            } catch (e) {
                console.error(`[decode-worker] failed to decode sector '${msg.sectorName}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "precache": {
            try {
                post({ type: "precached", requestId: msg.requestId, result: await engine.precacheSector(msg.sectorName, msg.settings) });
            } catch (e) {
                console.error(`[decode-worker] failed to precache sector '${msg.sectorName}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "free": {
            engine.freeSector(msg.sectorName);
            break;
        }
        case "decodeEnv": {
            try {
                const info = await engine.decodeEnvConfig();
                const transfer = engine.collectTransferables(info);

                post({ type: "envDecoded", requestId: msg.requestId, info }, transfer);
            } catch (e) {
                console.error("[decode-worker] failed to decode env config:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
        case "musicInfo": {
            try {
                post({ type: "musicInfoDecoded", requestId: msg.requestId, music: await engine.decodeMusicInfo() });
            } catch (e) {
                console.error("[decode-worker] failed to decode music info:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e) });
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
