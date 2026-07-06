import DecodeLibrary from "@client/assets/unreal/decode-library";
import type { WorkerToMainMessage } from "./decode-protocol";

interface PendingRequest {
    resolve(library: DecodeLibrary): void;
    reject(error: Error): void;
}

/**
 * Main-thread handle to the decode worker: init handshake, one promise per decode
 * request, dead-worker detection (AssetManager falls back to synchronous main-thread
 * decoding when `isDead`).
 */
class DecodeWorkerClient {
    protected worker: Worker;
    protected pending = new Map<number, PendingRequest>();
    protected nextRequestId = 1;

    protected readyResolve: () => void;
    protected readyReject: (error: Error) => void;

    public readonly ready: Promise<void>;
    public isDead = false;

    public constructor() {
        this.ready = new Promise<void>((resolve, reject) => {
            this.readyResolve = resolve;
            this.readyReject = reject;
        });

        this.worker = new Worker(new URL("./decode.worker.ts", import.meta.url), { name: "sector-decode" });
        this.worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => this.onMessage(event.data);
        this.worker.onerror = event => this.onWorkerDead(new Error(`decode worker crashed: ${event.message ?? "unknown error"}`));
        this.worker.onmessageerror = () => this.onWorkerDead(new Error("decode worker message failed to deserialize"));

        this.worker.postMessage({ type: "init" });
    }

    public decodeSector(sectorName: string, settings: GD.LoadSettings_T): Promise<DecodeLibrary> {
        if (this.isDead) return Promise.reject(new Error("decode worker is dead"));

        const requestId = this.nextRequestId++;

        return new Promise<DecodeLibrary>((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject });
            this.worker.postMessage({ type: "decode", requestId, sectorName, settings });
        });
    }

    protected onMessage(msg: WorkerToMainMessage) {
        switch (msg.type) {
            case "ready": {
                this.readyResolve();
                break;
            }
            case "init-error": {
                this.isDead = true;
                this.readyReject(new Error(msg.message));
                break;
            }
            case "decoded": {
                const request = this.pending.get(msg.requestId);
                if (!request) break;

                this.pending.delete(msg.requestId);

                /* the library is plain data with no instance methods - restoring the prototype suffices */
                request.resolve(Object.setPrototypeOf(msg.library, DecodeLibrary.prototype) as DecodeLibrary);
                break;
            }
            case "decode-error": {
                const request = this.pending.get(msg.requestId);
                if (!request) break;

                this.pending.delete(msg.requestId);
                request.reject(new Error(msg.message));
                break;
            }
        }
    }

    protected onWorkerDead(error: Error) {
        this.isDead = true;
        this.readyReject(error); // no-op if already resolved

        for (const request of this.pending.values())
            request.reject(error);

        this.pending.clear();
        this.worker.terminate();
    }
}

export default DecodeWorkerClient;
export { DecodeWorkerClient };
