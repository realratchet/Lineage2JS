import DecodeEngine from "./decode-engine";
import type { MainToWorkerMessage_T, WorkerToMainMessage_T } from "./decode-protocol";
import { selectAssetFiles, setServedAssets } from "../asset-source";
import { withAssetSources, releaseAssetSources } from "../unreal/asset-handle";
import { setLoadingStepHandler } from "../../loading-profile";
import { serializeLibraryBlob } from "./library-serializer";

const ctx = self as any;

// webpack-dev-server expects WorkerLocation.reload in its injected client.
if (typeof ctx.location.reload !== "function") {
    ctx.location.reload = () => { };
}

const engine = new DecodeEngine();
const loadingLabels: Record<string, string> = { read: "Reading", dependencies: "Loading package", convert: "Converting", cache: "Writing cache", load: "Loading built package" };
let flushLoadingProgress: (requestId: number) => void = null;

function post(message: WorkerToMainMessage_T, transfer?: Transferable[]) {
    if (flushLoadingProgress && "requestId" in message && message.type !== "sectorCache") flushLoadingProgress(message.requestId);
    ctx.postMessage(message, transfer ?? []);
}

async function handleProfiledMessage(message: MainToWorkerMessage_T): Promise<void> {
    if (!("requestId" in message) || message.type === "memoryStats") return handleMessage(message);

    const requestId = message.requestId, started = performance.timeOrigin + performance.now(), steps: Record<string, { ms: number, count: number }> = {}, active = new Map<number, { kind: string, name: string }>();
    let lastUpdate = 0, progressTimer = 0;

    function updateProgress(id: number = requestId) {
        if (id !== requestId) return;

        clearTimeout(progressTimer);
        progressTimer = 0;
        lastUpdate = performance.now();
        ctx.postMessage({ type: "loadingProgress", profile: { requestId, started, active: [...active.values()].map(step => step.kind === "lock" ? "Waiting for cache access" : `${loadingLabels[step.kind] || step.kind} ${step.name}`).slice(-1)[0] || message.type, steps, packages: [...active.values()].filter(step => step.kind !== "lock") } });
    }

    flushLoadingProgress = updateProgress;
    setLoadingStepHandler((id, kind, name, start, elapsed) => {
        if (elapsed < 0) active.set(id, { kind, name: name.replace(/^assets\//, "") });
        else {
            active.delete(id);
            const row = steps[kind] || (steps[kind] = { ms: 0, count: 0 });

            row.ms += elapsed;
            row.count++;
            if (kind === "lock") {
                const lock = steps[`lock:${name}`] || (steps[`lock:${name}`] = { ms: 0, count: 0 });
                lock.ms += elapsed;
                lock.count++;
            }
        }
        if (performance.now() - lastUpdate >= 250) updateProgress();
        else if (!progressTimer) progressTimer = setTimeout(updateProgress, 250 - (performance.now() - lastUpdate)) as any;
    });
    updateProgress();

    try {
        await handleMessage(message);
    } finally {
        clearTimeout(progressTimer);
        setLoadingStepHandler(null);
        flushLoadingProgress = null;
    }
}

async function handleMessage(msg: MainToWorkerMessage_T) {
    switch (msg.type) {
        case "init": {
            try {
                setServedAssets(msg.servedAssets);
                if (msg.assetFiles) await selectAssetFiles(msg.assetFiles);

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
                const { library } = await engine.decodeSectorTransfer(msg.sectorName, msg.settings, fromCache => post({ type: "sectorCache", requestId: msg.requestId, sectorName: msg.sectorName, fromCache }));

                if (msg.flushAssets) await engine.flushStoredAssets();

                const buffer = await serializeLibraryBlob(library).arrayBuffer();
                post({ type: "decoded", requestId: msg.requestId, buffer }, [buffer]);
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
        case "sectorPackages": {
            try {
                post({ type: "sectorPackagesListed", requestId: msg.requestId, packages: await engine.getSectorPackages(msg.sectorName, msg.settings, packages => ctx.postMessage({ type: "sectorPackagesReady", ready: { requestId: msg.requestId, packages } })) });
            } catch (error) {
                post({ type: "decodeError", requestId: msg.requestId, message: (error as Error).message });
            }
            break;
        }
        case "packageDependencies": {
            try {
                const packages = await engine.getPackageDependencies(msg.path, msg.settings, packages => ctx.postMessage({ type: "sectorPackagesReady", ready: { requestId: msg.requestId, packages } }));
                post({ type: "sectorPackagesListed", requestId: msg.requestId, packages });
            } catch (error) {
                post({ type: "decodeError", requestId: msg.requestId, message: (error as Error).message });
            }
            break;
        }
        case "precachePackage": {
            try {
                await engine.precachePackage(msg.path, msg.settings, false, msg.lockHeld);
                post({ type: "packagePrecached", requestId: msg.requestId });
            } catch (error) {
                post({ type: "decodeError", requestId: msg.requestId, message: (error as Error).message });
            }
            break;
        }
        case "free": {
            engine.freeSector(msg.sectorName);
            break;
        }
        case "decodeEnv": {
            try {
                const info = await engine.decodeEnvConfig(msg.settings);
                const transfer = engine.collectTransferables(info);

                post({ type: "envDecoded", requestId: msg.requestId, info }, transfer);
            } catch (e) {
                console.error("[decode-worker] failed to decode env config:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
        case "precacheCharacters": {
            try {
                await engine.precacheCharacters(msg.settings, msg.charIndex);
                await engine.flushStoredAssets();
                post({ type: "charactersPrecached", requestId: msg.requestId });
            } catch (e) {
                console.error("[decode-worker] failed to precache characters:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "precacheNpcBundle": {
            try {
                await engine.precacheNpcBundle(msg.settings, msg.packageName);
                await engine.flushStoredAssets();
                post({ type: "npcBundlePrecached", requestId: msg.requestId });
            } catch (e) {
                console.error(`[decode-worker] failed to precache npc bundle '${msg.packageName}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "charGroups": {
            try {
                post({ type: "charGroupsDecoded", requestId: msg.requestId, groups: await engine.decodeCharGroups(msg.settings) });
            } catch (e) {
                console.error("[decode-worker] failed to decode character groups:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "decodeCharacter": {
            try {
                const buffer = await engine.decodeCharacterBinary(msg.settings, msg.charIndex, msg.faceVariant, msg.hairVariant, msg.hairColour, msg.armor, msg.includeAnimations, msg.equipment);

                post({ type: "decoded", requestId: msg.requestId, buffer }, [buffer]);
            } catch (e) {
                console.error("[decode-worker] failed to decode character:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "decodeCharacterEquipment": {
            try {
                const buffer = await engine.decodeCharacterEquipmentBinary(msg.settings, msg.charIndex, msg.hairVariant, msg.equipment);

                post({ type: "decoded", requestId: msg.requestId, buffer }, [buffer]);
            } catch (e) {
                console.error("[decode-worker] failed to decode character equipment:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "resolveNpc": {
            try {
                post({ type: "npcResolved", requestId: msg.requestId, npc: await engine.resolveNpc(msg.selector, msg.settings) });
            } catch (e) {
                console.error(`[decode-worker] failed to resolve NPC '${msg.selector}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "listNpcs": {
            try {
                post({ type: "npcsListed", requestId: msg.requestId, npcs: await engine.listNpcs(msg.settings) });
            } catch (e) {
                console.error("[decode-worker] failed to list NPCs:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "decodeUITextures": {
            try {
                const textures = await engine.decodeUITextures(msg.settings, msg.paths, msg.useIntrinsicAlpha);

                post({ type: "uiTexturesDecoded", requestId: msg.requestId, textures }, textures.flatMap(texture => texture.frames));
            } catch (e) {
                console.error("[decode-worker] failed to decode UI textures:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "matineeScenes": {
            try {
                post({ type: "matineeScenesDecoded", requestId: msg.requestId, scenes: await engine.decodeMatineeScenes(msg.levelName) });
            } catch (e) {
                console.error(`[decode-worker] failed to decode matinee scenes of '${msg.levelName}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "gameStrings": {
            try {
                const strings = await engine.decodeGameStrings(msg.settings);
                const transfer = engine.collectTransferables(strings.zoneNameMasks);

                post({ type: "gameStringsDecoded", requestId: msg.requestId, strings }, transfer);
            } catch (e) {
                console.error("[decode-worker] failed to decode game strings:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "listPlayerSkills": {
            try {
                post({ type: "playerSkillsListed", requestId: msg.requestId, skills: await engine.listPlayerSkills(msg.includeAssetVariants) });
            } catch (e) {
                console.error("[decode-worker] failed to list player skills:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "decodeSkeletalMesh": {
            try {
                const library = await engine.decodeSkeletalMeshTransfer(msg.settings, msg.packageName, msg.meshName, msg.scriptClassPath, msg.texturePaths, msg.npcId, msg.includeAnimations, msg.equipment);

                post({ type: "decoded", requestId: msg.requestId, library });
            } catch (e) {
                console.error(`[decode-worker] failed to decode skeletal mesh '${msg.packageName}.${msg.meshName}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "decodeVehicle": {
            try {
                const buffer = await engine.decodeVehicleBinary(msg.settings);

                post({ type: "decoded", requestId: msg.requestId, buffer }, [buffer]);
            } catch (e) {
                console.error("[decode-worker] failed to decode vehicle:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error).message, stack: (e as Error).stack });
            }
            break;
        }
        case "decodeEffectTemplates": {
            try {
                const buffer = await engine.decodeEffectTemplatesBinary(msg.settings, msg.classPaths, msg.soundPaths, msg.scriptClassPaths, msg.requiredSounds);

                post({ type: "decoded", requestId: msg.requestId, buffer }, [buffer]);
            } catch (e) {
                console.error("[decode-worker] failed to decode effect templates:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "decodeItem": {
            try {
                const buffer = await engine.decodeItemBinary(msg.settings, msg.id);

                post({ type: "decoded", requestId: msg.requestId, buffer }, [buffer]);
            } catch (e) {
                console.error(`[decode-worker] failed to decode item '${msg.id}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error).message, stack: (e as Error).stack });
            }
            break;
        }
        case "decodeSkill": {
            try {
                const library = await engine.decodeSkillTransfer(msg.settings, msg.id, msg.level, msg.urgent, msg.record);

                post({ type: "decoded", requestId: msg.requestId, library });
            } catch (e) {
                console.error(`[decode-worker] failed to decode skill '${msg.id}:${msg.level}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
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
        case "clientConfig": {
            try {
                post({ type: "clientConfigDecoded", requestId: msg.requestId, config: await engine.decodeClientConfig(msg.settings) });
            } catch (e) {
                console.error("[decode-worker] failed to decode client config:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
        case "scriptLocalization": {
            try {
                post({ type: "scriptLocalizationDecoded", requestId: msg.requestId, properties: await engine.decodeScriptLocalization(msg.scriptClassPath) });
            } catch (e) {
                console.error(`[decode-worker] failed to decode script localization '${msg.scriptClassPath}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
        case "l2Text": {
            try {
                post({ type: "l2TextDecoded", requestId: msg.requestId, text: await engine.decodeL2Text(msg.name) });
            } catch (e) {
                console.error(`[decode-worker] failed to decode l2text '${msg.name}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e) });
            }
            break;
        }
    }
}

const arrMessages: MainToWorkerMessage_T[] = [];
let isProcessingMessages = false;

function isUrgentMessage(message: MainToWorkerMessage_T): boolean {
    return message.type === "decodeCharacterEquipment" || message.type === "decodeCharacter" || message.type === "decodeSkill" && message.urgent;
}

function queueMessage(message: MainToWorkerMessage_T): void {
    const index = isUrgentMessage(message) ? arrMessages.findIndex(entry => !isUrgentMessage(entry)) : -1;

    if (index < 0) arrMessages.push(message);
    else arrMessages.splice(index, 0, message);
}

function onMessage(event: MessageEvent<MainToWorkerMessage_T>) {
    const message = event.data;

    if (message.type === "memoryStats") {
        post({ type: "memoryStatsDecoded", requestId: message.requestId, stats: engine.getMemoryStats() });
        return;
    }
    if (message.type === "maintenance") {
        if (!isProcessingMessages && arrMessages.length === 0) void maintainPackages();
        return;
    }
    if (message.type === "promoteSkill") {
        const index = arrMessages.findIndex(entry => entry.type === "decodeSkill" && entry.requestId === message.requestId);

        if (index >= 0) {
            const skill = arrMessages.splice(index, 1)[0] as Extract<MainToWorkerMessage_T, { type: "decodeSkill" }>;
            skill.urgent = true;
            queueMessage(skill);
        }
        return;
    }
    if (message.type === "forgetSharedTextures") {
        engine.forgetSharedTextures(message.keys);
        return;
    }
    if (message.type === "forgetSharedSounds") {
        engine.forgetSharedSounds(message.keys);
        return;
    }
    if (message.type === "confirmSharedTextures") {
        engine.confirmSharedTextures(message.keys);
        return;
    }
    if (message.type === "confirmSharedScript") {
        engine.confirmSharedScript(message.keys);
        return;
    }
    queueMessage(message);
    void processMessages();
}

async function processMessages(): Promise<void> {
    if (isProcessingMessages || arrMessages.length === 0) return;

    isProcessingMessages = true;

    await withAssetSources(async () => {
        while (arrMessages.length > 0)
            await handleProfiledMessage(arrMessages.shift()!);
    });

    isProcessingMessages = false;
}

ctx.onmessage = onMessage;

async function maintainPackages(): Promise<void> {
    isProcessingMessages = true;
    try {
        await engine.flushStoredAssets();
        engine.releaseDecodePackages(0);
        await releaseAssetSources();
    } finally {
        isProcessingMessages = false;
        void processMessages();
    }
}
