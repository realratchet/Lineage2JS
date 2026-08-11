import DecodeLibrary from "@client/assets/unreal/decode-library";
import type { WorkerToMainMessage, PrecacheResult_T } from "./decode-protocol";
import type DecodeEngine from "./decode-engine";
import { deserializeLibraryAsync } from "./library-serializer";
import { refreshSoundBlobUris } from "./decode-cache";
import getNpcBundleName from "./npc-bundle";

type PendingRequest_T = {
    resolve(value: any): void;
    reject(error: Error): void;
    workerIndex: number;
};

type WorkerSlot_T = {
    worker: Worker;
    isDead: boolean;
    inFlight: number;
    readyResolve(): void;
    readyReject(error: Error): void;
};

type BinaryDecodeRequest_T = { buffer: ArrayBuffer, request: PendingRequest_T };

async function waitForWorkers(promises: Promise<void>[]): Promise<void> {
    await Promise.all(promises);
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
 *
 * poolSize 0 skips the Worker pool entirely and runs a single DecodeEngine in-process
 * instead, loaded via dynamic import - a dev-only knob for stepping through a decode in
 * the normal main-thread devtools instead of a worker context.
 */
class DecodeWorkerClient {
    protected slots: WorkerSlot_T[] = [];
    protected pending = new Map<number, PendingRequest_T>();
    protected nextRequestId = 1;
    protected sectorWorker = new Map<string, number>(); // sector -> worker that decoded it
    protected characterWorker = new Map<number, number>();
    protected npcWorker = new Map<string, number>();
    protected mainThreadEngine: DecodeEngine = null;
    protected characterAnimationSets = new Set<number>();
    protected npcAnimationSets = new Set<string>();
    protected readonly binaryDecodeQueue: BinaryDecodeRequest_T[] = [];
    protected isDecodingBinary = false;

    public readonly ready: Promise<void>;

    public constructor(poolSize: number = 1) {
        if (poolSize === 0) {
            this.ready = this.initMainThread();
            return;
        }

        const readyPromises: Promise<void>[] = [];

        for (let i = 0; i < poolSize; i++) {
            const slot = { isDead: false, inFlight: 0 } as WorkerSlot_T;

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

        this.ready = waitForWorkers(readyPromises);
    }

    protected async initMainThread(): Promise<void> {
        const { DecodeEngine } = await import(/* webpackChunkName: "modules/decode-engine" */ "./decode-engine");

        this.mainThreadEngine = new DecodeEngine();
        await this.mainThreadEngine.initialize();
    }

    public get isDead(): boolean {
        if (this.mainThreadEngine) return false;

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

    protected pickCharacterWorker(stickyIndex?: number): number {
        if (stickyIndex !== undefined) {
            const slot = this.slots[stickyIndex];

            if (slot && !slot.isDead) return stickyIndex;
        }

        let best = -1, bestLoad = Infinity;

        for (let i = this.slots.length - 1; i >= 0; i--) {
            if (this.slots[i].isDead) continue;
            if (this.slots[i].inFlight < bestLoad) { best = i; bestLoad = this.slots[i].inFlight; }
        }

        return best;
    }

    public async decodeSector(sectorName: string, settings: GD.LoadSettings_T): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) {
            const { library } = await this.mainThreadEngine.decodeSector(sectorName, settings);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickWorker(this.sectorWorker.get(sectorName));

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        this.sectorWorker.set(sectorName, workerIndex);

        return this.dispatch(workerIndex, { type: "decode", sectorName, settings });
    }

    public precacheSector(sectorName: string, settings: GD.LoadSettings_T): Promise<PrecacheResult_T> {
        if (this.mainThreadEngine)
            return this.mainThreadEngine.precacheSector(sectorName, settings);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "precache", sectorName, settings });
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
        if (this.mainThreadEngine) {
            this.mainThreadEngine.freeSector(sectorName);
            return;
        }

        const workerIndex = this.sectorWorker.get(sectorName);

        if (workerIndex === undefined) return;

        const slot = this.slots[workerIndex];

        if (!slot || slot.isDead) return;

        slot.worker.postMessage({ type: "free", sectorName });
    }

    public decodeEnv(): Promise<any> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeEnvConfig();

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "decodeEnv" });
    }

    public async decodeCharacter(settings: GD.LoadSettings_T, charIndex: number = 1, faceVariant: number = 0, hairVariant: number = 0, hairColour: number = 0, armor: GD.ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 }): Promise<DecodeLibrary> {
        const includeAnimations = !this.characterAnimationSets.has(charIndex);

        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeCharacter(settings, charIndex, faceVariant, hairVariant, hairColour, armor, includeAnimations);

            this.characterAnimationSets.add(charIndex);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickCharacterWorker(this.characterWorker.get(charIndex));

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        this.characterWorker.set(charIndex, workerIndex);

        const library = await this.dispatch(workerIndex, { type: "decodeCharacter", settings, charIndex, faceVariant, hairVariant, hairColour, armor, includeAnimations });

        this.characterAnimationSets.add(charIndex);

        return library;
    }

    public async decodeSkeletalMesh(settings: GD.LoadSettings_T, packageName: string, meshName: string, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null): Promise<DecodeLibrary> {
        const bundleName = npcId === null ? null : getNpcBundleName(packageName);
        const animationSet = `${packageName}.${meshName}`.toLowerCase();
        const includeAnimations = npcId === null || !this.npcAnimationSets.has(animationSet);

        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeSkeletalMesh(settings, packageName, meshName, scriptClassPath, texturePaths, npcId, includeAnimations);

            if (npcId !== null) this.npcAnimationSets.add(animationSet);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = bundleName === null ? this.pickWorker() : this.pickCharacterWorker(this.npcWorker.get(bundleName));

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        if (bundleName !== null) this.npcWorker.set(bundleName, workerIndex);

        const library = await this.dispatch(workerIndex, { type: "decodeSkeletalMesh", settings, packageName, meshName, scriptClassPath, texturePaths, npcId, includeAnimations });

        if (npcId !== null) this.npcAnimationSets.add(animationSet);

        return library;
    }

    public resolveNpc(selector: string | number): Promise<GD.INpcDefinition> {
        if (this.mainThreadEngine) return this.mainThreadEngine.resolveNpc(selector);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "resolveNpc", selector });
    }

    public async precacheCharacters(settings: GD.LoadSettings_T): Promise<void> {
        if (this.mainThreadEngine) return this.mainThreadEngine.precacheCharacters(settings);

        const characterWorkers = new Set(this.characterWorker.values());
        let workerIndex = -1;

        for (let i = this.slots.length - 1; i >= 0; i--) {
            const slot = this.slots[i];

            if (!characterWorkers.has(i) && !slot.isDead && slot.inFlight === 0) {
                workerIndex = i;
                break;
            }
        }

        if (workerIndex < 0) workerIndex = this.pickWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "precacheCharacters", settings });
    }

    public async getCharGroups(): Promise<GD.ICharacterGroup[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeCharGroups();

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "charGroups" });
    }

    public getMusicInfo(): Promise<Record<number, string[]>> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeMusicInfo();

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "musicInfo" });
    }

    protected dispatch(workerIndex: number, message: any): Promise<any> {
        const requestId = this.nextRequestId++;

        this.slots[workerIndex].inFlight++;

        return new Promise((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject, workerIndex });
            this.slots[workerIndex].worker.postMessage({ ...message, requestId });
        });
    }

    protected settlePending(requestId: number): PendingRequest_T | undefined {
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
            case "initError": {
                this.slots[workerIndex].isDead = true;
                this.slots[workerIndex].readyReject(new Error(msg.message));
                break;
            }
            case "decoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                this.binaryDecodeQueue.push({ buffer: msg.buffer, request });
                void this.processBinaryDecodeQueue();
                break;
            }
            case "precached": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.result);
                break;
            }
            case "decodeError": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                const error = new Error(msg.message);

                if (msg.stack) error.stack = msg.stack; // worker-side stack, not this handler's

                request.reject(error);
                break;
            }
            case "envDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.info);
                break;
            }
            case "musicInfoDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.music);
                break;
            }
            case "charactersPrecached": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(undefined);
                break;
            }
            case "charGroupsDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.groups);
                break;
            }
            case "npcResolved": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.npc);
                break;
            }
        }
    }

    protected async processBinaryDecodeQueue(): Promise<void> {
        if (this.isDecodingBinary) return;

        this.isDecodingBinary = true;

        while (this.binaryDecodeQueue.length > 0) {
            const { buffer, request } = this.binaryDecodeQueue.shift();

            try {
                const library = await deserializeLibraryAsync(buffer);

                refreshSoundBlobUris(library);
                request.resolve(Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary);
            } catch (e) {
                request.reject(e as Error);
            }
        }

        this.isDecodingBinary = false;
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

    public terminate() {
        this.slots.forEach(slot => slot.worker.terminate());
    }
}

export default DecodeWorkerClient;
export { DecodeWorkerClient };
