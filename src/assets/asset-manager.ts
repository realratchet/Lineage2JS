import RenderManager from "@client/rendering/render-manager";
import BaseActor from "@client/base-actor";
import UConfigWarrior from "@client/assets/unreal/conf-files/un-conf-warrior";
import UConfigLocalization, { LocalizationProperty_T } from "@client/assets/unreal/conf-files/un-conf-localization";
import { UnProperties } from "@l2js/core";

// matches decodeCharacter's own default charIndex
const DEFAULT_CHAR_INDEX = 1;
import { WebGLCapabilities } from "three/src/renderers/webgl/WebGLCapabilities";
import { createSectorStaticMeshDecodeJob, decodeObject3D, decodePackage, decodeSectorCore, stepSectorStaticMeshDecodeJob, SectorStaticMeshDecodeJob_T } from "@client/assets/decoders/object3d-decoder";
import decodeEnv from "@client/assets/decoders/env-decoder";
import DecodeWorkerClient from "@client/assets/decode-worker/decode-worker-client";
import { getUserConfig } from "@unreal/conf-files/un-conf-system";
import { AnimationClip, Matrix4, Vector3 } from "three";
import type { SectorObject } from "@client/objects/zone-object";
import UnScriptVM from "@client/ue-script/vm";
import LineagePlayerController from "@client/objects/lineage-player-controller";

const tmpCameraPosition = new Vector3();
const tmpAttachMatrix = new Matrix4();
const tmpPawnSoundPosition = new Vector3();
const tmpNpcFloorStart = new Vector3();
const npcFloorDirection = new Vector3(0, 0, -1);
const npcSpawnOffset = new Vector3(-600, -600, 0);

const FAILED_SECTOR_RETRY_MS = 30_000;
const RETIRED_SECTOR_DISPOSE_MS = 30_000;
const MAX_RETIRED_SECTORS = 3; // Caps grace-period libraries during rapid boundary crossings.
const SECTOR_WORLD_SIZE = 256 * 128;
const SECTOR_PREFETCH_LOOKAHEAD_MS = 1500;
const SECTOR_PREFETCH_MAX_DISTANCE = SECTOR_WORLD_SIZE;
const STATIC_MESH_BUILD_FRAME_MS = 2;
const BIND_POSE_EPSILON = 1e-3;
const NPC_SPAWN_FLOOR_DISTANCE = 2000;
const LANDMARK_EFFECTS = ["LineageEffect.e_u093_a", "LineageEffect.e_u093_b"];
const UNDERWATER_EFFECTS = ["LineageEffect.e_u061_cam", "LineageEffect.e_u061_beam"];
const PLAYER_CONTROLLER_CLASS = "Engine.LineagePlayerController";

const tmpPrefetchPosition = new Vector3();
const tmpCameraMovement = new Vector3();

type PendingStaticMeshBuild_T = { sector: SectorObject, library: GD.DecodeLibrary, decodeJob: SectorStaticMeshDecodeJob_T };
type AssetList_T = { supported: Record<string, string>, unsupported: string[] };

function findScriptField(library: GD.DecodeLibrary, classId: string, name: string): GD.IScriptFieldDecodeInfo {
    const lowerName = name.toLowerCase();
    let cls = library.scriptClasses[classId];

    while (cls) {
        const field = cls.fields.find(field => field.name.toLowerCase() === lowerName);

        if (field) return field;
        cls = cls.superClassId ? library.scriptClasses[cls.superClassId] : null;
    }

    throw new Error(`UnrealScript class '${classId}' has no property '${name}'.`);
}

function findScriptDefault(library: GD.DecodeLibrary, classId: string, name: string): GD.ScriptPropertyValue_T {
    const lowerName = name.toLowerCase();
    let cls = library.scriptClasses[classId];

    while (cls) {
        const key = Object.keys(cls.defaults).find(key => key.toLowerCase() === lowerName);

        if (key) return cls.defaults[key];
        cls = cls.superClassId ? library.scriptClasses[cls.superClassId] : null;
    }

    throw new Error(`UnrealScript class '${classId}' has no default for '${name}'.`);
}

function parseLocalizedValue(field: GD.IScriptFieldDecodeInfo, value: string): GD.ScriptPropertyValue_T {
    switch (field.type.toLowerCase()) {
        case "name":
        case "str":
        case "string": return value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"' ? value.slice(1, -1) : value;
        case "byte":
        case "int":
        case "float": {
            const number = Number(value);

            if (!Number.isFinite(number)) throw new Error(`Localized UnrealScript property '${field.id}' has invalid number '${value}'.`);

            return number;
        }
        case "bool":
            if (/^(true|1)$/i.test(value)) return true;
            if (/^(false|0)$/i.test(value)) return false;
            throw new Error(`Localized UnrealScript property '${field.id}' has invalid bool '${value}'.`);
        default: throw new Error(`Localized UnrealScript property '${field.id}' has unsupported type '${field.type}'.`);
    }
}

function applyScriptLocalization(library: GD.DecodeLibrary, classId: string, properties: LocalizationProperty_T[]): void {
    const cls = library.scriptClasses[classId];

    if (!cls) throw new Error(`UnrealScript class '${classId}' is not in '${library.name}'.`);

    for (const property of properties) {
        const field = findScriptField(library, classId, property.name);

        if (!(field.flags & UnProperties.PropertyFlags_T.CPF_Localized)) throw new Error(`UnrealScript property '${field.id}' is not localized.`);

        if (property.index < 0) {
            cls.defaults[field.name] = parseLocalizedValue(field, property.value);
            continue;
        }

        const inherited = findScriptDefault(library, classId, field.name);

        if (!Array.isArray(inherited)) throw new Error(`Localized UnrealScript property '${field.id}' is not an array.`);
        if (property.index >= field.arrayDimensions) continue;

        const values = Array.isArray(cls.defaults[field.name]) ? (cls.defaults[field.name] as GD.ScriptPropertyValue_T[]).slice() : inherited.slice();

        values[property.index] = parseLocalizedValue(field, property.value);
        cls.defaults[field.name] = values;
    }
}

function playPawnAnimationSound(renderManager: RenderManager, library: GD.DecodeLibrary, actor: BaseActor, notify: GD.IAnimationNotifyDecodeInfo): void {
    const object = notify.object;

    if (!object || object.type !== "sound") return;

    const info = object;

    if (Math.random() * 100 >= info.random) return;

    let soundName = object.sound;

    if (!soundName) {
        const sounds = actor.isSwimmingMovement()
            ? actor.isWalkingMovement() ? info.waterWalkSounds : info.waterRunSounds
            : actor.isWalkingMovement() ? info.defaultWalkSounds : info.defaultRunSounds;

        if (sounds.length === 0) return;

        soundName = sounds[Math.floor(Math.random() * sounds.length)];
    }

    const sound = library.soundBlobCache.get(soundName);

    if (!sound?.uri) throw new Error(`Pawn '${actor.name}' has no decoded sound '${soundName}'.`);

    actor.getWorldPosition(tmpPawnSoundPosition);
    renderManager.audioManager.playOneShotSound(sound.uri, tmpPawnSoundPosition, info.volume / 255, 1, info.radius, info.radius * 100);
}

function playPawnSwimSound(renderManager: RenderManager, library: GD.DecodeLibrary, actor: BaseActor, info: GD.IAnimationSwimSoundNotifyDecodeInfo): void {
    if (!actor.isSwimmingMovement()) return;

    const soundSet = actor.isUnderwaterMovement() ? info.underwater : info.surface;

    if (!soundSet) throw new Error(`Swim sound notify '${info.objectName}' has no audio profile.`);
    if (Math.random() * 100 >= soundSet.random) return;

    const soundName = soundSet.sounds[Math.floor(Math.random() * soundSet.sounds.length)];
    const sound = library.soundBlobCache.get(soundName);

    if (!sound?.uri) throw new Error(`Pawn '${actor.name}' has no decoded swim sound '${soundName}'.`);

    actor.getWorldPosition(tmpPawnSoundPosition);
    renderManager.audioManager.playOneShotSound(sound.uri, tmpPawnSoundPosition, soundSet.volume / 255, 1, soundSet.radius, soundSet.radius * 100);
}

function getNpcEnterSoundUri(library: GD.DecodeLibrary, event: GD.INpcEnterEvent): string {
    if (!event.sound || event.sound.toLowerCase() === "none") return null;

    const soundName = library.sounds[event.sound];
    const sound = library.soundBlobCache.get(soundName);

    if (!sound?.uri) throw new Error(`NPC enter sound '${event.sound}' failed to decode.`);

    return sound.uri;
}

function setPawnAnimationNotifies(renderManager: RenderManager, library: GD.DecodeLibrary, actor: BaseActor): void {
    actor.setAnimationNotifyHandler((actor, notify) => {
        const object = notify.object;

        if (!object) return;

        switch (object.type) {
            case "sound": playPawnAnimationSound(renderManager, library, actor, notify); break;
            case "swimSound": playPawnSwimSound(renderManager, library, actor, object); break;
            case "screenFade": renderManager.screenFadeBlink(object); break;
            case "viewShake": renderManager.addViewShake(actor, object); break;
        }
    });
}

/**
 * Streams the world in and out around the camera. All ue2 asset decoding happens in
 * the decode worker (its own webpack bundle) - this side only ever sees plain decoded
 * data and instantiates three.js objects from it.
 */
class AssetManager {
    protected isTicking: boolean = false;
    protected loadSettings: GD.LoadSettings_T;
    protected glCapabilities: WebGLCapabilities
    protected decodeWorker: DecodeWorkerClient = null;
    protected isWorkerReady = false;
    protected failedSectors = new Map<string, number>(); // sector id -> retry-after timestamp
    protected retiredSectors = new Map<string, { sector: SectorObject, retiredAt: number }>(); // hidden, awaiting disposal
    protected inFlightSectors = new Set<string>(); // sector ids currently decoding, so a boundary crossing can't re-request them

    protected readonly pendingStaticMeshBuilds: PendingStaticMeshBuild_T[] = [];
    protected readonly levelSectors = new Set<string>(); // sector ids that have a level package
    protected readonly localizationFiles = new Map<string, string>();
    protected preferCompressedTextures = false; // resolved from loadSettings.textures + gpu caps
    public userConfig: GA.IUserConfig = null;
    protected warriorConfig: UConfigWarrior = null;
    protected readonly scriptLocalizations = new Map<string, UConfigLocalization>();
    protected charGroups: GD.ICharacterGroup[] = null;
    protected effectLibrary: GD.DecodeLibrary = null;
    protected readonly decodeWorkerPoolSize: number;
    protected readonly maxConcurrentDecodes: number; // 0 = main thread, still processes one decode at a time
    protected readonly lastCameraPosition = new Vector3();
    protected lastCameraSampleTime = 0;

    /**
     * Sectors whose bounds intersect this radius around the camera or its projected
     * position get loaded. Unloading only kicks in past the larger radius so boundary
     * crossings don't thrash.
     */
    protected readonly renderDistance = SECTOR_WORLD_SIZE / 2;
    protected readonly unloadDistance = SECTOR_WORLD_SIZE;

    public constructor(loadSettings: GD.LoadSettings_T, assetList: AssetList_T) {
        this.loadSettings = loadSettings;
        this.decodeWorkerPoolSize = loadSettings.decodeWorkerPoolSize ?? 3;
        this.maxConcurrentDecodes = Math.max(this.decodeWorkerPoolSize, 1);

        /* level packages are <x>_<y>.unr - keep the sector ids for map-edge validity checks */
        for (const path of Object.keys(assetList.supported)) {
            if (!path.endsWith(".unr")) continue;

            this.levelSectors.add(path.slice(path.lastIndexOf("/") + 1, -".unr".length));
        }

        for (const path of assetList.unsupported)
            if (path.toLowerCase().endsWith(".int")) this.localizationFiles.set(path.toLowerCase(), path);
    }

    public hasSector(sectorIdx: string): boolean {
        return this.levelSectors.has(sectorIdx.toLowerCase());
    }

    public async initialize(renderManager: RenderManager): Promise<void> {
        this.glCapabilities = renderManager.renderer.capabilities;

        // with s3tc the dxt data uploads as-is (full mip chain, 4-8x less vram),
        // otherwise the worker converts to rgba like before
        const textureMode = (this.loadSettings as any).textures ?? "auto";
        const hasS3TC = !!renderManager.renderer.extensions.get("WEBGL_compressed_texture_s3tc");

        this.preferCompressedTextures = textureMode === "compressed" || (textureMode === "auto" && hasS3TC);
        (this.loadSettings as any).rgbaTextures = !this.preferCompressedTextures;

        this.userConfig = await getUserConfig();

        /* everything below comes out of the decode worker - the app cannot run without it */
        this.decodeWorker = new DecodeWorkerClient(this.decodeWorkerPoolSize);
        await this.decodeWorker.ready;
        this.isWorkerReady = true;

        const warriorConfig = await new UConfigWarrior("assets/system/lineagewarrior.int").decode();

        this.warriorConfig = await warriorConfig.load();
        this.charGroups = await this.decodeWorker.getCharGroups();

        const envInfo = await this.decodeWorker.decodeEnv();
        const musicInfo = await this.decodeWorker.getMusicInfo();
        const characterLibrary = await this.decodeWorker.decodeCharacter(this.loadSettings);
        const playerControllerLibrary = await this.decodeWorker.decodeEffectTemplates(this.loadSettings, [], [], [PLAYER_CONTROLLER_CLASS]);
        const playerController = new LineagePlayerController(playerControllerLibrary);
        const underwaterLoopSound = playerController.underWaterLoopSound;
        const effectLibrary = await this.decodeWorker.decodeEffectTemplates(this.loadSettings, [...LANDMARK_EFFECTS, ...UNDERWATER_EFFECTS], [underwaterLoopSound]);
        const skyLibrary = await this.decodeWorker.decodeSector("skylevel", {
            ...this.loadSettings, isSkyLevel: true,
            loadTerrain: true,
            loadBaseModel: true,
            loadStaticModels: false,
            loadEmitters: false,
            loadStaticModelList: undefined,
            loadAudio: false,
            batching: { staticMeshes: false, terrain: false }
        });

        skyLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (skyLibrary as any).preferCompressedTextures = this.preferCompressedTextures;
        effectLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (effectLibrary as any).preferCompressedTextures = this.preferCompressedTextures;

        this.effectLibrary = effectLibrary;

        this.applyCharacter(renderManager, characterLibrary, undefined, DEFAULT_CHAR_INDEX);

        renderManager.underWaterEffect.setEffects(this.createEffect(UNDERWATER_EFFECTS[0]), this.createEffect(UNDERWATER_EFFECTS[1]));

        const underwaterSoundName = effectLibrary.sounds[underwaterLoopSound];
        const underwaterSound = effectLibrary.soundBlobCache.get(underwaterSoundName);

        if (!underwaterSound?.uri) throw new Error(`Underwater loop sound '${underwaterLoopSound}' failed to decode.`);

        renderManager.audioManager.setUnderwaterLoopSound(underwaterSound.uri);

        renderManager.setEnv(decodeEnv(envInfo));
        renderManager.setSky(decodePackage(skyLibrary));
        renderManager.audioManager.setMusicInfo(musicInfo);
    }

    public createLandmarkEffect(classPath: string): THREE.Object3D {
        return this.createEffect(classPath);
    }

    public createEffect(classPath: string): THREE.Object3D {
        if (!this.effectLibrary) throw new Error("Effect templates have not loaded.");

        const info = this.effectLibrary.effectTemplates[classPath] || this.effectLibrary.effectTemplates[classPath.toLowerCase()];

        if (!info) throw new Error(`Effect template '${classPath}' is missing.`);

        return decodeObject3D(this.effectLibrary, info);
    }

    protected applyCharacter(renderManager: RenderManager, characterLibrary: GD.DecodeLibrary, actor?: BaseActor, charIndex: number = DEFAULT_CHAR_INDEX) {
        characterLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (characterLibrary as any).preferCompressedTextures = this.preferCompressedTextures;

        const bodyparts = characterLibrary.pawnActors.map(info => decodeObject3D(characterLibrary, info) as THREE.SkinnedMesh);
        const animations = (bodyparts[0] as any).meshAnimations as Record<string, THREE.AnimationClip>;
        const player = actor || renderManager.player;

        if (!animations) throw new Error(`'${characterLibrary.name}' animations failed to decode.`);

        shareSkeletons(bodyparts);
        attachLooseBoneChains(bodyparts);

        const declared = this.warriorConfig.getAnimations(this.getClassName(charIndex));

        player.setAnimations(animations);
        player.setIdleAnimation(findAnimation(animations, declared.wait));
        player.setWalkingAnimation(findAnimation(animations, declared.walk));
        player.setRunningAnimation(findAnimation(animations, declared.run));
        player.setDeathAnimation(findAnimation(animations, declared.death));
        player.setFallingAnimation(findAnimation(animations, declared.falling));
        player.setSwimmingAnimation(findAnimation(animations, declared.swim));
        player.setSwimmingIdleAnimation(findAnimation(animations, declared.swimWait));
        player.setMeshes(bodyparts);
        player.initAnimations();
        setPawnAnimationNotifies(renderManager, characterLibrary, player);
    }

    public async loadCharacter(renderManager: RenderManager, charIndex: number, faceVariant: number, hairVariant: number, hairColour: number, armor: GD.ICharacterArmorSelection, actor?: BaseActor) {
        this.applyCharacter(renderManager, await this.decodeWorker.decodeCharacter(this.loadSettings, charIndex, faceVariant, hairVariant, hairColour, armor), actor, charIndex);
        renderManager.needsUpdate = true;
    }

    public async loadSkeletalActor(renderManager: RenderManager, packageName: string, meshName: string, idleAnimation: string, actor: BaseActor, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null, enterAnimation: string = null) {
        const localizationPromise = scriptClassPath ? this.getScriptLocalization(scriptClassPath) : null;
        const [library, localization] = await Promise.all([this.decodeWorker.decodeSkeletalMesh(this.loadSettings, packageName, meshName, scriptClassPath, texturePaths, npcId), localizationPromise]);

        library.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (library as any).preferCompressedTextures = this.preferCompressedTextures;

        const meshes = library.pawnActors.map(info => decodeObject3D(library, info) as THREE.SkinnedMesh);
        const animations = (meshes[0] as any).meshAnimations as Record<string, THREE.AnimationClip>;

        if (!animations) throw new Error(`'${library.name}' animations failed to decode.`);

        if (Object.keys(animations).length === 0) {
            animations[idleAnimation] = new AnimationClip(idleAnimation, 0, []);

            if (enterAnimation && enterAnimation.toLowerCase() !== "none") animations[enterAnimation] = new AnimationClip(enterAnimation, 0, []);
        }

        const idle = findNpcIdleAnimation(animations, idleAnimation);

        actor.setAnimations(animations);
        actor.setIdleAnimation(idle);
        actor.setWalkingAnimation(findNpcMovementAnimation(animations, "walk", idle));
        actor.setRunningAnimation(findNpcMovementAnimation(animations, "run", idle));
        actor.setDeathAnimation(idle);
        actor.setFallingAnimation(idle);
        actor.setSwimmingAnimation(idle);
        actor.setSwimmingIdleAnimation(idle);
        actor.setMeshes(meshes);
        actor.initAnimations();
        setPawnAnimationNotifies(renderManager, library, actor);

        if (scriptClassPath) {
            const classId = library.pawnActors[0].scriptClassId;

            if (!classId) throw new Error(`'${library.name}' has no transferred script class.`);

            applyScriptLocalization(library, classId, localization);

            actor.setScriptRuntime(new UnScriptVM(library), classId, effectClassId => {
                const info = library.effectTemplates[effectClassId] || library.effectTemplates[effectClassId.toLowerCase()];

                if (!info) {
                    const actorInfo = library.actorTemplates[effectClassId] || library.actorTemplates[effectClassId.toLowerCase()];

                    if (!actorInfo) throw new Error(`Script object template '${effectClassId}' is not in '${library.name}'.`);

                    const object = decodeObject3D(library, actorInfo) as any;

                    object.scriptClassId = actorInfo.scriptClassId;
                    return object;
                }

                const effect = decodeObject3D(library, info) as any;

                effect.scriptProperties.set("Emitters", effect.children);

                effect.children.forEach((emitter: any) => {
                    emitter.scriptClassId = "Engine.ParticleEmitter";
                    emitter.isActorAttachedEmitter = true;
                });

                return effect;
            });
            actor.setUnrealScriptProperty("bActorShadows", false); // RenderManager owns the shared pawn projector pass.

            if (npcId !== null) actor.setDeathAnimationFromScript();
        }

        renderManager.needsUpdate = true;

        return library;
    }

    protected async getScriptLocalization(scriptClassPath: string): Promise<LocalizationProperty_T[]> {
        const separator = scriptClassPath.indexOf(".");

        if (separator < 1 || separator === scriptClassPath.length - 1) throw new Error(`Invalid UnrealScript class path '${scriptClassPath}'.`);

        const packageName = scriptClassPath.slice(0, separator).toLowerCase();
        const className = scriptClassPath.slice(separator + 1);
        const path = this.localizationFiles.get(`system/${packageName}.int`);

        if (!path) return [];

        let config = this.scriptLocalizations.get(packageName);

        if (!config) {
            config = await new UConfigLocalization(`assets/${path}`).decode();
            await config.load();
            this.scriptLocalizations.set(packageName, config);
        }

        return config.getProperties(className);
    }

    public async spawnNpc(renderManager: RenderManager, selector: string | number, position: Vector3 = null): Promise<BaseActor> {
        const npc = await this.decodeWorker.resolveNpc(selector);
        const index = npc.mesh.indexOf(".");

        if (index < 0) throw new Error(`NPC '${npc.id}' has invalid mesh path '${npc.mesh}'.`);

        const actor = new BaseActor(renderManager);

        actor.name = npc.name;
        actor.position.copy(position || renderManager.player.position);

        if (!position) actor.position.add(npcSpawnOffset);

        let library: GD.DecodeLibrary;

        try {
            library = await this.loadSkeletalActor(renderManager, npc.mesh.slice(0, index), npc.mesh.slice(index + 1), "Wait", actor, npc.className, npc.textures, npc.id, npc.enterEvent ? npc.enterEvent.animation : null);
        } catch (e) {
            throw new Error(`NPC '${npc.id}' (${npc.name}) failed to load mesh '${npc.mesh}' as '${npc.className}': ${(e as Error).message}`);
        }

        if (!position) {
            tmpNpcFloorStart.copy(actor.position);
            tmpNpcFloorStart.z += NPC_SPAWN_FLOOR_DISTANCE * 0.5;

            const floor = renderManager.collisionWorld.rayCheck(tmpNpcFloorStart, npcFloorDirection, NPC_SPAWN_FLOOR_DISTANCE, undefined, undefined, false);

            if (!floor) throw new Error(`NPC '${npc.id}' has no floor below its spawn position.`);

            actor.position.copy(floor.location);
        }

        try {
            renderManager.addPawn(actor);

            if (npc.enterEvent) actor.spawnEnterEvent(npc.enterEvent, getNpcEnterSoundUri(library, npc.enterEvent));
        } catch (e) {
            renderManager.removePawn(actor);
            throw e;
        }

        return actor;
    }

    public listNpcs(): Promise<GD.INpcDefinition[]> {
        return this.decodeWorker.listNpcs();
    }

    protected getClassName(charIndex: number): string {
        const group = this.charGroups.find(group => group.index === charIndex);

        if (!group) throw new Error(`No character group for index ${charIndex}.`);

        return group.name;
    }

    public precacheCharacters(): Promise<void> {
        return this.decodeWorker.precacheCharacters(this.loadSettings);
    }

    public getCharGroups(): Promise<GD.ICharacterGroup[]> {
        return this.decodeWorker.getCharGroups();
    }

    public async setAlwaysLoaded(renderManager: RenderManager, sectorName: string) {
        const decodeLibrary = await this.decodeWorker.decodeSector(sectorName, this.loadSettings);

        decodeLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (decodeLibrary as any).preferCompressedTextures = this.preferCompressedTextures;

        const sector = decodePackage(decodeLibrary);

        sector.neverUnload = true;
        renderManager.addSector(sector);
    }

    /**
     * Dispatches a sector decode to the worker pool without waiting for it to finish, so
     * a boundary crossing can request the newly-important sector on a free worker instead
     * of queueing behind whatever a previous tick already asked for. Returns true when a
     * load was attempted (dispatched, or reused from the retired grace period), false when
     * the sector was skipped (already in flight, failure cooldown, pool full, worker dead).
     */
    protected requestSector(renderManager: RenderManager, sectorIdx: string, maxInFlight: number = this.maxConcurrentDecodes): boolean {
        const retired = this.retiredSectors.get(sectorIdx);

        if (retired) {
            /* still in its disposal grace period - reuse it as is, no re-decode */
            this.retiredSectors.delete(sectorIdx);
            renderManager.addSector(retired.sector);
            return true;
        }

        if (this.inFlightSectors.has(sectorIdx)) return false;

        const retryAt = this.failedSectors.get(sectorIdx);

        if (retryAt !== undefined && performance.now() < retryAt) return false;

        if (!this.isWorkerReady || this.decodeWorker.isDead) return false;
        if (this.inFlightSectors.size >= maxInFlight) return false; // pool full, retry next tick

        this.inFlightSectors.add(sectorIdx);

        this.decodeWorker.decodeSector(sectorIdx, this.loadSettings)
            .then(decodeLibrary => {
                decodeLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
                (decodeLibrary as any).preferCompressedTextures = this.preferCompressedTextures;

                const sector = decodeSectorCore(decodeLibrary); // static meshes built later by processPendingBuilds
                renderManager.addSector(sector);
                renderManager.gateParticleWarmup(sector, false); // ungated again once materials finish, see attachStaticMeshGroup

                this.pendingStaticMeshBuilds.push({ sector, library: decodeLibrary, decodeJob: null });
                this.failedSectors.delete(sectorIdx);
            })
            .catch(e => {
                console.error(`Failed to decode sector '${sectorIdx}':`, e);
                this.failedSectors.set(sectorIdx, performance.now() + FAILED_SECTOR_RETRY_MS);
            })
            .finally(() => {
                this.inFlightSectors.delete(sectorIdx);
            });

        return true;
    }

    /**
     * Hides the sector immediately but keeps it (and its package refcounts) intact for
     * RETIRED_SECTOR_DISPOSE_MS - returning within that window re-adds the retained
     * object with no re-decode. destroyExpiredSectors does the real cleanup afterwards.
     */
    protected retireSector(renderManager: RenderManager, sector: SectorObject) {
        const sectorIdx = `${sector.index.x}_${sector.index.y}`;

        console.log(`Retiring sector '${sectorIdx}'.`);

        renderManager.removeSector(sector);
        this.retiredSectors.set(sectorIdx, { sector, retiredAt: performance.now() });
    }

    /**
     * Disposes retired sectors past their grace period and releases the package
     * refcounts they took in the decode worker.
     */
    protected destroyExpiredSectors(renderManager: RenderManager) {
        const now = performance.now();

        for (const [sectorIdx, { sector, retiredAt }] of this.retiredSectors) {
            // Map insertion order makes capped entries the oldest.
            if (now - retiredAt < RETIRED_SECTOR_DISPOSE_MS && this.retiredSectors.size <= MAX_RETIRED_SECTORS) continue;

            console.log(`Disposing sector '${sectorIdx}'.`);

            this.retiredSectors.delete(sectorIdx);
            this.dropPendingBuild(sector);
            renderManager.disposeSector(sector);

            this.decodeWorker?.freeSector(sectorIdx);
        }
    }

    protected dropPendingBuild(sector: SectorObject) {
        const jobIndex = this.pendingStaticMeshBuilds.findIndex(job => job.sector === sector);

        if (jobIndex >= 0) this.pendingStaticMeshBuilds.splice(jobIndex, 1);
    }

    protected processPendingBuilds(renderManager: RenderManager, cameraPosition: THREE.Vector3) {
        let jobIndex = -1;
        let jobDistance = Infinity;

        for (let i = 0; i < this.pendingStaticMeshBuilds.length; i++) {
            const sector = this.pendingStaticMeshBuilds[i].sector;

            // Never attach a completed build after its sector retires.
            if (!sector.parent) continue;

            const distance = sectorDistance(cameraPosition, sector.index.x, sector.index.y);

            if (distance >= jobDistance) continue;

            jobIndex = i;
            jobDistance = distance;
        }

        const job = jobIndex < 0 ? null : this.pendingStaticMeshBuilds[jobIndex];

        if (!job) return;

        try {
            if (!job.decodeJob) job.decodeJob = createSectorStaticMeshDecodeJob(job.library, job.sector);

            const deadline = performance.now() + STATIC_MESH_BUILD_FRAME_MS;
            let complete = false;

            do complete = stepSectorStaticMeshDecodeJob(job.decodeJob);
            while (!complete && performance.now() < deadline);

            if (!complete) return;

            this.pendingStaticMeshBuilds.splice(jobIndex, 1);
            renderManager.attachStaticMeshGroup(job.sector);
        } catch (e) {
            this.pendingStaticMeshBuilds.splice(jobIndex, 1);
            console.error(`Failed to build static meshes for sector '${job.sector.name}':`, e);
        }
    }

    public async tick(renderManager: RenderManager) {
        if (this.isTicking) return; // avoid too many ticks running at the same time as the tick is done on before render so we defer sector loading

        try {
            this.isTicking = true;

            const cameraPosition = renderManager.camera.getWorldPosition(tmpCameraPosition);
            const [sx, sy] = renderManager.getSectorId(cameraPosition);
            const originIdx = `${sx}_${sy}`;
            const sectorsLoaded = renderManager.getLoadedSectors();
            const sectorsLoadedIds = sectorsLoaded.map(({ index }) => `${index.x}_${index.y}`)
            const isValidOrigin = this.hasSector(originIdx);
            const now = performance.now();
            const sampleDelta = now - this.lastCameraSampleTime;

            tmpPrefetchPosition.copy(cameraPosition);
            tmpCameraMovement.set(0, 0, 0);

            if (this.lastCameraSampleTime > 0 && sampleDelta > 0 && sampleDelta < 250) {
                tmpCameraMovement.subVectors(cameraPosition, this.lastCameraPosition).setZ(0).multiplyScalar(SECTOR_PREFETCH_LOOKAHEAD_MS / sampleDelta);

                if (tmpCameraMovement.lengthSq() > SECTOR_PREFETCH_MAX_DISTANCE * SECTOR_PREFETCH_MAX_DISTANCE)
                    tmpCameraMovement.setLength(SECTOR_PREFETCH_MAX_DISTANCE);

                tmpPrefetchPosition.add(tmpCameraMovement);
            }

            this.lastCameraPosition.copy(cameraPosition);
            this.lastCameraSampleTime = now;

            /*
             * Retire sectors past the unload radius; the gap between renderDistance and
             * unloadDistance keeps boundary crossings from thrashing. Retired sectors
             * stay reusable for a grace period before actually being disposed.
             */
            for (const sector of sectorsLoaded) {
                if (sector.neverUnload || !sector.index) continue;
                if (sectorDistance(cameraPosition, sector.index.x, sector.index.y) <= this.unloadDistance) continue;

                this.retireSector(renderManager, sector);
            }

            this.destroyExpiredSectors(renderManager);
            this.processPendingBuilds(renderManager, cameraPosition);

            /*
             * Sectors wanted this tick, most-important first: the sector the camera is
             * in, then any sector near the projected camera position, nearest-first.
             * Recomputing the list every tick makes a direction or boundary change
             * reprioritize the next available worker.
             */
            const sectorsToLoad: string[] = [];

            if (isValidOrigin && !sectorsLoadedIds.includes(originIdx)) {
                this.requestSector(renderManager, originIdx);
                return;
            }

            const ring = Math.ceil(this.renderDistance / SECTOR_WORLD_SIZE);
            const [psx, psy] = renderManager.getSectorId(tmpPrefetchPosition);
            const neighbours: { idx: string, dist: number, prefetchDist: number }[] = [];

            for (let x = Math.min(sx, psx) - ring, xmax = Math.max(sx, psx) + ring; x <= xmax; x++) {
                for (let y = Math.min(sy, psy) - ring, ymax = Math.max(sy, psy) + ring; y <= ymax; y++) {
                    const levelIdx = `${x}_${y}`;

                    if (levelIdx === originIdx || !this.hasSector(levelIdx))
                        continue; // skip origin and invalid sectors

                    if (sectorsLoadedIds.includes(levelIdx)) continue;

                    const dist = sectorDistance(cameraPosition, x, y);
                    const prefetchDist = sectorDistance(tmpPrefetchPosition, x, y);

                    if (dist <= this.renderDistance || prefetchDist <= this.renderDistance)
                        neighbours.push({ idx: levelIdx, dist, prefetchDist });
                }
            }

            neighbours.sort((a, b) => a.prefetchDist - b.prefetchDist || a.dist - b.dist);
            sectorsToLoad.push(...neighbours.map(n => n.idx));

            const backgroundLimit = tmpCameraMovement.lengthSq() > 0
                ? Math.max(this.maxConcurrentDecodes - 1, 1)
                : this.maxConcurrentDecodes;

            for (let i = 0; i < sectorsToLoad.length; i++) {
                this.requestSector(renderManager, sectorsToLoad[i], backgroundLimit);
            }
        } finally {
            this.isTicking = false;
        }
    }
}

function isHeadBone(name: string) {
    return /^bip01[ _]head$/i.test(name);
}

// system/lineagewarrior.int clip names are case-insensitive against package names.
function findAnimation(animations: Record<string, THREE.AnimationClip>, declared: string): string {
    const match = declared.toLowerCase();
    const name = Object.keys(animations).find(name => name.toLowerCase() === match);

    if (!name) throw new Error(`Character has no '${declared}' animation.`);

    return name;
}

function findNpcIdleAnimation(animations: Record<string, THREE.AnimationClip>, declared: string): string {
    const names = Object.keys(animations);
    const match = declared.toLowerCase();
    const name = names.find(name => name.toLowerCase() === match)
        || names.find(name => /^wait(?:_|$)/i.test(name))
        || names.find(name => /^spwait/i.test(name))
        || names[0];

    if (!name) throw new Error(`NPC has no '${declared}' animation.`);

    return name;
}

function findNpcMovementAnimation(animations: Record<string, THREE.AnimationClip>, movement: string, idle: string): string {
    const names = Object.keys(animations);
    const index = idle.indexOf("_");
    const suffix = index < 0 ? "" : idle.slice(index);
    const match = `${movement}${suffix}`.toLowerCase();

    return names.find(name => name.toLowerCase() === match) || names.find(name => new RegExp(`^${movement}(?:_|$)`, "i").test(name)) || idle;
}

// Share one bone tree instead of decoding six or seven identical trees per pawn.
function shareSkeletons(bodyparts: THREE.SkinnedMesh[]) {
    const host = bodyparts.find(part => part.skeleton.bones.some(bone => isHeadBone(bone.name)));

    if (!host) throw new Error(`Character has no bodypart carrying a head bone to share its skeleton from.`);

    for (const part of bodyparts) {
        if (part === host || !isSameBindPose(host, part)) continue;

        part.remove(part.skeleton.bones[0]);
        part.bind(host.skeleton, part.bindMatrix);

        (part as any).sharesSkeleton = true;
    }
}

// armor bodyparts can ship extra bones (skirts, coat tails) or a differently posed reference frame
function isSameBindPose(host: THREE.SkinnedMesh, part: THREE.SkinnedMesh): boolean {
    const hostSkeleton = host.skeleton, partSkeleton = part.skeleton;

    if (hostSkeleton.bones.length !== partSkeleton.bones.length) return false;
    if (host.position.distanceTo(part.position) > BIND_POSE_EPSILON) return false;
    if (host.scale.distanceTo(part.scale) > BIND_POSE_EPSILON) return false;
    if (Math.abs(host.quaternion.dot(part.quaternion)) < 1 - BIND_POSE_EPSILON) return false;

    for (let i = 0, len = hostSkeleton.bones.length; i < len; i++) {
        if (hostSkeleton.bones[i].name !== partSkeleton.bones[i].name) return false;

        const hostInverse = hostSkeleton.boneInverses[i].elements, partInverse = partSkeleton.boneInverses[i].elements;

        for (let j = 0; j < 16; j++)
            if (Math.abs(hostInverse[j] - partInverse[j]) > BIND_POSE_EPSILON) return false;
    }

    return true;
}

// hair bodyparts ship their own Hair01 chain instead of the Bip01 skeleton, so nothing in the body's clip drives them
function attachLooseBoneChains(bodyparts: THREE.SkinnedMesh[]) {
    const host = bodyparts.find(part => part.skeleton.bones.some(bone => isHeadBone(bone.name)));

    if (!host) throw new Error(`Character has no bodypart carrying a head bone to attach its hair to.`);

    const headBone = host.skeleton.bones.find(bone => isHeadBone(bone.name));

    host.updateMatrixWorld(true);

    for (const part of bodyparts) {
        if (part === host || !/(?:^|_)(?:ah|bh)$/i.test(part.name) || part.skeleton.bones.some(bone => isHeadBone(bone.name))) continue;

        const root = part.skeleton.bones[0];

        part.updateMatrixWorld(true);

        tmpAttachMatrix.copy(headBone.matrixWorld).invert().multiply(root.matrixWorld);
        tmpAttachMatrix.decompose(root.position, root.quaternion, root.scale);

        headBone.add(root);

        (part as any).isBoneAttachment = true;
    }
}

/**
 * Distance from the camera to a sector's bounds (0 inside it), using the same
 * sector -> world mapping as RenderManager.getSectorId.
 */
function sectorDistance(cameraPosition: THREE.Vector3, x: number, y: number): number {
    const minX = (x - 20) * SECTOR_WORLD_SIZE, maxX = minX + SECTOR_WORLD_SIZE;
    const minY = (y - 18) * SECTOR_WORLD_SIZE, maxY = minY + SECTOR_WORLD_SIZE;

    const dx = Math.max(minX - cameraPosition.x, 0, cameraPosition.x - maxX);
    const dy = Math.max(minY - cameraPosition.y, 0, cameraPosition.y - maxY);

    return Math.sqrt(dx * dx + dy * dy);
}

export default AssetManager;
export { AssetManager };
