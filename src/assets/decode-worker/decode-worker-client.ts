import DecodeLibrary from "@client/assets/unreal/decode-library";
import type { WorkerToMainMessage } from "./decode-protocol";

interface PendingRequest {
    resolve(value: any): void;
    reject(error: Error): void;
    workerIndex: number;
}

interface WorkerSlot {
    worker: Worker;
    isDead: boolean;
    inFlight: number;
    readyResolve(): void;
    readyReject(error: Error): void;
}

/**
 * Main-thread handle to a pool of decode workers: init handshake per worker, one
 * promise per decode request (routed to the least-busy live worker), dead-worker
 * detection per slot (isDead only once every worker in the pool has died - AssetManager
 * falls back to a retry cooldown in that case).
 *
 * A pool exists so a slow/stale in-flight decode for a sector the camera has already
 * moved past can't block a newly-urgent sector behind it - each sector still routes to
 * whichever single worker decoded it (freeSector needs that worker specifically, since
 * package refcounts are per-worker, not shared).
 */
class DecodeWorkerClient {
    protected slots: WorkerSlot[] = [];
    protected pending = new Map<number, PendingRequest>();
    protected nextRequestId = 1;
    protected sectorWorker = new Map<string, number>(); // sector -> worker that decoded it

    public readonly ready: Promise<void>;

    public constructor(poolSize: number = 1) {
        const readyPromises: Promise<void>[] = [];

        for (let i = 0; i < poolSize; i++) {
            const slot = { isDead: false, inFlight: 0 } as WorkerSlot;

            readyPromises.push(new Promise<void>((resolve, reject) => {
                slot.readyResolve = resolve;
                slot.readyReject = reject;
            }));

            /* built as its own webpack compilation - the renderer bundle carries no ue2 code */
            const worker = new Worker("decode-worker.bundle.js", { name: `sector-decode-${i}` });

            slot.worker = worker;
            worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => this.onMessage(i, event.data);
            worker.onerror = event => this.onWorkerDead(i, new Error(`decode worker crashed: ${event.message ?? "unknown error"}`));
            worker.onmessageerror = () => this.onWorkerDead(i, new Error("decode worker message failed to deserialize"));

            worker.postMessage({ type: "init" });

            this.slots.push(slot);
        }

        this.ready = Promise.all(readyPromises).then(() => { });
    }

    public get isDead(): boolean {
        return this.slots.every(slot => slot.isDead);
    }

    protected pickWorker(stickyIndex?: number): number {
        // reuse the worker that last decoded this sector if it's sitting idle - it likely
        // still has shared dependency packages warm in memory, which isn't shared across
        // workers. Only when idle though: forcing a busy worker would reintroduce the
        // head-of-line blocking a boundary crossing needs the pool to avoid
        if (stickyIndex !== undefined) {
            const slot = this.slots[stickyIndex];
            if (slot && !slot.isDead && slot.inFlight === 0) return stickyIndex;
        }

        let best = -1, bestLoad = Infinity;

        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i].isDead) continue;
            if (this.slots[i].inFlight < bestLoad) { best = i; bestLoad = this.slots[i].inFlight; }
        }

        return best;
    }

    public decodeSector(sectorName: string, settings: GD.LoadSettings_T): Promise<DecodeLibrary> {
        const workerIndex = this.pickWorker(this.sectorWorker.get(sectorName));

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        this.sectorWorker.set(sectorName, workerIndex);

        return this.dispatch(workerIndex, { type: "decode", sectorName, settings });
    }

    /**
     * Releases the worker-side package refcounts a decoded sector took (fire-and-forget).
     * Routed to whichever worker actually decoded it - refcounts aren't shared across the
     * pool. The sectorWorker entry is intentionally kept (not deleted): a later re-decode
     * of this sector still prefers that worker in pickWorker, since shared dependency
     * packages it didn't just free may still be warm there. Bounded by the sector count
     * (~142), not worth pruning.
     */
    public freeSector(sectorName: string) {
        const workerIndex = this.sectorWorker.get(sectorName);

        if (workerIndex === undefined) return;

        const slot = this.slots[workerIndex];

        if (!slot || slot.isDead) return;

        slot.worker.postMessage({ type: "free", sectorName });
    }

    public decodeEnv(): Promise<any> {
        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "decode-env" });
    }

    public getMusicInfo(): Promise<Record<number, string[]>> {
        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "music-info" });
    }

    protected dispatch(workerIndex: number, message: any): Promise<any> {
        const requestId = this.nextRequestId++;

        this.slots[workerIndex].inFlight++;

        return new Promise((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject, workerIndex });
            this.slots[workerIndex].worker.postMessage({ ...message, requestId });
        });
    }

    protected settlePending(requestId: number): PendingRequest | undefined {
        const request = this.pending.get(requestId);

        if (!request) return undefined;

        this.pending.delete(requestId);
        this.slots[request.workerIndex].inFlight--;

        return request;
    }

    protected onMessage(workerIndex: number, msg: WorkerToMainMessage) {
        switch (msg.type) {
            case "ready": {
                this.slots[workerIndex].readyResolve();
                break;
            }
            case "init-error": {
                this.slots[workerIndex].isDead = true;
                this.slots[workerIndex].readyReject(new Error(msg.message));
                break;
            }
            case "decoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                /* the library is plain data with no instance methods - restoring the prototype suffices */
                request.resolve(Object.setPrototypeOf(msg.library, DecodeLibrary.prototype) as DecodeLibrary);
                break;
            }
            case "decode-error": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                const error = new Error(msg.message);

                if (msg.stack) error.stack = msg.stack; // worker-side stack, not this handler's

                request.reject(error);
                break;
            }
            case "env-decoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.info);
                break;
            }
            case "music-info-decoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.music);
                break;
            }
        }
    }

    protected onWorkerDead(workerIndex: number, error: Error) {
        const slot = this.slots[workerIndex];

        slot.isDead = true;
        slot.readyReject(error); // no-op if already resolved

        for (const [requestId, request] of this.pending) {
            if (request.workerIndex !== workerIndex) continue;

            this.pending.delete(requestId);
            request.reject(error);
        }

        slot.worker.terminate();
    }
}

export default DecodeWorkerClient;
export { DecodeWorkerClient };
