import type { APackage, UClass, UObject } from "@l2js/core";
import AssetLoader from "../asset-loader";
import UConfigEnv from "@l2js/engine/conf-files/un-conf-env";
import UDataFile from "@l2js/engine/datafile/un-datafile";
import * as SchemasC4 from "@l2js/engine/datafile/schema/schema-types";
import { buildStaticMeshBatchData } from "../decoders/batch-data";
import { convertDDSMaterialsToRGBA, dxt1ToRgba, dxt3ToRgba, dxt5ToRgba } from "@l2js/engine/dds/dxt-decode";
import buildDecodeLibrary from "./build-decode-library";
import prepareLibraryForTransfer from "./collect-transferables";
import * as DecodeCache from "./decode-cache";
import { serializeLibrary, deserializeLibrary, hydrateLibraryFile, type SeekableLibrary_T } from "./library-serializer";
import { dumpObjectScriptProperties } from "@l2js/engine/script-dump-loader";
import type { GameStrings_T, ItemInfo_T, MatineeScene_T, MatineeAction_T, UITexture_T, PlayerSkillInfo_T, PrecacheResult_T, WorkerMemoryStats_T } from "./decode-protocol";
import DecodeLibrary from "@l2js/engine/decode-library";
import DecodeLibraryBuilder from "@l2js/engine/decode-library-builder";
import getNpcBundleName, { isNpcMeshPackage } from "./npc-bundle";
import UConfigAudio, { SwimSoundConfig_T, SwimSoundSet_T } from "@l2js/engine/conf-files/un-conf-audio";
import decodeSkillVisuals, { validatePlayerSkillSource } from "../unreal/skills/skill-visual-decoder";
import mobSkillTable from "./mob-skill-table";
import { WeaponType } from "@l2js/engine/un-pawn";
import UConfigHair from "@l2js/engine/conf-files/un-conf-hair";
import UConfigWarrior, { WarriorAnimations_T } from "@l2js/engine/conf-files/un-conf-warrior";
import UConfigLocalization, { LocalizationProperty_T } from "@l2js/engine/conf-files/un-conf-localization";
import UL2Text from "@l2js/engine/conf-files/un-l2text";
import { consumeTuple } from "@l2js/engine/conf-files/conf-parser";
import { getUserConfig, UserConfig_T } from "@l2js/engine/conf-files/un-conf-system";
import { getRotatorQuaternionElements } from "@l2js/engine/utils/rotator";
import type { IAnimationNotifyDecodeInfo, ISkinNotifyDecodeInfo, ISkinNotifyEntryDecodeInfo, IAnimationSwimSoundSetDecodeInfo, IAnimationSwimSoundNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";
import type { IMaterialGroupDecodeInfo } from "@l2js/engine/contracts/material";
import type { ICharacterArmorSelection, INpcDefinition, NpcSkillAttack_T, NpcSkillEffectPhase_T, ICharacterGroup, ICharacterArmorOptions } from "@l2js/engine/contracts/pawn";
import type { IKeyframeDecodeInfo_T, IAnimationSequenceDecodeInfo, ISkinnedMeshObjectDecodeInfo } from "@l2js/engine/contracts/skeletal-mesh";
import type { UEmitter } from "@l2js/engine/un-emitter";
import type UTexture from "@l2js/engine/un-texture";
import type { IAnimatedSpriteDecodeInfo, IDataTextureDecodeInfo, ITextureDecodeInfo } from "@l2js/engine/contracts/texture";
import type { UMaterial } from "@l2js/engine/un-material";
import type { USound } from "@l2js/engine/un-sound";
import type { USkeletalMesh } from "@l2js/engine/skeletal-mesh/un-skeletal-mesh";

type BinarySector_T = { buffer: ArrayBuffer, fromCache: boolean };
type CharacterBundle_T = {
    name: string;
    animationSet: string;
    animations: Record<string, IKeyframeDecodeInfo_T[]>;
    animationSequences: Record<string, IAnimationSequenceDecodeInfo>;
    animationNotifies: Record<string, IAnimationNotifyDecodeInfo[]>;
    skinNotifies: Record<string, ISkinNotifyDecodeInfo>;
    meshes: Record<string, string>;
    materials: Record<string, string>;
};
type CharacterHairPieces_T = Map<number, Map<number, [string, string][]>>;
type CharacterPartPaths_T = [string, string];
type NpcBundleEntry_T = { meshIndex: number, materials: string, scriptClassId: string | null, effectSpawnBoneIndex: number | null, damageEffect: string | null };
type NpcBundleManifest_T = { actors: Record<number, NpcBundleEntry_T> };
type CachedBundle_T = { library: DecodeLibrary, seekable?: SeekableLibrary_T };
type SkillTables_T = { skills: Record<string, any>[], names: Record<string, any>[], sounds: Record<string, any>[] };

const dynamicHairTypes = new Set([2, 5, 6, 7, 9]);
const SKILL_VOICE_GROUPS = ["mfighter", "ffighter", "mdarkelf", "fdarkelf", "mdwarf", "fdwarf", "melf", "felf", "mmagic", "fmagic", "morc", "forc", "mshaman", "fshaman"];

function characterBundleCacheName(charIndex: number, name: string): string {
    return `character_${charIndex}_${name}`.replace(/[^\w.-]/g, "_");
}

function copyCharacterMaterial(target: DecodeLibrary, source: DecodeLibrary, root: string) {
    const seenMaterials = new Set<string>();
    const seenModifiers = new Set<string>();

    function copyReferences(value: any) {
        if (typeof value === "string") {
            if (value in source.materials) copyMaterial(value);
            if (value in source.materialModifiers) copyModifier(value);
            return;
        }

        if (!value || typeof value !== "object" || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return;

        if (Array.isArray(value)) {
            for (const entry of value) copyReferences(entry);
            return;
        }

        for (const entry of Object.values(value)) copyReferences(entry);
    }

    function copyMaterial(uuid: string) {
        if (seenMaterials.has(uuid)) return;

        const info = source.materials[uuid];

        if (!info) throw new Error(`Character material '${uuid}' not found in its bundle.`);

        seenMaterials.add(uuid);
        target.materials[uuid] = Object.assign({}, info);
        copyReferences(info);
    }

    function copyModifier(uuid: string) {
        if (seenModifiers.has(uuid)) return;

        const info = source.materialModifiers[uuid];

        if (!info) throw new Error(`Character material modifier '${uuid}' not found in its bundle.`);

        seenModifiers.add(uuid);
        target.materialModifiers[uuid] = Object.assign({}, info);
        copyReferences(info);
    }

    copyMaterial(root);
}

function copyAnimationSounds(target: DecodeLibrary, source: DecodeLibrary, animationNotifies: Record<string, IAnimationNotifyDecodeInfo[]>): void {
    function copySound(name: string): void {
        if (!name || target.soundBlobCache.has(name)) return;

        const sound = source.soundBlobCache.get(name);

        if (!sound) throw new Error(`Asset bundle has no decoded sound '${name}'.`);

        target.soundBlobCache.set(name, sound);
    }

    const soundsToCopy = [
        "defaultWalkSounds",
        "defaultRunSounds",
        "grassWalkSounds",
        "grassRunSounds",
        "waterWalkSounds",
        "waterRunSounds",
        "defaultActorWalkSounds",
        "defaultActorRunSounds"
    ] as const;

    for (const notifications of Object.values(animationNotifies)) {
        for (const notify of notifications) {
            const object = notify.object;

            if (!object) continue;

            if (object.type === "swimSound") {
                if (!object.surface || !object.underwater) throw new Error(`Swim sound notify '${object.objectName}' has no audio profile.`);

                for (const name of object.surface.sounds) copySound(name);
                for (const name of object.underwater.sounds) copySound(name);
                continue;
            }

            if (object.type !== "sound") continue;

            copySound(object.sound);

            for (const soundKey of soundsToCopy)
                for (const name of object[soundKey])
                    copySound(name);
        }
    }
}

function copyScriptClass(target: DecodeLibrary, source: DecodeLibrary, classId: string): void {
    function copyFunction(id: string): void {
        if (id in target.scriptFunctions) return;

        const fn = source.scriptFunctions[id];

        if (!fn) throw new Error(`NPC bundle has no script function '${id}'.`);

        target.scriptFunctions[id] = fn;
    }

    function copyState(id: string): void {
        if (id in target.scriptStates) return;

        const state = source.scriptStates[id];

        if (!state) throw new Error(`NPC bundle has no script state '${id}'.`);

        target.scriptStates[id] = state;

        for (const functionId of state.functionIds) copyFunction(functionId);
    }

    function copyClass(id: string): void {
        if (id in target.scriptClasses) return;

        const cls = source.scriptClasses[id];

        if (!cls) throw new Error(`NPC bundle has no script class '${id}'.`);

        target.scriptClasses[id] = cls;

        if (cls.superClassId) copyClass(cls.superClassId);
        for (const functionId of cls.functionIds) copyFunction(functionId);
        for (const stateId of cls.stateIds) copyState(stateId);
    }

    copyClass(classId);
}

function splitObjectPath(path: string): [string, string] {
    const index = path.indexOf(".");

    return [path.slice(0, index), path.slice(index + 1)];
}

function getSkinNotifyIndices(skinNotifies: Record<string, ISkinNotifyDecodeInfo>): Set<number> {
    const indices = new Set<number>();

    function addTimeline(timeline: ISkinNotifyEntryDecodeInfo[]): void {
        for (const entry of timeline) {
            if (entry.skinIndex < 0) throw new Error(`Invalid skin notify index '${entry.skinIndex}'.`);
            indices.add(entry.skinIndex);
        }
    }

    for (const info of Object.values(skinNotifies)) {
        if (info.mode === "grouped") {
            for (const group of info.groups) addTimeline(group.timeline);
        } else addTimeline(info.timeline);
    }

    indices.add(0);

    return indices;
}

function getSkinMaterialPath(path: string, index: number): string {
    if (index === 0) return path;

    const [packageName, objectName] = splitObjectPath(path);

    if (!/_f$/i.test(objectName)) throw new Error(`Skin notify base material '${path}' does not end in '_f'.`);

    return `${packageName}.${objectName}${String.fromCharCode(48 + index)}`;
}

function getCharacterRow(rows: Record<string, any>[], charIndex: number): Record<string, any> {
    const row = rows[charIndex];

    if (!row || row.face_mesh.length === 0) throw new Error(`Character group '${charIndex}' does not exist.`);

    return row;
}

function getCharacterArmorGroup(row: Record<string, any>): string {
    const name = splitObjectPath(row.face_mesh[0] as string)[1].replace(/_m\d+_f$/, "").toLowerCase();
    const group = SchemasC4.CHARACTER_ARMOR_GROUPS[name];

    if (!group) throw new Error(`Character armor group '${name}' does not exist.`);

    return group;
}

function getCharacterArmorPaths(row: Record<string, any>, armor: Record<string, any>): CharacterPartPaths_T[] {
    const group = getCharacterArmorGroup(row);
    const meshes = armor[`${group}_mesh`] as string[];
    const textures = armor[`${group}_texture`] as string[];
    const additionalMeshes = armor[`${group}_additional_mesh`] as string[];
    const additionalTextures = armor[`${group}_additional_texture`] as string[];

    if (meshes.length !== textures.length)
        throw new Error(`Armor '${armor.id}' has ${meshes.length} meshes and ${textures.length} textures for '${group}'.`);
    if (additionalMeshes.length !== additionalTextures.length)
        throw new Error(`Armor '${armor.id}' has ${additionalMeshes.length} additional meshes and ${additionalTextures.length} additional textures for '${group}'.`);

    return [...meshes.map((mesh, i) => [mesh, textures[i]] as CharacterPartPaths_T), ...additionalMeshes.map((mesh, i) => [mesh, additionalTextures[i]] as CharacterPartPaths_T)].filter(part => part[0] && part[1]);
}

function getCharacterArmorLabel(armor: Record<string, any>, itemNames: Map<number, Record<string, any>>): string {
    const item = itemNames.get(armor.id);

    if (!item || !item.name) throw new Error(`Armor '${armor.id}' has no item name.`);

    const name = (item.name as string).trim();
    const addName = (item.add_name as string).trim();

    return addName ? `${name} ${addName}` : name;
}

function resolveCharacterPartPaths(row: Record<string, any>, headParts: CharacterPartPaths_T[], armorRows: Record<string, any>[], faceVariant: number, armor: ICharacterArmorSelection): [string[], string[]] {
    const faceMesh = row.face_mesh[0] as string;
    const faceTexture = row.face_tex[faceVariant % row.face_tex.length] as string;
    const bodyParts = (row.body_mesh as string[]).map((mesh, i) => [[mesh, row.body_tex[i]]] as CharacterPartPaths_T[]);
    const bodyIndices: Record<string, number> = { u: 0, l: 1, g: 2, b: 3 };
    const chest = armorRows.find(row => row.id === armor.chest);
    const isAllDress = chest?.body_part === SchemasC4.CHARACTER_ALLDRESS_SLOT;
    const isFullArmor = isAllDress || chest?.body_part === SchemasC4.CHARACTER_FULL_ARMOR_SLOT;

    if (isFullArmor) bodyParts[bodyIndices.l] = []; // User::GetPcMeshName 0x738293: full armor supplies the lower mesh, including an empty entry.
    if (isAllDress) {
        bodyParts[bodyIndices.g] = [];
        bodyParts[bodyIndices.b] = [];
    }

    for (const slot of Object.keys(SchemasC4.CHARACTER_ARMOR_SLOTS)) {
        const id = armor[slot as keyof ICharacterArmorSelection];

        if (!id || slot === "legs" && isFullArmor || slot !== "chest" && isAllDress) continue;

        const armorRow = armorRows.find(row => row.id === id);

        if (!armorRow) throw new Error(`Armor '${id}' does not exist.`);
        if (!SchemasC4.CHARACTER_ARMOR_SLOTS[slot as keyof typeof SchemasC4.CHARACTER_ARMOR_SLOTS].includes(armorRow.body_part))
            throw new Error(`Armor '${id}' does not fit '${slot}'.`);

        const cleared = new Set<number>();

        for (const part of getCharacterArmorPaths(row, armorRow)) {
            const match = /_([ulgb])(?:_ad\d+)?$/i.exec(splitObjectPath(part[0])[1]);
            const index = match ? bodyIndices[match[1].toLowerCase()] : Object.keys(SchemasC4.CHARACTER_ARMOR_SLOTS).indexOf(slot);

            if (!cleared.has(index)) {
                bodyParts[index] = [];
                cleared.add(index);
            }

            bodyParts[index].push(part);
        }
    }

    const body = bodyParts.flat();

    return [
        [faceMesh, ...headParts.map(piece => piece[0]), ...body.map(piece => piece[0])] as string[],
        [faceTexture, ...headParts.map(piece => piece[1]), ...body.map(piece => piece[1])] as string[]
    ];
}

function decodeTextureRGBA(info: ITextureDecodeInfo): { width: number, height: number, buffer: ArrayBuffer } {
    if (info.textureType === "rgba") {
        const data = info as IDataTextureDecodeInfo;

        if (data.format && data.format !== "rgba") throw new Error(`UI texture '${info.name}' has unsupported data format '${data.format}'.`);

        return { width: data.width, height: data.height, buffer: info.buffer.slice(0) };
    }

    if (info.textureType !== "dds") throw new Error(`UI texture '${info.name}' has unsupported type '${info.textureType}'.`);

    const header = new Int32Array(info.buffer, 0, 31);
    const height = header[3], width = header[4], fourCC = header[21];
    const input = new Uint8Array(info.buffer, 128);

    switch (fourCC) {
        case 0x31545844: return { width, height, buffer: dxt1ToRgba(width, height, input).buffer as ArrayBuffer };
        case 0x33545844: return { width, height, buffer: dxt3ToRgba(width, height, input).buffer as ArrayBuffer };
        case 0x35545844: return { width, height, buffer: dxt5ToRgba(width, height, input).buffer as ArrayBuffer };
        default: throw new Error(`UI texture '${info.name}' has unsupported FourCC 0x${(fourCC >>> 0).toString(16)}.`);
    }
}

export class DecodeEngine {
    protected assetLoader: AssetLoader = null;
    protected hasSweptCache = false;
    protected cacheCharGrpRows: Record<string, any>[] = null;
    protected cacheArmorGrpRows: Record<string, any>[] = null;
    protected cacheWeaponGrpRows: Record<string, any>[] = null;
    protected cacheEtcItemGrpRows: Record<string, any>[] = null;
    protected cacheItemNameRows: Record<string, any>[] = null;
    protected cacheNpcDefinitions: INpcDefinition[] = null;
    protected cacheSkillTables: Promise<SkillTables_T> = null;
    protected cacheCharacterBundles = new Map<number, CachedBundle_T>();
    protected cacheCharacterHairPieces = new Map<number, CharacterHairPieces_T>();
    protected cacheCharacterHairTables = new Map<string, Record<string, any>[]>();
    protected cacheNpcBundles = new Map<string, CachedBundle_T>();
    protected readonly cacheDecodePackages = new Map<APackage, number>();
    protected cacheAudioConfig: UConfigAudio = null;
    protected cacheHairConfig: UConfigHair = null;
    protected cacheEnchantConfig: Record<string, string> = null;
    protected readonly localizationFiles = new Map<string, string>();
    protected readonly scriptLocalizations = new Map<string, UConfigLocalization>();

    protected async sweepCache(settings: LoadSettings_T): Promise<void> {
        if (this.hasSweptCache) return;

        await DecodeCache.sweepDecodeCache(settings);
        this.hasSweptCache = true;
    }

    public async initialize(): Promise<void> {
        const assetList = await (await fetch("asset-list.json")).json();

        for (const path of assetList.unsupported)
            if (path.toLowerCase().endsWith(".int")) this.localizationFiles.set(path.toLowerCase(), path);

        this.assetLoader = await AssetLoader.Instantiate(assetList.supported);

        await this.assetLoader.using(this.assetLoader.getNativePackage(), { neverUnload: true });
        const pkgCore = await this.assetLoader.using(this.assetLoader.getCorePackage(), { neverUnload: true });
        await this.assetLoader.using(this.assetLoader.getEnginePackage(), { neverUnload: true });

        pkgCore.loadNativeClasses();
    }

    public async decodeClientConfig(): Promise<{ userConfig: UserConfig_T, warriorAnimations: Record<string, WarriorAnimations_T> }> {
        const [userConfig, warriorFile] = await Promise.all([
            getUserConfig(),
            new UConfigWarrior("assets/system/lineagewarrior.int").decode()
        ]);
        const warriorConfig = await warriorFile.load();
        const warriorAnimations: Record<string, WarriorAnimations_T> = {};

        for (const className of warriorConfig.getClassNames())
            warriorAnimations[className] = warriorConfig.getAnimations(className);

        return { userConfig, warriorAnimations };
    }

    public async decodeL2Text(name: string): Promise<string> {
        if (!/^[\w-]+\.htm$/i.test(name)) throw new Error(`Invalid l2text name '${name}'.`);

        return (await new UL2Text(`assets/l2text/${name}`).decode()).getText();
    }

    public async decodeScriptLocalization(scriptClassPath: string): Promise<LocalizationProperty_T[]> {
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

    protected collectPackageBuffers(): Set<ArrayBuffer> {
        const buffers = new Set<ArrayBuffer>();

        for (const packages of (this.assetLoader as any).packages.values()) {
            for (const pkg of packages.values()) {
                const buffer = (pkg as any).buffer;

                if (buffer instanceof ArrayBuffer) buffers.add(buffer);
            }
        }

        return buffers;
    }

    public async decodeSector(sectorName: string, settings: LoadSettings_T): Promise<{ library: any, fromCache: boolean }> {
        await this.sweepCache(settings);

        console.log(`[decode] decoding sector '${sectorName}'`);

        const start = performance.now();
        const result = await this.decodeSectorCore(sectorName, settings);

        console.log(`[decode] sector '${sectorName}' decoded in ${(performance.now() - start).toFixed(0)}ms${result.fromCache ? " (from cache)" : ""}`);

        return result;
    }

    public async decodeSectorBinary(sectorName: string, settings: LoadSettings_T): Promise<BinarySector_T> {
        await this.sweepCache(settings);

        console.log(`[decode] decoding sector '${sectorName}'`);

        const start = performance.now();
        const result = await this.decodeSectorBinaryCore(sectorName, settings);

        console.log(`[decode] sector '${sectorName}' decoded in ${(performance.now() - start).toFixed(0)}ms${result.fromCache ? " (from cache)" : ""}`);

        return result;
    }

    public async precacheSector(sectorName: string, settings: LoadSettings_T): Promise<PrecacheResult_T> {
        await this.sweepCache(settings);

        if (await DecodeCache.hasCachedLibrary(sectorName, settings))
            return { cached: true, bytes: 0 };

        try {
            const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
            const library = buildDecodeLibrary(pkg, sectorName, settings);

            await this.pullWaterVolumeEffects(library, settings);
            buildStaticMeshBatchData(library);
            prepareLibraryForTransfer(library, this.collectPackageBuffers());

            return { cached: false, bytes: await DecodeCache.storeCachedLibraryDurable(sectorName, settings, library) };
        } finally {
            this.freeSector(sectorName);
        }
    }

    protected async decodeSectorCore(sectorName: string, settings: LoadSettings_T): Promise<{ library: any, fromCache: boolean }> {
        const convertToRGBA = (settings as any).rgbaTextures !== false; // false = client uploads DDS as-is (s3tc)

        // Sky-level material UUIDs are session-random.
        const cacheable = !(settings as any).isSkyLevel;

        const cached = cacheable ? await DecodeCache.loadCachedLibrary(sectorName, settings) : null;

        if (cached) {
            if (convertToRGBA) convertDDSMaterialsToRGBA(cached);

            DecodeCache.refreshSoundBlobUris(cached);

            return { library: cached, fromCache: true };
        }

        const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
        const library = buildDecodeLibrary(pkg, sectorName, settings);

        await this.pullWaterVolumeEffects(library, settings);
        buildStaticMeshBatchData(library);

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if (cacheable) DecodeCache.storeCachedLibrary(sectorName, settings, library);

        if (convertToRGBA) convertDDSMaterialsToRGBA(library);

        // Main-thread decode owns these blob URLs.
        DecodeCache.refreshSoundBlobUris(library);

        return { library, fromCache: false };
    }

    protected async decodeSectorBinaryCore(sectorName: string, settings: LoadSettings_T): Promise<BinarySector_T> {
        const convertToRGBA = (settings as any).rgbaTextures !== false;
        const cacheable = !(settings as any).isSkyLevel;
        const cachedBuffer = cacheable ? await DecodeCache.loadCachedLibraryBuffer(sectorName, settings) : null;

        if (cachedBuffer) {
            if (!convertToRGBA) return { buffer: cachedBuffer, fromCache: true };

            const library = deserializeLibrary(cachedBuffer);

            convertDDSMaterialsToRGBA(library);

            return { buffer: serializeLibrary(library).buffer as ArrayBuffer, fromCache: true };
        }

        const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
        const library = buildDecodeLibrary(pkg, sectorName, settings);

        await this.pullWaterVolumeEffects(library, settings);
        buildStaticMeshBatchData(library);
        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        let buffer: ArrayBuffer = null;

        if (cacheable) {
            buffer = serializeLibrary(library).buffer as ArrayBuffer;
            await DecodeCache.storeCachedLibraryBufferDurable(sectorName, settings, buffer);
        }

        if (convertToRGBA) {
            buffer = null;
            convertDDSMaterialsToRGBA(library);
        }

        if (!buffer) buffer = serializeLibrary(library).buffer as ArrayBuffer;

        return { buffer, fromCache: false };
    }

    public freeSector(sectorName: string) {
        try {
            this.assetLoader.free(this.assetLoader.getPackage(sectorName, "Level"));
        } catch (e) { } // sector was decoded from cache - its packages were never loaded here
    }

    public async decodeEnvConfig(): Promise<any> {
        const pkgL2Skies = await this.assetLoader.using(this.assetLoader.getPackage("l2_skies", "Texture"), { neverUnload: true });
        const envFile = await (new UConfigEnv("assets/system/env.int").asReadable()).decode();
        const envConfig = await envFile.load(this.assetLoader.getNativePackage(), this.assetLoader.getEnginePackage(), pkgL2Skies);

        return envConfig.getDecodeInfo();
    }

    // one counted ref per package, handed back once nothing decoded from it for a while
    protected async usingDecodePackage<T extends APackage>(pkg: T): Promise<T> {
        if (!this.cacheDecodePackages.has(pkg)) await this.assetLoader.using(pkg);

        this.cacheDecodePackages.set(pkg, performance.now());

        return pkg;
    }

    public releaseDecodePackages(idleMs: number): void {
        const now = performance.now();

        for (const [pkg, lastUsed] of this.cacheDecodePackages) {
            if (now - lastUsed < idleMs) continue;

            this.cacheDecodePackages.delete(pkg);
            this.assetLoader.free(pkg);
        }
    }

    public getMemoryStats(): WorkerMemoryStats_T {
        let buffers = 0, packages = 0;

        for (const byExt of (this.assetLoader as any).packages.values()) for (const pkg of byExt.values()) {
            if (!pkg.buffer) continue;

            buffers += pkg.buffer.byteLength;
            packages++;
        }

        return { buffers, packages };
    }

    protected async fetchSkeletalMesh(path: string): Promise<USkeletalMesh> {
        const [packageName, objectName] = splitObjectPath(path);
        const pkg = await this.usingDecodePackage(this.assetLoader.getPackage(packageName, "Animation"));
        const lowerName = objectName.toLowerCase();
        const entry = pkg.exportGroups.SkeletalMesh.find(entry => (entry.export.objectName as string).toLowerCase() === lowerName);

        if (!entry) throw new Error(`Skeletal mesh '${objectName}' not found in '${packageName}'.`);

        return pkg.fetchObject<USkeletalMesh>(entry.index + 1);
    }

    protected async fetchCharacterMaterial(path: string): Promise<UMaterial> {
        const [packageName, objectName] = splitObjectPath(path);
        const pkg = await this.usingDecodePackage(this.assetLoader.getPackage(packageName, "Texture"));
        const lowerName = objectName.toLowerCase();
        const entry = pkg.exports.find(entry => objectName.includes(".") ? pkg.getObjectPath(entry).toLowerCase() === path.toLowerCase() : (entry.objectName as string).toLowerCase() === lowerName);

        if (!entry) throw new Error(`Material '${objectName}' not found in '${packageName}'.`);

        return pkg.fetchObject<UMaterial>(entry.index + 1);
    }

    protected async pullCharacterSkinMaterials(builder: DecodeLibraryBuilder, skinNotifies: Record<string, ISkinNotifyDecodeInfo>, basePath: string, baseMaterial: string): Promise<Record<number, string>> {
        const materials: Record<number, string> = { 0: baseMaterial };

        for (const index of getSkinNotifyIndices(skinNotifies)) {
            if (index === 0) continue;

            const path = getSkinMaterialPath(basePath, index);

            materials[index] = builder.pullMaterial(await this.fetchCharacterMaterial(path));
        }

        return materials;
    }

    protected async fetchScriptClass(path: string): Promise<[APackage, UClass]> {
        const [packageName, objectName] = splitObjectPath(path);
        const pkg = await this.usingDecodePackage(this.assetLoader.getPackage(packageName, "Script"));
        const lowerName = objectName.toLowerCase();
        const actualName = (pkg.exports.find(entry => (entry.objectName as string).toLowerCase() === lowerName)?.objectName as string) || objectName;
        const cls = pkg.fetchObjectByType<UClass>("Class", actualName);

        if (!cls) throw new Error(`Script class '${path}' not found.`);

        return [pkg, cls.loadSelf()];
    }

    protected async getAudioConfig(): Promise<UConfigAudio> {
        if (!this.cacheAudioConfig) this.cacheAudioConfig = (await new UConfigAudio("assets/system/alaudio.int").decode()).load();

        return this.cacheAudioConfig;
    }

    protected async getSwimSoundConfig(): Promise<SwimSoundConfig_T> { return (await this.getAudioConfig()).getSwimSound(); }

    protected async pullPawnSounds(library: DecodeLibrary, builder: DecodeLibraryBuilder, profile: L2JS.Engine.IPawnSoundsDecodeInfo): Promise<void> {
        const config = await this.getAudioConfig();

        library.pawnSounds = { ...profile };

        for (const [key, sound] of [["critical", config.getCriticalSound()], ["soulshot", config.getSoulshotSound()]] as const)
            library.pawnSounds[key] = { ...sound, sound: sound.sound && sound.sound.toLowerCase() !== "none" ? await this.pullSoundPath(builder, sound.sound, false) : null };

        for (const key of ["defense", "damage", "item", "shield"] as const) {
            const set = profile[key];

            if (!set) continue;

            const arrSounds = await Promise.all(set.sounds.map(path => path && path.toLowerCase() !== "none" ? this.pullSoundPath(builder, path, false) : null));

            library.pawnSounds[key] = { ...set, sounds: arrSounds } as any;
        }
    }

    protected async pullCharacterSounds(library: DecodeLibrary, builder: DecodeLibraryBuilder, row: Record<string, any>, chestId: number = 0, leftHandId: number = 0): Promise<void> {
        const audio = await this.getAudioConfig();
        const config = audio.getPawnSound("CharSound");
        const itemConfig = audio.getPawnSound("ItemSound");
        const armor = chestId ? (await this.decodeArmorGrp()).find(item => item.id === chestId) : null;
        const shield = leftHandId ? (await this.decodeWeaponGrp()).find(item => item.id === leftHandId) : null;

        if (chestId && !armor) throw new Error(`Defense item '${chestId}' was not found in armorgrp.`);

        // Engine.dll CharDataLoad 0x70ce21/0x70ce83 caps defense/damage lists at 5/3 without removing NAME_None slots.
        await this.pullPawnSounds(library, builder, {
            defense: { sounds: row.snd_def.slice(0, 5), volume: config.volume, radius: config.radius },
            damage: { sounds: row.snd_dmg.slice(0, 3), volume: config.volume, radius: config.radius, random: config.random },
            // Engine.dll OnUserInfo 0x74b965..0x74b974; SetPawnResource 0x73bf72..0x73bfcc: DefenseItemClassID is chest slot2.
            item: armor && armor.tag === 1 ? { sounds: armor.item_sound, volume: itemConfig.volume, radius: itemConfig.radius } : null,
            shield: shield && shield.tag === 0 ? { sounds: shield.item_sound, volume: itemConfig.volume, radius: itemConfig.radius } : null
        });
    }

    protected async pullSoundPath(builder: DecodeLibraryBuilder, path: string, required: boolean = true): Promise<string> {
        const [packageName, objectName] = splitObjectPath(path);

        if (!required && !this.assetLoader.hasPackage(packageName, "Sound")) return null;

        const pkg = await this.usingDecodePackage(this.assetLoader.getPackage(packageName, "Sound"));
        const lowerName = objectName.toLowerCase();
        const entry = pkg.exportGroups.Sound.find(entry => (entry.export.objectName as string).toLowerCase() === lowerName);

        if (!entry) {
            if (!required) return null;
            throw new Error(`Sound '${objectName}' not found in '${packageName}'.`);
        }

        const sound = pkg.fetchObject<USound>(entry.index + 1).loadSelf();
        const soundName = sound.objectName ?? sound.uuid;

        if (!builder.pullSound(sound)) throw new Error(`Sound '${path}' has no audio data.`);

        return soundName;
    }

    protected async pullSwimSoundSet(builder: DecodeLibraryBuilder, config: SwimSoundSet_T): Promise<IAnimationSwimSoundSetDecodeInfo> {
        return {
            sounds: await Promise.all(config.sounds.map(path => this.pullSoundPath(builder, path))),
            volume: config.volume,
            radius: config.radius,
            random: config.random
        };
    }

    protected async pullAnimationNotifyAssets(builder: DecodeLibraryBuilder, animationNotifies: Record<string, IAnimationNotifyDecodeInfo[]>): Promise<void> {
        const swimNotifies: IAnimationSwimSoundNotifyDecodeInfo[] = [];

        for (const notifications of Object.values(animationNotifies))
            for (const notify of notifications)
                if (notify.object?.type === "swimSound") swimNotifies.push(notify.object);

        if (swimNotifies.length === 0) return;

        const config = await this.getSwimSoundConfig();
        const [surface, underwater] = await Promise.all([this.pullSwimSoundSet(builder, config.surface), this.pullSwimSoundSet(builder, config.underwater)]);

        for (const notify of swimNotifies) {
            notify.surface = surface;
            notify.underwater = underwater;
        }
    }

    protected async pullScriptEffectTemplates(library: DecodeLibrary, builder: DecodeLibraryBuilder): Promise<void> {
        const paths = new Set<string>();
        const programs = [...Object.values(library.scriptFunctions), ...Object.values(library.scriptStates), ...Object.values(library.scriptClasses)];

        for (const info of programs)
            for (const entry of info.program.entries)
                if (typeof entry.value === "string" && /^LineageEffect\./i.test(entry.value)) paths.add(entry.value);

        if (paths.size === 0) return;

        for (const path of paths) await this.pullEffectTemplate(library, builder, path);
    }

    protected async pullAnimationNotifyEffects(builder: DecodeLibraryBuilder, animationNotifies: Record<string, IAnimationNotifyDecodeInfo[]>): Promise<void> {
        const paths = new Set<string>();

        for (const notifications of Object.values(animationNotifies))
            for (const notify of notifications)
                if (notify.object?.type === "effect" && notify.object.effectClass) paths.add(notify.object.effectClass);

        for (const path of paths)
            if (!builder.library.effectTemplates[path]) await this.pullEffectTemplate(builder.library, builder, path);
    }

    protected async pullNpcSkillAttacks(library: DecodeLibrary, builder: DecodeLibraryBuilder, attacks: readonly NpcSkillAttack_T[]): Promise<void> {
        await decodeSkillVisuals(library, attacks, async packageName => this.usingDecodePackage(this.assetLoader.getPackage(packageName, "Effect")), (path, pullScript, weaponId) => this.pullEffectTemplate(library, builder, path, pullScript, weaponId), (path, required) => this.pullSoundPath(builder, path, required));
    }

    protected async pullScriptActorTemplates(library: DecodeLibrary, builder: DecodeLibraryBuilder): Promise<void> {
        const paths = new Set<string>();
        const programs = [...Object.values(library.scriptFunctions), ...Object.values(library.scriptStates), ...Object.values(library.scriptClasses)];

        for (const program of programs)
            for (const entry of program.program.entries)
                if (entry.type === "objectRef" && typeof entry.value === "string" && /^LineageNpc\./i.test(entry.value)) paths.add(entry.value);

        for (const path of paths) {
            const [, cls] = await this.fetchScriptClass(path);
            const properties = dumpObjectScriptProperties(cls);
            const meshPath = properties.Mesh;

            if (typeof meshPath !== "string" || meshPath.toLowerCase() === "none") continue;

            const info = Object.assign({}, builder.pullSkeletalMesh(await this.fetchSkeletalMesh(meshPath), false));

            builder.pullScriptClassFunctions([cls]);
            info.scriptClassId = cls.name;
            info.scriptProperties = properties;
            library.actorTemplates[path] = info;
            library.actorTemplates[cls.name] = info;
        }
    }

    protected async pullEffectTemplate(library: DecodeLibrary, builder: DecodeLibraryBuilder, path: string, pullScript: boolean = false, weaponId?: number): Promise<void> {
        const [pkg, cls] = await this.fetchScriptClass(path);
        const emitter = pkg.newObject<UEmitter>(cls);

        emitter.objectName = cls.objectName;

        const info = emitter.getTemplateDecodeInfo(builder);

        info.scriptClassId = cls.name;
        info.scriptProperties = dumpObjectScriptProperties(emitter);
        library.effectTemplates[path] = info;
        library.effectTemplates[cls.name] = info;

        if (pullScript || info.drawType === "mesh") {
            builder.pullScriptClasses([cls]);

            for (let current = library.scriptClasses[cls.name]; current; current = library.scriptClasses[current.superClassId])
                for (const [name, value] of Object.entries(current.defaults))
                    if (!(name in info.scriptProperties)) info.scriptProperties[name] = value;
        } else builder.pullScriptClassFunctions([cls]);

        if (weaponId !== undefined) {
            const row = (await this.decodeWeaponGrp()).find(row => row.id === weaponId);

            if (!row || row.wpn_mesh.length !== 1 || info.drawType !== "mesh") throw new Error(`Native effect '${path}' cannot load weapon '${weaponId}'.`);

            info.scriptProperties.Mesh = row.wpn_mesh[0];
            info.scriptProperties.Skins = row.wpn_tex.slice();
        }

        if (info.drawType === "mesh") await this.pullScriptMeshAssets(library, builder, cls.name, info.scriptProperties);
    }

    protected async pullScriptMeshAssets(library: DecodeLibrary, builder: DecodeLibraryBuilder, classId: string, properties: Record<string, any>): Promise<void> {
        const meshes = new Set<string>();
        const materials = new Set<string>();

        if (properties.Mesh && properties.Mesh.toLowerCase() !== "none") meshes.add(properties.Mesh);
        for (const skin of properties.Skins || [])
            if (skin && skin.toLowerCase() !== "none") materials.add(skin);

        for (let cls = library.scriptClasses[classId]; cls; cls = library.scriptClasses[cls.superClassId])
            for (const fn of Object.values(library.scriptFunctions)) {
                if (fn.owner !== cls.id) continue;

                const entries = fn.program.entries;

                for (let i = 0; i < entries.length - 4; i++) {
                    if (entries[i].type !== "functionRef" || (entries[i].value as string).toLowerCase() !== "core.object.dynamicloadobject") continue;
                    if (entries[i + 2].type !== "string" || entries[i + 4].type !== "objectRef") continue;

                    const path = entries[i + 2].value as string;
                    const type = (entries[i + 4].value as string).toLowerCase();

                    if (type === "engine.skeletalmesh") meshes.add(path);
                    else if (type === "engine.texture" || type === "engine.material") materials.add(path);
                }
            }

        for (const path of meshes)
            if (!library.scriptMeshes[path.toLowerCase()]) library.scriptMeshes[path.toLowerCase()] = builder.pullSkeletalMesh(await this.fetchSkeletalMesh(path), false);
        for (const path of materials)
            if (!library.scriptMaterials[path.toLowerCase()]) library.scriptMaterials[path.toLowerCase()] = builder.pullMaterial(await this.fetchCharacterMaterial(path));
    }

    protected async pullWaterVolumeEffects(library: DecodeLibrary, settings: LoadSettings_T): Promise<void> {
        const paths = new Set<string>();

        for (const volume of library.waterVolumes) {
            if (volume.waitHitEffect) paths.add(volume.waitHitEffect);
            if (volume.runHitEffect) paths.add(volume.runHitEffect);
        }

        if (paths.size === 0) return;

        const builder = new DecodeLibraryBuilder(library, settings);

        for (const path of paths) await this.pullEffectTemplate(library, builder, path, true);
    }

    protected async buildNpcBundle(settings: LoadSettings_T, bundleName: string): Promise<DecodeLibrary> {
        const definitions = (await this.decodeNpcDefinitions()).filter(npc => {
            if (!npc.mesh.includes(".")) return false;

            const [packageName] = splitObjectPath(npc.mesh);

            return isNpcMeshPackage(packageName) && getNpcBundleName(packageName) === bundleName;
        });
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, { ...settings, rgbaTextures: false } as LoadSettings_T);
        const manifest: NpcBundleManifest_T = { actors: {} };
        const meshIndices = new Map<string, number>();
        const materialIds = new Map<string, string>();
        const textureIds = new Map<string, string>();
        const classIds = new Map<string, string | null>();
        const pawnDefaults = new Map<string, { effectSpawnBoneIndex: number, damageEffect: string | null }>();
        const classes: UClass[] = [];

        library.name = bundleName;

        for (const npc of definitions) {
            const meshPath = npc.mesh.toLowerCase();

            if (meshIndices.has(meshPath)) continue;

            const mesh = await this.fetchSkeletalMesh(npc.mesh);
            let info: ISkinnedMeshObjectDecodeInfo;

            try {
                info = builder.pullSkeletalMesh(mesh, true);
            } catch (e) {
                throw new Error(`NPC mesh '${npc.mesh}' failed to decode: ${(e as Error).message}`);
            }

            if (Object.keys(info.animations).length > 0) info.animationSet = `${bundleName}_${meshPath}`;
            meshIndices.set(meshPath, library.pawnActors.length);
            library.pawnActors.push(info);
        }

        for (const info of library.pawnActors) await this.pullAnimationNotifyAssets(builder, info.animationNotifies);

        for (const npc of definitions) {
            const classPath = npc.className.toLowerCase();

            if (classIds.has(classPath)) continue;

            let pkg: APackage, cls: UClass;

            try {
                [pkg, cls] = await this.fetchScriptClass(npc.className);
            } catch (e) {
                if (!(e as Error).message.endsWith("not found.")) throw e;

                classIds.set(classPath, null);
                continue;
            }

            classIds.set(classPath, cls.name);
            classes.push(cls);

            const pawn = pkg.newObject(cls);
            const effectSpawnBoneIndex = pawn.propertyDict.get("EffectSpawnBoneIdx");
            const damageEffect = pawn.propertyDict.get("DamageEffect") as UClass;

            if (!Number.isInteger(effectSpawnBoneIndex)) throw new Error(`Pawn '${npc.className}' has no effect target bone index.`);
            if (damageEffect === undefined) throw new Error(`Pawn '${npc.className}' has no DamageEffect default.`);

            pawnDefaults.set(classPath, { effectSpawnBoneIndex, damageEffect: damageEffect ? damageEffect.name : null });
        }

        builder.pullScriptClasses(classes);

        for (const npc of definitions) {
            const meshIndex = meshIndices.get(npc.mesh.toLowerCase());
            const meshInfo = library.pawnActors[meshIndex];
            const materialKey = `${meshInfo.materials}|${npc.textures.map(path => path.toLowerCase()).join("|")}`;
            let materials = meshInfo.materials;

            if (npc.textures.length > 0) {
                materials = materialIds.get(materialKey);

                if (!materials) {
                    // USkeletalMeshInstance::GetMaterial (retail 0x949851): absent nonzero skins retain mesh Materials[index].
                    const materialNames = (library.materials[meshInfo.materials] as IMaterialGroupDecodeInfo).materials.slice();

                    for (let i = 0; i < npc.textures.length; i++) {
                        const path = npc.textures[i];
                        const key = path.toLowerCase();
                        let material = textureIds.get(key);

                        if (!material) {
                            material = builder.pullMaterial(await this.fetchCharacterMaterial(path));
                            textureIds.set(key, material);
                        }

                        materialNames[i] = material;
                    }

                    materials = `${bundleName}.materials.${materialIds.size}`;
                    materialIds.set(materialKey, materials);
                    library.materials[materials] = { name: materials, materialType: "group", materials: materialNames } as IMaterialGroupDecodeInfo;
                }
            }

            const defaults = pawnDefaults.get(npc.className.toLowerCase());

            manifest.actors[npc.id] = { meshIndex, materials, scriptClassId: classIds.get(npc.className.toLowerCase()), effectSpawnBoneIndex: defaults ? defaults.effectSpawnBoneIndex : null, damageEffect: defaults ? defaults.damageEffect : null };
        }

        (library as any).npcBundle = manifest;

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        return library;
    }

    protected async getNpcBundle(settings: LoadSettings_T, packageName: string): Promise<CachedBundle_T> {
        const bundleName = getNpcBundleName(packageName);
        let bundle = this.cacheNpcBundles.get(bundleName);

        if (bundle) return bundle;

        const seekable = await DecodeCache.openCachedLibrary(bundleName, settings);

        if (seekable) {
            bundle = { library: seekable.library as DecodeLibrary, seekable };
        } else {
            const library = await this.buildNpcBundle(settings, bundleName);

            await DecodeCache.storeCachedLibraryDurable(bundleName, settings, library);

            // the built bundle holds every mesh and texture of its packages, keep the file-backed copy instead
            const stored = await DecodeCache.openCachedLibrary(bundleName, settings);

            bundle = stored ? { library: stored.library as DecodeLibrary, seekable: stored } : { library };
        }

        this.cacheNpcBundles.set(bundleName, bundle);

        return bundle;
    }

    protected async decodeNpc(settings: LoadSettings_T, npcId: number, includeAnimations: boolean, equipment: L2JS.Engine.INpcEquipment | null): Promise<DecodeLibrary> {
        const npc = await this.resolveNpc(npcId);
        const [packageName] = splitObjectPath(npc.mesh);
        const cached = await this.getNpcBundle(settings, packageName);
        const bundle = cached.library;
        const manifest = (bundle as any).npcBundle as NpcBundleManifest_T;
        const entry = manifest.actors[npcId];

        if (!entry) throw new Error(`NPC '${npcId}' is not in '${bundle.name}'.`);
        if (!entry.scriptClassId) throw new Error(`NPC '${npcId}' references missing script class '${npc.className}'.`);

        const sourceInfo = bundle.pawnActors[entry.meshIndex];
        const info = Object.assign({}, sourceInfo, {
            uuid: `${sourceInfo.uuid}.${npcId}`,
            name: npc.name,
            materials: entry.materials,
            scriptClassId: entry.scriptClassId,
            animations: includeAnimations ? sourceInfo.animations : {},
            animationSequences: includeAnimations ? sourceInfo.animationSequences : {},
            animationNotifies: includeAnimations ? sourceInfo.animationNotifies : {}
        });
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);

        library.name = `${npc.id}_${npc.name}`;
        library.geometries[info.geometry] = bundle.geometries[info.geometry];
        copyCharacterMaterial(library, bundle, info.materials);
        copyAnimationSounds(library, bundle, sourceInfo.animationNotifies);
        copyScriptClass(library, bundle, entry.scriptClassId);
        // the bundle carries the pawn defaults so a spawn never has to load LineageMonster.u and the mesh packages it imports
        library.effectSpawnBoneIndex = entry.effectSpawnBoneIndex;
        library.damageEffect = entry.damageEffect;
        if (entry.damageEffect) await this.pullEffectTemplate(library, builder, entry.damageEffect, true);
        await this.pullAnimationNotifyEffects(builder, sourceInfo.animationNotifies);
        await this.pullScriptEffectTemplates(library, builder);
        await this.pullScriptActorTemplates(library, builder);
        await this.pullNpcSkillAttacks(library, builder, npc.skillAttacks);
        await this.pullNpcEquipment(library, builder, equipment);
        await this.pullPawnSounds(library, builder, npc.sounds);

        if (npc.enterEvent?.effect && npc.enterEvent.effect.toLowerCase() !== "none")
            await this.pullEffectTemplate(library, builder, npc.enterEvent.effect);

        if (npc.enterEvent?.sound && npc.enterEvent.sound.toLowerCase() !== "none")
            library.sounds[npc.enterEvent.sound] = await this.pullSoundPath(builder, npc.enterEvent.sound);

        library.pawnActors.push(info);

        if (cached.seekable) await hydrateLibraryFile(cached.seekable, library);

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    public async decodeSkeletalMesh(settings: LoadSettings_T, packageName: string, meshName: string, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null, includeAnimations: boolean = true, equipment: L2JS.Engine.INpcEquipment | null = null): Promise<DecodeLibrary> {
        if (npcId !== null) return this.decodeNpc(settings, npcId, includeAnimations, equipment);

        const mesh = await this.fetchSkeletalMesh(`${packageName}.${meshName}`);
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);
        const meshInfo = builder.pullSkeletalMesh(mesh, true);

        await this.pullAnimationNotifyAssets(builder, meshInfo.animationNotifies);
        await this.pullAnimationNotifyEffects(builder, meshInfo.animationNotifies);

        library.name = mesh.objectName;
        library.pawnActors.push(meshInfo);

        if (texturePaths.length > 0) {
            const material = library.materials[meshInfo.materials] as IMaterialGroupDecodeInfo;

            if (!material || material.materialType !== "group") throw new Error(`Skeletal mesh '${packageName}.${meshName}' has no material group.`);

            const skins = await Promise.all(texturePaths.map(async path => builder.pullMaterial(await this.fetchCharacterMaterial(path))));

            skins.forEach((skin, i) => material.materials[i] = skin);
        }

        if (scriptClassPath) {
            const [, cls] = await this.fetchScriptClass(scriptClassPath);

            meshInfo.scriptClassId = cls.name;
            builder.pullScriptClasses([cls]);
            await this.pullPawnEffects(library, builder, scriptClassPath);
            await this.pullScriptEffectTemplates(library, builder);
            await this.pullScriptActorTemplates(library, builder);
        }

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    public async decodeItem(settings: LoadSettings_T, id: number): Promise<DecodeLibrary> {
        const tables = await Promise.all([this.decodeEtcItemGrp(), this.decodeWeaponGrp(), this.decodeArmorGrp()]);
        const row = tables.flat().find(row => row.id === id);

        if (!row) throw new Error(`Missing item '${id}'.`);

        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);
        const meshes = [row.drop_mesh1 ?? row.drop_mesh_1, row.drop_mesh2 ?? row.drop_mesh_2, row.drop_mesh3 ?? row.drop_mesh_3];
        const skins = [row.drop_tex1 ?? row.drop_texture_1, row.drop_tex2 ?? row.drop_texture_2, row.drop_tex3 ?? row.drop_texture_3];

        library.name = `Item_${id}`;
        library.pickup = { items: [], dropSound: row.drop_sound ?? row.item_sound };

        // UGameEngine::OnSpawnItem 0x74c895..0x74c8c6: skins following the last mesh belong to that mesh.
        for (let i = 0; i < meshes.length; i++) {
            const path = meshes[i];

            if (!path || path.toLowerCase() === "none") continue;

            const mesh = builder.pullSkeletalMesh(await this.fetchSkeletalMesh(path), false);
            const itemSkins = skins.filter((skin, j) => skin && skin.toLowerCase() !== "none" && (i === j || !meshes[i + 1] || meshes[i + 1].toLowerCase() === "none"));

            library.scriptMeshes[path.toLowerCase()] = mesh;
            library.pickup.items.push({ mesh: path, skins: itemSkins });

            for (const skin of itemSkins) library.scriptMaterials[skin.toLowerCase()] = builder.pullMaterial(await this.fetchCharacterMaterial(skin));
        }

        if (!library.pickup.items.length) throw new Error(`Item '${id}' has no drop mesh.`);

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    public async decodeItemBinary(settings: LoadSettings_T, id: number): Promise<ArrayBuffer> {
        return serializeLibrary(await this.decodeItem(settings, id)).buffer as ArrayBuffer;
    }

    public async decodeEffectTemplates(settings: LoadSettings_T, classPaths: string[], soundPaths: string[] = [], scriptClassPaths: string[] = []): Promise<DecodeLibrary> {
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);

        library.name = "EffectTemplates";

        for (const path of classPaths) await this.pullEffectTemplate(library, builder, path, scriptClassPaths.includes(path));
        for (const path of soundPaths) library.sounds[path] = await this.pullSoundPath(builder, path);
        for (const path of scriptClassPaths) {
            const [, cls] = await this.fetchScriptClass(path);

            builder.pullScriptClasses([cls]);
        }

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    protected async decodeSkillTables(): Promise<SkillTables_T> {
        if (!this.cacheSkillTables) this.cacheSkillTables = this.loadSkillTables();

        return this.cacheSkillTables;
    }

    public async decodeMatineeScenes(levelName: string): Promise<MatineeScene_T[]> {
        const pkg = await this.usingDecodePackage(this.assetLoader.getPackage(levelName, "Level"));
        const scenes: MatineeScene_T[] = [];

        for (const { index } of pkg.exportGroups.SceneManager || []) {
            const manager = pkg.fetchObject<UObject>(index + 1).loadSelf();
            const actions: MatineeAction_T[] = [];

            for (const ref of [...(manager.propertyDict.get("Actions") || [])] as UObject[]) {
                if (!ref) continue;

                const action = ref.loadSelf(), point = (action.propertyDict.get("IntPoint") as UObject).loadSelf();
                const location = point.propertyDict.get("Location") as any, rotation = point.propertyDict.get("Rotation") as any;

                actions.push({
                    action: action.constructor.friendlyName,
                    duration: action.propertyDict.get("Duration") as number,
                    pathStyle: action.propertyDict.get("PathStyle") as number,
                    location: [location.x, location.y, location.z],
                    rotation: [rotation.pitch, rotation.yaw, rotation.roll]
                });
            }

            scenes.push({ tag: manager.propertyDict.get("Tag") as string, actions });
        }

        return scenes;
    }

    public async decodeUITextures(settings: LoadSettings_T, paths: string[]): Promise<UITexture_T[]> {
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, { ...settings, rgbaTextures: false } as LoadSettings_T);
        const textures: UITexture_T[] = [];

        library.loadMipmaps = false;

        const packages = new Set(paths.map(request => request.replace(/^\?/, "").split(".")[0].toLowerCase()));

        await Promise.all([...packages].map(name => this.usingDecodePackage(this.assetLoader.getPackage(name, "Texture"))));

        for (const request of paths) { // NCButton's implicit '%s_over' is optional.
            const isOptional = request.startsWith("?");
            const path = isOptional ? request.slice(1) : request;
            const parts = path.split(".");

            if (parts.length < 2 || parts.length > 3) throw new Error(`UI texture path '${path}' is not Package[.Group].Name.`);

            const pkg = await this.usingDecodePackage(this.assetLoader.getPackage(parts[0], "Texture"));
            const ref = pkg.findObjectRef("Texture", parts[parts.length - 1], parts.length === 3 ? parts[1] : "None");

            if (ref === 0) {
                if (isOptional) continue;

                throw new Error(`UI texture '${path}' does not exist.`);
            }

            const info = (pkg.fetchObject(ref) as UTexture).loadSelf().getDecodeInfo(builder) as ITextureDecodeInfo | IAnimatedSpriteDecodeInfo;

            if (info.materialType === "sprite") {
                const frames = (info as IAnimatedSpriteDecodeInfo).sprites.map(sprite => decodeTextureRGBA(sprite as ITextureDecodeInfo));

                textures.push({ path, width: frames[0].width, height: frames[0].height, frames: frames.map(frame => frame.buffer), frameTime: (info as IAnimatedSpriteDecodeInfo).framerate });
            } else if (info.materialType === "texture") {
                const frame = decodeTextureRGBA(info as ITextureDecodeInfo);

                textures.push({ path, width: frame.width, height: frame.height, frames: [frame.buffer], frameTime: 0 });
            } else throw new Error(`UI texture '${path}' decoded to unsupported material '${info.materialType}'.`);
        }

        return textures;
    }

    public async decodeGameStrings(): Promise<GameStrings_T> {
        const [messages, sysStrings, servers, actions, logon, classes, tables, items, weapons, armor, etcItems, symbols] = await Promise.all([
            (new UDataFile(SchemasC4.SCHEMA_SYSTEMMSG_E_DAT, "assets/system/systemmsg-e.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_SYSSTRING_E_DAT, "assets/system/sysstring-e.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_SERVERNAME_E_DAT, "assets/system/servername-e.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_ACTIONNAME_E_DAT, "assets/system/actionname-e.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_LOGONGRP_DAT, "assets/system/logongrp.dat", SchemasC4.LOGONGRP_RECORD_COUNT).asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_CLASSINFO_E_DAT, "assets/system/classinfo-e.dat").asReadable()).decode(),
            this.decodeSkillTables(),
            this.decodeItemNames(),
            this.decodeWeaponGrp(),
            this.decodeArmorGrp(),
            this.decodeEtcItemGrp(),
            (new UDataFile(SchemasC4.SCHEMA_SYMBOLNAME_E_DAT, "assets/system/symbolname-e.dat").asReadable()).decode()
        ]);
        const itemInfos: Record<number, ItemInfo_T> = {};

        for (const row of items) itemInfos[row.id] = { addName: row.add_name, description: row.description.replace(/\\n/g, "\n"), equipSound: "", weight: 0, crystalType: 0, consumeType: 0, weaponType: 0, pAtk: 0, mAtk: 0, speed: 0, soulshots: 0, spiritshots: 0, mpConsume: 0, shieldPDef: 0, shieldRate: 0, avoidModify: 0, armorType: 0, pDef: 0, mDef: 0, mpBonus: 0 }; // NWindow 0x1006b130 turns the literal "\n" into line breaks.

        for (const row of weapons) Object.assign(itemInfos[row.id], { equipSound: row.equip_sound, weight: row.weight, crystalType: row.crystal_type, weaponType: row.weapon_type, pAtk: row.patt, mAtk: row.matt, speed: row.speed, soulshots: row.SS_count, spiritshots: row.SPS_count, mpConsume: row.mp_consume, shieldPDef: row.shield_pdef, shieldRate: row.shield_rate, avoidModify: row.avoid_mod });
        for (const row of armor) Object.assign(itemInfos[row.id], { equipSound: row.equip_sound, weight: row.weight, crystalType: row.crystal_type, armorType: row.armor_type, pDef: row.physical_defence, mDef: row.magical_defence, mpBonus: row.mp_bonus });
        for (const row of etcItems) Object.assign(itemInfos[row.id], { equipSound: row.equip_sound, weight: row.weight, crystalType: row.grade, consumeType: row.stackable });

        const skillNames: Record<number, string> = {};
        const skillIcons: Record<number, string> = {};

        for (const row of tables.names)
            if (!(row.id in skillNames)) skillNames[row.id] = row.name;

        for (const row of tables.skills)
            if (!(row.skill_id in skillIcons)) skillIcons[row.skill_id] = row.icon_name;

        return {
            systemMessages: Object.fromEntries(messages.datarows.map((row: any) => [row.id, row.message])),
            systemMessageColors: Object.fromEntries(messages.datarows.map((row: any) => [row.id, ((row.UNK_1 & 0xff) << 24 | row.rgb[2] << 16 | row.rgb[1] << 8 | row.rgb[0]) >>> 0])), // NWindow 0x1005c274 uses the record's rgb + alpha bytes verbatim as an 0xAARRGGBB dword.
            systemMessageSounds: Object.fromEntries(messages.datarows.filter((row: any) => row.item_sound && row.item_sound.toLowerCase() !== "none").map((row: any) => [row.id, row.item_sound])),
            sysStrings: Object.fromEntries(sysStrings.datarows.map((row: any) => [row.id, row.name])),
            serverNames: Object.fromEntries(servers.datarows.map((row: any) => [row.server_id + 1, row.server_name])), // servername-e.dat ids are 0-based; login server ids start at 1 (server 1 = Bartz in the L2.4_20 capture).
            skillIcons,
            skillCastStyles: Object.fromEntries(tables.skills.map(row => [`${row.skill_id}:${row.skill_level}`, row.cast_style])),
            actions: Object.fromEntries(actions.datarows.map((row: any) => [row.id, { name: row.name, icon: row.icon, type: row.type, category: row.category, command: row.cmd }])),
            logonSpots: logon.datarows.map((row: any) => [row.x, row.y, row.z, row.yaw]),
            classNames: Object.fromEntries(classes.datarows.map((row: any) => [row.id, row.name])),
            skillNames,
            itemNames: Object.fromEntries(items.map(row => [row.id, row.name])),
            itemIcons: Object.fromEntries([...weapons, ...etcItems].map(row => [row.id, row.icon[0]]).concat(armor.map(row => [row.id, row.icon]))),
            itemInfos,
            symbols: Object.fromEntries(symbols.datarows.map((row: any) => [row.filename, row.alias])) // FL2GameData::GetSymbolTexture matches the backtick token against the first column.
        };
    }

    public async listPlayerSkills(): Promise<PlayerSkillInfo_T[]> {
        const tables = await this.decodeSkillTables();
        const rows = new Map<number, Record<string, any>>();

        for (const row of tables.skills) {
            const id = row.skill_id as number;
            if (id < 1 || id > 1999 || row.oper_type !== 0 && row.oper_type !== 1) continue;

            const current = rows.get(id);
            if (!current || current.skill_level > row.skill_level) rows.set(id, row);
        }

        return [...rows.entries()].sort(([a], [b]) => a - b).map(([id, row]) => {
            const level = row.skill_level as number;
            const name = tables.names.find(entry => entry.id === id && entry.level === level);

            if (!name) throw new Error(`Player skill '${id}:${level}' has no skillname-e row.`);

            return { id, level, name: name.name as string, animationCategory: row.ani_char as string, hitTime: row.hit_time as number, castRange: row.cast_range as number, previewTarget: mobSkillTable.get(id)?.target ? "self" : undefined };
        });
    }

    protected async loadSkillTables(): Promise<SkillTables_T> {
        const [skills, names, sounds] = await Promise.all([
            (new UDataFile(SchemasC4.SCHEMA_SKILLGRP_DAT, "assets/system/skillgrp.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_SKILLNAME_E_DAT, "assets/system/skillname-e.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_SKILLSOUNDGRP_DAT, "assets/system/skillsoundgrp.dat").asReadable()).decode()
        ]);

        return { skills: skills.datarows, names: names.datarows, sounds: sounds.datarows };
    }

    public async decodeSkill(settings: LoadSettings_T, id: number, level: number): Promise<DecodeLibrary> {
        if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(level) || level <= 0) throw new Error(`Invalid skill ID/level '${id}:${level}'.`);

        const tables = await this.decodeSkillTables();
        const rows = tables.skills.filter(row => row.skill_id === id && row.skill_level === level);

        if (rows.length !== 1) throw new Error(`Skill '${id}:${level}' has ${rows.length} exact skillgrp rows.`);

        const row = rows[0];
        const visualEffect = String(row.desc || "None");

        validatePlayerSkillSource(id, level, row.oper_type);

        const name = tables.names.find(entry => entry.id === id && entry.level === level);

        if (!name) throw new Error(`Player skill '${id}:${level}' has no skillname-e row.`);

        const sounds = tables.sounds.find(entry => entry.skill_id === id && entry.skill_level === level) || tables.sounds.find(entry => entry.skill_id === id && entry.skill_level === 1);
        // Server supplies cast duration; the offline preview uses skillgrp.hit_time.
        const serverSkill = mobSkillTable.get(id);
        const attack: NpcSkillAttack_T = { id, level, name: name.name, animation: "", animationCategory: row.ani_char, castStyle: row.cast_style, isMagic: row.is_magic !== 0, castRange: row.cast_range, hitTime: row.hit_time, isMultiShot: [8, 9, 10].includes(row.cast_style), flyingTime: 0, visualEffect, visual: null, passive: serverSkill?.passive === true, previewTarget: serverSkill?.target ? "self" : undefined, sounds: [] };

        if (sounds) {
            const phases: [string, NpcSkillEffectPhase_T][] = [["spelleffect", "casting"], ["shoteffect", "shot"], ["expeffect", "explosion"]];

            for (const [prefix, phase] of phases) {
                for (let i = 1; i <= 3; i++) {
                    const sound = sounds[`${prefix}_sound_${i}`] as string;

                    if (sound && sound.toLowerCase() !== "none") attack.sounds.push({ phase, sound, volume: sounds[`${prefix}_sound_vol_${i}`] as number, radius: sounds[`${prefix}_sound_rad_${i}`] as number });
                }

                if (phase === "casting" || phase === "shot") // Engine.dll PlaySkillSound 0x797f3c: after the phase sounds, the _sub (casting) or _throw (shot) voice of the pawn's CharClassID.
                    SKILL_VOICE_GROUPS.forEach((group, charClassId) => {
                        const sound = sounds[`${group}_${phase === "casting" ? "sub" : "throw"}`] as string;

                        if (sound && sound.toLowerCase() !== "none") attack.sounds.push({ phase, sound, volume: sounds.sound_vol as number, radius: sounds.sound_rad as number, charClassId });
                    });
            }
        }

        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);

        library.name = `Skill_${id}_${level}`;
        await this.pullNpcSkillAttacks(library, builder, [attack]);

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    protected async decodeCharacterFromSource(settings: LoadSettings_T, charIndex: number, meshPaths: string[], texturePaths: string[], includeAnimations: boolean, chestId: number, equipment: L2JS.Engine.ICharacterEquipment, hairVariant: number): Promise<DecodeLibrary> {
        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);

        library.name = splitObjectPath(row.face_mesh[0])[1];

        for (let i = 0, len = meshPaths.length; i < len; i++) {
            const mesh = await this.fetchSkeletalMesh(meshPaths[i]);
            const texture = await this.fetchCharacterMaterial(texturePaths[i]);
            const decodeAnimations = i === 0 && includeAnimations || /_l_ad\d+$/i.test(meshPaths[i]);
            const meshInfo = builder.pullSkeletalMesh(mesh, decodeAnimations, false, i === 0);
            const textureUuid = builder.pullMaterial(texture);
            const material = library.materials[meshInfo.materials] as IMaterialGroupDecodeInfo;

            if (!material || material.materialType !== "group")
                throw new Error(`Skeletal mesh '${meshPaths[i]}' has no material group.`);

            material.materials = [textureUuid];
            meshInfo.animations = decodeAnimations ? meshInfo.animations : {};
            meshInfo.animationSequences = decodeAnimations ? meshInfo.animationSequences : {};
            meshInfo.animationNotifies = i === 0 ? meshInfo.animationNotifies : {};

            if (i === 0)
                meshInfo.skinMaterials = await this.pullCharacterSkinMaterials(builder, meshInfo.skinNotifies, texturePaths[i], textureUuid);
            else meshInfo.skinNotifies = {};

            if (i === 0) meshInfo.animationSet = characterBundleCacheName(charIndex, library.name.replace(/_m\d+_f$/, ""));

            library.pawnActors.push(meshInfo);
        }

        await this.applyCharacterHairConfig(library.pawnActors, meshPaths);
        await this.pullPawnEffects(library, builder, `LineageWarrior.${splitObjectPath(row.face_mesh[0])[1].replace(/_m\d+_f$/, "")}`);
        await this.pullCharacterSounds(library, builder, row, chestId, equipment?.leftHand || 0);
        await this.pullCharacterEquipment(library, builder, row, equipment, hairVariant);

        if (library.pawnActors.length > 0) {
            await this.pullAnimationNotifyAssets(builder, library.pawnActors[0].animationNotifies);
            await this.pullAnimationNotifyEffects(builder, library.pawnActors[0].animationNotifies);
        }

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    public async decodeCharacter(settings: LoadSettings_T, charIndex: number = 1, faceVariant: number = 0, hairVariant: number = 0, hairColour: number = 0, armor: ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 }, includeAnimations: boolean = true, equipment: L2JS.Engine.ICharacterEquipment = null): Promise<DecodeLibrary> {
        await this.sweepCache(settings);

        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const [meshPaths, texturePaths] = await this.characterPartPaths(charIndex, faceVariant, hairVariant, hairColour, armor, equipment);
        const cacheName = characterBundleCacheName(charIndex, splitObjectPath(row.face_mesh[0])[1].replace(/_m\d+_f$/, ""));
        let cached = this.cacheCharacterBundles.get(charIndex);

        if (!cached) {
            const seekable = await DecodeCache.openCachedLibrary(cacheName, settings);

            if (seekable) {
                cached = { library: seekable.library as DecodeLibrary, seekable };
                this.cacheCharacterBundles.set(charIndex, cached);
            }
        }

        if (!cached) return this.decodeCharacterFromSource(settings, charIndex, meshPaths, texturePaths, includeAnimations, armor.chest, equipment, hairVariant);

        const bundle = cached.library;

        const manifest = (bundle as any).characterBundle as CharacterBundle_T;

        if (!meshPaths.every(path => manifest.meshes[path]) || !texturePaths.every(path => manifest.materials[path])) // Helmets and hair accessories come from helmetgrp/hairaccessarygrp, outside the bundle.
            return this.decodeCharacterFromSource(settings, charIndex, meshPaths, texturePaths, includeAnimations, armor.chest, equipment, hairVariant);

        const library = new DecodeLibrary();
        const actors = new Map(bundle.pawnActors.map(info => [info.uuid, info]));

        library.name = manifest.name;

        copyAnimationSounds(library, bundle, manifest.animationNotifies);

        for (let i = 0, len = meshPaths.length; i < len; i++) {
            const actor = actors.get(manifest.meshes[meshPaths[i]]);
            const textureUuid = manifest.materials[texturePaths[i]];

            if (!actor) throw new Error(`Character mesh '${meshPaths[i]}' not found in '${cacheName}'.`);
            if (!textureUuid) throw new Error(`Character material '${texturePaths[i]}' not found in '${cacheName}'.`);

            const info = Object.assign({}, actor);
            const material = bundle.materials[info.materials] as IMaterialGroupDecodeInfo;

            if (!material || material.materialType !== "group")
                throw new Error(`Character mesh '${meshPaths[i]}' has no material group in '${cacheName}'.`);

            library.geometries[info.geometry] = bundle.geometries[info.geometry];
            library.materials[info.materials] = Object.assign({}, material, { materials: [textureUuid] });
            copyCharacterMaterial(library, bundle, textureUuid);

            const isAttached = /_l_ad\d+$/i.test(meshPaths[i]);

            info.animations = i === 0 && includeAnimations ? manifest.animations : isAttached ? actor.animations : {};
            info.animationSequences = i === 0 && includeAnimations ? manifest.animationSequences : isAttached ? actor.animationSequences : {};
            info.animationNotifies = i === 0 ? manifest.animationNotifies : {};

            if (i === 0) {
                info.animationSet = manifest.animationSet;
                info.skinNotifies = manifest.skinNotifies;
                info.skinMaterials = {};

                for (const index of getSkinNotifyIndices(manifest.skinNotifies)) {
                    const path = getSkinMaterialPath(texturePaths[i], index);
                    const uuid = manifest.materials[path];

                    if (!uuid) throw new Error(`Character skin material '${path}' not found in '${cacheName}'.`);

                    info.skinMaterials[index] = uuid;
                    copyCharacterMaterial(library, bundle, uuid);
                }
            } else info.skinNotifies = {};

            library.pawnActors.push(info);
        }

        await this.applyCharacterHairConfig(library.pawnActors, meshPaths);
        await this.pullPawnEffects(library, new DecodeLibraryBuilder(library, settings), `LineageWarrior.${splitObjectPath(row.face_mesh[0])[1].replace(/_m\d+_f$/, "")}`);
        await this.pullCharacterSounds(library, new DecodeLibraryBuilder(library, settings), row, armor.chest, equipment?.leftHand || 0);
        await this.pullCharacterEquipment(library, new DecodeLibraryBuilder(library, settings), row, equipment, hairVariant);
        await this.pullAnimationNotifyEffects(new DecodeLibraryBuilder(library, settings), library.pawnActors[0].animationNotifies);

        if (cached.seekable) await hydrateLibraryFile(cached.seekable, library);

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    protected async pullPawnEffects(library: DecodeLibrary, builder: DecodeLibraryBuilder, classPath: string): Promise<void> {
        const [pkg, cls] = await this.fetchScriptClass(classPath);
        const pawn = pkg.newObject(cls);
        const index = pawn.propertyDict.get("EffectSpawnBoneIdx");
        const damageEffect = pawn.propertyDict.get("DamageEffect") as UClass;

        if (!Number.isInteger(index)) throw new Error(`Pawn '${classPath}' has no effect target bone index.`);
        if (damageEffect === undefined) throw new Error(`Pawn '${classPath}' has no DamageEffect default.`);

        library.effectSpawnBoneIndex = index;
        library.damageEffect = damageEffect ? damageEffect.name : null;
        if (damageEffect) await this.pullEffectTemplate(library, builder, damageEffect.name, true);

        await this.pullEffectTemplate(library, builder, "LineageEffect.p_u004_a", true);
        for (let grade = 505; grade <= 510; grade++)
            for (const suffix of ["c", "d", "e"]) await this.pullEffectTemplate(library, builder, `LineageEffect.e_u${grade}_${suffix}`, true);
    }

    protected async applyCharacterHairConfig(infos: ISkinnedMeshObjectDecodeInfo[], meshPaths: string[]): Promise<void> {
        if (!infos.some(info => dynamicHairTypes.has(info.boneSimulationType))) return;

        const bodyPath = meshPaths.find(path => /_u$/i.test(splitObjectPath(path)[1]));

        if (!bodyPath) throw new Error(`Character assembly has dynamic hair but no upper-body mesh.`);

        if (!this.cacheHairConfig) {
            const config = await new UConfigHair("assets/system/Hair.int").decode();

            this.cacheHairConfig = config.load();
        }

        const bodyName = splitObjectPath(bodyPath)[1];

        for (let i = 0, len = infos.length; i < len; i++) {
            const info = infos[i];

            if (!dynamicHairTypes.has(info.boneSimulationType)) continue;

            const hairName = splitObjectPath(meshPaths[i])[1];

            info.dynamicHair = { type: info.boneSimulationType, config: this.cacheHairConfig.getDecodeInfo(hairName, bodyName) };
        }
    }

    protected async buildCharacterBundle(settings: LoadSettings_T, charIndex: number): Promise<DecodeLibrary> {
        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const name = splitObjectPath(row.face_mesh[0])[1].replace(/_m\d+_f$/, "");
        const cacheName = characterBundleCacheName(charIndex, name);
        const meshPaths = new Set<string>();
        const texturePaths = new Set<string>();
        const hairPieces = await this.characterHairPieces(charIndex);
        const armorSlots = Object.values(SchemasC4.CHARACTER_ARMOR_SLOTS).flat();

        for (const armorRow of await this.decodeArmorGrp()) {
            if (!armorSlots.includes(armorRow.body_part)) continue;

            for (const [mesh, texture] of getCharacterArmorPaths(row, armorRow)) {
                meshPaths.add(mesh);
                texturePaths.add(texture);
            }
        }

        for (let face = 0, len = row.face_tex.length; face < len; face++) {
            for (const colours of hairPieces.values()) {
                for (const colour of colours.keys()) {
                    const [meshes, textures] = resolveCharacterPartPaths(row, colours.get(colour), [], face, { chest: 0, legs: 0, gloves: 0, boots: 0 });

                    for (const path of meshes) meshPaths.add(path);
                    for (const path of textures) texturePaths.add(path);
                }
            }
        }

        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, { ...settings, rgbaTextures: false } as LoadSettings_T);
        const manifest: CharacterBundle_T = { name, animationSet: cacheName, animations: {}, animationSequences: {}, animationNotifies: {}, skinNotifies: {}, meshes: {}, materials: {} };
        const faceMesh = row.face_mesh[0] as string;

        library.name = name;

        for (const path of meshPaths) {
            const mesh = await this.fetchSkeletalMesh(path);
            const isAttached = /_l_ad\d+$/i.test(path);
            const info = builder.pullSkeletalMesh(mesh, path === faceMesh || isAttached, false);

            if (path === faceMesh) {
                manifest.animations = info.animations;
                manifest.animationSequences = info.animationSequences;
                manifest.animationNotifies = info.animationNotifies;
                manifest.skinNotifies = info.skinNotifies;
            }

            if (!isAttached) {
                info.animations = {};
                info.animationSequences = {};
            }

            info.animationNotifies = {};
            info.skinNotifies = {};
            manifest.meshes[path] = info.uuid;
            library.pawnActors.push(info);
        }

        for (const path of row.face_tex as string[])
            for (const index of getSkinNotifyIndices(manifest.skinNotifies))
                texturePaths.add(getSkinMaterialPath(path, index));

        for (const path of texturePaths)
            manifest.materials[path] = builder.pullMaterial(await this.fetchCharacterMaterial(path));

        await this.pullAnimationNotifyAssets(builder, manifest.animationNotifies);

        (library as any).characterBundle = manifest;

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        return library;
    }

    protected async characterPartPaths(charIndex: number, faceVariant: number, hairVariant: number, hairColour: number, armor: ICharacterArmorSelection, equipment: L2JS.Engine.ICharacterEquipment): Promise<[string[], string[]]> {
        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const hairPieces = await this.characterHairPieces(charIndex);
        const armorRows = await this.decodeArmorGrp();
        const style = hairPieces.has(hairVariant) ? hairVariant : [...hairPieces.keys()].sort((a, b) => a - b)[0];
        const colours = hairPieces.get(style);
        const colour = colours.has(hairColour) ? hairColour : [...colours.keys()].sort((a, b) => a - b)[0];
        let headParts = colours.get(colour);
        const headId = equipment?.hair || equipment?.head;

        if (headId) {
            const head = armorRows.find(row => row.id === headId);

            if (!head || !SchemasC4.CHARACTER_HEAD_ARMOR_SLOTS.includes(head.body_part)) throw new Error(`Armor '${headId}' does not fit the head.`);

            const parts = getCharacterArmorPaths(row, head);
            const match = parts.length > 0 ? /_m00(\d)/.exec(parts[0][0]) : null;
            const meshType = match ? Number(match[1]) : 0; // User::GetHelmMeshType 0x73a950.

            if (equipment.hair || meshType > 0) {
                const fileName = equipment.hair ? "hairaccessarygrp" : "helmetgrp";
                let tables = this.cacheCharacterHairTables.get(fileName);

                if (!tables) {
                    const schema = equipment.hair ? SchemasC4.SCHEMA_HAIRACCESSARYGRP_DAT : SchemasC4.SCHEMA_HELMETGRP_DAT;
                    const file = await new UDataFile(schema, `assets/system/${fileName}.dat`).asReadable().decode();

                    tables = file.datarows;
                    this.cacheCharacterHairTables.set(fileName, tables);
                }

                const table = tables.find(row => row.id === meshType);

                if (!table) throw new Error(`'${fileName}' has no hair mapping for mesh type '${meshType}'.`);

                headParts = [];

                for (let i = 0; i < 2; i++) {
                    const variant = table.hair[(charIndex * 15 + style) * 2 + i];

                    if (variant === -1) continue;

                    const suffix = i === 0 ? "_ah" : "_bh";
                    const part = hairPieces.get(variant)?.get(colour)?.find(part => part[0].toLowerCase().endsWith(suffix));

                    if (!part) throw new Error(`Character '${charIndex}' has no '${suffix}' hair '${variant}' colour '${colour}'.`);

                    headParts.push(part);
                }
            }
        }

        return resolveCharacterPartPaths(row, headParts, armorRows, faceVariant, armor);
    }

    // hair carries its own style and colour axes - the face texture only ever names the head
    protected async characterHairPieces(charIndex: number): Promise<CharacterHairPieces_T> {
        if (this.cacheCharacterHairPieces.has(charIndex)) return this.cacheCharacterHairPieces.get(charIndex)!;

        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const [packageName, faceName] = splitObjectPath(row.face_mesh[0] as string);
        const [texturePackage] = splitObjectPath(row.face_tex[0] as string);
        const pkg = await this.usingDecodePackage(this.assetLoader.getPackage(packageName, "Animation")); // reading the export table only
        const textures = await this.characterTextureNames(row.face_tex[0] as string);
        const pattern = new RegExp(`^${faceName.replace(/_m\d+_f$/, "").toLowerCase()}_m(\\d+)_m00_(ah|bh)$`);
        const styles = new Map<number, Map<number, [string, string][]>>();

        for (const entry of pkg.exportGroups.SkeletalMesh) {
            const name = entry.export.objectName;
            const match = pattern.exec(name.toLowerCase());

            if (!match) continue;

            const style = parseInt(match[1], 10);
            const texturePattern = new RegExp(`^${name.replace(/_m00_(ah|bh)$/i, "_t(\\d+)_m00_$1")}$`, "i");

            for (const texture of textures) {
                const textureMatch = texturePattern.exec(texture);

                // every style ships a mesh for both pieces, but only the pieces it actually wears get a texture
                if (!textureMatch) continue;

                const colour = parseInt(textureMatch[1], 10);

                if (!styles.has(style)) styles.set(style, new Map());

                const colours = styles.get(style);

                if (!colours.has(colour)) colours.set(colour, []);

                colours.get(colour).push([`${packageName}.${name}`, `${texturePackage}.${texture}`]);
            }
        }

        this.cacheCharacterHairPieces.set(charIndex, styles);

        return styles;
    }

    protected async characterTextureNames(faceTexture: string): Promise<string[]> {
        const pkg = await this.usingDecodePackage(this.assetLoader.getPackage(splitObjectPath(faceTexture)[0], "Texture"));

        return pkg.exports.map(entry => entry.objectName as string);
    }

    public async decodeCharacterEquipment(settings: LoadSettings_T, charIndex: number, hairVariant: number, equipment: L2JS.Engine.ICharacterEquipment): Promise<DecodeLibrary> {
        await this.sweepCache(settings);

        const row = getCharacterRow(await this.decodeCharGrp(), charIndex);
        const library = new DecodeLibrary();

        await this.pullCharacterEquipment(library, new DecodeLibraryBuilder(library, settings), row, equipment, hairVariant);
        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    public async decodeCharacterEquipmentBinary(settings: LoadSettings_T, charIndex: number, hairVariant: number, equipment: L2JS.Engine.ICharacterEquipment): Promise<ArrayBuffer> {
        return serializeLibrary(await this.decodeCharacterEquipment(settings, charIndex, hairVariant, equipment)).buffer as ArrayBuffer;
    }

    public async decodeCharacterBinary(settings: LoadSettings_T, charIndex: number, faceVariant: number, hairVariant: number, hairColour: number, armor: ICharacterArmorSelection, includeAnimations: boolean, equipment: L2JS.Engine.ICharacterEquipment): Promise<ArrayBuffer> {
        return serializeLibrary(await this.decodeCharacter(settings, charIndex, faceVariant, hairVariant, hairColour, armor, includeAnimations, equipment)).buffer as ArrayBuffer;
    }

    public async decodeSkeletalMeshBinary(settings: LoadSettings_T, packageName: string, meshName: string, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null, includeAnimations: boolean = true, equipment: L2JS.Engine.INpcEquipment | null = null): Promise<ArrayBuffer> {
        return serializeLibrary(await this.decodeSkeletalMesh(settings, packageName, meshName, scriptClassPath, texturePaths, npcId, includeAnimations, equipment)).buffer as ArrayBuffer;
    }

    public async decodeEffectTemplatesBinary(settings: LoadSettings_T, classPaths: string[], soundPaths: string[] = [], scriptClassPaths: string[] = []): Promise<ArrayBuffer> {
        return serializeLibrary(await this.decodeEffectTemplates(settings, classPaths, soundPaths, scriptClassPaths)).buffer as ArrayBuffer;
    }

    public async decodeSkillBinary(settings: LoadSettings_T, id: number, level: number): Promise<ArrayBuffer> {
        return serializeLibrary(await this.decodeSkill(settings, id, level)).buffer as ArrayBuffer;
    }

    public async precacheCharacters(settings: LoadSettings_T): Promise<void> {
        if (settings.cache === false || settings.cache?.enabled === false) return;

        await this.sweepCache(settings);

        const groups = await this.decodeCharGroups();

        for (const group of groups) {
            const name = characterBundleCacheName(group.index, group.name);

            if (await DecodeCache.hasCachedLibrary(name, settings)) {
                const seekable = this.cacheCharacterBundles.has(group.index) ? null : await DecodeCache.openCachedLibrary(name, settings);

                if (seekable) this.cacheCharacterBundles.set(group.index, { library: seekable.library as DecodeLibrary, seekable });
                continue;
            }

            const bundle = await this.buildCharacterBundle(settings, group.index);

            await DecodeCache.storeCachedLibraryDurable(name, settings, bundle);
            this.cacheCharacterBundles.set(group.index, { library: bundle });
        }
    }

    public async decodeCharGroups(): Promise<ICharacterGroup[]> {
        const rows = await this.decodeCharGrp();
        const armorRows = await this.decodeArmorGrp();
        const itemNames = new Map((await this.decodeItemNames()).map(item => [item.id as number, item]));
        const groups: ICharacterGroup[] = [];

        for (let index = 0, len = rows.length; index < len; index++) {
            const row = rows[index];

            if (row.face_mesh.length === 0) {
                if (index !== SchemasC4.CHARGRP_RECORD_COUNT - 1) throw new Error(`Character group '${index}' is unexpectedly empty.`);
                continue;
            }

            const pieces = await this.characterHairPieces(index);
            const armor = { chest: [], legs: [], gloves: [], boots: [] } as ICharacterArmorOptions;

            for (const slot of Object.keys(SchemasC4.CHARACTER_ARMOR_SLOTS) as (keyof typeof SchemasC4.CHARACTER_ARMOR_SLOTS)[]) {
                const items = armorRows
                    .filter(item => SchemasC4.CHARACTER_ARMOR_SLOTS[slot].includes(item.body_part) && getCharacterArmorPaths(row, item).length > 0)
                    .map(item => ({ id: item.id, label: getCharacterArmorLabel(item, itemNames), grade: item.crystal_type }))
                    .sort((a, b) => a.grade - b.grade || a.label.localeCompare(b.label) || a.id - b.id);
                const labelCounts = new Map<string, number>();

                for (const item of items)
                    labelCounts.set(item.label, (labelCounts.get(item.label) || 0) + 1);

                armor[slot] = items.map(item => ({ id: item.id, label: labelCounts.get(item.label) > 1 ? `${item.label} (#${item.id})` : item.label }));
            }

            groups.push({
                index,
                name: splitObjectPath(row.face_mesh[0] as string)[1].replace(/_m\d+_f$/, ""),
                faceVariants: (row.face_tex as string[]).length,
                hairStyles: [...pieces.keys()].sort((a, b) => a - b),
                hairColours: Object.fromEntries([...pieces].map(([style, colours]) => [style, [...colours.keys()].sort((a, b) => a - b)])),
                armor
            });
        }

        return groups;
    }

    protected async decodeCharGrp(): Promise<Record<string, any>[]> {
        if (this.cacheCharGrpRows) return this.cacheCharGrpRows;

        const file = await (new UDataFile(SchemasC4.SCHEMA_CHARGRP_DAT, "assets/system/chargrp.dat", SchemasC4.CHARGRP_RECORD_COUNT).asReadable()).decode();

        this.cacheCharGrpRows = file.datarows;

        return this.cacheCharGrpRows;
    }

    protected async decodeArmorGrp(): Promise<Record<string, any>[]> {
        if (this.cacheArmorGrpRows) return this.cacheArmorGrpRows;

        const file = await (new UDataFile(SchemasC4.SCHEMA_ARMORGRP_DAT, "assets/system/armorgrp.dat").asReadable()).decode();

        this.cacheArmorGrpRows = file.datarows;

        return this.cacheArmorGrpRows;
    }

    protected async decodeItemNames(): Promise<Record<string, any>[]> {
        if (this.cacheItemNameRows) return this.cacheItemNameRows;

        const file = await (new UDataFile(SchemasC4.SCHEMA_ITEMNAME_E_DAT, "assets/system/itemname-e.dat").asReadable()).decode();

        this.cacheItemNameRows = file.datarows;

        return this.cacheItemNameRows;
    }

    protected async decodeWeaponGrp(): Promise<Record<string, any>[]> {
        if (this.cacheWeaponGrpRows) return this.cacheWeaponGrpRows;

        const file = await (new UDataFile(SchemasC4.SCHEMA_WEAPONGRP_DAT, "assets/system/Weapongrp.dat").asReadable()).decode();

        this.cacheWeaponGrpRows = file.datarows;

        return this.cacheWeaponGrpRows;
    }

    protected async decodeEtcItemGrp(): Promise<Record<string, any>[]> {
        if (this.cacheEtcItemGrpRows) return this.cacheEtcItemGrpRows;

        const file = await (new UDataFile(SchemasC4.SCHEMA_ETCITEMGRP_DAT, "assets/system/etcitemgrp.dat").asReadable()).decode();

        this.cacheEtcItemGrpRows = file.datarows;

        return this.cacheEtcItemGrpRows;
    }

    protected async pullCharacterEquipment(library: DecodeLibrary, builder: DecodeLibraryBuilder, row: Record<string, any>, equipment: L2JS.Engine.ICharacterEquipment, hairVariant: number): Promise<void> {
        if (!equipment) return;

        const rows = await this.decodeWeaponGrp();
        const right = rows.find(row => row.id === equipment.rightHand);
        const left = rows.find(row => row.id === equipment.leftHand);
        const info: L2JS.Engine.IPawnEquipmentDecodeInfo = { weaponType: WeaponType.WT_HAND, items: [] };

        if (equipment.rightHand && !right) throw new Error(`Missing weapon '${equipment.rightHand}'.`);

        if (right) {
            const dual = right.handness === WeaponType.WT_DUAL || right.handness === WeaponType.WT_DUALFIST;
            const bones = dual ? ["RightHandBone", "LeftHandBone"] : [right.handness === WeaponType.WT_BOW ? "LeftHandBone" : right.handness === WeaponType.WT_HAND ? "RightArmBone" : "RightHandBone"];

            if (right.wpn_mesh.length !== bones.length) throw new Error(`Weapon '${right.id}' has ${right.wpn_mesh.length} meshes for ${bones.length} attachments.`);

            // User::GetPcMeshName 0x738171..0x738282: dual weapons split mesh and texture indices.
            for (let i = 0; i < bones.length; i++) {
                const item: L2JS.Engine.IPawnEquipmentDecodeInfo["items"][number] = { mesh: right.wpn_mesh[i], skins: dual ? [right.wpn_tex[i]] : right.wpn_tex.slice(), bone: bones[i] };

                await this.pullWeaponEnchant(library, builder, right, equipment.enchantLevel || 0, i, item);
                info.items.push(item);
            }
            info.weaponType = right.handness === WeaponType.WT_HAND ? WeaponType.WT_1HS : right.handness;
            await this.pullNpcEquipment(library, builder, { rightHand: right.id, attackRange: 2000 });
        }

        if (left && left.id !== equipment.rightHand) {
            if (left.wpn_mesh.length !== 1) throw new Error(`Left-hand item '${left.id}' has ${left.wpn_mesh.length} meshes.`);

            info.items.push({ mesh: left.wpn_mesh[0], skins: left.wpn_tex.slice(), bone: left.handness === WeaponType.WT_HAND ? "LeftArmBone" : "LeftHandBone" });
            if (!right) info.weaponType = WeaponType.WT_1HS;
        } else if (equipment.leftHand && !left) {
            if (!(await this.decodeEtcItemGrp()).some(row => row.id === equipment.leftHand)) throw new Error(`Missing left-hand equipment '${equipment.leftHand}'.`);
        }

        const headId = equipment.hair || equipment.head;

        if (headId) {
            const head = (await this.decodeArmorGrp()).find(row => row.id === headId);

            for (const [mesh, texture] of getCharacterArmorPaths(row, head)) info.items.push({ mesh, skins: [texture], bone: "HeadBone" });
        }

        for (const item of info.items) await this.pullScriptMeshAssets(library, builder, null, { Mesh: item.mesh, Skins: item.skins });

        if (equipment.hair) {
            let locations = this.cacheCharacterHairTables.get("hairaccessorylocgrp");

            if (!locations) {
                const file = await new UDataFile(SchemasC4.SCHEMA_HAIRACCESSORYLOCGRP_DAT, "assets/system/hairaccessorylocgrp.dat").asReadable().decode();

                locations = file.datarows;
                this.cacheCharacterHairTables.set("hairaccessorylocgrp", locations);
            }

            for (const item of info.items) {
                if (item.bone !== "HeadBone") continue;

                const path = item.mesh.toLowerCase();
                const location = locations.find(row => row.name.toLowerCase() === path);

                if (!location) continue;

                // User::SetPawnResource 0x73c17e..0x73c1be indexes accessory offsets by hairstyle.
                const suffix = (hairVariant + 1).toString(16);
                const origin = location[`floats_${suffix}`];
                const rotation = location[`ints_${suffix}`];

                if (!origin || !rotation) throw new Error(`Accessory '${item.mesh}' has no offsets for hairstyle '${hairVariant}'.`);
                if (!origin.some(value => value !== 0) && !rotation.some(value => value !== 0)) continue;

                library.scriptMeshes[path] = { ...library.scriptMeshes[path], meshOrigin: origin, meshRotOrigin: rotation, meshRotOriginQuaternion: getRotatorQuaternionElements(rotation[0], rotation[1], rotation[2]) } as ISkinnedMeshObjectDecodeInfo;
            }
        }

        library.pawnEquipment = info;
    }

    protected async pullWeaponEnchant(library: DecodeLibrary, builder: DecodeLibraryBuilder, weapon: Record<string, any>, level: number, index: number, item: L2JS.Engine.IPawnEquipmentDecodeInfo["items"][number]): Promise<void> {
        if (!this.cacheEnchantConfig) {
            const file = await new UConfigLocalization("assets/system/env.int").decode();

            await file.load();
            this.cacheEnchantConfig = Object.fromEntries(file.getProperties("EnchantEffect").map(entry => [entry.name.toLowerCase(), entry.value]));
        }

        const config = this.cacheEnchantConfig;
        const values = consumeTuple(config[`enchant${level}`] || config.enchant || "()");
        const meshShow = Number(config.enchantmeshshow ?? -1), effectShow = Number(config.enchanteffectshow ?? -1);
        const mesh = weapon.enchantedMesh[index], effect = weapon.enchantedEffect[index];

        // APawn::GetEnchantedWeaponMesh 0x8c2ed0 / UpdateAbnormalState 0x7663c4.
        if (meshShow >= 0 && level >= meshShow && mesh && mesh.toLowerCase() !== "none") {
            const skin = config.cubetexname;

            if (!skin) throw new Error(`EnchantEffect has no CubeTexName.`);

            await this.pullScriptMeshAssets(library, builder, null, { Mesh: mesh, Skins: [skin] });
            item.enchantMesh = { mesh, skin, scale: weapon.enchantedMeshScale[index], offset: weapon.enchantedMeshOffset[index], colors: [1, 2].map(n => ["r", "g", "b"].map(c => Number(values[`${c}${n}`] ?? 100) / 255)) };
        }

        if (effectShow >= 0 && level >= effectShow && effect && effect.toLowerCase() !== "none") {
            if (!library.effectTemplates[effect]) await this.pullEffectTemplate(library, builder, effect, true);

            item.enchantEffect = { path: effect, offset: weapon.enchantedEffectOffset[index], scale: weapon.enchantedEffectScale[index], velocityScale: weapon.enchantedEffectVelocityScale[index], opacity: Number(values.opacity ?? 1), num: Number(values.num ?? 1) };
        }
    }

    protected async pullNpcEquipment(library: DecodeLibrary, builder: DecodeLibraryBuilder, equipment: L2JS.Engine.INpcEquipment | null): Promise<void> {
        if (!equipment) return;

        const rows = await this.decodeWeaponGrp();
        const right = equipment.rightHand ? rows.find(row => row.id === equipment.rightHand) : null;
        const left = equipment.leftHand ? rows.find(row => row.id === equipment.leftHand) : null;
        const armor = equipment.chest ? (await this.decodeArmorGrp()).find(row => row.id === equipment.chest) : null;

        if (equipment.rightHand && !right) throw new Error(`NPC equipment references missing weapon '${equipment.rightHand}'.`);
        if (equipment.leftHand && !left) throw new Error(`NPC equipment references missing weapon '${equipment.leftHand}'.`);
        if (equipment.chest && !armor) throw new Error(`NPC equipment references missing armor '${equipment.chest}'.`);

        const info: L2JS.Engine.IPawnEquipmentDecodeInfo = { weaponType: WeaponType.WT_HAND, items: [] };
        const bow = right && right.handness === WeaponType.WT_BOW;

        if (right) {
            const dual = right.handness === WeaponType.WT_DUAL || right.handness === WeaponType.WT_DUALFIST;
            const bones = dual ? ["RightHandBone", "LeftHandBone"] : [right.handness === WeaponType.WT_BOW ? "LeftHandBone" : right.handness === WeaponType.WT_HAND ? "RightArmBone" : "RightHandBone"];

            if (right.wpn_mesh.length !== bones.length) throw new Error(`Weapon '${right.id}' has ${right.wpn_mesh.length} meshes for ${bones.length} attachments.`);

            for (let i = 0; i < bones.length; i++)
                info.items.push({ mesh: right.wpn_mesh[i], skins: dual ? [right.wpn_tex[i]] : right.wpn_tex.slice(), bone: bones[i] });

            info.weaponType = right.handness === WeaponType.WT_HAND ? WeaponType.WT_1HS : right.handness;
        }

        if (left && left.id !== equipment.rightHand) {
            if (left.wpn_mesh.length !== 1) throw new Error(`Left-hand item '${left.id}' has ${left.wpn_mesh.length} meshes.`);

            info.items.push({ mesh: left.wpn_mesh[0], skins: left.wpn_tex.slice(), bone: left.handness === WeaponType.WT_HAND ? "LeftArmBone" : "LeftHandBone" });
            if (!right) info.weaponType = WeaponType.WT_1HS;
        }

        if (armor) {
            for (const mesh of armor.npc_mesh) {
                if (!mesh || mesh.toLowerCase() === "none") continue;

                info.items.push({ mesh, skins: armor.npc_texture.slice(), bone: 2 });
            }
        }

        for (const item of info.items) await this.pullScriptMeshAssets(library, builder, null, { Mesh: item.mesh, Skins: item.skins });
        if (info.items.length) library.pawnEquipment = info;
        if (!bow) return;

        const weapon = right;
        if (weapon.wpn_mesh.length !== 1) throw new Error(`Bow '${weapon.id}' has ${weapon.wpn_mesh.length} meshes.`);

        // Engine.dll User::GetArrowItemID 0x73684b..0x736880, grade jump table 0x7368a4.
        const ammo = [17, 1341, 1342, 1343, 1344, 1345][weapon.crystal_type];

        if (!ammo) throw new Error(`Bow '${weapon.id}' has unsupported grade '${weapon.crystal_type}'.`);
        const arrow = (await this.decodeEtcItemGrp()).find(row => row.id === ammo);

        if (!arrow || arrow.mesh_tex_pair[0].length !== 1) throw new Error(`Arrow '${ammo}' has no single mesh.`);

        // Engine.dll APawn::SetAtkArrow 0x8c0322 / 0x8c03a3..0x8c0467.
        await this.pullEffectTemplate(library, builder, "LineageEffect.NArrow", true);
        const template = library.effectTemplates["LineageEffect.NArrow"];

        template.scriptProperties.Mesh = arrow.mesh_tex_pair[0][0];
        template.scriptProperties.Skins = arrow.mesh_tex_pair[1].slice();
        await this.pullScriptMeshAssets(library, builder, template.scriptClassId, template.scriptProperties);
        await this.pullScriptMeshAssets(library, builder, null, { Mesh: weapon.wpn_mesh[0], Skins: weapon.wpn_tex });
        library.npcBow = { weaponMesh: weapon.wpn_mesh[0], weaponSkins: weapon.wpn_tex.slice(), curvature: weapon.curvature, attackRange: equipment.attackRange, ammo };
    }

    public async decodeMusicInfo(): Promise<Record<number, string[]>> {
        const file = await (new UDataFile(SchemasC4.SCHEMA_MUSICINFO_DAT, "assets/system/musicinfo.dat").asReadable()).decode();

        return Object.fromEntries(file.datarows.map((row: any) => [
            row.id,
            (row.sounds as string[]).map(sound => this.assetLoader.getPackage(sound, "Music").path)
        ]));
    }

    public async resolveNpc(selector: string | number): Promise<INpcDefinition> {
        const definitions = await this.decodeNpcDefinitions();

        if (typeof selector === "number") {
            const npc = definitions.find(npc => npc.id === selector);

            if (!npc) throw new Error(`NPC ID '${selector}' does not exist.`);

            return npc;
        }

        const name = selector.trim().toLowerCase();

        if (name.length === 0) throw new Error("NPC name cannot be empty.");

        if (/^\d+$/.test(name)) {
            const id = Number(name);
            const npc = definitions.find(npc => npc.id === id);

            if (!npc) throw new Error(`NPC ID '${selector}' does not exist.`);

            return npc;
        }

        const matches = definitions.filter(npc => npc.name.trim().toLowerCase() === name);

        if (matches.length === 0) throw new Error(`NPC name '${selector}' does not exist.`);
        if (matches.length > 1) console.warn(`NPC name '${selector}' matches IDs ${matches.map(npc => npc.id).join(", ")}; spawning ID ${matches[0].id}.`);

        return matches[0];
    }

    public listNpcs(): Promise<INpcDefinition[]> {
        return this.decodeNpcDefinitions();
    }

    protected async decodeNpcDefinitions(): Promise<INpcDefinition[]> {
        if (this.cacheNpcDefinitions) return this.cacheNpcDefinitions;

        const [groups, names, enterEvents, skillAnimations, skills, skillSounds] = await Promise.all([
            (new UDataFile(SchemasC4.SCHEMA_NPCGRP_DAT, "assets/system/Npcgrp.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_NPCNAME_E_DAT, "assets/system/npcname-e.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_ENTEREVENTGRP_DAT, "assets/system/entereventgrp.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_MOBSKILLANIMGRP_DAT, "assets/system/mobskillanimgrp.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_SKILLGRP_DAT, "assets/system/skillgrp.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_SKILLSOUNDGRP_DAT, "assets/system/skillsoundgrp.dat").asReadable()).decode()
        ]);
        const soundsByIdAndLevel = new Map(skillSounds.datarows.map(row => [`${row.skill_id}:${row.skill_level}`, row]));
        const namesById = new Map(names.datarows.map(row => [row.id as number, row.name as string]));
        const skillVisualsById = new Map<number, { level: number, hitTime: number, animationCategory: string, castStyle: number, isMagic: boolean, visualEffect: string, isMultiShot: boolean }>();
        const skillAttacksByNpcId = new Map<number, NpcSkillAttack_T[]>();
        const enterEventsById = new Map(enterEvents.datarows.map(row => [row.id as number, {
            sound: row.skill_sound as string,
            soundVolume: row.sound_vol as number,
            soundRadius: row.sound_rad as number,
            isRise: row.isrise as number,
            spawnType: row.spawn_type as number,
            effect: row.effect_name as string,
            animation: row.anim_name as string
        }]));

        for (const row of skills.datarows) {
            const id = row.skill_id as number;
            const level = row.skill_level as number;
            const current = skillVisualsById.get(id);

            // Engine.dll cast_style -> MagicType: 0x7269dc, 0x79b471; IsCastingMultiShotSkill 0x796f00.
            // mobskillanimgrp has no level; preview the base level until server skill data supplies it.
            if (!current || current.level > level)
                skillVisualsById.set(id, { level, hitTime: row.hit_time as number, animationCategory: row.ani_char as string, castStyle: row.cast_style as number, isMagic: row.is_magic !== 0, visualEffect: (row.desc as string) || "None", isMultiShot: [8, 9, 10].includes(row.cast_style as number) });
        }

        for (const row of skillAnimations.datarows) {
            const npcId = row.npc_id as number;
            const attacks = skillAttacksByNpcId.get(npcId) || [];
            const id = row.skill_id as number;
            const visual = skillVisualsById.get(id);
            const serverSkill = mobSkillTable.get(id);
            const attack: NpcSkillAttack_T = { id, level: visual ? visual.level : 1, name: row.skill_name as string, animation: row.seq_name as string, animationCategory: visual ? visual.animationCategory : "", castStyle: visual ? visual.castStyle : 0, isMagic: visual ? visual.isMagic : false, hitTime: visual ? visual.hitTime : 0, isMultiShot: visual ? visual.isMultiShot : false, flyingTime: 0, visualEffect: visual ? visual.visualEffect : "None", visual: null, passive: serverSkill?.passive === true, previewTarget: serverSkill?.target ? "self" : undefined, sounds: [] };
            // Engine.dll 0x72e685: GetSkillSoundData matches level, then falls back to level 1.
            const sounds = soundsByIdAndLevel.get(`${id}:${attack.level}`) || soundsByIdAndLevel.get(`${id}:1`);

            if (sounds) {
                const phases: [string, NpcSkillEffectPhase_T][] = [["spelleffect", "casting"], ["shoteffect", "shot"], ["expeffect", "explosion"]];

                for (const [prefix, phase] of phases)
                    for (let i = 1; i <= 3; i++) {
                        const sound = sounds[`${prefix}_sound_${i}`] as string;

                        if (sound && sound.toLowerCase() !== "none") attack.sounds.push({ phase, sound, volume: sounds[`${prefix}_sound_vol_${i}`] as number, radius: sounds[`${prefix}_sound_rad_${i}`] as number });
                    }
            }

            if (!attacks.some(other => other.id === attack.id && other.animation.toLowerCase() === attack.animation.toLowerCase())) attacks.push(attack);
            if (!skillAttacksByNpcId.has(npcId)) skillAttacksByNpcId.set(npcId, attacks);
        }

        this.cacheNpcDefinitions = groups.datarows.map(row => ({
            id: row.tag as number,
            name: namesById.get(row.tag as number) || "",
            className: row.class as string,
            mesh: row.mesh as string,
            textures: [...row.tex1 as string[], ...row.tex2 as string[]].filter(path => path && path.toLowerCase() !== "none"),
            skillAttacks: skillAttacksByNpcId.get(row.tag as number) || [],
            enterEvent: enterEventsById.get(row.tag as number) || null,
            // Engine.dll NpcDataLoad 0x73205d/0x7320ad and 0x732103..0x732159.
            sounds: {
                defense: { sounds: (row.sound2 as string[]).slice(0, 5), volume: row.soundVolume as number, radius: row.soundRadius as number },
                damage: { sounds: (row.sound3 as string[]).slice(0, 3), volume: row.soundVolume as number, radius: row.soundRadius as number, random: row.soundRandom as number },
                item: null
            }
        }));

        return this.cacheNpcDefinitions;
    }

    public collectTransferables(value: any): ArrayBuffer[] {
        return prepareLibraryForTransfer(value, this.collectPackageBuffers());
    }
}

export default DecodeEngine;
