import RenderManager from "../rendering/render-manager";
import BaseActor from "../base-actor";
import type LitSkinnedMesh from "../objects/lit-skinned-mesh";
import type { DecodeLibrary } from "@l2js/engine";
import type { WarriorAnimations_T, LocalizationProperty_T, UserConfig_T, LoadSettings_T } from "@l2js/engine/contracts/config";
import type { ICharacterGroup, ICharacterArmorSelection, INpcDefinition } from "@l2js/engine/contracts/pawn";
import type { IScriptFieldDecodeInfo, ScriptPropertyValue_T } from "@l2js/engine/contracts/script";
import { PropertyFlags_T } from "@l2js/core";

const DEFAULT_CHAR_INDEX = 1;
import { WebGLCapabilities } from "three/src/renderers/webgl/WebGLCapabilities";
import { createSectorStaticMeshDecodeJob, decodeObject3D, decodePackage, decodeSectorCore, stepSectorStaticMeshDecodeJob, SectorStaticMeshDecodeJob_T } from "./decoders/object3d-decoder";
import decodeEnv from "./decoders/env-decoder";
import DecodeWorkerClient from "./decode-worker/decode-worker-client";
import type { GameStrings_T, MatineeScene_T, PlayerSkillInfo_T, UITexture_T } from "./decode-worker/decode-protocol";
import { AnimationClip, Matrix4, Vector3 } from "three";
import type { SectorObject } from "../objects/zone-object";
import UnScriptVM from "../ue-script/vm";
import LineagePlayerController from "../objects/lineage-player-controller";
import { IEngineComponent } from "../game/components";
import type { GameManager } from "../game/game-manager"
import SoundComponent from "../audio/components/sound-component";
import EffectsComponent from "../rendering/components/effects-component";
import AnimationComponent from "../objects/components/animation-component";
import TransformComponent from "../objects/components/transform-component";
import HairSimulationComponent from "../objects/components/hair-simulation-component";
import SkinNotifyComponent from "../objects/components/skin-notify-component";
import NpcLifecycleComponent from "../objects/components/npc-lifecycle-component";
import PawnAttackComponent from "../objects/components/pawn-attack-component";
import PawnEquipmentComponent from "../objects/components/pawn-equipment-component";
import { WeaponType, type NpcSkillAttack_T } from "./unreal/un-pawn";
import PawnRenderableComponent from "../rendering/components/pawn-renderable-component";
import ActorMeshComponent from "../rendering/components/actor-mesh-component";
import { ScriptComponent } from "../game/script-component";
import type LocalSpaceSkeleton from "../objects/local-space-skeleton";

const tmpCameraPosition = new Vector3();
const tmpAttachMatrix = new Matrix4();
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

type PendingStaticMeshBuild_T = { sector: SectorObject, library: DecodeLibrary, decodeJob: SectorStaticMeshDecodeJob_T };
export type AssetList_T = { supported: Record<string, string>, unsupported: string[] };

function findScriptField(library: DecodeLibrary, classId: string, name: string): IScriptFieldDecodeInfo | null {
    const lowerName = name.toLowerCase();
    let cls = library.scriptClasses[classId];

    while (cls) {
        const field = cls.fields.find(field => field.name.toLowerCase() === lowerName);

        if (field) return field;
        cls = cls.superClassId ? library.scriptClasses[cls.superClassId] : null;
    }

    return null;
}

function findScriptDefault(library: DecodeLibrary, classId: string, name: string): ScriptPropertyValue_T {
    const lowerName = name.toLowerCase();
    let cls = library.scriptClasses[classId];

    while (cls) {
        const key = Object.keys(cls.defaults).find(key => key.toLowerCase() === lowerName);

        if (key) return cls.defaults[key];
        cls = cls.superClassId ? library.scriptClasses[cls.superClassId] : null;
    }

    throw new Error(`UnrealScript class '${classId}' has no default for '${name}'.`);
}

function parseLocalizedValue(field: IScriptFieldDecodeInfo, value: string): ScriptPropertyValue_T {
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

function applyScriptLocalization(library: DecodeLibrary, classId: string, properties: LocalizationProperty_T[]): void {
    const cls = library.scriptClasses[classId];

    if (!cls) throw new Error(`UnrealScript class '${classId}' is not in '${library.name}'.`);

    for (const property of properties) {
        const field = findScriptField(library, classId, property.name);

        // Core.dll LoadLocalized 0x10163cab / 0x1015c19d reads only declared CPF_Localized properties.
        if (!field || !(field.flags & PropertyFlags_T.CPF_Localized)) continue;

        if (property.index < 0) {
            cls.defaults[field.name] = parseLocalizedValue(field, property.value);
            continue;
        }

        const inherited = findScriptDefault(library, classId, field.name);

        if (!Array.isArray(inherited)) throw new Error(`Localized UnrealScript property '${field.id}' is not an array.`);
        if (property.index >= field.arrayDimensions) continue;

        const values = Array.isArray(cls.defaults[field.name]) ? (cls.defaults[field.name] as ScriptPropertyValue_T[]).slice() : inherited.slice();

        values[property.index] = parseLocalizedValue(field, property.value);
        cls.defaults[field.name] = values;
    }
}

function setPawnComponents(renderManager: RenderManager, library: DecodeLibrary, actor: BaseActor): void {
    const sound = actor.findComponent<SoundComponent>("sound") || actor.addComponent(new SoundComponent(renderManager.audioManager));

    sound.setLibrary(library);
    const effects = actor.findComponent<EffectsComponent>("effects") || actor.addComponent(new EffectsComponent(renderManager));

    effects.setLibrary(library);
    if (!actor.findComponent("animation")) actor.addComponent(new AnimationComponent(renderManager));
    if (!actor.findComponent("hairSimulation")) actor.addComponent(new HairSimulationComponent(renderManager));
    if (!actor.findComponent("skinNotify")) actor.addComponent(new SkinNotifyComponent(renderManager));
    if (!actor.findComponent("transform")) actor.addComponent(new TransformComponent(renderManager));
    if (!actor.findComponent("npcLifecycle")) actor.addComponent(new NpcLifecycleComponent());
    if (!actor.findComponent("pawnRenderable")) actor.addComponent(new PawnRenderableComponent(renderManager));
}

function mergePawnLibrary(target: DecodeLibrary, source: DecodeLibrary): void {
    for (const key of ["geometries", "geometryInstances", "materials", "materialModifiers", "scriptClasses", "scriptFunctions", "scriptStates", "effectTemplates", "actorTemplates", "scriptMeshes", "scriptMaterials", "sounds"] as const)
        for (const [id, value] of Object.entries(source[key]))
            if (!(id in target[key])) (target[key] as any)[id] = value;

    for (const [name, sound] of source.soundBlobCache) {
        if (!target.soundBlobCache.has(name)) target.soundBlobCache.set(name, sound);
        else if (sound.uri) URL.revokeObjectURL(sound.uri);
    }
}

export class AssetManager implements IEngineComponent<GameManager> {
    protected isTicking: boolean = false;
    protected isStreaming: boolean = true;
    protected loadSettings: LoadSettings_T;
    protected glCapabilities: WebGLCapabilities;
    protected hasS3TC: boolean;
    protected decodeWorker: DecodeWorkerClient = null;
    protected isWorkerReady = false;
    protected failedSectors = new Map<string, number>();
    protected retiredSectors = new Map<string, { sector: SectorObject, retiredAt: number }>();
    protected inFlightSectors = new Set<string>();

    protected readonly pendingStaticMeshBuilds: PendingStaticMeshBuild_T[] = [];
    protected readonly levelSectors = new Set<string>();
    protected preferCompressedTextures = false;
    public userConfig: UserConfig_T = null;
    protected warriorAnimations: Record<string, WarriorAnimations_T> = null;
    protected charGroups: ICharacterGroup[] = null;
    protected effectLibrary: DecodeLibrary = null;
    protected cubicLibrary: Promise<DecodeLibrary> = null;
    protected readonly pawnLibraries = new WeakMap<BaseActor, DecodeLibrary>();
    protected readonly cacheSounds = new Map<string, Promise<string>>();
    protected readonly characterLoads = new WeakMap<BaseActor, number>();
    protected readonly pawnSkillRequests = new WeakMap<BaseActor, number>();
    protected readonly cachePawnSkills = new WeakMap<DecodeLibrary, Map<string, Promise<NpcSkillAttack_T>>>();
    protected readonly decodeWorkerPoolSize: number;
    protected readonly maxConcurrentDecodes: number;
    protected readonly lastCameraPosition = new Vector3();
    protected lastCameraSampleTime = 0;

    protected readonly renderDistance = SECTOR_WORLD_SIZE / 2;
    protected readonly unloadDistance = SECTOR_WORLD_SIZE;

    protected gameManager: GameManager;
    public setParent(parent: GameManager): this { this.gameManager = parent; return this; }
    public getParent(): GameManager { return this.gameManager; }

    public constructor(loadSettings: LoadSettings_T, assetList: AssetList_T) {
        this.loadSettings = loadSettings;
        this.decodeWorkerPoolSize = loadSettings.decodeWorkerPoolSize ?? 3;
        this.maxConcurrentDecodes = Math.max(this.decodeWorkerPoolSize, 1);

        for (const path of Object.keys(assetList.supported)) {
            if (!path.endsWith(".unr")) continue;

            this.levelSectors.add(path.slice(path.lastIndexOf("/") + 1, -".unr".length));
        }

    }

    public hasSector(sectorIdx: string): boolean {
        return this.levelSectors.has(sectorIdx.toLowerCase());
    }

    public isAreaLoaded(renderManager: RenderManager, position: THREE.Vector3): boolean {
        const [sx, sy] = renderManager.getSectorId(position);
        const ring = Math.ceil(this.renderDistance / SECTOR_WORLD_SIZE);

        for (let x = sx - ring; x <= sx + ring; x++) {
            for (let y = sy - ring; y <= sy + ring; y++) {
                if (!this.hasSector(`${x}_${y}`) || sectorDistance(position, x, y) > this.renderDistance) continue;

                const sector = renderManager.getSectorByCoords(x, y);

                if (!sector || !sector.staticMeshGroup || !renderManager.isSectorWarm(sector)) return false;
            }
        }

        return true;
    }

    public async onInit(): Promise<this> {
        const manRender = this.getParent().getComponent("render");
        const textureMode = (this.loadSettings as any).textures ?? "auto";

        this.glCapabilities = manRender.renderer.capabilities;
        this.hasS3TC = manRender.renderer.extensions.get("WEBGL_compressed_texture_s3tc")
        this.preferCompressedTextures = textureMode === "compressed" || (textureMode === "auto" && this.hasS3TC);

        (this.loadSettings as any).rgbaTextures = !this.preferCompressedTextures;

        this.decodeWorker = new DecodeWorkerClient(this.decodeWorkerPoolSize);
        await this.decodeWorker.ready;
        this.isWorkerReady = true;

        const playerControllerLoad = this.decodeWorker.decodeEffectTemplates(this.loadSettings, [], [], [PLAYER_CONTROLLER_CLASS]).then(library => new LineagePlayerController(library));
        const [clientConfig, charGroups, envInfo, musicInfo, characterLibrary, playerController, effectLibrary, skyLibrary] = await Promise.all([
            this.decodeWorker.getClientConfig(),
            this.decodeWorker.getCharGroups(),
            this.decodeWorker.decodeEnv(),
            this.decodeWorker.getMusicInfo(),
            this.decodeWorker.decodeCharacter(this.loadSettings),
            playerControllerLoad,
            playerControllerLoad.then(controller => this.decodeWorker.decodeEffectTemplates(this.loadSettings, [...LANDMARK_EFFECTS, ...UNDERWATER_EFFECTS], [controller.underWaterLoopSound])),
            this.decodeWorker.decodeSector("skylevel", {
                ...this.loadSettings, isSkyLevel: true,
                loadTerrain: true,
                loadBaseModel: true,
                loadStaticModels: false,
                loadEmitters: false,
                loadStaticModelList: undefined,
                loadAudio: false,
                batching: { staticMeshes: false, terrain: false }
            })
        ]);
        const underwaterLoopSound = playerController.underWaterLoopSound;

        this.userConfig = clientConfig.userConfig;
        this.warriorAnimations = clientConfig.warriorAnimations;
        this.charGroups = charGroups;

        skyLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (skyLibrary as any).preferCompressedTextures = this.preferCompressedTextures;
        effectLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (effectLibrary as any).preferCompressedTextures = this.preferCompressedTextures;

        this.effectLibrary = effectLibrary;

        await this.applyCharacter(manRender, characterLibrary, undefined, DEFAULT_CHAR_INDEX);

        manRender.waterEffects.underWaterEffect.setEffects(this.createEffect(UNDERWATER_EFFECTS[0]), this.createEffect(UNDERWATER_EFFECTS[1]));

        const underwaterSoundName = effectLibrary.sounds[underwaterLoopSound];
        const underwaterSound = effectLibrary.soundBlobCache.get(underwaterSoundName);

        if (!underwaterSound?.uri) throw new Error(`Underwater loop sound '${underwaterLoopSound}' failed to decode.`);

        manRender.audioManager.setUnderwaterLoopSound(underwaterSound.uri);

        manRender.setEnv(decodeEnv(envInfo));
        manRender.setSky(decodePackage(skyLibrary));
        manRender.audioManager.setMusicInfo(musicInfo);

        return this;
    }

    public getMemoryStats() { return this.decodeWorker.getMemoryStats(); }

    public async loadCubicEffects(): Promise<DecodeLibrary> {
        if (!this.cubicLibrary) {
            const paths = ["a", "b", "c", "d", "e"].map(name => `LineageEffect.s_u013_${name}`);

            this.cubicLibrary = this.decodeWorker.decodeEffectTemplates(this.loadSettings, paths, [], paths);
        }

        const library = await this.cubicLibrary;

        library.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (library as any).preferCompressedTextures = this.preferCompressedTextures;
        return library;
    }

    public async loadSkeletalMeshes(packageName: string, meshNames: string[]): Promise<LitSkinnedMesh[]> {
        const libraries = await Promise.all(meshNames.map(name => this.decodeWorker.decodeSkeletalMesh(this.loadSettings, packageName, name)));

        return libraries.map(library => {
            library.anisotropy = this.glCapabilities.getMaxAnisotropy();
            (library as any).preferCompressedTextures = this.preferCompressedTextures;

            return decodeObject3D(library, library.pawnActors[0]) as LitSkinnedMesh;
        });
    }

    public async loadItem(id: number): Promise<DecodeLibrary> {
        const library = await this.decodeWorker.decodeItem(this.loadSettings, id);

        library.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (library as any).preferCompressedTextures = this.preferCompressedTextures;

        return library;
    }

    public loadSound(path: string): Promise<string> {
        const key = path.toLowerCase();

        if (!this.cacheSounds.has(key)) this.cacheSounds.set(key, this.decodeSound(path));

        return this.cacheSounds.get(key);
    }

    protected async decodeSound(path: string): Promise<string> {
        const library = await this.decodeWorker.decodeEffectTemplates(this.loadSettings, [], [path]);
        const sound = library.soundBlobCache.get(library.sounds[path]);

        if (!sound || !sound.uri) throw new Error(`Sound '${path}' has no decoded audio.`);

        return sound.uri;
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

    protected async applyCharacter(renderManager: RenderManager, characterLibrary: DecodeLibrary, actor?: BaseActor, charIndex: number = DEFAULT_CHAR_INDEX, request: number = null) {
        const classPath = `LineageWarrior.${this.getClassName(charIndex)}`;
        const [scriptLibrary, localization] = await Promise.all([this.decodeWorker.decodeScriptClass(this.loadSettings, classPath), this.getScriptLocalization(classPath)]);
        const classId = Object.keys(scriptLibrary.scriptClasses).find(id => id.toLowerCase() === classPath.toLowerCase());

        if (!classId) throw new Error(`Character class '${classPath}' was not decoded.`);

        mergePawnLibrary(characterLibrary, scriptLibrary);
        if (request !== null && this.characterLoads.get(actor) !== request) {
            for (const sound of characterLibrary.soundBlobCache.values())
                if (sound.uri) URL.revokeObjectURL(sound.uri);
            return;
        }

        applyScriptLocalization(characterLibrary, classId, localization);
        characterLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (characterLibrary as any).preferCompressedTextures = this.preferCompressedTextures;

        const bodyparts = characterLibrary.pawnActors.map(info => decodeObject3D(characterLibrary, info) as THREE.SkinnedMesh);
        const animations = (bodyparts[0] as any).meshAnimations as Record<string, THREE.AnimationClip>;
        const player = actor || renderManager.player;

        if (player === renderManager.player) this.stopPlayerSkill(renderManager);
        const previousAttack = player.findComponent<PawnAttackComponent>("pawnAttack");

        if (previousAttack) player.removeComponent(previousAttack);
        const previousEquipment = player.findComponent<PawnEquipmentComponent>("pawnEquipment");

        if (previousEquipment) player.removeComponent(previousEquipment);

        if (!animations) throw new Error(`'${characterLibrary.name}' animations failed to decode.`);

        shareSkeletons(bodyparts);
        attachLooseBoneChains(bodyparts);

        const className = this.getClassName(charIndex).toLowerCase();
        const declared = this.warriorAnimations[className];

        if (!declared) throw new Error(`'assets/system/lineagewarrior.int' has no '${className}' class.`);

        setPawnComponents(renderManager, characterLibrary, player);
        player.setAnimations(animations);
        player.setIdleAnimation(findAnimation(animations, declared.wait));
        player.setWalkingAnimation(findAnimation(animations, declared.walk));
        player.setRunningAnimation(findAnimation(animations, declared.run));
        player.setDeathAnimation(findAnimation(animations, declared.death));
        player.setFallingAnimation(findAnimation(animations, declared.falling));
        player.setSwimmingAnimation(findAnimation(animations, declared.swim));
        player.setSwimmingIdleAnimation(findAnimation(animations, declared.swimWait));
        player.setMeshes(bodyparts);
        const vm = new UnScriptVM(characterLibrary);

        player.setScriptRuntime(vm, classId, effectClassId => this.createScriptObject(renderManager, characterLibrary, effectClassId, vm));
        player.setUnrealScriptProperty("bActorShadows", false);

        for (const part of bodyparts) {
            if (!/_l_ad\d+$/i.test(part.name)) continue;

            const host = bodyparts[0].skeleton as LocalSpaceSkeleton;
            const boneName = player.getUnrealScriptProperty("LowbodyBone") as string;
            const index = host.matchRefBone(boneName);

            if (index < 0) throw new Error(`Character has no lower-body bone '${boneName}'.`);

            (part.skeleton as LocalSpaceSkeleton).rootBoneSource = host.bones[index];
        }

        if (characterLibrary.pawnEquipment) applyCharacterEquipment(renderManager, characterLibrary, player, animations);
        player.effectSpawnBoneIndex = characterLibrary.effectSpawnBoneIndex;
        player.initAnimations();
        player.addComponent(new PawnAttackComponent(renderManager, player.getAnimationNames(), [], characterLibrary.npcBow));

        this.pawnLibraries.set(player, characterLibrary);
    }

    public async loadCharacterEquipment(renderManager: RenderManager, actor: BaseActor, charIndex: number, hairVariant: number, equipment: L2JS.Engine.ICharacterEquipment) { // UGameEngine::OnEquipItem 0x7456d0 queues a ChangeItemAction on a loaded pawn instead of User::SetPawnResource.
        const request = (this.characterLoads.get(actor) || 0) + 1;

        this.characterLoads.set(actor, request);

        const library = await this.decodeWorker.decodeCharacterEquipment(this.loadSettings, charIndex, hairVariant, equipment);
        const pawnLibrary = this.pawnLibraries.get(actor);

        if (this.characterLoads.get(actor) !== request) {
            for (const sound of library.soundBlobCache.values())
                if (sound.uri) URL.revokeObjectURL(sound.uri);
            return;
        }

        mergePawnLibrary(pawnLibrary, library);
        pawnLibrary.pawnEquipment = library.pawnEquipment;
        pawnLibrary.npcBow = library.npcBow;
        actor.removeComponent(actor.getComponent<PawnEquipmentComponent>("pawnEquipment"));
        applyCharacterEquipment(renderManager, pawnLibrary, actor, Object.fromEntries(actor.getAnimationNames().map(name => [name, null as THREE.AnimationClip])));
        actor.getComponent<PawnAttackComponent>("pawnAttack").setWeapon(pawnLibrary.npcBow);
        renderManager.needsUpdate = true;
    }

    public async loadCharacter(renderManager: RenderManager, charIndex: number, faceVariant: number, hairVariant: number, hairColour: number, armor: ICharacterArmorSelection, actor: BaseActor = renderManager.player, equipment: L2JS.Engine.ICharacterEquipment = null) {
        const request = (this.characterLoads.get(actor) || 0) + 1;

        this.characterLoads.set(actor, request);
        await this.applyCharacter(renderManager, await this.decodeWorker.decodeCharacter(this.loadSettings, charIndex, faceVariant, hairVariant, hairColour, armor, equipment), actor, charIndex, request);
        renderManager.needsUpdate = true;
    }

    public async castPlayerSkill(renderManager: RenderManager, id: number, level: number, target: BaseActor, previewRange?: number): Promise<void> {
        if (!target) throw new Error(`Player skill '${id}:${level}' has no target.`);

        const player = renderManager.player;
        this.pawnSkillRequests.set(player, (this.pawnSkillRequests.get(player) || 0) + 1);
        const pending = this.loadPawnSkill(player, id, level);
        const request = this.pawnSkillRequests.get(player);
        const skill = await pending;

        if (!skill || request !== this.pawnSkillRequests.get(player)) return;
        if (!target.parent) throw new Error(`Player skill '${id}:${level}' target was removed while loading.`);

        const attack = player.getComponent<PawnAttackComponent>("pawnAttack");

        attack.attack(target, attack.addSkill(previewRange === undefined ? skill : { ...skill, castRange: previewRange }), [], [target]);
    }

    public async loadPawnSkill(actor: BaseActor, id: number, level: number, isTransient: boolean = false) {
        const pawnLibrary = this.pawnLibraries.get(actor);

        if (!pawnLibrary) throw new Error(`Pawn '${actor.name}' has not loaded.`);

        const request = this.pawnSkillRequests.get(actor);
        const existing = pawnLibrary.npcSkillAttacks.find(skill => skill.id === id && skill.level === level);

        if (existing) return existing;

        const skill = await this.getPawnSkill(actor, pawnLibrary, id, level);
        const canceled = !isTransient && request !== this.pawnSkillRequests.get(actor) || pawnLibrary !== this.pawnLibraries.get(actor);

        return canceled ? null : skill;
    }

    public async preloadPawnSkill(actor: BaseActor, id: number, level: number) {
        const pawnLibrary = this.pawnLibraries.get(actor);

        if (!pawnLibrary) throw new Error(`Pawn '${actor.name}' has not loaded.`);

        await this.getPawnSkill(actor, pawnLibrary, id, level);
    }

    protected getPawnSkill(actor: BaseActor, pawnLibrary: DecodeLibrary, id: number, level: number): Promise<NpcSkillAttack_T> {
        let loads = this.cachePawnSkills.get(pawnLibrary);

        if (!loads) this.cachePawnSkills.set(pawnLibrary, loads = new Map());

        const key = `${id}:${level}`;

        if (!loads.has(key)) loads.set(key, this.mergePawnSkill(actor, pawnLibrary, id, level));

        return loads.get(key);
    }

    protected async mergePawnSkill(actor: BaseActor, pawnLibrary: DecodeLibrary, id: number, level: number): Promise<NpcSkillAttack_T> {
        const library = await this.decodeWorker.decodeSkill(this.loadSettings, id, level);

        if (pawnLibrary !== this.pawnLibraries.get(actor) || !actor.parent) {
            for (const sound of library.soundBlobCache.values())
                if (sound.uri) URL.revokeObjectURL(sound.uri);
            this.cachePawnSkills.get(pawnLibrary).delete(`${id}:${level}`);
            return null;
        }

        const skill = library.npcSkillAttacks[0];

        mergePawnLibrary(pawnLibrary, library);
        pawnLibrary.npcSkillAttacks.push(skill);
        actor.getComponent<ScriptComponent>("script").getVM().loadFunctions();
        actor.getComponent<PawnAttackComponent>("pawnAttack").addSkill(skill);
        return skill;
    }

    public stopPlayerSkill(renderManager: RenderManager): void {
        this.stopPawnSkill(renderManager.player);
    }

    public stopPawnSkill(actor: BaseActor): void {
        this.pawnSkillRequests.set(actor, (this.pawnSkillRequests.get(actor) || 0) + 1);
        actor.findComponent<PawnAttackComponent>("pawnAttack")?.stop();
    }

    public async loadSkeletalActor(renderManager: RenderManager, packageName: string, meshName: string, idleAnimation: string, actor: BaseActor, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null, enterAnimation: string = null, equipment: L2JS.Engine.INpcEquipment | null = null) {
        const localizationPromise = scriptClassPath ? this.getScriptLocalization(scriptClassPath) : null;
        const [library, localization] = await Promise.all([this.decodeWorker.decodeSkeletalMesh(this.loadSettings, packageName, meshName, scriptClassPath, texturePaths, npcId, equipment), localizationPromise]);

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
        const walking = findNpcMovementAnimation(animations, "walk", idle);
        const running = findNpcMovementAnimation(animations, "run", idle);

        setPawnComponents(renderManager, library, actor);
        this.pawnLibraries.set(actor, library);
        actor.setAnimations(animations);
        actor.setIdleAnimation(idle);
        actor.setWalkingAnimation(walking);
        actor.setRunningAnimation(running);
        actor.setDeathAnimation(idle);
        actor.setFallingAnimation(idle);
        actor.setSwimmingAnimation(idle);
        actor.setSwimmingIdleAnimation(idle);
        actor.setMeshes(meshes);

        if (scriptClassPath) {
            const classId = library.pawnActors[0].scriptClassId;

            if (!classId) throw new Error(`'${library.name}' has no transferred script class.`);

            applyScriptLocalization(library, classId, localization);

            const vm = new UnScriptVM(library);

            actor.setScriptRuntime(vm, classId, effectClassId => this.createScriptObject(renderManager, library, effectClassId, vm));
            actor.setUnrealScriptProperty("bActorShadows", false); // RenderManager owns the shared pawn projector pass.

            if (library.npcBow || library.pawnEquipment) actor.setUnrealScriptProperty("CurWeaponType", library.pawnEquipment ? library.pawnEquipment.weaponType : WeaponType.WT_BOW);

            const weaponType = Number(actor.getUnrealScriptProperty("CurWeaponType") || 0);
            const swim = actor.getUnrealScriptProperty("SwimAnimName") as string[];
            const swimWait = actor.getUnrealScriptProperty("SwimWaitAnimName") as string[];

            actor.setSwimmingAnimation(findNpcDeclaredAnimation(animations, swim && swim[weaponType], walking));
            actor.setSwimmingIdleAnimation(findNpcDeclaredAnimation(animations, swimWait && swimWait[weaponType], idle));

            if (npcId !== null) actor.setDeathAnimationFromScript();
        }

        actor.initAnimations();

        if (library.npcBow || library.pawnEquipment) {
            actor.addComponent(new PawnEquipmentComponent(library, renderManager));
        }

        renderManager.needsUpdate = true;

        return library;
    }

    public getL2Text(name: string): Promise<string> { return this.decodeWorker.getL2Text(name); }

    protected async getScriptLocalization(scriptClassPath: string): Promise<LocalizationProperty_T[]> {
        return this.decodeWorker.getScriptLocalization(scriptClassPath);
    }

    public createScriptObject(renderManager: RenderManager, library: DecodeLibrary, classId: string, vm: UnScriptVM = new UnScriptVM(library)): any {
        const info = library.effectTemplates[classId] || library.effectTemplates[classId.toLowerCase()];

        if (!info) {
            const actorInfo = library.actorTemplates[classId] || library.actorTemplates[classId.toLowerCase()];

            if (!actorInfo) throw new Error(`Script object template '${classId}' is not in '${library.name}'.`);

            const object = decodeObject3D(library, actorInfo) as any;

            object.scriptClassId = actorInfo.scriptClassId;
            return object;
        }

        const effect = decodeObject3D(library, info) as any;

        if ((info as any).drawType === "mesh") {
            effect.addComponent(new ScriptComponent(vm, classId => this.createScriptObject(renderManager, library, classId, vm), info.scriptClassId));
            effect.addComponent(new ActorMeshComponent(library, renderManager));
        }

        effect.children.forEach((emitter: any) => {
            emitter.isActorAttachedEmitter = true;
        });

        return effect;
    }

    public async spawnNpc(renderManager: RenderManager, selector: string | number, position: Vector3 = null, equipment: L2JS.Engine.INpcEquipment | null = null): Promise<BaseActor> {
        const npc = await this.decodeWorker.resolveNpc(selector);
        const index = npc.mesh.indexOf(".");

        if (index < 0) throw new Error(`NPC '${npc.id}' has invalid mesh path '${npc.mesh}'.`);

        const actor = new BaseActor(renderManager);

        actor.name = npc.name;
        actor.position.copy(position || renderManager.player.position);

        if (!position) actor.position.add(npcSpawnOffset);

        let library;

        try {
            library = await this.loadSkeletalActor(renderManager, npc.mesh.slice(0, index), npc.mesh.slice(index + 1), "Wait", actor, npc.className, npc.textures, npc.id, npc.enterEvent ? npc.enterEvent.animation : null, equipment);
        } catch (e) {
            throw new Error(`NPC '${npc.id}' (${npc.name}) failed to load mesh '${npc.mesh}' as '${npc.className}': ${(e as Error).message}`);
        }

        actor.addComponent(new PawnAttackComponent(renderManager, actor.getAnimationNames(), library.npcSkillAttacks, library.npcBow));

        if (!position) {
            tmpNpcFloorStart.copy(actor.position);
            tmpNpcFloorStart.z += NPC_SPAWN_FLOOR_DISTANCE * 0.5;

            const floor = this.gameManager.getComponent("physics").rayCheck(tmpNpcFloorStart, npcFloorDirection, NPC_SPAWN_FLOOR_DISTANCE, undefined, undefined, false);

            if (!floor) throw new Error(`NPC '${npc.id}' has no floor below its spawn position.`);

            actor.position.copy(floor.location);
        }

        try {
            renderManager.addPawn(actor);

            if (npc.enterEvent) actor.spawnEnterEvent(npc.enterEvent);
        } catch (e) {
            renderManager.removePawn(actor);
            throw e;
        }

        return actor;
    }

    public listNpcs(): Promise<INpcDefinition[]> {
        return this.decodeWorker.listNpcs();
    }

    public listPlayerSkills(): Promise<PlayerSkillInfo_T[]> { return this.decodeWorker.listPlayerSkills(); }
    public getGameStrings(): Promise<GameStrings_T> { return this.decodeWorker.getGameStrings(); }
    public decodeUITextures(paths: string[]): Promise<UITexture_T[]> { return this.decodeWorker.decodeUITextures(this.loadSettings, paths); }
    public decodeMatineeScenes(levelName: string): Promise<MatineeScene_T[]> { return this.decodeWorker.decodeMatineeScenes(levelName); }

    protected getClassName(charIndex: number): string {
        const group = this.charGroups.find(group => group.index === charIndex);

        if (!group) throw new Error(`No character group for index ${charIndex}.`);

        return group.name;
    }

    public precacheCharacters(): Promise<void> {
        if (this.loadSettings.cache === false || this.loadSettings.cache?.enabled === false) return Promise.resolve();

        return this.decodeWorker.precacheCharacters(this.loadSettings);
    }

    public async getCharGroups(): Promise<ICharacterGroup[]> { return this.charGroups; }

    public async prefetchCharacterScripts(): Promise<void> {
        await Promise.all(this.charGroups.map(group => this.decodeWorker.prefetchScriptClass(this.loadSettings, `LineageWarrior.${this.getClassName(group.index)}`)));
    }

    public getStreaming() { return this.isStreaming; }

    public setStreaming(renderManager: RenderManager, isStreaming: boolean) {
        this.isStreaming = isStreaming;

        if (isStreaming) return;

        for (const sector of renderManager.getLoadedSectors().slice())
            if (!sector.neverUnload && sector.index) this.retireSector(renderManager, sector);
    }

    public unloadAlwaysLoaded(renderManager: RenderManager, sectorName: string, sector: SectorObject) {
        renderManager.removeSector(sector);
        renderManager.disposeSector(sector);
        this.decodeWorker.freeSector(sectorName);
    }

    public async setAlwaysLoaded(renderManager: RenderManager, sectorName: string, gridIndex: [number, number] = null): Promise<SectorObject> {
        const decodeLibrary = await this.decodeWorker.decodeSector(sectorName, this.loadSettings);

        decodeLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
        (decodeLibrary as any).preferCompressedTextures = this.preferCompressedTextures;

        if (gridIndex) decodeLibrary.sector = gridIndex;

        const sector = decodePackage(decodeLibrary);

        sector.neverUnload = true;

        renderManager.addSector(sector);

        return sector;
    }

    protected requestSector(renderManager: RenderManager, sectorIdx: string, maxInFlight: number = this.maxConcurrentDecodes): boolean {
        const retired = this.retiredSectors.get(sectorIdx);

        if (retired) {
            this.retiredSectors.delete(sectorIdx);
            renderManager.addSector(retired.sector);
            return true;
        }

        if (this.inFlightSectors.has(sectorIdx)) return false;

        const retryAt = this.failedSectors.get(sectorIdx);

        if (retryAt !== undefined && performance.now() < retryAt) return false;

        if (!this.isWorkerReady || this.decodeWorker.isDead) return false;
        if (this.inFlightSectors.size >= maxInFlight) return false;

        this.inFlightSectors.add(sectorIdx);

        this.decodeWorker.decodeSector(sectorIdx, this.loadSettings)
            .then(decodeLibrary => {
                decodeLibrary.anisotropy = this.glCapabilities.getMaxAnisotropy();
                (decodeLibrary as any).preferCompressedTextures = this.preferCompressedTextures;

                const sector = decodeSectorCore(decodeLibrary);
                renderManager.addSector(sector);
                this.gameManager.getComponent("physics").setEmitterWarmupGate(sector, false);

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

    protected retireSector(renderManager: RenderManager, sector: SectorObject) {
        const sectorIdx = `${sector.index.x}_${sector.index.y}`;

        console.log(`Retiring sector '${sectorIdx}'.`);

        renderManager.removeSector(sector);
        this.retiredSectors.set(sectorIdx, { sector, retiredAt: performance.now() });
    }

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

            if (!this.isStreaming) {
                this.destroyExpiredSectors(renderManager);
                return;
            }

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

            for (const sector of sectorsLoaded) {
                if (sector.neverUnload || !sector.index) continue;
                if (sectorDistance(cameraPosition, sector.index.x, sector.index.y) <= this.unloadDistance) continue;

                this.retireSector(renderManager, sector);
            }

            this.destroyExpiredSectors(renderManager);
            this.processPendingBuilds(renderManager, cameraPosition);

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
function applyCharacterEquipment(renderManager: RenderManager, library: DecodeLibrary, actor: BaseActor, animations: Record<string, THREE.AnimationClip>): void {
    const weapon = library.pawnEquipment.weaponType;

    actor.setUnrealScriptProperty("CurWeaponType", weapon);
    actor.setIdleAnimation(findAnimation(animations, (actor.getUnrealScriptProperty("WaitAnimName") as string[])[weapon]));
    actor.setWalkingAnimation(findAnimation(animations, (actor.getUnrealScriptProperty("WalkAnimName") as string[])[weapon]));
    actor.setRunningAnimation(findAnimation(animations, (actor.getUnrealScriptProperty("RunAnimName") as string[])[weapon]));
    actor.addComponent(new PawnEquipmentComponent(library, renderManager));
}

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

function findNpcDeclaredAnimation(animations: Record<string, THREE.AnimationClip>, declared: string, fallback: string): string {
    if (!declared || declared.toLowerCase() === "none") return fallback;

    return Object.keys(animations).find(name => name.toLowerCase() === declared.toLowerCase()) || fallback;
}

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

function sectorDistance(cameraPosition: THREE.Vector3, x: number, y: number): number {
    const minX = (x - 20) * SECTOR_WORLD_SIZE, maxX = minX + SECTOR_WORLD_SIZE;
    const minY = (y - 18) * SECTOR_WORLD_SIZE, maxY = minY + SECTOR_WORLD_SIZE;

    const dx = Math.max(minX - cameraPosition.x, 0, cameraPosition.x - maxX);
    const dy = Math.max(minY - cameraPosition.y, 0, cameraPosition.y - maxY);

    return Math.sqrt(dx * dx + dy * dy);
}

export default AssetManager;
