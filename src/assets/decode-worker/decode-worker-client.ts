import DecodeLibrary from "@l2js/engine/decode-library";
import type { GameStrings_T, MatineeScene_T, UITexture_T, PlayerSkillInfo_T, WorkerToMainMessage_T, PrecacheResult_T, ClientConfig_T, WorkerMemoryStats_T } from "./decode-protocol";
import type { LocalizationProperty_T, LoadSettings_T } from "@l2js/engine/contracts/config";
import type { ICharacterArmorSelection, INpcDefinition, ICharacterGroup } from "@l2js/engine/contracts/pawn";
import type DecodeEngine from "./decode-engine";
import { deserializeLibraryAsync } from "./library-serializer";
import { refreshSoundBlobUris } from "./decode-cache";
import getNpcBundleName from "./npc-bundle";

const cacheScript = { scriptClasses: new Map<string, any>(), scriptFunctions: new Map<string, any>(), scriptStates: new Map<string, any>() };

function shareScript(library: any): void {
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

export class DecodeWorkerClient {
    protected slots: WorkerSlot_T[] = [];
    protected pending = new Map<number, PendingRequest_T>();
    protected readonly cacheScriptBuffers = new Map<string, Promise<ArrayBuffer>>();
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

    protected pickScriptWorker(): number { // LineageWarrior/LineageEffect script classes drag in a ~1.4GB import closure per worker, keep it to one.
        for (let i = this.slots.length - 1; i >= 0; i--)
            if (!this.slots[i].isDead) return i;

        return -1;
    }

    protected pickCharacterWorker(stickyIndex?: number): number {
        if (stickyIndex !== undefined) {
            const slot = this.slots[stickyIndex];

            if (slot && !slot.isDead && slot.inFlight === 0) return stickyIndex;
        }

        let best = -1, bestLoad = Infinity;

        for (let i = this.slots.length - 1; i >= 0; i--) {
            if (this.slots[i].isDead) continue;
            if (this.slots[i].inFlight < bestLoad) { best = i; bestLoad = this.slots[i].inFlight; }
        }

        return best;
    }

    public async decodeSector(sectorName: string, settings: LoadSettings_T): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) {
            const { library } = await this.mainThreadEngine.decodeSector(sectorName, settings);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = sectorName === "skylevel" && this.sectorWorker.has(sectorName) ? this.sectorWorker.get(sectorName) : this.pickWorker(this.sectorWorker.get(sectorName));

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        this.sectorWorker.set(sectorName, workerIndex);

        return this.dispatch(workerIndex, { type: "decode", sectorName, settings });
    }

    public precacheSector(sectorName: string, settings: LoadSettings_T): Promise<PrecacheResult_T> {
        if (this.mainThreadEngine)
            return this.mainThreadEngine.precacheSector(sectorName, settings);

        const workerIndex = this.pickWorker();

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
        const bundleName = npcId === null ? null : getNpcBundleName(packageName);
        const animationSet = `${packageName}.${meshName}`.toLowerCase();
        const includeAnimations = npcId === null || !this.npcAnimationSets.has(animationSet);

        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeSkeletalMesh(settings, packageName, meshName, scriptClassPath, texturePaths, npcId, includeAnimations, equipment);

            if (npcId !== null) this.npcAnimationSets.add(animationSet);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = bundleName === null ? this.pickWorker() : this.pickNpcWorker(bundleName);

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        if (bundleName !== null) this.npcWorker.set(bundleName, workerIndex);

        const library = await this.dispatch(workerIndex, { type: "decodeSkeletalMesh", settings, packageName, meshName, scriptClassPath, texturePaths, npcId, equipment, includeAnimations });

        if (npcId !== null) this.npcAnimationSets.add(animationSet);

        return library;
    }

    public async decodeEffectTemplates(settings: LoadSettings_T, classPaths: string[], soundPaths: string[] = [], scriptClassPaths: string[] = []): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeEffectTemplates(settings, classPaths, soundPaths, scriptClassPaths);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "decodeEffectTemplates", settings, classPaths, soundPaths, scriptClassPaths });
    }

    public async decodeScriptClass(settings: LoadSettings_T, classPath: string): Promise<DecodeLibrary> { // Pawns merge and own their script library, so each gets a fresh copy of the one worker result.
        if (this.mainThreadEngine) return this.decodeEffectTemplates(settings, [], [], [classPath]);

        const library = await deserializeLibraryAsync((await this.getScriptBuffer(settings, classPath)).slice(0));

        shareScript(library);
        refreshSoundBlobUris(library);

        return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
    }

    public async warmScriptClass(settings: LoadSettings_T, classPath: string): Promise<void> { // character decodes run on every worker, each one has to load the script class import closure once
        if (this.mainThreadEngine) return;

        const scriptIndex = this.pickScriptWorker();

        await Promise.all(this.slots.map((slot, i) => slot.isDead || i === scriptIndex ? null : this.dispatch(i, { type: "decodeEffectTemplates", settings, classPaths: [], soundPaths: [], scriptClassPaths: [classPath] })));
    }

    public async prefetchScriptClass(settings: LoadSettings_T, classPath: string): Promise<void> {
        if (this.mainThreadEngine) return;

        await this.getScriptBuffer(settings, classPath);
    }

    protected getScriptBuffer(settings: LoadSettings_T, classPath: string): Promise<ArrayBuffer> {
        if (!this.cacheScriptBuffers.has(classPath)) {
            const workerIndex = this.pickScriptWorker();

            if (workerIndex < 0) throw new Error("Decode worker is dead");

            this.cacheScriptBuffers.set(classPath, this.dispatch(workerIndex, { type: "decodeEffectTemplates", settings, classPaths: [], soundPaths: [], scriptClassPaths: [classPath] }, true));
        }

        return this.cacheScriptBuffers.get(classPath);
    }

    public async decodeItem(settings: LoadSettings_T, id: number): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) return this.mainThreadEngine.decodeItem(settings, id);

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error(`Decode worker is dead`);

        return this.dispatch(workerIndex, { type: "decodeItem", settings, id });
    }

    public async decodeSkill(settings: LoadSettings_T, id: number, level: number): Promise<DecodeLibrary> {
        if (this.mainThreadEngine) {
            const library = await this.mainThreadEngine.decodeSkill(settings, id, level);

            return Object.setPrototypeOf(library, DecodeLibrary.prototype) as DecodeLibrary;
        }

        const workerIndex = this.pickScriptWorker();

        if (workerIndex < 0) throw new Error("Decode worker is dead");

        return this.dispatch(workerIndex, { type: "decodeSkill", settings, id, level });
    }

    public listPlayerSkills(): Promise<PlayerSkillInfo_T[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.listPlayerSkills();

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("decode worker is dead"));

        return this.dispatch(workerIndex, { type: "listPlayerSkills" });
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

    public resolveNpc(selector: string | number): Promise<INpcDefinition> {
        if (this.mainThreadEngine) return this.mainThreadEngine.resolveNpc(selector);

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "resolveNpc", selector });
    }

    public listNpcs(): Promise<INpcDefinition[]> {
        if (this.mainThreadEngine) return this.mainThreadEngine.listNpcs();

        const workerIndex = this.pickWorker();

        if (workerIndex < 0) return Promise.reject(new Error("Decode worker is dead"));

        return this.dispatch(workerIndex, { type: "listNpcs" });
    }

    protected pickNpcWorker(bundleName: string): number { // the bundle and its packages only live in the worker that opened it
        const index = this.npcWorker.get(bundleName);

        if (index !== undefined && !this.slots[index].isDead) return index;

        const scriptIndex = this.pickScriptWorker(); // player skill preloads queue there on world entry
        let best = scriptIndex, bestLoad = Infinity;

        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i].isDead || i === scriptIndex) continue;
            if (this.slots[i].inFlight < bestLoad) { best = i; bestLoad = this.slots[i].inFlight; }
        }

        return best;
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

        const workerIndex = this.pickWorker();

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
            this.pending.set(requestId, { resolve, reject, workerIndex, isRaw });
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
    }

    protected async processBinaryDecodeQueue(): Promise<void> {
        if (this.isDecodingBinary) return;

        this.isDecodingBinary = true;

        while (this.binaryDecodeQueue.length > 0) {
            const { buffer, request } = this.binaryDecodeQueue.shift();

            try {
                if (request.isRaw) { // registers its script entries in worker order, later results may only carry their ids
                    shareScript(await deserializeLibraryAsync(buffer.slice(0)));
                    request.resolve(buffer);
                    continue;
                }

                const library = await deserializeLibraryAsync(buffer);

                shareScript(library);
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
