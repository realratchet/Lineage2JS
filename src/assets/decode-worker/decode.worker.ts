import DecodeEngine from "./decode-engine";
import type { MainToWorkerMessage_T, WorkerToMainMessage_T } from "./decode-protocol";

const ctx = self as any;

// webpack-dev-server expects WorkerLocation.reload in its injected client.
if (typeof ctx.location.reload !== "function") {
    ctx.location.reload = () => { };
}

const DECODE_PACKAGE_IDLE_MS = 30000;
const DECODE_PACKAGE_SWEEP_MS = 5000;
const engine = new DecodeEngine();

function post(message: WorkerToMainMessage_T, transfer?: Transferable[]) {
    ctx.postMessage(message, transfer ?? []);
}

async function handleMessage(msg: MainToWorkerMessage_T) {
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
                const { buffer } = await engine.decodeSectorBinary(msg.sectorName, msg.settings);

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
        case "precacheCharacters": {
            try {
                await engine.precacheCharacters(msg.settings);
                post({ type: "charactersPrecached", requestId: msg.requestId });
            } catch (e) {
                console.error("[decode-worker] failed to precache characters:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "charGroups": {
            try {
                post({ type: "charGroupsDecoded", requestId: msg.requestId, groups: await engine.decodeCharGroups() });
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
                post({ type: "npcResolved", requestId: msg.requestId, npc: await engine.resolveNpc(msg.selector) });
            } catch (e) {
                console.error(`[decode-worker] failed to resolve NPC '${msg.selector}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "listNpcs": {
            try {
                post({ type: "npcsListed", requestId: msg.requestId, npcs: await engine.listNpcs() });
            } catch (e) {
                console.error("[decode-worker] failed to list NPCs:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "decodeUITextures": {
            try {
                const textures = await engine.decodeUITextures(msg.settings, msg.paths);

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
                post({ type: "gameStringsDecoded", requestId: msg.requestId, strings: await engine.decodeGameStrings() });
            } catch (e) {
                console.error("[decode-worker] failed to decode game strings:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "listPlayerSkills": {
            try {
                post({ type: "playerSkillsListed", requestId: msg.requestId, skills: await engine.listPlayerSkills() });
            } catch (e) {
                console.error("[decode-worker] failed to list player skills:", e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "decodeSkeletalMesh": {
            try {
                const buffer = await engine.decodeSkeletalMeshBinary(msg.settings, msg.packageName, msg.meshName, msg.scriptClassPath, msg.texturePaths, msg.npcId, msg.includeAnimations, msg.equipment);

                post({ type: "decoded", requestId: msg.requestId, buffer }, [buffer]);
            } catch (e) {
                console.error(`[decode-worker] failed to decode skeletal mesh '${msg.packageName}.${msg.meshName}':`, e);
                post({ type: "decodeError", requestId: msg.requestId, message: (e as Error)?.message ?? String(e), stack: (e as Error)?.stack });
            }
            break;
        }
        case "decodeEffectTemplates": {
            try {
                const buffer = await engine.decodeEffectTemplatesBinary(msg.settings, msg.classPaths, msg.soundPaths, msg.scriptClassPaths);

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
                const buffer = await engine.decodeSkillBinary(msg.settings, msg.id, msg.level);

                post({ type: "decoded", requestId: msg.requestId, buffer }, [buffer]);
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
        case "memoryStats": {
            post({ type: "memoryStatsDecoded", requestId: msg.requestId, stats: engine.getMemoryStats() });
            break;
        }
        case "clientConfig": {
            try {
                post({ type: "clientConfigDecoded", requestId: msg.requestId, config: await engine.decodeClientConfig() });
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

function onMessage(event: MessageEvent<MainToWorkerMessage_T>) {
    arrMessages.push(event.data);
    void processMessages();
}

async function processMessages(): Promise<void> {
    if (isProcessingMessages) return;

    isProcessingMessages = true;

    while (arrMessages.length > 0)
        await handleMessage(arrMessages.shift()!);

    isProcessingMessages = false;
}

ctx.onmessage = onMessage;

setInterval(() => { if (!isProcessingMessages) engine.releaseDecodePackages(DECODE_PACKAGE_IDLE_MS); }, DECODE_PACKAGE_SWEEP_MS);
