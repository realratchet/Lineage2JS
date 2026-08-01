import AssetLoader from "@client/assets/asset-loader";
import UConfigEnv from "@unreal/conf-files/un-conf-env";
import UDataFile from "@unreal/datafile/un-datafile";
import { SCHEMA_MUSICINFO_DAT } from "@unreal/datafile/schema/schema-types";
import SCHEMA_CHARGRP_DAT from "@unreal/datafile/schema/chargrp.schema";
import SCHEMA_ARMORGRP_DAT from "@unreal/datafile/schema/armorgrp.schema";
import SCHEMA_ITEMNAME_E_DAT from "@unreal/datafile/schema/itemname-e.schema";
import { buildStaticMeshBatchData } from "@client/assets/decoders/batch-data";
import { convertDDSMaterialsToRGBA } from "@client/assets/decoders/dxt-decode";
import buildDecodeLibrary from "./build-decode-library";
import prepareLibraryForTransfer from "./collect-transferables";
import { hasCachedLibrary, loadCachedLibrary, loadCachedLibraryBuffer, storeCachedLibrary, storeCachedLibraryDurable, storeCachedLibraryBufferDurable, sweepDecodeCache, refreshSoundBlobUris } from "./decode-cache";
import { serializeLibrary, deserializeLibrary } from "./library-serializer";
import type { PrecacheResult_T } from "./decode-protocol";
import DecodeLibrary from "@client/assets/unreal/decode-library";
import DecodeLibraryBuilder from "@client/assets/unreal/decode-library-builder";

type BinarySector_T = { buffer: ArrayBuffer, fromCache: boolean };
type CharacterBundle_T = {
    name: string;
    animationSet: string;
    animations: Record<string, GD.IKeyframeDecodeInfo_T[]>;
    meshes: Record<string, string>;
    materials: Record<string, string>;
};
type CharacterHairPieces_T = Map<number, Map<number, [string, string][]>>;
type CharacterPartPaths_T = [string, string];

const HAIR_COLOUR_COUNT = 10;
const CHARACTER_ARMOR_GROUPS: Record<string, string> = { mfighter: "m_human_fighter", ffighter: "f_human_fighter", mdarkelf: "m_dark_elf", fdarkelf: "f_dark_elf", mdwarf: "m_dwarf", fdwarf: "f_dwarf", melf: "m_elf", felf: "f_elf", mmagic: "m_human_mystic", fmagic: "f_human_mystic", morc: "m_orc_fighter", forc: "f_orc_fighter", mshaman: "m_orc_mystic", fshaman: "f_orc_mystic" };
const CHARACTER_ARMOR_SLOTS = { chest: 10, legs: 11, gloves: 9, boots: 12 };

function characterBundleCacheName(charIndex: number, name: string): string {
    return `character_v2_${charIndex}_${name}`.replace(/[^\w.-]/g, "_");
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
            value.forEach(copyReferences);
            return;
        }

        Object.values(value).forEach(copyReferences);
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

function splitObjectPath(path: string): [string, string] {
    const index = path.indexOf(".");

    return [path.slice(0, index), path.slice(index + 1)];
}

function getCharacterRow(rows: Record<string, any>[], charIndex: number): Record<string, any> {
    const row = rows[charIndex];

    if (!row) throw new Error(`Character group '${charIndex}' does not exist.`);

    return row;
}

function getCharacterArmorGroup(row: Record<string, any>): string {
    const name = splitObjectPath(row.face_mesh[0] as string)[1].replace(/_m\d+_f$/, "").toLowerCase();
    const group = CHARACTER_ARMOR_GROUPS[name];

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

function resolveCharacterPartPaths(row: Record<string, any>, hairPieces: CharacterHairPieces_T, armorRows: Record<string, any>[], faceVariant: number, hairVariant: number, hairColour: number, armor: GD.ICharacterArmorSelection): [string[], string[]] {
    const faceMesh = row.face_mesh[0] as string;
    const faceTexture = row.face_tex[faceVariant % row.face_tex.length] as string;
    const style = hairPieces.has(hairVariant) ? hairVariant : [...hairPieces.keys()].sort((a, b) => a - b)[0];
    const colours = hairPieces.get(style);
    const pieces = colours.get(colours.has(hairColour) ? hairColour : [...colours.keys()].sort((a, b) => a - b)[0]);
    const bodyParts = (row.body_mesh as string[]).map((mesh, i) => [[mesh, row.body_tex[i]]] as CharacterPartPaths_T[]);
    const bodyIndices: Record<string, number> = { u: 0, l: 1, g: 2, b: 3 };

    for (const slot of Object.keys(CHARACTER_ARMOR_SLOTS)) {
        const id = armor[slot as keyof GD.ICharacterArmorSelection];

        if (!id) continue;

        const armorRow = armorRows.find(row => row.id === id);

        if (!armorRow) throw new Error(`Armor '${id}' does not exist.`);
        if (armorRow.body_part !== CHARACTER_ARMOR_SLOTS[slot as keyof typeof CHARACTER_ARMOR_SLOTS])
            throw new Error(`Armor '${id}' does not fit '${slot}'.`);

        const cleared = new Set<number>();

        for (const part of getCharacterArmorPaths(row, armorRow)) {
            const match = /_([ulgb])$/i.exec(splitObjectPath(part[0])[1]);
            const index = match ? bodyIndices[match[1].toLowerCase()] : Object.keys(CHARACTER_ARMOR_SLOTS).indexOf(slot);

            if (!cleared.has(index)) {
                bodyParts[index] = [];
                cleared.add(index);
            }

            bodyParts[index].push(part);
        }
    }

    const body = bodyParts.flat();

    return [
        [faceMesh, ...pieces.map(piece => piece[0]), ...body.map(piece => piece[0])] as string[],
        [faceTexture, ...pieces.map(piece => piece[1]), ...body.map(piece => piece[1])] as string[]
    ];
}

/**
 * Owns an AssetLoader and runs the full sector decode - deserialization, decode-info
 * generation, batch merging and DXT->RGBA conversion. Used by decode.worker.ts (message
 * driven, its own webpack bundle) and directly by DecodeWorkerClient on the main thread
 * when its pool size is 0, so a decode can be stepped through in regular devtools
 * instead of a worker context.
 */
class DecodeEngine {
    protected assetLoader: AssetLoader = null;
    protected hasSweptCache = false;
    protected cacheCharGrpRows: Record<string, any>[] = null;
    protected cacheArmorGrpRows: Record<string, any>[] = null;
    protected cacheItemNameRows: Record<string, any>[] = null;
    protected cacheCharacterBundles = new Map<number, DecodeLibrary>();
    protected cacheCharacterHairPieces = new Map<number, CharacterHairPieces_T>();

    public async initialize(): Promise<void> {
        const assetList = await (await fetch("asset-list.json")).json();

        this.assetLoader = await AssetLoader.Instantiate(assetList.supported);

        /* same bootstrap AssetManager.initialize performs before any level decode */
        await this.assetLoader.using(this.assetLoader.getNativePackage(), { neverUnload: true });
        const pkgCore = await this.assetLoader.using(this.assetLoader.getCorePackage(), { neverUnload: true });
        await this.assetLoader.using(this.assetLoader.getEnginePackage(), { neverUnload: true });

        pkgCore.loadNativeClasses();
    }

    /**
     * Every ArrayBuffer of a package decoded so far - used by the transfer walk to make
     * sure no library value ever transfers (= detaches) a package buffer.
     */
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

    public async decodeSector(sectorName: string, settings: GD.LoadSettings_T): Promise<{ library: any, fromCache: boolean }> {
        if (!this.hasSweptCache) {
            await sweepDecodeCache(settings);
            this.hasSweptCache = true;
        }

        console.log(`[decode] decoding sector '${sectorName}'`);

        const start = performance.now();
        const result = await this.decodeSectorCore(sectorName, settings);

        console.log(`[decode] sector '${sectorName}' decoded in ${(performance.now() - start).toFixed(0)}ms${result.fromCache ? " (from cache)" : ""}`);

        return result;
    }

    public async decodeSectorBinary(sectorName: string, settings: GD.LoadSettings_T): Promise<BinarySector_T> {
        if (!this.hasSweptCache) {
            await sweepDecodeCache(settings);
            this.hasSweptCache = true;
        }

        console.log(`[decode] decoding sector '${sectorName}'`);

        const start = performance.now();
        const result = await this.decodeSectorBinaryCore(sectorName, settings);

        console.log(`[decode] sector '${sectorName}' decoded in ${(performance.now() - start).toFixed(0)}ms${result.fromCache ? " (from cache)" : ""}`);

        return result;
    }

    public async precacheSector(sectorName: string, settings: GD.LoadSettings_T): Promise<PrecacheResult_T> {
        if (!this.hasSweptCache) {
            await sweepDecodeCache(settings);
            this.hasSweptCache = true;
        }

        if (await hasCachedLibrary(sectorName, settings))
            return { cached: true, bytes: 0 };

        try {
            const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
            const library = buildDecodeLibrary(pkg, sectorName, settings);

            buildStaticMeshBatchData(library);
            prepareLibraryForTransfer(library, this.collectPackageBuffers());

            return { cached: false, bytes: await storeCachedLibraryDurable(sectorName, settings, library) };
        } finally {
            this.freeSector(sectorName);
        }
    }

    protected async decodeSectorCore(sectorName: string, settings: GD.LoadSettings_T): Promise<{ library: any, fromCache: boolean }> {
        const convertToRGBA = (settings as any).rgbaTextures !== false; // false = client uploads DDS as-is (s3tc)

        // never cache the skylevel, sky renderer matches its sections against env config
        // material uuids which are session-random - a cached skylevel never matches
        const cacheable = !(settings as any).isSkyLevel;

        const cached = cacheable ? await loadCachedLibrary(sectorName, settings) : null;

        if (cached) {
            if (convertToRGBA) convertDDSMaterialsToRGBA(cached); /* the cache stores DDS (4-8x smaller than RGBA) */
            refreshSoundBlobUris(cached);                         /* blob URLs are session-scoped */

            return { library: cached, fromCache: true };
        }

        const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
        const library = buildDecodeLibrary(pkg, sectorName, settings);

        buildStaticMeshBatchData(library);

        /*
         * Sanitize before caching so the cache only ever sees plain data; this pass's
         * transfer list is discarded (the DXT conversion below swaps texture buffers).
         * storeCachedLibrary serializes now and writes in the background.
         */
        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if (cacheable) storeCachedLibrary(sectorName, settings, library);

        if (convertToRGBA) convertDDSMaterialsToRGBA(library);

        return { library, fromCache: false };
    }

    protected async decodeSectorBinaryCore(sectorName: string, settings: GD.LoadSettings_T): Promise<BinarySector_T> {
        const convertToRGBA = (settings as any).rgbaTextures !== false;
        const cacheable = !(settings as any).isSkyLevel;
        const cachedBuffer = cacheable ? await loadCachedLibraryBuffer(sectorName, settings) : null;

        if (cachedBuffer) {
            if (!convertToRGBA) return { buffer: cachedBuffer, fromCache: true };

            const library = deserializeLibrary(cachedBuffer);

            convertDDSMaterialsToRGBA(library);

            return { buffer: serializeLibrary(library).buffer as ArrayBuffer, fromCache: true };
        }

        const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
        const library = buildDecodeLibrary(pkg, sectorName, settings);

        buildStaticMeshBatchData(library);
        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        let buffer: ArrayBuffer = null;

        if (cacheable) {
            buffer = serializeLibrary(library).buffer as ArrayBuffer;
            await storeCachedLibraryBufferDurable(sectorName, settings, buffer);
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

    protected async fetchSkeletalMesh(path: string): Promise<GA.USkeletalMesh> {
        const [packageName, objectName] = splitObjectPath(path);
        const pkg = await this.assetLoader.using(this.assetLoader.getPackage(packageName, "Animation"), { neverUnload: true });
        const lowerName = objectName.toLowerCase();
        const entry = pkg.exportGroups.SkeletalMesh.find(entry => (entry.export.objectName as string).toLowerCase() === lowerName);

        if (!entry) throw new Error(`Skeletal mesh '${objectName}' not found in '${packageName}'.`);

        return pkg.fetchObject<GA.USkeletalMesh>(entry.index + 1);
    }

    protected async fetchCharacterMaterial(path: string): Promise<GA.UMaterial> {
        const [packageName, objectName] = splitObjectPath(path);
        const pkg = await this.assetLoader.using(this.assetLoader.getPackage(packageName, "Texture"), { neverUnload: true });
        const lowerName = objectName.toLowerCase();
        const entry = pkg.exports.find(entry => (entry.objectName as string).toLowerCase() === lowerName);

        if (!entry) throw new Error(`Material '${objectName}' not found in '${packageName}'.`);

        return pkg.fetchObject<GA.UMaterial>(entry.index + 1);
    }

    protected async decodeCharacterFromSource(settings: GD.LoadSettings_T, charIndex: number, meshPaths: string[], texturePaths: string[], includeAnimations: boolean): Promise<DecodeLibrary> {
        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);

        library.name = splitObjectPath(row.face_mesh[0])[1];

        for (let i = 0; i < meshPaths.length; i++) {
            const mesh = await this.fetchSkeletalMesh(meshPaths[i]);
            const texture = await this.fetchCharacterMaterial(texturePaths[i]);
            const meshInfo = builder.pullSkeletalMesh(mesh, i === 0 && includeAnimations, false);
            const textureUuid = builder.pullMaterial(texture);
            const material = library.materials[meshInfo.materials] as GD.IMaterialGroupDecodeInfo;

            if (!material || material.materialType !== "group")
                throw new Error(`Skeletal mesh '${meshPaths[i]}' has no material group.`);

            material.materials = [textureUuid];
            meshInfo.animations = i === 0 && includeAnimations ? meshInfo.animations : {};

            if (i === 0) meshInfo.animationSet = characterBundleCacheName(charIndex, library.name.replace(/_m\d+_f$/, ""));

            library.pawnActors.push(meshInfo);
        }

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    public async decodeCharacter(settings: GD.LoadSettings_T, charIndex: number = 1, faceVariant: number = 0, hairVariant: number = 0, hairColour: number = 0, armor: GD.ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 }, includeAnimations: boolean = true): Promise<DecodeLibrary> {
        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const [meshPaths, texturePaths] = await this.characterPartPaths(charIndex, faceVariant, hairVariant, hairColour, armor);
        const cacheName = characterBundleCacheName(charIndex, splitObjectPath(row.face_mesh[0])[1].replace(/_m\d+_f$/, ""));
        let bundle = this.cacheCharacterBundles.get(charIndex);

        if (Object.values(armor).some(id => id !== 0))
            return this.decodeCharacterFromSource(settings, charIndex, meshPaths, texturePaths, includeAnimations);

        if (!bundle) {
            const buffer = await loadCachedLibraryBuffer(cacheName, settings);

            if (buffer) {
                bundle = deserializeLibrary(buffer) as DecodeLibrary;
                this.cacheCharacterBundles.set(charIndex, bundle);
            }
        }

        if (!bundle) return this.decodeCharacterFromSource(settings, charIndex, meshPaths, texturePaths, includeAnimations);

        const manifest = (bundle as any).characterBundle as CharacterBundle_T;
        const library = new DecodeLibrary();
        const actors = new Map(bundle.pawnActors.map(info => [info.uuid, info]));

        library.name = manifest.name;

        for (let i = 0; i < meshPaths.length; i++) {
            const actor = actors.get(manifest.meshes[meshPaths[i]]);
            const textureUuid = manifest.materials[texturePaths[i]];

            if (!actor) throw new Error(`Character mesh '${meshPaths[i]}' not found in '${cacheName}'.`);
            if (!textureUuid) throw new Error(`Character material '${texturePaths[i]}' not found in '${cacheName}'.`);

            const info = Object.assign({}, actor);
            const material = bundle.materials[info.materials] as GD.IMaterialGroupDecodeInfo;

            if (!material || material.materialType !== "group")
                throw new Error(`Character mesh '${meshPaths[i]}' has no material group in '${cacheName}'.`);

            library.geometries[info.geometry] = bundle.geometries[info.geometry];
            library.materials[info.materials] = Object.assign({}, material, { materials: [textureUuid] });
            copyCharacterMaterial(library, bundle, textureUuid);

            info.animations = i === 0 && includeAnimations ? manifest.animations : {};

            if (i === 0) info.animationSet = manifest.animationSet;

            library.pawnActors.push(info);
        }

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    protected async buildCharacterBundle(settings: GD.LoadSettings_T, charIndex: number): Promise<DecodeLibrary> {
        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const name = splitObjectPath(row.face_mesh[0])[1].replace(/_m\d+_f$/, "");
        const cacheName = characterBundleCacheName(charIndex, name);
        const meshPaths = new Set<string>();
        const texturePaths = new Set<string>();
        const hairPieces = await this.characterHairPieces(charIndex);

        for (let face = 0; face < row.face_tex.length; face++) {
            for (const [hair, colours] of hairPieces) {
                for (const colour of colours.keys()) {
                    const [meshes, textures] = resolveCharacterPartPaths(row, hairPieces, [], face, hair, colour, { chest: 0, legs: 0, gloves: 0, boots: 0 });

                    meshes.forEach(path => meshPaths.add(path));
                    textures.forEach(path => texturePaths.add(path));
                }
            }
        }

        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, { ...settings, rgbaTextures: false } as GD.LoadSettings_T);
        const manifest: CharacterBundle_T = { name, animationSet: cacheName, animations: {}, meshes: {}, materials: {} };
        const faceMesh = row.face_mesh[0] as string;

        library.name = name;

        for (const path of meshPaths) {
            const mesh = await this.fetchSkeletalMesh(path);
            const info = builder.pullSkeletalMesh(mesh, path === faceMesh, false);

            if (path === faceMesh) manifest.animations = info.animations;

            info.animations = {};
            manifest.meshes[path] = info.uuid;
            library.pawnActors.push(info);
        }

        for (const path of texturePaths)
            manifest.materials[path] = builder.pullMaterial(await this.fetchCharacterMaterial(path));

        (library as any).characterBundle = manifest;

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        return library;
    }

    protected async characterPartPaths(charIndex: number, faceVariant: number, hairVariant: number, hairColour: number, armor: GD.ICharacterArmorSelection): Promise<[string[], string[]]> {
        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const hairPieces = await this.characterHairPieces(charIndex);
        const armorRows = await this.decodeArmorGrp();

        return resolveCharacterPartPaths(row, hairPieces, armorRows, faceVariant, hairVariant, hairColour, armor);
    }

    // hair carries its own style and colour axes - the face texture only ever names the head
    protected async characterHairPieces(charIndex: number): Promise<CharacterHairPieces_T> {
        if (this.cacheCharacterHairPieces.has(charIndex)) return this.cacheCharacterHairPieces.get(charIndex)!;

        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const [packageName, faceName] = splitObjectPath(row.face_mesh[0] as string);
        const [texturePackage] = splitObjectPath(row.face_tex[0] as string);
        const pkg = await this.assetLoader.load(this.assetLoader.getPackage(packageName, "Animation")); // reading the export table only, no ref-count
        const textures = await this.characterTextureNames(row.face_tex[0] as string);
        const pattern = new RegExp(`^${faceName.replace(/_m\d+_f$/, "").toLowerCase()}_m(\\d+)_m00_(ah|bh)$`);
        const styles = new Map<number, Map<number, [string, string][]>>();

        for (const entry of pkg.exportGroups.SkeletalMesh) {
            const name = entry.export.objectName as string;
            const match = pattern.exec(name.toLowerCase());

            if (!match) continue;

            const style = parseInt(match[1], 10);

            for (let colour = 0; colour < HAIR_COLOUR_COUNT; colour++) {
                const texture = name.replace(/_m00_(ah|bh)$/i, `_t0${colour}_m00_$1`);

                // every style ships a mesh for both pieces, but only the pieces it actually wears get a texture
                if (!textures.has(texture.toLowerCase())) continue;

                if (!styles.has(style)) styles.set(style, new Map());

                const colours = styles.get(style);

                if (!colours.has(colour)) colours.set(colour, []);

                colours.get(colour).push([`${packageName}.${name}`, `${texturePackage}.${texture}`]);
            }
        }

        this.cacheCharacterHairPieces.set(charIndex, styles);

        return styles;
    }

    protected async characterTextureNames(faceTexture: string): Promise<Set<string>> {
        const pkg = await this.assetLoader.load(this.assetLoader.getPackage(splitObjectPath(faceTexture)[0], "Texture"));

        return new Set(pkg.exports.map(entry => (entry.objectName as string).toLowerCase()));
    }

    public async decodeCharacterBinary(settings: GD.LoadSettings_T, charIndex: number, faceVariant: number, hairVariant: number, hairColour: number, armor: GD.ICharacterArmorSelection, includeAnimations: boolean): Promise<ArrayBuffer> {
        return serializeLibrary(await this.decodeCharacter(settings, charIndex, faceVariant, hairVariant, hairColour, armor, includeAnimations)).buffer as ArrayBuffer;
    }

    public async precacheCharacters(settings: GD.LoadSettings_T): Promise<void> {
        const groups = await this.decodeCharGroups();

        if (settings.cache?.enabled === false) return;

        for (const group of groups) {
            const name = characterBundleCacheName(group.index, group.name);

            if (await hasCachedLibrary(name, settings)) continue;

            const bundle = await this.buildCharacterBundle(settings, group.index);

            await storeCachedLibraryDurable(name, settings, bundle);
            this.cacheCharacterBundles.set(group.index, bundle);
        }
    }

    public async decodeCharGroups(): Promise<GD.ICharacterGroup[]> {
        const rows = await this.decodeCharGrp();
        const armorRows = await this.decodeArmorGrp();
        const itemNames = new Map((await this.decodeItemNames()).map(item => [item.id as number, item]));
        const groups: GD.ICharacterGroup[] = [];

        for (let index = 0; index < rows.length; index++) {
            const row = rows[index];
            const pieces = await this.characterHairPieces(index);
            const armor = { chest: [], legs: [], gloves: [], boots: [] } as GD.ICharacterArmorOptions;

            for (const slot of Object.keys(CHARACTER_ARMOR_SLOTS) as (keyof typeof CHARACTER_ARMOR_SLOTS)[]) {
                const items = armorRows
                    .filter(item => item.body_part === CHARACTER_ARMOR_SLOTS[slot] && getCharacterArmorPaths(row, item).length > 0)
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

        const file = await (new UDataFile(SCHEMA_CHARGRP_DAT, "assets/system/chargrp.dat", false).asReadable()).decode();

        this.cacheCharGrpRows = file.datarows;

        return this.cacheCharGrpRows;
    }

    protected async decodeArmorGrp(): Promise<Record<string, any>[]> {
        if (this.cacheArmorGrpRows) return this.cacheArmorGrpRows;

        const file = await (new UDataFile(SCHEMA_ARMORGRP_DAT, "assets/system/armorgrp.dat").asReadable()).decode();

        this.cacheArmorGrpRows = file.datarows;

        return this.cacheArmorGrpRows;
    }

    protected async decodeItemNames(): Promise<Record<string, any>[]> {
        if (this.cacheItemNameRows) return this.cacheItemNameRows;

        const file = await (new UDataFile(SCHEMA_ITEMNAME_E_DAT, "assets/system/itemname-e.dat").asReadable()).decode();

        this.cacheItemNameRows = file.datarows;

        return this.cacheItemNameRows;
    }

    public async decodeMusicInfo(): Promise<Record<number, string[]>> {
        const file = await (new UDataFile(SCHEMA_MUSICINFO_DAT, "assets/system/musicinfo.dat").asReadable()).decode();

        return Object.fromEntries(file.datarows.map((row: any) => [
            row.id,
            (row.sounds as string[]).map(sound => this.assetLoader.getPackage(sound, "Music").path)
        ]));
    }

    /* postMessage transfer list for a value already produced by this engine - the sanitize
       pass inside decodeSectorCore already ran, this only needs to (re)walk for buffers */
    public collectTransferables(value: any): ArrayBuffer[] {
        return prepareLibraryForTransfer(value, this.collectPackageBuffers());
    }
}

export default DecodeEngine;
export { DecodeEngine };
