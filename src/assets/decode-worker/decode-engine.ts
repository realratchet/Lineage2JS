import AssetLoader from "@client/assets/asset-loader";
import UConfigEnv from "@unreal/conf-files/un-conf-env";
import UDataFile from "@unreal/datafile/un-datafile";
import * as SchemasC4 from "@unreal/datafile/schema/schema-types";
import { buildStaticMeshBatchData } from "@client/assets/decoders/batch-data";
import { convertDDSMaterialsToRGBA } from "@client/assets/decoders/dxt-decode";
import buildDecodeLibrary from "./build-decode-library";
import prepareLibraryForTransfer from "./collect-transferables";
import * as DecodeCache from "./decode-cache";
import { serializeLibrary, deserializeLibrary } from "./library-serializer";
import type { PrecacheResult_T } from "./decode-protocol";
import DecodeLibrary from "@client/assets/unreal/decode-library";
import DecodeLibraryBuilder from "@client/assets/unreal/decode-library-builder";
import getNpcBundleName, { isNpcMeshPackage } from "./npc-bundle";

type BinarySector_T = { buffer: ArrayBuffer, fromCache: boolean };
type CharacterBundle_T = {
    name: string;
    animationSet: string;
    animations: Record<string, GD.IKeyframeDecodeInfo_T[]>;
    animationNotifies: Record<string, GD.IAnimationNotifyDecodeInfo[]>;
    meshes: Record<string, string>;
    materials: Record<string, string>;
};
type CharacterHairPieces_T = Map<number, Map<number, [string, string][]>>;
type CharacterPartPaths_T = [string, string];
type NpcBundleEntry_T = { meshIndex: number, materials: string, scriptClassId: string | null };
type NpcBundleManifest_T = { actors: Record<number, NpcBundleEntry_T> };
type CachedBundle_T = { library: DecodeLibrary, seekable?: DecodeCache.SeekableLibrary_T };

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

function copyAnimationSounds(target: DecodeLibrary, source: DecodeLibrary, animationNotifies: Record<string, GD.IAnimationNotifyDecodeInfo[]>): void {
    function copySound(name: string): void {
        if (!name || target.soundBlobCache.has(name)) return;

        const sound = source.soundBlobCache.get(name);

        if (!sound) throw new Error(`Asset bundle has no decoded sound '${name}'.`);

        target.soundBlobCache.set(name, sound);
    }

    for (const notifications of Object.values(animationNotifies)) {
        for (const notify of notifications) {
            const object = notify.object;

            if (!object || object.type !== "sound") continue;

            copySound(object.sound);

            for (const name of object.defaultWalkSounds) copySound(name);
            for (const name of object.defaultRunSounds) copySound(name);
            for (const name of object.grassWalkSounds) copySound(name);
            for (const name of object.grassRunSounds) copySound(name);
            for (const name of object.waterWalkSounds) copySound(name);
            for (const name of object.waterRunSounds) copySound(name);
            for (const name of object.defaultActorWalkSounds) copySound(name);
            for (const name of object.defaultActorRunSounds) copySound(name);
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

function resolveCharacterPartPaths(row: Record<string, any>, hairPieces: CharacterHairPieces_T, armorRows: Record<string, any>[], faceVariant: number, hairVariant: number, hairColour: number, armor: GD.ICharacterArmorSelection): [string[], string[]] {
    const faceMesh = row.face_mesh[0] as string;
    const faceTexture = row.face_tex[faceVariant % row.face_tex.length] as string;
    const style = hairPieces.has(hairVariant) ? hairVariant : [...hairPieces.keys()].sort((a, b) => a - b)[0];
    const colours = hairPieces.get(style);
    const pieces = colours.get(colours.has(hairColour) ? hairColour : [...colours.keys()].sort((a, b) => a - b)[0]);
    const bodyParts = (row.body_mesh as string[]).map((mesh, i) => [[mesh, row.body_tex[i]]] as CharacterPartPaths_T[]);
    const bodyIndices: Record<string, number> = { u: 0, l: 1, g: 2, b: 3 };

    for (const slot of Object.keys(SchemasC4.CHARACTER_ARMOR_SLOTS)) {
        const id = armor[slot as keyof GD.ICharacterArmorSelection];

        if (!id) continue;

        const armorRow = armorRows.find(row => row.id === id);

        if (!armorRow) throw new Error(`Armor '${id}' does not exist.`);
        if (armorRow.body_part !== SchemasC4.CHARACTER_ARMOR_SLOTS[slot as keyof typeof SchemasC4.CHARACTER_ARMOR_SLOTS])
            throw new Error(`Armor '${id}' does not fit '${slot}'.`);

        const cleared = new Set<number>();

        for (const part of getCharacterArmorPaths(row, armorRow)) {
            const match = /_([ulgb])$/i.exec(splitObjectPath(part[0])[1]);
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
    protected cacheNpcDefinitions: GD.INpcDefinition[] = null;
    protected cacheCharacterBundles = new Map<number, CachedBundle_T>();
    protected cacheCharacterHairPieces = new Map<number, CharacterHairPieces_T>();
    protected cacheNpcBundles = new Map<string, CachedBundle_T>();

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
            await DecodeCache.sweepDecodeCache(settings);
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
            await DecodeCache.sweepDecodeCache(settings);
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
            await DecodeCache.sweepDecodeCache(settings);
            this.hasSweptCache = true;
        }

        if (await DecodeCache.hasCachedLibrary(sectorName, settings))
            return { cached: true, bytes: 0 };

        try {
            const pkg = await this.assetLoader.using(this.assetLoader.getPackage(sectorName, "Level"));
            const library = buildDecodeLibrary(pkg, sectorName, settings);

            buildStaticMeshBatchData(library);
            prepareLibraryForTransfer(library, this.collectPackageBuffers());

            return { cached: false, bytes: await DecodeCache.storeCachedLibraryDurable(sectorName, settings, library) };
        } finally {
            this.freeSector(sectorName);
        }
    }

    protected async decodeSectorCore(sectorName: string, settings: GD.LoadSettings_T): Promise<{ library: any, fromCache: boolean }> {
        const convertToRGBA = (settings as any).rgbaTextures !== false; // false = client uploads DDS as-is (s3tc)

        // never cache the skylevel, sky renderer matches its sections against env config
        // material uuids which are session-random - a cached skylevel never matches
        const cacheable = !(settings as any).isSkyLevel;

        const cached = cacheable ? await DecodeCache.loadCachedLibrary(sectorName, settings) : null;

        if (cached) {
            if (convertToRGBA) convertDDSMaterialsToRGBA(cached); /* the cache stores DDS (4-8x smaller than RGBA) */
            DecodeCache.refreshSoundBlobUris(cached);                         /* blob URLs are session-scoped */

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

        if (cacheable) DecodeCache.storeCachedLibrary(sectorName, settings, library);

        if (convertToRGBA) convertDDSMaterialsToRGBA(library);

        // Main-thread decode owns these blob URLs.
        DecodeCache.refreshSoundBlobUris(library);

        return { library, fromCache: false };
    }

    protected async decodeSectorBinaryCore(sectorName: string, settings: GD.LoadSettings_T): Promise<BinarySector_T> {
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

    protected async fetchScriptClass(path: string): Promise<[C.APackage, C.UClass]> {
        const [packageName, objectName] = splitObjectPath(path);
        const pkg = await this.assetLoader.using(this.assetLoader.getPackage(packageName, "Script"), { neverUnload: true });
        const cls = pkg.fetchObjectByType<C.UClass>("Class", objectName);

        if (!cls) throw new Error(`Script class '${path}' not found.`);

        return [pkg, cls.loadSelf()];
    }

    protected async pullScriptEffectTemplates(library: DecodeLibrary, builder: DecodeLibraryBuilder): Promise<void> {
        const paths = new Set<string>();
        const programs = [...Object.values(library.scriptFunctions), ...Object.values(library.scriptStates), ...Object.values(library.scriptClasses)];

        for (const info of programs)
            for (const entry of info.program.entries)
                if (typeof entry.value === "string" && /^LineageEffect\./i.test(entry.value)) paths.add(entry.value);

        for (const path of paths) {
            const [pkg, cls] = await this.fetchScriptClass(path);
            const emitter = pkg.newObject<GA.UEmitter>(cls);

            emitter.objectName = cls.objectName;

            const info = emitter.getTemplateDecodeInfo(builder);

            info.scriptClassId = cls.name;
            library.effectTemplates[cls.name] = info;
        }
    }

    protected async buildNpcBundle(settings: GD.LoadSettings_T, bundleName: string): Promise<DecodeLibrary> {
        const definitions = (await this.decodeNpcDefinitions()).filter(npc => {
            if (!npc.mesh.includes(".")) return false;

            const [packageName] = splitObjectPath(npc.mesh);

            return isNpcMeshPackage(packageName) && getNpcBundleName(packageName) === bundleName;
        });
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, { ...settings, rgbaTextures: false } as GD.LoadSettings_T);
        const manifest: NpcBundleManifest_T = { actors: {} };
        const meshIndices = new Map<string, number>();
        const materialIds = new Map<string, string>();
        const textureIds = new Map<string, string>();
        const classIds = new Map<string, string | null>();
        const classes: C.UClass[] = [];

        library.name = bundleName;

        for (const npc of definitions) {
            const meshPath = npc.mesh.toLowerCase();

            if (meshIndices.has(meshPath)) continue;

            const mesh = await this.fetchSkeletalMesh(npc.mesh);
            const decodeMaterials = definitions.some(other => other.mesh.toLowerCase() === meshPath && other.textures.length === 0);
            let info: GD.ISkinnedMeshObjectDecodeInfo;

            try {
                info = builder.pullSkeletalMesh(mesh, true, decodeMaterials);
            } catch (e) {
                throw new Error(`NPC mesh '${npc.mesh}' failed to decode: ${(e as Error).message}`);
            }

            info.animationSet = `${bundleName}_${meshPath}`;
            meshIndices.set(meshPath, library.pawnActors.length);
            library.pawnActors.push(info);
        }

        for (const npc of definitions) {
            const classPath = npc.className.toLowerCase();

            if (classIds.has(classPath)) continue;

            let cls: C.UClass;

            try {
                [, cls] = await this.fetchScriptClass(npc.className);
            } catch (e) {
                if (!(e as Error).message.endsWith("not found.")) throw e;

                classIds.set(classPath, null);
                continue;
            }

            classIds.set(classPath, cls.name);
            classes.push(cls);
        }

        builder.pullScriptClasses(classes);

        for (const npc of definitions) {
            const meshIndex = meshIndices.get(npc.mesh.toLowerCase());
            const meshInfo = library.pawnActors[meshIndex];
            const materialKey = npc.textures.map(path => path.toLowerCase()).join("|");
            let materials = meshInfo.materials;

            if (materialKey) {
                materials = materialIds.get(materialKey);

                if (!materials) {
                    const materialNames: string[] = [];

                    for (const path of npc.textures) {
                        const key = path.toLowerCase();
                        let material = textureIds.get(key);

                        if (!material) {
                            material = builder.pullMaterial(await this.fetchCharacterMaterial(path));
                            textureIds.set(key, material);
                        }

                        materialNames.push(material);
                    }

                    materials = `${bundleName}.materials.${materialIds.size}`;
                    materialIds.set(materialKey, materials);
                    library.materials[materials] = { name: materials, materialType: "group", materials: materialNames } as GD.IMaterialGroupDecodeInfo;
                }
            }

            manifest.actors[npc.id] = { meshIndex, materials, scriptClassId: classIds.get(npc.className.toLowerCase()) };
        }

        (library as any).npcBundle = manifest;

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        return library;
    }

    protected async getNpcBundle(settings: GD.LoadSettings_T, packageName: string): Promise<CachedBundle_T> {
        const bundleName = getNpcBundleName(packageName);
        let bundle = this.cacheNpcBundles.get(bundleName);

        if (bundle) return bundle;

        const seekable = await DecodeCache.openCachedLibrary(bundleName, settings);

        if (seekable) {
            bundle = { library: seekable.library as DecodeLibrary, seekable };
        } else {
            const library = await this.buildNpcBundle(settings, bundleName);

            await DecodeCache.storeCachedLibraryDurable(bundleName, settings, library);
            bundle = { library };
        }

        this.cacheNpcBundles.set(bundleName, bundle);

        return bundle;
    }

    protected async decodeNpc(settings: GD.LoadSettings_T, npcId: number, includeAnimations: boolean): Promise<DecodeLibrary> {
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
            animationNotifies: includeAnimations ? sourceInfo.animationNotifies : {}
        });
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);

        library.name = `${npc.id}_${npc.name}`;
        library.geometries[info.geometry] = bundle.geometries[info.geometry];
        copyCharacterMaterial(library, bundle, info.materials);
        copyAnimationSounds(library, bundle, sourceInfo.animationNotifies);
        copyScriptClass(library, bundle, entry.scriptClassId);
        await this.pullScriptEffectTemplates(library, builder);
        library.pawnActors.push(info);

        if (cached.seekable) await DecodeCache.hydrateLibraryFile(cached.seekable, library);

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    public async decodeSkeletalMesh(settings: GD.LoadSettings_T, packageName: string, meshName: string, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null, includeAnimations: boolean = true): Promise<DecodeLibrary> {
        if (npcId !== null) return this.decodeNpc(settings, npcId, includeAnimations);

        const mesh = await this.fetchSkeletalMesh(`${packageName}.${meshName}`);
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);
        const meshInfo = builder.pullSkeletalMesh(mesh, true, texturePaths.length === 0);

        library.name = mesh.objectName;
        library.pawnActors.push(meshInfo);

        if (texturePaths.length > 0) {
            const material = library.materials[meshInfo.materials] as GD.IMaterialGroupDecodeInfo;

            if (!material || material.materialType !== "group") throw new Error(`Skeletal mesh '${packageName}.${meshName}' has no material group.`);

            material.materials = await Promise.all(texturePaths.map(async path => builder.pullMaterial(await this.fetchCharacterMaterial(path))));
        }

        if (scriptClassPath) {
            const [, cls] = await this.fetchScriptClass(scriptClassPath);

            meshInfo.scriptClassId = cls.name;
            builder.pullScriptClasses([cls]);
            await this.pullScriptEffectTemplates(library, builder);
        }

        prepareLibraryForTransfer(library, this.collectPackageBuffers());

        if ((settings as any).rgbaTextures !== false) convertDDSMaterialsToRGBA(library);

        return library;
    }

    protected async decodeCharacterFromSource(settings: GD.LoadSettings_T, charIndex: number, meshPaths: string[], texturePaths: string[], includeAnimations: boolean): Promise<DecodeLibrary> {
        const rows = await this.decodeCharGrp();
        const row = getCharacterRow(rows, charIndex);
        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, settings);

        library.name = splitObjectPath(row.face_mesh[0])[1];

        for (let i = 0, len = meshPaths.length; i < len; i++) {
            const mesh = await this.fetchSkeletalMesh(meshPaths[i]);
            const texture = await this.fetchCharacterMaterial(texturePaths[i]);
            const meshInfo = builder.pullSkeletalMesh(mesh, i === 0 && includeAnimations, false);
            const textureUuid = builder.pullMaterial(texture);
            const material = library.materials[meshInfo.materials] as GD.IMaterialGroupDecodeInfo;

            if (!material || material.materialType !== "group")
                throw new Error(`Skeletal mesh '${meshPaths[i]}' has no material group.`);

            material.materials = [textureUuid];
            meshInfo.animations = i === 0 && includeAnimations ? meshInfo.animations : {};
            meshInfo.animationNotifies = i === 0 && includeAnimations ? meshInfo.animationNotifies : {};

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
        let cached = this.cacheCharacterBundles.get(charIndex);

        if (Object.values(armor).some(id => id !== 0))
            return this.decodeCharacterFromSource(settings, charIndex, meshPaths, texturePaths, includeAnimations);

        if (!cached) {
            const seekable = await DecodeCache.openCachedLibrary(cacheName, settings);

            if (seekable) {
                cached = { library: seekable.library as DecodeLibrary, seekable };
                this.cacheCharacterBundles.set(charIndex, cached);
            }
        }

        if (!cached) return this.decodeCharacterFromSource(settings, charIndex, meshPaths, texturePaths, includeAnimations);

        const bundle = cached.library;

        const manifest = (bundle as any).characterBundle as CharacterBundle_T;
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
            const material = bundle.materials[info.materials] as GD.IMaterialGroupDecodeInfo;

            if (!material || material.materialType !== "group")
                throw new Error(`Character mesh '${meshPaths[i]}' has no material group in '${cacheName}'.`);

            library.geometries[info.geometry] = bundle.geometries[info.geometry];
            library.materials[info.materials] = Object.assign({}, material, { materials: [textureUuid] });
            copyCharacterMaterial(library, bundle, textureUuid);

            info.animations = i === 0 && includeAnimations ? manifest.animations : {};
            info.animationNotifies = i === 0 && includeAnimations ? manifest.animationNotifies : {};

            if (i === 0) info.animationSet = manifest.animationSet;

            library.pawnActors.push(info);
        }

        if (cached.seekable) await DecodeCache.hydrateLibraryFile(cached.seekable, library);

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

        for (let face = 0, len = row.face_tex.length; face < len; face++) {
            for (const [hair, colours] of hairPieces) {
                for (const colour of colours.keys()) {
                    const [meshes, textures] = resolveCharacterPartPaths(row, hairPieces, [], face, hair, colour, { chest: 0, legs: 0, gloves: 0, boots: 0 });

                    for (const path of meshes) meshPaths.add(path);
                    for (const path of textures) texturePaths.add(path);
                }
            }
        }

        const library = new DecodeLibrary();
        const builder = new DecodeLibraryBuilder(library, { ...settings, rgbaTextures: false } as GD.LoadSettings_T);
        const manifest: CharacterBundle_T = { name, animationSet: cacheName, animations: {}, animationNotifies: {}, meshes: {}, materials: {} };
        const faceMesh = row.face_mesh[0] as string;

        library.name = name;

        for (const path of meshPaths) {
            const mesh = await this.fetchSkeletalMesh(path);
            const info = builder.pullSkeletalMesh(mesh, path === faceMesh, false);

            if (path === faceMesh) {
                manifest.animations = info.animations;
                manifest.animationNotifies = info.animationNotifies;
            }

            info.animations = {};
            info.animationNotifies = {};
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
        const pkg = await this.assetLoader.load(this.assetLoader.getPackage(splitObjectPath(faceTexture)[0], "Texture"));

        return pkg.exports.map(entry => entry.objectName as string);
    }

    public async decodeCharacterBinary(settings: GD.LoadSettings_T, charIndex: number, faceVariant: number, hairVariant: number, hairColour: number, armor: GD.ICharacterArmorSelection, includeAnimations: boolean): Promise<ArrayBuffer> {
        return serializeLibrary(await this.decodeCharacter(settings, charIndex, faceVariant, hairVariant, hairColour, armor, includeAnimations)).buffer as ArrayBuffer;
    }

    public async decodeSkeletalMeshBinary(settings: GD.LoadSettings_T, packageName: string, meshName: string, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null, includeAnimations: boolean = true): Promise<ArrayBuffer> {
        return serializeLibrary(await this.decodeSkeletalMesh(settings, packageName, meshName, scriptClassPath, texturePaths, npcId, includeAnimations)).buffer as ArrayBuffer;
    }

    public async precacheCharacters(settings: GD.LoadSettings_T): Promise<void> {
        const groups = await this.decodeCharGroups();

        if (settings.cache?.enabled === false) return;

        for (const group of groups) {
            const name = characterBundleCacheName(group.index, group.name);

            if (await DecodeCache.hasCachedLibrary(name, settings)) continue;

            const bundle = await this.buildCharacterBundle(settings, group.index);

            await DecodeCache.storeCachedLibraryDurable(name, settings, bundle);
            this.cacheCharacterBundles.set(group.index, { library: bundle });
        }
    }

    public async decodeCharGroups(): Promise<GD.ICharacterGroup[]> {
        const rows = await this.decodeCharGrp();
        const armorRows = await this.decodeArmorGrp();
        const itemNames = new Map((await this.decodeItemNames()).map(item => [item.id as number, item]));
        const groups: GD.ICharacterGroup[] = [];

        for (let index = 0, len = rows.length; index < len; index++) {
            const row = rows[index];

            if (row.face_mesh.length === 0) {
                if (index !== SchemasC4.CHARGRP_RECORD_COUNT - 1) throw new Error(`Character group '${index}' is unexpectedly empty.`);
                continue;
            }

            const pieces = await this.characterHairPieces(index);
            const armor = { chest: [], legs: [], gloves: [], boots: [] } as GD.ICharacterArmorOptions;

            for (const slot of Object.keys(SchemasC4.CHARACTER_ARMOR_SLOTS) as (keyof typeof SchemasC4.CHARACTER_ARMOR_SLOTS)[]) {
                const items = armorRows
                    .filter(item => item.body_part === SchemasC4.CHARACTER_ARMOR_SLOTS[slot] && getCharacterArmorPaths(row, item).length > 0)
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

    public async decodeMusicInfo(): Promise<Record<number, string[]>> {
        const file = await (new UDataFile(SchemasC4.SCHEMA_MUSICINFO_DAT, "assets/system/musicinfo.dat").asReadable()).decode();

        return Object.fromEntries(file.datarows.map((row: any) => [
            row.id,
            (row.sounds as string[]).map(sound => this.assetLoader.getPackage(sound, "Music").path)
        ]));
    }

    public async resolveNpc(selector: string | number): Promise<GD.INpcDefinition> {
        const definitions = await this.decodeNpcDefinitions();

        if (typeof selector === "number") {
            const npc = definitions.find(npc => npc.id === selector);

            if (!npc) throw new Error(`NPC ID '${selector}' does not exist.`);

            return npc;
        }

        const name = selector.trim().toLowerCase();

        if (name.length === 0) throw new Error("NPC name cannot be empty.");

        const matches = definitions.filter(npc => npc.name.trim().toLowerCase() === name);

        if (matches.length === 0) throw new Error(`NPC name '${selector}' does not exist.`);
        if (matches.length > 1) throw new Error(`NPC name '${selector}' matches IDs ${matches.map(npc => npc.id).sort((a, b) => a - b).join(", ")}; spawn by ID.`);

        return matches[0];
    }

    protected async decodeNpcDefinitions(): Promise<GD.INpcDefinition[]> {
        if (this.cacheNpcDefinitions) return this.cacheNpcDefinitions;

        const [groups, names] = await Promise.all([
            (new UDataFile(SchemasC4.SCHEMA_NPCGRP_DAT, "assets/system/Npcgrp.dat").asReadable()).decode(),
            (new UDataFile(SchemasC4.SCHEMA_NPCNAME_E_DAT, "assets/system/npcname-e.dat").asReadable()).decode()
        ]);
        const namesById = new Map(names.datarows.map(row => [row.id as number, row.name as string]));

        this.cacheNpcDefinitions = groups.datarows.map(row => ({
            id: row.tag as number,
            name: namesById.get(row.tag as number) || "",
            className: row.class as string,
            mesh: row.mesh as string,
            textures: [...row.tex1 as string[], ...row.tex2 as string[]].filter(path => path && path.toLowerCase() !== "none")
        }));

        return this.cacheNpcDefinitions;
    }

    /* postMessage transfer list for a value already produced by this engine - the sanitize
       pass inside decodeSectorCore already ran, this only needs to (re)walk for buffers */
    public collectTransferables(value: any): ArrayBuffer[] {
        return prepareLibraryForTransfer(value, this.collectPackageBuffers());
    }
}

export default DecodeEngine;
export { DecodeEngine };
