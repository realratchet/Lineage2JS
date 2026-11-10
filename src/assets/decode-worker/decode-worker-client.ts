import DecodeLibrary from "@l2js/engine/decode-library";
import type { GameStrings_T, MatineeScene_T, UITexture_T, PlayerSkillInfo_T, WorkerToMainMessage_T, PrecacheResult_T, ClientConfig_T, WorkerMemoryStats_T, ConfirmSharedScriptMessage_T } from "./decode-protocol";
import type { LocalizationProperty_T, LoadSettings_T } from "@l2js/engine/contracts/config";
import type { ICharacterArmorSelection, INpcDefinition, ICharacterGroup, ICharacterEquipment, INpcEquipment } from "@l2js/engine/contracts/pawn";
import type DecodeEngine from "./decode-engine";
import { deserializeLibraryAsync } from "./library-serializer";
import { hasCachedLibrary } from "./decode-cache";
import { isCacheEnabled } from "./cache-storage";
import { refreshSoundBlobUris } from "../sound-uris";
import getNpcBundleName from "./npc-bundle";
import requestWebLock from "../web-lock";
import { getAssetSourceId, getAssetFiles, getServedAssets } from "../asset-source";
import { beginLoadingProfile, assignLoadingProfile, updateLoadingProfile, finishLoadingProfile, printLoadingProfile } from "../../loading-profile";

const cacheScript = { scriptClasses: new Map<string, any>(), scriptFunctions: new Map<string, any>(), scriptStates: new Map<string, any>(), scriptObjects: new Map<string, any>() };
type SharedSound_T = { key: string, data: Uint8Array | Blob, mimeType: string, refs: number };
type CharacterAnimationSet_T = { library: WeakRef<DecodeLibrary>, pending: Promise<void> };
const cacheSounds = new Map<string, SharedSound_T>();
const cacheTextureBuffers = new Map<string, ArrayBuffer>();
const cacheTextureIds = new WeakMap<ArrayBuffer, Set<string>>();
const clients = new Set<DecodeWorkerClient>();
const DECODE_PACKAGE_SWEEP_MS = 5000;
let nextProfileWorker = 1;
const pendingTextureDisposals = new Set<ArrayBuffer>();
const pendingSoundDisposals = new Set<SharedSound_T>();
const soundFinalizer = new FinalizationRegistry<SharedSound_T>(sound => {
    if (--sound.refs < 0) throw new Error(`Invalid sound reference count for '${sound.key}'.`);
    if (sound.refs) return;

    pendingSoundDisposals.add(sound);
    releaseDisposedSounds();
});

function releaseDisposedSounds(): void {
    if ([...clients].some(client => client.hasPendingAssets())) return;

    const forgotten: string[] = [];

    for (const sound of pendingSoundDisposals) {
        if (sound.refs || cacheSounds.get(sound.key) !== sound) continue;

        cacheSounds.delete(sound.key);
        forgotten.push(sound.key);
    }
    pendingSoundDisposals.clear();

    for (const client of clients) client.forgetSharedSounds(forgotten);
}

function releaseDisposedTextures(): void {
    if ([...clients].some(client => client.hasPendingAssets())) return;

    const buffers = [...pendingTextureDisposals];

    pendingTextureDisposals.clear();
    buffers.forEach(buffer => releaseSharedTextureBuffer(buffer));
}

export function releaseSharedTextureBuffer(buffer: ArrayBuffer): void {
    const keys = cacheTextureIds.get(buffer);

    if (!keys) return;
    if ([...clients].some(client => client.hasPendingAssets())) {
        pendingTextureDisposals.add(buffer);
        return;
    }

    const forgotten = [...keys].filter(key => cacheTextureBuffers.get(key) === buffer);

    forgotten.forEach(key => cacheTextureBuffers.delete(key));
    cacheTextureIds.delete(buffer);
    for (const client of clients) client.forgetSharedTextures(forgotten);
}

export function getSharedTextureBuffer(key: string, buffer: ArrayBuffer): ArrayBuffer {
    if (buffer && !cacheTextureBuffers.has(key)) cacheTextureBuffers.set(key, buffer);
    if (!cacheTextureBuffers.has(key)) throw new Error(`Shared texture '${key}' never reached the main thread.`);

    const shared = cacheTextureBuffers.get(key);
    let keys = cacheTextureIds.get(shared);

    if (!keys) cacheTextureIds.set(shared, keys = new Set());
    keys.add(key);
    return shared;
}

export function restoreSharedTextureBuffer(key: string, buffer: ArrayBuffer): ArrayBuffer {
    const restored = !cacheTextureBuffers.has(key);
    const shared = getSharedTextureBuffer(key, buffer);

    pendingTextureDisposals.delete(shared);
    if (restored) for (const client of clients) client.confirmSharedTextures([key]);
    return shared;
}

function shareTextures(library: any): void {
    if (!library.sharedTextures) return;

    for (const [id, index, key] of library.sharedTextures) {
        const material = library.materials[id], texture = material.materialType === "sprite" ? material.sprites[index] : material;

        texture.buffer = getSharedTextureBuffer(key, texture.buffer);
        texture.sharedTextureKey = key;
    }

    const received = [...new Set<string>(library.sharedTextures.map(([, , key]) => key))];

    for (const client of clients) client.confirmSharedTextures(received);
    delete library.sharedTextures;
}

function shareSounds(library: any): void {
    if (!library.sharedSounds) return;

    for (const [name, sound] of library.soundBlobCache) {
        const id = library.sharedSounds[name];

        const data = sound.data instanceof ArrayBuffer ? new Uint8Array(sound.data) : sound.data;

        if (!cacheSounds.has(id)) cacheSounds.set(id, { key: id, data: data.slice(), mimeType: sound.mimeType, refs: 0 });
    }

    for (const [name, id] of Object.entries(library.sharedSounds) as [string, string][]) {
        if (!cacheSounds.has(id)) throw new Error(`Shared sound '${name}' (${id}) never reached the main thread.`);

        const cached = cacheSounds.get(id);
        const sound = { uri: null, data: cached.data, mimeType: cached.mimeType };

        cached.refs++;
        soundFinalizer.register(sound, cached);
        library.soundBlobCache.set(name, sound);
    }

    delete library.sharedSounds;
}

function shareScript(library: any): void {
    shareTextures(library);
    shareSounds(library);

    const sharedScript = library.sharedScript as Record<keyof typeof cacheScript, string[]>;

    if (!sharedScript) return;

    const received: ConfirmSharedScriptMessage_T["keys"] = { scriptClasses: [], scriptFunctions: [], scriptStates: [], scriptObjects: [] };
    let hasNew = false;

    for (const key of Object.keys(cacheScript) as (keyof typeof cacheScript)[]) {
        const cache = cacheScript[key], dict = library[key];

        for (const id of Object.keys(dict)) {
            if (cache.has(id)) dict[id] = cache.get(id);
            else {
                cache.set(id, dict[id]);
                received[key].push(id);
                hasNew = true;
            }
        }

        for (const id of sharedScript[key]) {
            if (!cache.has(id)) throw new Error(`Shared ${key} entry '${id}' never reached the main thread.`);

            dict[id] = cache.get(id);
        }
    }

    if (hasNew) for (const client of clients) client.confirmSharedScript(received);
    delete library.sharedScript;
}

type PendingRequest_T = {
    packagesReady?: (packages: string[]) => void;
    isPackageDiscovery?: boolean;
    loadingId?: number;
    resolve(value: any): void;
    reject(error: Error): void;
    workerIndex: number;
    isAsset: boolean;
    isRaw?: boolean;
    copyChunks?: boolean;
    urgent?: boolean;
};

type WorkerSlot_T = {
    loadingName: string;
    loadingId: number;
    worker: Worker;
    isDead: boolean;
    isReady: boolean;
    isReserved: boolean;
    inFlight: number;
    readyResolve(): void;
    readyReject(error: Error): void;
};

type BinaryDecodeRequest_T = { buffer?: ArrayBuffer, library?: DecodeLibrary, request: PendingRequest_T };
type SectorRequest_T = { message: any, packagesReady?: (packages: string[]) => void, loadingId: number, reserveScriptWorker: boolean, isStreaming: boolean, resolve(value: any): void, reject(error: Error): void };

async function waitForWorkers(promises: Promise<void>[]): Promise<void> {
    await Promise.all(promises);
}

export class DecodeWorkerClient {
    protected slots: WorkerSlot_T[] = [];
    protected pending = new Map<number, PendingRequest_T>();
    protected readonly sectorQueue: SectorRequest_T[] = [];
    protected activeSector: string = null;
    protected isSectorQueueScheduled = false;
    protected isTerminated = false;
    protected readonly pendingSkillRequests = new Map<string, { requestId: number, request: PendingRequest_T }>();
    protected readonly cacheSkillLibraries = new Map<string, Promise<DecodeLibrary>>();
    protected readonly cacheScriptLibraries = new Map<string, Promise<DecodeLibrary>>();
    protected readonly packageBuildAbort = new AbortController();
    protected packageBuildCount = 0;
    protected readonly cachePackagePrebuilds = new Map<string, Promise<void>>();
    protected nextRequestId = 1;
    protected sectorWorker = new Map<string, number>();
    protected readonly cacheSectorHits = new Map<string, boolean>();
    protected npcWorker = new Map<string, number>();
    protected mainThreadEngine: DecodeEngine = null;
    protected characterPrecache: Promise<void> = null;
    protected precacheWorker: DecodeWorkerClient = null;
    protected precacheCount = 0;
    protected characterGroups: Promise<ICharacterGroup[]> = null;
    protected readonly cacheNpcPrebuilds = new Map<string, Promise<void>>();
    protected loadingWorker: DecodeWorkerClient = null;
    protected loadingSectorCount = 0;
    protected isWorldLoading = false;
    protected characterAnimationSets = new Map<number, CharacterAnimationSet_T>();
    protected npcAnimationSets = new Set<string>();
    protected readonly cacheNpcDefinitions = new Map<number, INpcDefinition>();
    protected cacheScriptLocalizations: Map<string, Map<string, LocalizationProperty_T[]>> = null;
    protected readonly binaryDecodeQueue: BinaryDecodeRequest_T[] = [];
    protected isDecodingBinary = false;
    protected decodingBinaryCount = 0;
    protected lastAssetActivity = performance.now();
    protected maintenanceTimer: ReturnType<typeof setInterval>;

    public readonly ready: Promise<void>;

    public constructor(poolSize: number = 1) {
        clients.add(this);
        if (poolSize === 0) {
            this.ready = this.initMainThread();
            return;
        }

        const readyPromises: Promise<void>[] = [];

        for (let i = 0; i < poolSize; i++) {
            const slot = { isDead: false, isReady: false, isReserved: false, inFlight: 0, loadingName: `worker-${nextProfileWorker++}` } as WorkerSlot_T;
            slot.loadingId = beginLoadingProfile("Initialize", slot.loadingName);
            updateLoadingProfile(slot.loadingId, performance.timeOrigin + performance.now(), "Initializing", {});

            readyPromises.push(new Promise<void>((resolve, reject) => {
                slot.readyResolve = resolve;
                slot.readyReject = reject;
            }));

            const worker = new Worker("decode-worker.bundle.js", { name: `sector-decode-${i}` });

            slot.worker = worker;
            worker.onmessage = (event: MessageEvent<WorkerToMainMessage_T>) => this.onMessage(i, event.data);
            worker.onerror = event => this.onWorkerDead(i, new Error(`decode worker crashed: ${event.message ?? "unknown error"}`));
            worker.onmessageerror = () => this.onWorkerDead(i, new Error("decode worker message failed to deserialize"));

            worker.postMessage({ type: "init", assetFiles: getAssetFiles(), servedAssets: getServedAssets() });

            this.slots.push(slot);
        }

        this.ready = waitForWorkers(readyPromises);
        this.maintenanceTimer = setInterval(() => this.maintainWorkers(), DECODE_PACKAGE_SWEEP_MS);
    }

    protected maintainWorkers(): void {
        const now = performance.now();

        for (const client of clients) {
            if (client.packageBuildCount || client.sectorQueue.length || client.binaryDecodeQueue.length || client.decodingBinaryCount || now - client.lastAssetActivity < DECODE_PACKAGE_SWEEP_MS) return;
            for (const request of client.pending.values())
                if (request.isAsset) return;
        }

        for (const slot of this.slots)
            if (slot.isReady && !slot.isDead) slot.worker.postMessage({ type: "maintenance" });
    }

    protected async initMainThread(): Promise<void> {
        const { DecodeEngine } = await import(/* webpackChunkName: "modules/decode-engine" */ "./decode-engine");

        this.mainThreadEngine = new DecodeEngine();
        await this.mainThreadEngine.initialize();
    }

    public isDead(): boolean {
        if (this.mainThreadEngine) return false;

        return this.slots.every(slot => slot.isDead);
    }

    protected pickWorker(stickyIndex?: number, reserveScriptWorker: boolean = false, idleOnly: boolean = false): number {
        const count = reserveScriptWorker && this.slots.length > 1 ? this.slots.length - 1 : this.slots.length;
        // reuse the worker that last decoded this sector if it's sitting idle - it likely
        // still has shared dependency packages warm in memory, which isn't shared across
        // workers. Only when idle though: forcing a busy worker would reintroduce the
        // head-of-line blocking a boundary crossing needs the pool to avoid
        if (stickyIndex !== undefined && stickyIndex < count) {
            const slot = this.slots[stickyIndex];
            if (slot && !slot.isDead && !slot.isReserved && slot.inFlight === 0 && (!idleOnly || slot.isReady)) return stickyIndex;
        }

        let best = -1, bestLoad = Infinity;

        for (let i = 0; i < count; i++) {
            if (this.slots[i].isDead || this.slots[i].isReserved) continue;
            if (idleOnly && (!this.slots[i].isReady || this.slots[i].inFlight > 0)) continue;
            if (this.slots[i].inFlight < bestLoad) { best = i; bestLoad = this.slots[i].inFlight; }
        }

        if (best >= 0 || !reserveScriptWorker) return best;
        if (idleOnly && this.slots.some((slot, index) => index < count && !slot.isDead)) return -1;

        const fallback = this.pickScriptWorker();

        return fallback >= 0 && (!idleOnly || this.slots[fallback].isReady && this.slots[fallback].inFlight === 0) ? fallback : -1;
    }

    protected pickScriptWorker(): number { // LineageWarrior/LineageEffect script classes drag in a ~1.4GB import closure per worker, keep it to one.
        for (let i = this.slots.length - 1; i >= 0; i--)
            if (!this.slots[i].isDead) return i;

        return -1;
    }

    protected pickCharacterWorker(): number { return this.pickScriptWorker(); }

    public setActiveSector(sectorName: string): void {
        if (this.activeSector === sectorName) return;

        this.activeSector = sectorName;
        this.scheduleSectorQueue();
    }

    public cancelQueuedSectors(requiredSectors: readonly string[] = [], origin: string = null): void {
        if (this.loadingWorker) this.loadingWorker.cancelQueuedSectors(requiredSectors, origin);
        let cancelled = false;

        for (let i = this.sectorQueue.length - 1; i >= 0; i--) {
            const request = this.sectorQueue[i];
            const name = request.message.sectorName;

            if (!request.isStreaming || name === origin || requiredSectors.includes(name)) continue;

            this.sectorQueue.splice(i, 1);
            finishLoadingProfile(request.loadingId);
            request.reject(new DOMException(`Sector '${name}' is no longer needed.`, "AbortError"));
            cancelled = true;
        }

        if (!cancelled) return;

        releaseDisposedTextures();
        releaseDisposedSounds();
        this.scheduleSectorQueue();
    }

    protected queueSector(message: any, reserveScriptWorker: boolean, isStreaming: boolean = false, packagesReady: (packages: string[]) => void = null, queuedLoadingId: number = null): Promise<any> {
        return new Promise((resolve, reject) => {
            if (this.isTerminated || this.isDead()) {
                reject(new Error(`Decode worker is dead.`));
                return;
            }

            const loadingId = queuedLoadingId ?? beginLoadingProfile(`${message.type} ${message.sectorName ?? message.path ?? message.packageName ?? message.charIndex ?? ""}`.trim(), "queued");

            this.sectorQueue.push({ message, packagesReady, loadingId, reserveScriptWorker, isStreaming, resolve, reject });
            this.scheduleSectorQueue();
        });
    }

    protected scheduleSectorQueue(): void {
        if (!this.sectorQueue.length || this.isSectorQueueScheduled || this.isTerminated) return;

        this.isSectorQueueScheduled = true;
        queueMicrotask(() => {
            this.isSectorQueueScheduled = false;
            this.processSectorQueue();
        });
    }

    protected processSectorQueue(): void {
        if (this.isTerminated) return;

        if (this.isDead()) {
            for (const request of this.sectorQueue.splice(0)) {
                finishLoadingProfile(request.loadingId);
                request.reject(new Error(`Decode worker is dead.`));
            }
            return;
        }

        while (this.sectorQueue.length) {
            let requestIndex = -1, workerIndex = -1, priority = -1;

            for (let i = 0; i < this.sectorQueue.length; i++) {
                const request = this.sectorQueue[i];
                if ((request.message.type === "sectorPackages" || request.message.type === "packageDependencies") && [...this.pending.values()].filter(entry => entry.isPackageDiscovery).length >= Math.max(1, Math.floor(this.slots.length / 2))) continue;
                const requestPriority = request.message.sectorName === this.activeSector ? 3 : request.message.type === "precachePackage" ? 2 : request.reserveScriptWorker ? 0 : 1;

                if (requestPriority <= priority) continue;

                const index = this.pickWorker(this.sectorWorker.get(request.message.sectorName), request.reserveScriptWorker || this.activeSector !== null, true);

                if (index < 0) continue;

                requestIndex = i;
                workerIndex = index;
                priority = requestPriority;
            }

            if (requestIndex < 0) return;

            const request = this.sectorQueue.splice(requestIndex, 1)[0];

            if (request.message.type === "decode") this.sectorWorker.set(request.message.sectorName, workerIndex);
            void this.dispatchSector(request, workerIndex);
        }
    }

    protected async dispatchSector(request: SectorRequest_T, workerIndex: number): Promise<void> {
        const slot = this.slots[workerIndex];
        let reserved = false, queued = false;
        try {
            if (request.message.type === "precachePackage" && request.message.lockHeld) {
                const lockName = `package-conversion:${getAssetSourceId()}:${request.message.path}`;
                slot.isReserved = reserved = true;
                const dispatched = await requestWebLock(lockName, async lock => {
                    slot.isReserved = reserved = false;
                    if (!lock) return false;
                    request.resolve(await this.dispatch(workerIndex, request.message, false, request.loadingId, request.packagesReady));
                    return true;
                }, { ifAvailable: true });
                if (!dispatched) {
                    this.scheduleSectorQueue();
                    await requestWebLock(lockName, async () => { }, { signal: this.packageBuildAbort.signal });
                    if (this.isTerminated) throw new Error(`Decode worker terminated.`);
                    this.sectorQueue.unshift(request);
                    queued = true;
                    this.scheduleSectorQueue();
                }
            } else request.resolve(await this.dispatch(workerIndex, request.message, false, request.loadingId, request.packagesReady));
        } catch (error) {
            request.reject(error as Error);
        } finally {
            if (reserved) slot.isReserved = false;
            if (!queued) finishLoadingProfile(request.loadingId);
        }
    }

    public async decodeSector(sectorName: string, settings: LoadSettings_T, isWorldLoading: boolean = false, isStreaming: boolean = false): Promise<DecodeLibrary> {
        this.cacheSectorHits.delete(sectorName);
        if (this.mainThreadEngine) {
            const { library } = await this.mainThreadEngine.decodeSector(sectorName, settings, fromCache => this.cacheSectorHits.set(sectorName, fromCache));

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        if (isWorldLoading && (this.loadingWorker || !await hasCachedLibrary(sectorName, settings)))
            return this.decodeLoadingSector(sectorName, settings, isStreaming);

        return this.queueSector({ type: "decode", sectorName, settings }, !isWorldLoading, isStreaming);
    }

    public getLoadingWorkerPoolSize(): number { return Math.max(1, Math.floor((navigator.hardwareConcurrency || 6) / 2)); }

    public setWorldLoading(isLoading: boolean): void {
        this.isWorldLoading = isLoading;
        if (isLoading || this.loadingSectorCount || !this.loadingWorker || this.precacheWorker === this.loadingWorker) return;

        this.loadingWorker.terminate();
        this.loadingWorker = null;
        printLoadingProfile(true);
    }

    protected async decodeLoadingSector(sectorName: string, settings: LoadSettings_T, isStreaming: boolean): Promise<DecodeLibrary> {
        if (this.isTerminated) throw new Error(`Decode worker terminated.`);
        const worker = this.loadingWorker || (this.loadingWorker = this.precacheWorker || new DecodeWorkerClient(this.getLoadingWorkerPoolSize()));

        this.loadingSectorCount++;
        this.sectorWorker.delete(sectorName);

        try {
            await worker.ready;
            if (isCacheEnabled(settings) && settings._packageCache !== false) await worker.prepareSectorPackages(sectorName, settings);
            return await worker.queueSector({ type: "decode", sectorName, settings, flushAssets: true }, false, isStreaming);
        } finally {
            const cached = worker.cacheSectorHits.get(sectorName);

            if (cached !== undefined) this.cacheSectorHits.set(sectorName, cached);
            this.loadingSectorCount--;
            if (!this.isWorldLoading) this.setWorldLoading(false);
        }
    }

    protected async prepareSectorPackages(sectorName: string, settings: LoadSettings_T): Promise<void> {
        return this.preparePackageDependencies({ type: "sectorPackages", sectorName, settings }, settings);
    }

    protected async preparePackageDependencies(message: any, settings: LoadSettings_T): Promise<void> {
        const requests: Promise<Error | null>[] = [], scheduled = new Set<string>(), client = this;

        function ready(packages: string[]): void {
            for (const path of packages) {
                if (scheduled.has(path)) continue;
                scheduled.add(path);
                requests.push(build(path));
            }
        }

        async function build(path: string): Promise<Error | null> {
            let request = client.cachePackagePrebuilds.get(path);
            if (!request) client.cachePackagePrebuilds.set(path, request = client.buildPackage(path, settings));
            try {
                await request;
                return null;
            } catch (error) {
                if (client.cachePackagePrebuilds.get(path) === request) client.cachePackagePrebuilds.delete(path);
                return error as Error;
            }
        }

        try {
            ready(await this.queueSector(message, false, false, ready));
        } finally {
            const errors = await Promise.all(requests);
            const error = errors.find(error => error !== null);
            if (error) throw error;
        }
    }

    protected async buildPackage(path: string, settings: LoadSettings_T): Promise<void> {
        const loadingId = beginLoadingProfile(`precachePackage ${path}`, "queued");
        this.packageBuildCount++;
        try {
            await this.queueSector({ type: "precachePackage", path, settings, lockHeld: true }, false, false, null, loadingId);
        } finally {
            this.packageBuildCount--;
            finishLoadingProfile(loadingId);
        }
    }

    public precacheSector(sectorName: string, settings: LoadSettings_T): Promise<PrecacheResult_T> {
        if (this.mainThreadEngine)
            return this.mainThreadEngine.precacheSector(sectorName, settings);

        return this.queueSector({ type: "precache", sectorName, settings }, true);
    }

    public isBuildingSector(sectorName: string): boolean { return this.loadingWorker?.isBuildingSector(sectorName) || this.cacheSectorHits.get(sectorName) === false; }

    public freeSector(sectorName: string) {
        if (this.loadingWorker) this.loadingWorker.freeSector(sectorName);
        this.cacheSectorHits.delete(sectorName);
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

    public decodeEnv(settings: LoadSettings_T = {}): Promise<any> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeEnvConfig(settings);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "decodeEnv", settings });
    }

    public async decodeCharacter(settings: LoadSettings_T, charIndex: number = 1, faceVariant: number = 0, hairVariant: number = 0, hairColour: number = 0, armor: ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 }, equipment: ICharacterEquipment = null): Promise<DecodeLibrary> {
        for (;;) {
            const cached = this.characterAnimationSets.get(charIndex);
            if (cached) {
                const source = cached.library && cached.library.deref();
                if (source) {
                    const library = await this.decodeCharacterLibrary(settings, charIndex, faceVariant, hairVariant, hairColour, armor, false, equipment);
                    const info = library.pawnActors[0], animations = source.pawnActors[0];
                    if (!info.animationSet || info.animationSet !== animations.animationSet) throw new Error(`Character '${charIndex}' animation set does not match its source.`);
                    info.animations = animations.animations;
                    info.animationSequences = animations.animationSequences;
                    library.sourceLibrary = source;
                    return library;
                }
                if (!cached.library) { await cached.pending; continue; }
            }

            let complete: () => void;
            const entry: CharacterAnimationSet_T = { library: null, pending: new Promise(resolve => complete = resolve) };
            this.characterAnimationSets.set(charIndex, entry);
            try {
                const library = await this.decodeCharacterLibrary(settings, charIndex, faceVariant, hairVariant, hairColour, armor, true, equipment);
                entry.library = new WeakRef(library);
                return library;
            } catch (error) {
                this.characterAnimationSets.delete(charIndex);
                throw error;
            } finally { complete(); }
        }
    }

    protected async decodeCharacterLibrary(settings: LoadSettings_T, charIndex: number, faceVariant: number, hairVariant: number, hairColour: number, armor: ICharacterArmorSelection, includeAnimations: boolean, equipment: ICharacterEquipment): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeCharacter(settings, charIndex, faceVariant, hairVariant, hairColour, armor, includeAnimations, equipment);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickCharacterWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");


        const library = await this.dispatch(workerIndex, { type: "decodeCharacter", settings, charIndex, faceVariant, hairVariant, hairColour, armor, includeAnimations, equipment });

        return library;
    }

    public async decodeCharacterEquipment(settings: LoadSettings_T, charIndex: number, hairVariant: number, equipment: ICharacterEquipment): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) return Object.setPrototypeOf(await this.mainThreadEngine.decodeCharacterEquipment(settings, charIndex, hairVariant, equipment), DecodeLibrary.prototype) as DecodeLibrary;

        const workerIndex = this.pickCharacterWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "decodeCharacterEquipment", settings, charIndex, hairVariant, equipment });
    }

    public async decodeSkeletalMesh(settings: LoadSettings_T, packageName: string, meshName: string, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null, equipment: INpcEquipment | null = null): Promise<DecodeLibrary> {
        const bundleName = npcId === null || !packageName ? null : getNpcBundleName(packageName);
        const animationSet = `${packageName}.${meshName}`.toLowerCase();
        const includeAnimations = npcId === null || !this.npcAnimationSets.has(animationSet);

        if (bundleName !== null && isCacheEnabled(settings)) await this.precacheNpcBundle(settings, packageName);

        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeSkeletalMesh(settings, packageName, meshName, scriptClassPath, texturePaths, npcId, includeAnimations, equipment);

            if (npcId !== null) this.npcAnimationSets.add(animationSet);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        if (bundleName !== null) this.npcWorker.set(bundleName, workerIndex);

        const library = await this.dispatch(workerIndex, { type: "decodeSkeletalMesh", settings, packageName, meshName, scriptClassPath, texturePaths, npcId, equipment, includeAnimations });

        if (npcId !== null) this.npcAnimationSets.add(animationSet);

        return library;
    }

    public async decodeVehicle(settings: LoadSettings_T): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeVehicle(settings);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "decodeVehicle", settings });
    }

    public async decodeEffectTemplates(settings: LoadSettings_T, classPaths: string[], soundPaths: string[] = [], scriptClassPaths: string[] = [], requiredSounds: boolean = true): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeEffectTemplates(settings, classPaths, soundPaths, scriptClassPaths, requiredSounds);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "decodeEffectTemplates", settings, classPaths, soundPaths, scriptClassPaths, requiredSounds });
    }

    public decodeScriptClass(settings: LoadSettings_T, classPath: string): Promise<DecodeLibrary> {
        if (!this.cacheScriptLibraries.has(classPath)) this.cacheScriptLibraries.set(classPath, this.decodeEffectTemplates(settings, [], [], [classPath]));

        return this.cacheScriptLibraries.get(classPath);
    }

    public async prefetchScriptClass(settings: LoadSettings_T, classPath: string): Promise<void> {
        await this.decodeScriptClass(settings, classPath);
    }

    public async decodeItem(settings: LoadSettings_T, id: number): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeItem(settings, id);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error(`Decode worker is dead`);

        return this.dispatch(workerIndex, { type: "decodeItem", settings, id });
    }

    public decodeSkill(settings: LoadSettings_T, id: number, level: number, urgent: boolean = false, record: import("@l2js/engine/contracts/pawn").NpcSkillAttack_T = null): Promise<DecodeLibrary> {
        const visual = record ? record.visualEffect.toLowerCase() === "none" ? JSON.stringify([id, record.name, record.castStyle === 0]) : record.visualEffect.toLowerCase() : `${id}:${level}`;
        const key = `${visual}:${settings.rgbaTextures !== false ? "rgba" : "native"}`;

        if (!this.cacheSkillLibraries.has(key)) this.cacheSkillLibraries.set(key, this.loadSkill(settings, id, level, urgent, record, key));

        const pending = this.pendingSkillRequests.get(key);

        if (urgent && pending && !pending.request.urgent) {
            pending.request.urgent = true;
            this.slots[pending.request.workerIndex].worker.postMessage({ type: "promoteSkill", requestId: pending.requestId });
        }

        return this.cacheSkillLibraries.get(key);
    }

    protected async loadSkill(settings: LoadSettings_T, id: number, level: number, urgent: boolean, record: import("@l2js/engine/contracts/pawn").NpcSkillAttack_T, key: string): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeSkill(settings, id, level, record);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error(`Decode worker is dead`);

        const requestId = this.nextRequestId;
        const promise = this.dispatch(workerIndex, { type: "decodeSkill", settings, id, level, urgent, record });
        const request = this.pending.get(requestId);

        if (request) this.pendingSkillRequests.set(key, { requestId, request });

        try { return await promise; }
        finally { this.pendingSkillRequests.delete(key); }
    }

    public listPlayerSkills(includeAssetVariants: boolean = false): Promise<PlayerSkillInfo_T[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.listPlayerSkills(includeAssetVariants);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "listPlayerSkills", includeAssetVariants });
    }

    public decodeUITextures(settings: LoadSettings_T, paths: string[], useIntrinsicAlpha = true): Promise<UITexture_T[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeUITextures(settings, paths, useIntrinsicAlpha);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "decodeUITextures", settings, paths, useIntrinsicAlpha });
    }

    public decodeMatineeScenes(levelName: string): Promise<MatineeScene_T[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeMatineeScenes(levelName);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "matineeScenes", levelName });
    }

    public getGameStrings(settings: LoadSettings_T = {}): Promise<GameStrings_T> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeGameStrings(settings);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "gameStrings", settings });
    }

    public resolveNpc(selector: string | number, settings: LoadSettings_T): Promise<INpcDefinition> {
        if (typeof selector === "number" && this.cacheNpcDefinitions.has(selector)) return Promise.resolve(this.cacheNpcDefinitions.get(selector));
        if (this.mainThreadEngine) return this.mainThreadEngine.resolveNpc(selector, settings);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "resolveNpc", selector, settings });
    }

    public async listNpcs(settings: LoadSettings_T): Promise<INpcDefinition[]> {
        let npcs: INpcDefinition[];

        if (this.mainThreadEngine) npcs = await this.mainThreadEngine.listNpcs(settings);
        else {
            const workerIndex = this.pickScriptWorker();

            if (workerIndex < 0) throw new Error("Decode worker is dead");

            npcs = await this.dispatch(workerIndex, { type: "listNpcs", settings });
        }

        for (const npc of npcs)
            if (!this.cacheNpcDefinitions.has(npc.id)) this.cacheNpcDefinitions.set(npc.id, npc);

        return npcs;
    }

    protected pickNpcWorker(bundleName: string): number {
        return this.pickScriptWorker();
    }

    public precacheNpcBundle(settings: LoadSettings_T, packageName: string): Promise<void> {
        const bundleName = getNpcBundleName(packageName);
        let request = this.cacheNpcPrebuilds.get(bundleName);

        if (!request) this.cacheNpcPrebuilds.set(bundleName, request = this.precacheNpcAssets(settings, packageName));
        return request;
    }

    protected async precacheNpcAssets(settings: LoadSettings_T, packageName: string): Promise<void> {
        if (!isCacheEnabled(settings)) return;
        if (this.mainThreadEngine) return this.mainThreadEngine.precacheNpcBundle(settings, packageName);

        const bundleName = getNpcBundleName(packageName);
        if (await hasCachedLibrary(bundleName, settings)) return;

        await this.precacheAssets(async worker => {
            const paths = bundleName === "npc_monsters" ? ["system/LineageMonster.u", "system/LineageMonster2.u"] : ["system/LineageNpc.u", "system/LineageDeco.u"];

            await Promise.all(paths.map(path => worker.preparePackageDependencies({ type: "packageDependencies", path, settings }, settings)));
            await worker.queueSector({ type: "precacheNpcBundle", settings, packageName }, false);
        });
    }

    protected async precacheAssets(prepare: (worker: DecodeWorkerClient) => Promise<void>): Promise<void> {
        if (this.isTerminated) throw new Error(`Decode worker terminated.`);

        const worker = this.precacheWorker || (this.precacheWorker = this.loadingWorker || new DecodeWorkerClient(this.getLoadingWorkerPoolSize()));
        this.precacheCount++;

        try {
            await Promise.all([worker.ready, prepare(worker)]);
        } finally {
            if (--this.precacheCount === 0) {
                if (worker !== this.loadingWorker) worker.terminate();
                this.precacheWorker = null;
                if (worker === this.loadingWorker) this.setWorldLoading(this.isWorldLoading);
            }
        }
    }

    public precacheCharacters(settings: LoadSettings_T): Promise<void> {
        if (!this.characterPrecache) this.characterPrecache = this.precacheCharacterGroups(settings);

        return this.characterPrecache;
    }

    protected async precacheCharacterGroups(settings: LoadSettings_T): Promise<void> {
        if (!isCacheEnabled(settings)) return;
        if (this.mainThreadEngine) return this.mainThreadEngine.precacheCharacters(settings);

        await this.precacheAssets(async worker => {
            if (!this.characterGroups) this.characterGroups = worker.queueSector({ type: "charGroups", settings }, false);

            const [groups] = await Promise.all([this.characterGroups, worker.preparePackageDependencies({ type: "packageDependencies", path: "system/LineageWarrior.u", settings }, settings)]);
            let cursor = 0;

            await Promise.all(worker.slots.map(async () => {
                while (cursor < groups.length) {
                    const group = groups[cursor++];

                    await worker.queueSector({ type: "precacheCharacters", settings, charIndex: group.index }, false);
                }
            }));
            printLoadingProfile(true);
        });
    }

    public async getCharGroups(settings: LoadSettings_T = {}): Promise<ICharacterGroup[]> {
        if (this.characterGroups) return this.characterGroups;
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeCharGroups(settings);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.characterGroups = this.dispatch(workerIndex, { type: "charGroups", settings });
    }

    public getMusicInfo(): Promise<Record<number, string[]>> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeMusicInfo();

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "musicInfo" });
    }

    public getMemoryStats(): Promise<(WorkerMemoryStats_T | null)[]> {
        if (this.mainThreadEngine) return Promise.resolve([this.mainThreadEngine.getMemoryStats()]);

        return Promise.all(this.slots.map((slot, i) => slot.isDead ? null : this.dispatch(i, { type: "memoryStats" })));
    }

    public async getClientConfig(settings: LoadSettings_T = {}): Promise<ClientConfig_T> {
        let config: ClientConfig_T;

        if (this.mainThreadEngine) config = await this.mainThreadEngine.decodeClientConfig(settings);
        else {
            const workerIndex = this.pickWorker();

            if (workerIndex < 0) throw new Error("decode worker is dead");

            config = await this.dispatch(workerIndex, { type: "clientConfig", settings });
        }
        this.cacheScriptLocalizations = config.scriptLocalizationProperties;
        return config;
    }

    public async getScriptLocalization(scriptClassPath: string): Promise<LocalizationProperty_T[]> {
        if (this.cacheScriptLocalizations) {
            const separator = scriptClassPath.indexOf(".");

            if (separator < 1 || separator === scriptClassPath.length - 1) throw new Error(`Invalid UnrealScript class path '${scriptClassPath}'.`);

            const sections = this.cacheScriptLocalizations.get(scriptClassPath.slice(0, separator).toLowerCase());

            return sections ? sections.get(scriptClassPath.slice(separator + 1).toLowerCase()) || [] : [];
        }
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeScriptLocalization(scriptClassPath);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error("decode worker is dead");

        return this.dispatch(workerIndex, { type: "scriptLocalization", scriptClassPath });
    }

    public getL2Text(name: string): Promise<string> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeL2Text(name);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "l2Text", name });
    }

    protected dispatch(workerIndex: number, message: any, isRaw: boolean = false, queuedLoadingId: number = null, packagesReady: (packages: string[]) => void = null): Promise<any> {
        if (this.isTerminated || this.slots[workerIndex].isDead) return Promise.reject(new Error(`Decode worker is dead.`));

        const isAsset = message.type !== "memoryStats";
        if (isAsset) this.lastAssetActivity = performance.now();
        const requestId = this.nextRequestId++;

        this.slots[workerIndex].inFlight++;
        const name = message.sectorName ?? message.path ?? message.packageName ?? message.charIndex ?? "";
        const loadingId = queuedLoadingId ?? (isAsset ? beginLoadingProfile(`${message.type} ${name}`.trim(), this.slots[workerIndex].loadingName) : null);
        assignLoadingProfile(loadingId, this.slots[workerIndex].loadingName);

        return new Promise((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject, workerIndex, loadingId, packagesReady, isPackageDiscovery: message.type === "sectorPackages" || message.type === "packageDependencies", isAsset, isRaw, copyChunks: true, urgent: message.type === "decodeCharacterEquipment" || message.type === "decodeSkill" && message.urgent });

            try {
                this.slots[workerIndex].worker.postMessage({ ...message, requestId });
            } catch (error) {
                this.settlePending(requestId);
                reject(error as Error);
                this.scheduleSectorQueue();
            }
        });
    }

    protected settlePending(requestId: number, keepProfile: boolean = false): PendingRequest_T | undefined {
        const request = this.pending.get(requestId);

        if (!request) return undefined;

        this.pending.delete(requestId);
        this.slots[request.workerIndex].inFlight--;
        if (!keepProfile) finishLoadingProfile(request.loadingId);
        if (request.isAsset) this.lastAssetActivity = performance.now();

        return request;
    }

    protected onMessage(workerIndex: number, msg: WorkerToMainMessage_T) {
        switch (msg.type) {
            case "loadingProgress": {
                const request = this.pending.get(msg.profile.requestId);
                if (request) updateLoadingProfile(request.loadingId, msg.profile.started, msg.profile.active, msg.profile.steps, msg.profile.packages);
                break;
            }
            case "ready": {
                finishLoadingProfile(this.slots[workerIndex].loadingId);
                this.slots[workerIndex].isReady = true;
                this.slots[workerIndex].readyResolve();
                break;
            }
            case "initError": {
                this.onWorkerDead(workerIndex, new Error(msg.message));
                break;
            }
            case "sectorCache": {
                if (this.pending.has(msg.requestId)) this.cacheSectorHits.set(msg.sectorName, msg.fromCache);
                break;
            }
            case "decoded": {
                const request = this.settlePending(msg.requestId, true);
                if (!request) break;

                this.binaryDecodeQueue.push({ buffer: msg.buffer, library: msg.library, request });
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
            case "memoryStatsDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.stats);
                break;
            }
            case "npcBundlePrecached":
            case "packagePrecached":
            case "charactersPrecached": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(undefined);
                break;
            }
            case "sectorPackagesReady": {
                const request = this.pending.get(msg.ready.requestId);
                if (request?.packagesReady) request.packagesReady(msg.ready.packages);
                break;
            }
            case "sectorPackagesListed": {
                const request = this.settlePending(msg.requestId);
                if (request) request.resolve(msg.packages);
                break;
            }
            case "clientConfigDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.config);
                break;
            }
            case "scriptLocalizationDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.properties);
                break;
            }
            case "l2TextDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.text);
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
            case "npcsListed": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.npcs);
                break;
            }
            case "uiTexturesDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.textures);
                break;
            }
            case "matineeScenesDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.scenes);
                break;
            }
            case "gameStringsDecoded": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.strings);
                break;
            }
            case "playerSkillsListed": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(msg.skills);
                break;
            }
        }

        releaseDisposedTextures();
        releaseDisposedSounds();
        this.scheduleSectorQueue();
    }

    protected async processBinaryDecodeQueue(): Promise<void> {
        if (this.isDecodingBinary) return;

        this.isDecodingBinary = true;

        while (this.binaryDecodeQueue.length > 0) {
            const { buffer, library: transferred, request } = this.binaryDecodeQueue.shift();
            this.decodingBinaryCount++;

            try {
                if (request.isRaw) { // registers its script entries in worker order, later results may only carry their ids
                    shareScript(await deserializeLibraryAsync(buffer.slice(0)));
                    request.resolve(buffer);
                    continue;
                }

                const library = transferred || await deserializeLibraryAsync(buffer, request.copyChunks, () => this.processUrgentLibraries());

                shareScript(library);
                refreshSoundBlobUris(library);
                request.resolve(Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary);
            } catch (e) {
                request.reject(e as Error);
            } finally {
                finishLoadingProfile(request.loadingId);
                this.decodingBinaryCount--;
                this.lastAssetActivity = performance.now();
            }
        }

        this.isDecodingBinary = false;
        releaseDisposedTextures();
        releaseDisposedSounds();
    }

    protected async processUrgentLibraries(): Promise<void> {
        let index: number;

        while ((index = this.binaryDecodeQueue.findIndex(entry => entry.request.urgent)) >= 0) {
            const { buffer, library: transferred, request } = this.binaryDecodeQueue.splice(index, 1)[0];
            this.decodingBinaryCount++;

            try {
                const library = transferred || await deserializeLibraryAsync(buffer, true);

                shareScript(library);
                refreshSoundBlobUris(library);
                request.resolve(Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary);
            } catch (e) {
                request.reject(e as Error);
            } finally {
                finishLoadingProfile(request.loadingId);
                this.decodingBinaryCount--;
            }
        }
    }

    protected onWorkerDead(workerIndex: number, error: Error) {
        const slot = this.slots[workerIndex];

        finishLoadingProfile(slot.loadingId);
        slot.isDead = true;
        slot.inFlight = 0;
        slot.readyReject(error); // no-op if already resolved

        for (const [requestId, request] of this.pending) {
            if (request.workerIndex !== workerIndex) continue;

            this.pending.delete(requestId);
            finishLoadingProfile(request.loadingId);
            request.reject(error);
        }

        slot.worker.terminate();
        this.scheduleSectorQueue();
    }

    public getPendingAssetCount(): number { return this.pending.size + this.sectorQueue.length + this.binaryDecodeQueue.length + this.decodingBinaryCount + this.loadingSectorCount + this.packageBuildCount + this.precacheCount; }
    public hasPendingAssets(): boolean { return this.getPendingAssetCount() > 0; }

    public forgetSharedSounds(keys: string[]): void {
        if (!keys.length) return;

        if (this.mainThreadEngine) this.mainThreadEngine.forgetSharedSounds(keys);
        for (const slot of this.slots)
            if (!slot.isDead) slot.worker.postMessage({ type: "forgetSharedSounds", keys });
    }

    public forgetSharedTextures(keys: string[]): void {
        if (!keys.length) return;

        if (this.mainThreadEngine) this.mainThreadEngine.forgetSharedTextures(keys);
        for (const slot of this.slots)
            if (!slot.isDead) slot.worker.postMessage({ type: "forgetSharedTextures", keys });
    }

    public confirmSharedTextures(keys: string[]): void {
        if (!keys.length) return;

        if (this.mainThreadEngine) this.mainThreadEngine.confirmSharedTextures(keys);
        for (const slot of this.slots)
            if (!slot.isDead) slot.worker.postMessage({ type: "confirmSharedTextures", keys });
    }

    public confirmSharedScript(keys: ConfirmSharedScriptMessage_T["keys"]): void {
        if (this.mainThreadEngine) this.mainThreadEngine.confirmSharedScript(keys);
        for (const slot of this.slots)
            if (!slot.isDead) slot.worker.postMessage({ type: "confirmSharedScript", keys });
    }

    public terminate() {
        if (this.isTerminated) return;
        this.isTerminated = true;
        this.packageBuildAbort.abort();
        this.isWorldLoading = false;
        if (this.precacheWorker) this.precacheWorker.terminate();
        if (this.loadingWorker) {
            this.loadingWorker.terminate();
            this.loadingWorker = null;
        }
        clearInterval(this.maintenanceTimer);
        clients.delete(this);
        const error = new Error(`Decode worker terminated.`);

        for (const request of this.sectorQueue.splice(0)) {
            finishLoadingProfile(request.loadingId);
            request.reject(error);
        }
        for (const entry of this.binaryDecodeQueue.splice(0)) {
            finishLoadingProfile(entry.request.loadingId);
            entry.request.reject(error);
        }
        this.slots.forEach((slot, index) => this.onWorkerDead(index, error));
    }
}

export default DecodeWorkerClient;
