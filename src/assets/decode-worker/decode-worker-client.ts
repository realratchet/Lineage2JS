import DecodeLibrary from "@l2js/engine/decode-library";
import type { GameStrings_T, MatineeScene_T, UITexture_T, PlayerSkillInfo_T, WorkerToMainMessage_T, PrecacheResult_T, ClientConfig_T, WorkerMemoryStats_T } from "./decode-protocol";
import type { LocalizationProperty_T, LoadSettings_T } from "@l2js/engine/contracts/config";
import type { ICharacterArmorSelection, INpcDefinition, ICharacterGroup } from "@l2js/engine/contracts/pawn";
import type DecodeEngine from "./decode-engine";
import { deserializeLibraryAsync } from "./library-serializer";
import { refreshSoundBlobUris } from "./decode-cache";
import getNpcBundleName from "./npc-bundle";

const cacheScript = { scriptClasses: new Map<string, any>(), scriptFunctions: new Map<string, any>(), scriptStates: new Map<string, any>() };
const cacheSounds = new Map<string, { uri: string, data: Uint8Array | Blob, mimeType: string }>();
const cacheTextureBuffers = new Map<string, ArrayBuffer>();
const cacheTextureIds = new WeakMap<ArrayBuffer, Set<string>>();
const clients = new Set<DecodeWorkerClient>();
const pendingTextureDisposals = new Set<ArrayBuffer>();

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

        if (!cacheSounds.has(id)) cacheSounds.set(id, { uri: null, data: sound.data.slice(), mimeType: sound.mimeType });
    }

    for (const [name, id] of Object.entries(library.sharedSounds) as [string, string][]) {
        if (!cacheSounds.has(id)) throw new Error(`Shared sound '${name}' (${id}) never reached the main thread.`);

        library.soundBlobCache.set(name, Object.assign({}, cacheSounds.get(id)));
    }

    delete library.sharedSounds;
}

function shareScript(library: any): void {
    shareTextures(library);
    shareSounds(library);

    const sharedScript = library.sharedScript as Record<keyof typeof cacheScript, string[]>;

    if (!sharedScript) return;

    for (const key of Object.keys(cacheScript) as (keyof typeof cacheScript)[]) {
        const cache = cacheScript[key], dict = library[key];

        for (const id of Object.keys(dict)) {
            if (cache.has(id)) dict[id] = cache.get(id);
            else cache.set(id, dict[id]);
        }

        for (const id of sharedScript[key]) {
            if (!cache.has(id)) throw new Error(`Shared ${key} entry '${id}' never reached the main thread.`);

            dict[id] = cache.get(id);
        }
    }

    delete library.sharedScript;
}

type PendingRequest_T = {
    resolve(value: any): void;
    reject(error: Error): void;
    workerIndex: number;
    isRaw?: boolean;
    copyChunks?: boolean;
    urgent?: boolean;
};

type WorkerSlot_T = {
    worker: Worker;
    isDead: boolean;
    inFlight: number;
    readyResolve(): void;
    readyReject(error: Error): void;
};

type BinaryDecodeRequest_T = { buffer?: ArrayBuffer, library?: DecodeLibrary, request: PendingRequest_T };

async function waitForWorkers(promises: Promise<void>[]): Promise<void> {
    await Promise.all(promises);
}

export class DecodeWorkerClient {
    protected slots: WorkerSlot_T[] = [];
    protected pending = new Map<number, PendingRequest_T>();
    protected readonly pendingSkillRequests = new Map<string, { requestId: number, request: PendingRequest_T }>();
    protected readonly cacheSkillLibraries = new Map<string, Promise<DecodeLibrary>>();
    protected readonly cacheScriptLibraries = new Map<string, Promise<DecodeLibrary>>();
    protected nextRequestId = 1;
    protected sectorWorker = new Map<string, number>();
    protected npcWorker = new Map<string, number>();
    protected mainThreadEngine: DecodeEngine = null;
    protected characterAnimationSets = new Set<number>();
    protected npcAnimationSets = new Set<string>();
    protected readonly binaryDecodeQueue: BinaryDecodeRequest_T[] = [];
    protected isDecodingBinary = false;

    public readonly ready: Promise<void>;

    public constructor(poolSize: number = 1) {
        clients.add(this);
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

            const worker = new Worker("decode-worker.bundle.js", { name: `sector-decode-${i}` });

            slot.worker = worker;
            worker.onmessage = (event: MessageEvent<WorkerToMainMessage_T>) => this.onMessage(i, event.data);
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

    public isDead(): boolean {
        if (this.mainThreadEngine) return false;

        return this.slots.every(slot => slot.isDead);
    }

    protected pickWorker(stickyIndex?: number, isSector: boolean = false): number {
        const count = isSector && this.slots.length > 1 ? this.slots.length - 1 : this.slots.length;
        // reuse the worker that last decoded this sector if it's sitting idle - it likely
        // still has shared dependency packages warm in memory, which isn't shared across
        // workers. Only when idle though: forcing a busy worker would reintroduce the
        // head-of-line blocking a boundary crossing needs the pool to avoid
        if (stickyIndex !== undefined && stickyIndex < count) {
            const slot = this.slots[stickyIndex];
            if (slot && !slot.isDead && slot.inFlight === 0) return stickyIndex;
        }

        let best = -1, bestLoad = Infinity;

        for (let i = 0; i < count; i++) {
            if (this.slots[i].isDead) continue;
            if (this.slots[i].inFlight < bestLoad) { best = i; bestLoad = this.slots[i].inFlight; }
        }

        return best < 0 && isSector ? this.pickScriptWorker() : best;
    }

    protected pickScriptWorker(): number { // LineageWarrior/LineageEffect script classes drag in a ~1.4GB import closure per worker, keep it to one.
        for (let i = this.slots.length - 1; i >= 0; i--)
            if (!this.slots[i].isDead) return i;

        return -1;
    }

    protected pickCharacterWorker(): number { return this.pickScriptWorker(); }

    public async decodeSector(sectorName: string, settings: LoadSettings_T): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) {
            const { library } = await this.mainThreadEngine.decodeSector(sectorName, settings);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickWorker(this.sectorWorker.get(sectorName), true);

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        this.sectorWorker.set(sectorName, workerIndex);

        return this.dispatch(workerIndex, { type: "decode", sectorName, settings });
    }

    public precacheSector(sectorName: string, settings: LoadSettings_T): Promise<PrecacheResult_T> {
        if (this.mainThreadEngine)
            return this.mainThreadEngine.precacheSector(sectorName, settings);

        const workerIndex = this.pickWorker(undefined, true);

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "precache", sectorName, settings });
    }

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

        this.sectorWorker.set("skylevel", workerIndex); // env layer names carry skylevel's session uuids, both decode in one worker

        return this.dispatch(workerIndex, { type: "decodeEnv" });
    }

    public async decodeCharacter(settings: LoadSettings_T, charIndex: number = 1, faceVariant: number = 0, hairVariant: number = 0, hairColour: number = 0, armor: ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 }, equipment: L2JS.Engine.ICharacterEquipment = null): Promise<DecodeLibrary> {
        const includeAnimations = !this.characterAnimationSets.has(charIndex);

        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeCharacter(settings, charIndex, faceVariant, hairVariant, hairColour, armor, includeAnimations, equipment);

            this.characterAnimationSets.add(charIndex);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickCharacterWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");


        const library = await this.dispatch(workerIndex, { type: "decodeCharacter", settings, charIndex, faceVariant, hairVariant, hairColour, armor, includeAnimations, equipment });

        this.characterAnimationSets.add(charIndex);

        return library;
    }

    public async decodeCharacterEquipment(settings: LoadSettings_T, charIndex: number, hairVariant: number, equipment: L2JS.Engine.ICharacterEquipment): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) return Object.setPrototypeOf(await this.mainThreadEngine.decodeCharacterEquipment(settings, charIndex, hairVariant, equipment), DecodeLibrary.prototype) as DecodeLibrary;

        const workerIndex = this.pickCharacterWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "decodeCharacterEquipment", settings, charIndex, hairVariant, equipment });
    }

    public async decodeSkeletalMesh(settings: LoadSettings_T, packageName: string, meshName: string, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null, equipment: L2JS.Engine.INpcEquipment | null = null): Promise<DecodeLibrary> {
        const bundleName = npcId === null || !packageName ? null : getNpcBundleName(packageName);
        const animationSet = `${packageName}.${meshName}`.toLowerCase();
        const includeAnimations = npcId === null || !this.npcAnimationSets.has(animationSet);

        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeSkeletalMesh(settings, packageName, meshName, scriptClassPath, texturePaths, npcId, includeAnimations, equipment);

            if (npcId !== null) this.npcAnimationSets.add(animationSet);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = npcId === null ? this.pickWorker() : this.pickScriptWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        if (bundleName !== null) this.npcWorker.set(bundleName, workerIndex);

        const library = await this.dispatch(workerIndex, { type: "decodeSkeletalMesh", settings, packageName, meshName, scriptClassPath, texturePaths, npcId, equipment, includeAnimations });

        if (npcId !== null) this.npcAnimationSets.add(animationSet);

        return library;
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
        const visual = record ? record.visualEffect.toLowerCase() === "none" ? JSON.stringify([id, record.name]) : record.visualEffect.toLowerCase() : `${id}:${level}`;
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
        this.pendingSkillRequests.set(key, { requestId, request: this.pending.get(requestId) });

        try { return await promise; }
        finally { this.pendingSkillRequests.delete(key); }
    }

    public listPlayerSkills(includeAssetVariants: boolean = false): Promise<PlayerSkillInfo_T[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.listPlayerSkills(includeAssetVariants);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "listPlayerSkills", includeAssetVariants });
    }

    public decodeUITextures(settings: LoadSettings_T, paths: string[]): Promise<UITexture_T[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeUITextures(settings, paths);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "decodeUITextures", settings, paths });
    }

    public decodeMatineeScenes(levelName: string): Promise<MatineeScene_T[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeMatineeScenes(levelName);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "matineeScenes", levelName });
    }

    public getGameStrings(): Promise<GameStrings_T> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeGameStrings();

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "gameStrings" });
    }

    public resolveNpc(selector: string | number, settings: LoadSettings_T): Promise<INpcDefinition> {
        if (this.mainThreadEngine) return this.mainThreadEngine.resolveNpc(selector, settings);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "resolveNpc", selector, settings });
    }

    public listNpcs(settings: LoadSettings_T): Promise<INpcDefinition[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.listNpcs(settings);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "listNpcs", settings });
    }

    protected pickNpcWorker(bundleName: string): number {
        return this.pickScriptWorker();
    }

    public async precacheNpcBundle(settings: LoadSettings_T, packageName: string): Promise<void> {
        if (this.mainThreadEngine) return this.mainThreadEngine.precacheNpcBundle(settings, packageName);

        const bundleName = getNpcBundleName(packageName);
        const workerIndex = this.pickNpcWorker(bundleName);

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        this.npcWorker.set(bundleName, workerIndex);

        return this.dispatch(workerIndex, { type: "precacheNpcBundle", settings, packageName });
    }

    public async precacheCharacters(settings: LoadSettings_T): Promise<void> {
        if (this.mainThreadEngine) return this.mainThreadEngine.precacheCharacters(settings);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "precacheCharacters", settings });
    }

    public async getCharGroups(): Promise<ICharacterGroup[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeCharGroups();

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "charGroups" });
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

    public getClientConfig(): Promise<ClientConfig_T> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeClientConfig();

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "clientConfig" });
    }

    public getScriptLocalization(scriptClassPath: string): Promise<LocalizationProperty_T[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeScriptLocalization(scriptClassPath);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "scriptLocalization", scriptClassPath });
    }

    public getL2Text(name: string): Promise<string> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeL2Text(name);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "l2Text", name });
    }

    protected dispatch(workerIndex: number, message: any, isRaw: boolean = false): Promise<any> {
        const requestId = this.nextRequestId++;

        this.slots[workerIndex].inFlight++;

        return new Promise((resolve, reject) => {
            this.pending.set(requestId, { resolve, reject, workerIndex, isRaw, copyChunks: true, urgent: message.type === "decodeCharacterEquipment" || message.type === "decodeSkill" && message.urgent });
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

    protected onMessage(workerIndex: number, msg: WorkerToMainMessage_T) {
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
            case "charactersPrecached": {
                const request = this.settlePending(msg.requestId);
                if (!request) break;

                request.resolve(undefined);
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
    }

    protected async processBinaryDecodeQueue(): Promise<void> {
        if (this.isDecodingBinary) return;

        this.isDecodingBinary = true;

        while (this.binaryDecodeQueue.length > 0) {
            const { buffer, library: transferred, request } = this.binaryDecodeQueue.shift();

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
            }
        }

        this.isDecodingBinary = false;
        releaseDisposedTextures();
    }

    protected async processUrgentLibraries(): Promise<void> {
        let index: number;

        while ((index = this.binaryDecodeQueue.findIndex(entry => entry.request.urgent)) >= 0) {
            const { buffer, library: transferred, request } = this.binaryDecodeQueue.splice(index, 1)[0];

            try {
                const library = transferred || await deserializeLibraryAsync(buffer, true);

                shareScript(library);
                refreshSoundBlobUris(library);
                request.resolve(Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary);
            } catch (e) {
                request.reject(e as Error);
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

    public hasPendingAssets(): boolean { return this.pending.size > 0 || this.isDecodingBinary || this.binaryDecodeQueue.length > 0; }

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

    public terminate() {
        clients.delete(this);
        this.slots.forEach(slot => slot.worker.terminate());
    }
}

export default DecodeWorkerClient;
