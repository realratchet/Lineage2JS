import { v5 as seededUuid } from "uuid";
import StringSet from "./utils/string-set";
import type PackageCache from "../decode-worker/package-cache";
import FBox from "./un-box";
import FVector from "./un-vector";
import type UTexture from "./un-texture";
import type { UClass, APackage } from "@l2js/core";
import type { UObject } from "./un-object";
import DecodeLibrary, { type IBaseObjectDecodeInfo } from "./decode-library";
import pullScriptDumps, { dumpObjectClass, dumpObjectScriptProperties, pullScriptClasses, pullScriptClassFunctions } from "./script-dump-loader";
import type { HeightMapInfo_T, UTerrainSector, ITerrainSegmentDecodeInfo } from "./un-terrain-sector";
import type UPhysicsVolume from "./un-physics-volume";
import type UVolume from "./un-volume";
import UPrimitive from "./un-primitive";
import type { UMaterial } from "./un-material";
import type { FStaticLightmapTexture } from "./model/un-multilightmap-texture";
import type { UStaticMesh, IStaticMeshObjectDecodeInfo } from "./static-mesh/un-static-mesh";
import type { USound } from "./un-sound";
import type { USkeletalMesh, ISkinnedMeshObjectDecodeInfo } from "./skeletal-mesh/un-skeletal-mesh";
import type { UModel } from "./model/un-model";
import type { ULevelInfo } from "./un-level-info";
import type { ATerrainInfo } from "./un-terrain-info";
import type { ULevel } from "./un-level";
import type { UAActor } from "./un-aactor";
import type { UNSun } from "./un-nsun";
import type { UNMoon } from "./un-nmoon";
import type { FZoneInfo } from "./un-zone-info";
import type { UL2FogInfo } from "./un-fog-info";
import type { UEmitter } from "./un-emitter";
import type { UPawn } from "./un-pawn";
import type { UStaticMeshActor } from "./static-mesh/un-static-mesh-actor";
import type { ULight } from "./un-light";
import type { UMusicVolume } from "./un-music-volume";
import type { UBlockingVolume } from "./un-blocking-volume";
import type { UAmbientSoundObject } from "./un-ambient-sound";
import type { Vector3Arr } from "./library-types";

export type LoadSettings_T = {
    loadTerrain?: boolean,
    loadBaseModel?: boolean,
    loadStaticModels?: boolean,
    loadStaticModelList?: (number | string)[],
    loadExtendedBoneInfluences?: boolean,
    loadEmitters?: boolean,
    loadEmitterList?: { name: string, emitters?: string[] }[],
    loadAudio?: boolean,
    textures: "auto" | "rgba" | "compressed",
    rgbaTextures?: boolean,
    helpersZoneBounds?: boolean,
    isSkyLevel?: boolean,
    decodeWorkerPoolSize?: number,
    batching?: {
        terrain?: boolean,
        staticMeshes?: boolean
    },
    cache?: false | {
        enabled?: boolean,
        version?: number
    },
    [key: `_${string}`]: any // debug/testing overrides, see core.ts
};

type SharedScriptProperties_T = { properties: IBaseObjectDecodeInfo["scriptProperties"], overrides: Set<string> };

export class DecodeLibraryBuilder {
    public readonly library: DecodeLibrary;

    protected readonly materialsLoading = new Set<string>();
    protected readonly skeletalMeshes = new Map<string, ISkinnedMeshObjectDecodeInfo>();
    protected readonly cacheScriptDefaults = new WeakMap<Function, Map<string, any>>();
    protected readonly cacheSharedScriptProperties = new WeakMap<Function, SharedScriptProperties_T>();
    protected readonly settings: LoadSettings_T;
    protected readonly packageCache: PackageCache;
    protected readonly textureSources = new Map<string, any>();
    protected readonly textureFrames = new Map<string, any>();
    protected readonly alphaPalettes = new Set<string>();
    protected readonly materialSizes = new Map<string, { width: number, height: number }>();
    protected readonly staticMeshMetadata = new Map<string, any>();

    public constructor(library: DecodeLibrary, settings: LoadSettings_T, packageCache: PackageCache = null) {

        this.library = library;
        this.settings = settings;
        this.packageCache = packageCache?.isEnabled() ? packageCache : null;
    }

    public getSettings() { return this.settings; }

    public isPackageCaching(): boolean { return !!this.packageCache; }

    public isLoadingExtendedBoneInfluences() { return this.settings.loadExtendedBoneInfluences !== false; }

    public pullMaterial(material: UMaterial): string {
        if (!material) return null;

        if (this.materialsLoading.has(material.uuid)) return material.uuid;
        const cached = this.packageCache?.read(material, "material", this.library);
        if (cached !== undefined) {
            this.materialSizes.set(material.uuid, cached.textureSize);
            this.applyAlphaPalette(cached.uuid, cached.source);
            return cached.uuid;
        }
        if (material.uuid in this.library.materials) return material.uuid;
        this.packageCache?.begin(material, "material", this.library);
        material = material.loadSelf();

        this.materialsLoading.add(material.uuid);

        const info = material.getDecodeInfo(this);
        if (this.packageCache && typeof (material as any).getTextureFrameDecodeInfo === "function" && !this.textureFrames.has(material.uuid))
            (material as UTexture).getTextureFrameDecodeInfo(this);
        const textureSize = typeof material.getTextureSize === "function" ? material.getTextureSize() : null;
        const source = this.packageCache && typeof (material as any).getSourceDecodeInfo === "function" ? (material as UTexture).getSourceDecodeInfo(this) : null;
        this.materialSizes.set(material.uuid, textureSize);

        this.materialsLoading.delete(material.uuid);

        if (typeof info === "string" || !info) {
            this.packageCache?.end(material, this.library, { uuid: info || null, textureSize, source });
            return info || null;
        }

        this.library.materials[material.uuid] = info;
        this.applyAlphaPalette(material.uuid, source);
        this.packageCache?.end(material, this.library, { uuid: material.uuid, textureSize, source });

        return material.uuid;
    }

    public getTextureSource(texture: UTexture, pixels: boolean = true): any {
        let source = this.textureSources.get(texture.uuid);
        if (source && (!pixels || !source.data?.isLibraryChunk)) return source;
        source = this.packageCache?.readTextureSource(texture, pixels);
        if (!source) source = texture.loadSelf().getSourceDecodeInfo(this);
        this.textureSources.set(texture.uuid, source);
        return source;
    }

    public beginTextureFrame(texture: UTexture): void {
        this.packageCache?.read(texture, "frame", this.library);
        this.packageCache?.begin(texture, "frame", this.library);
    }

    public setTextureFrame(texture: UTexture, info: any, next: UTexture): void {
        if (!this.packageCache) return;
        this.textureFrames.set(texture.uuid, info);
        this.packageCache.addMaterialDependency(info.detail, this.library);
        this.packageCache.end(texture, this.library, { info, next: next ? { path: (next as any).pkg.path, index: next.exportIndex } : null });
    }

    public getCachedTextureFrame(texture: UTexture): { info: any, next: UTexture } | null {
        const cached = this.packageCache?.readTextureFrame(texture, this.library) || null;
        if (cached) this.textureFrames.set(texture.uuid, cached.info);
        return cached;
    }

    public getCachedTextureSource(texture: UTexture): any {
        return this.packageCache?.readTextureSource(texture, false) || null;
    }

    public setAlphaPalette(texture: UTexture): void {
        const source = this.getTextureSource(texture, false);
        if (source.paletteId) this.alphaPalettes.add(source.paletteId);
    }

    protected applyAlphaPalette(uuid: string, source: any): void {
        if (!uuid || !source || !source.paletteId || !this.alphaPalettes.size) return;
        const material: any = this.library.materials[uuid];
        if (!material) return;
        const textures = material.materialType === "sprite" ? material.sprites : [material];
        let changed = false;
        const result = textures.map(texture => {
            if (!this.alphaPalettes.has(source.palettes[texture.name]) || texture.textureType !== "rgba") return texture;
            const data = new Uint8Array(texture.buffer);
            let differs = false;
            for (let i = 0; i < data.length; i += 4) if (data[i] !== data[i + 3]) { differs = true; break; }
            if (!differs) return texture;
            const copy = data.slice();
            for (let i = 0; i < copy.length; i += 4) copy[i + 3] = copy[i];
            changed = true;
            return { ...texture, buffer: copy.buffer };
        });
        if (changed) this.library.materials[uuid] = material.materialType === "sprite" ? { ...material, sprites: result } : result[0];
    }

    public getMaterialTextureSize(material: UMaterial): { width: number, height: number } | null {
        if (!material) return null;
        if (!this.materialSizes.has(material.uuid)) this.pullMaterial(material);
        return this.materialSizes.has(material.uuid) ? this.materialSizes.get(material.uuid) : material.loadSelf().getTextureSize();
    }

    public pullStaticLightmap(lightmap: FStaticLightmapTexture): string {
        if (lightmap.uuid in this.library.materials) return lightmap.uuid;

        this.library.materials[lightmap.uuid] = lightmap.getDecodeInfo(this);

        return lightmap.uuid;
    }

    public pullStaticMesh(mesh: UStaticMesh, modifiers?: string[]): IStaticMeshObjectDecodeInfo {
        const kind = "mesh";
        const cached = this.packageCache?.read(mesh, kind, this.library);
        if (cached !== undefined) {
            this.staticMeshMetadata.set(mesh.uuid, cached.metadata);
            for (const uuid of cached.colorMaterials) if (this.library.materials[uuid]) this.library.materials[uuid].color = true;
            return this.getStaticMeshVariant(cached.object, modifiers);
        }
        this.packageCache?.begin(mesh, kind, this.library);
        mesh = mesh.loadSelf();

        const result = mesh.getDecodeInfo(this, this.packageCache ? null : modifiers);

        if (result.geometry) {
            this.library.geometryInstances[result.object.geometry] = 0;
            this.library.geometries[result.object.geometry] = result.geometry;
        }

        for (const [uuid, material] of result.materials)
            this.library.materials[uuid] = material;

        for (const uuid of result.colorMaterials) {
            const material = this.library.materials[uuid];

            if (material) material.color = true;
        }

        const metadata = { renderBounds: mesh.getRenderBoundingBox().getDecodeInfo(), collisionBounds: (mesh as any).collisionModel ? (mesh as any).collisionModel.loadSelf().getCollisionBoundingBox().getDecodeInfo() : null, useVertexColor: mesh.useVertexColor };
        this.staticMeshMetadata.set(mesh.uuid, metadata);
        this.packageCache?.end(mesh, this.library, { object: result.object, metadata, colorMaterials: result.colorMaterials });
        return this.packageCache ? this.getStaticMeshVariant(result.object, modifiers) : result.object;
    }

    protected getStaticMeshVariant(info: IStaticMeshObjectDecodeInfo, modifiers?: string[]): IStaticMeshObjectDecodeInfo {
        if (!modifiers?.length) return info;
        const hash = new StringSet(modifiers).hash();
        const materials = seededUuid(new Uint8Array(new BigUint64Array([hash]).buffer), info.uuid);
        if (!(materials in this.library.materials)) this.library.materials[materials] = { materialType: "instance", baseMaterial: info.uuid, modifiers } as any;
        return { ...info, materials };
    }

    public async preparePackageCache(pkg: APackage): Promise<void> {
        if (!this.packageCache) return;
        const packages = pkg.loader.getDependencies(pkg).filter(path => path !== pkg.loader.getNativePackage().path).map(path => pkg.loader.getPackage(path));
        await this.packageCache.open(packages);
        await this.packageCache.build(packages);
    }

    public getStaticMeshMetadata(mesh: UStaticMesh): any {
        if (!this.staticMeshMetadata.has(mesh.uuid)) this.pullStaticMesh(mesh);
        return this.staticMeshMetadata.get(mesh.uuid);
    }

    public getStaticMeshBounds(mesh: UStaticMesh, owner: UAActor = null, collision: boolean = false): FBox {
        if (collision && owner.isUsingCylinderCollision) return UPrimitive.getCylinderCollisionBoundingBox(owner);
        const metadata = this.getStaticMeshMetadata(mesh);
        const info = metadata.renderBounds;
        let bounds = FBox.make(FVector.make(...info.min), FVector.make(...info.max), info.isValid ? 1 : 0);
        if (!collision) return bounds;
        const transform = owner.localToWorld();
        bounds = bounds.transformBy(transform);
        if (metadata.collisionBounds) {
            const info = metadata.collisionBounds;
            bounds = bounds.addBox(FBox.make(FVector.make(...info.min), FVector.make(...info.max), info.isValid ? 1 : 0).transformBy(transform));
        }
        return bounds;
    }

    public pullSound(sound: USound): { uri: string, data: Uint8Array | Blob, mimeType: string, assetName?: string } | null {
        if (!sound) return null;

        const cached = this.packageCache?.read(sound, "sound", this.library);
        if (cached !== undefined) return cached ? this.library.soundBlobCache.get(sound.name) : null;
        this.packageCache?.begin(sound, "sound", this.library);
        sound = sound.loadSelf();

        const soundKey = sound.name;
        this.library.sounds[soundKey] = soundKey;
        this.library.scriptObjects[soundKey.toLowerCase()] = dumpObjectClass(sound);
        let soundEntry = this.library.soundBlobCache.get(soundKey);

        if (soundEntry) {
            this.packageCache?.end(sound, this.library, true);
            return soundEntry;
        }

        const audioData = sound.getAudioData();

        if (!audioData || audioData.length === 0) {
            this.packageCache?.end(sound, this.library, false);
            return null;
        }

        const fileType = sound.getFileType()?.toLowerCase() ?? "wav";
        const mimeType = fileType === "ogg" ? "audio/ogg" : "audio/wav";

        // Blob URLs are minted by refreshSoundBlobUris on the thread that owns the library.
        soundEntry = { uri: null, data: audioData, mimeType, assetName: sound.name };
        this.library.soundBlobCache.set(soundKey, soundEntry);
        this.packageCache?.end(sound, this.library, true);

        return soundEntry;
    }

    public pullSkeletalMesh(mesh: USkeletalMesh, animations: boolean = true, materials: boolean = true, animationNotifies: boolean = animations): ISkinnedMeshObjectDecodeInfo {
        mesh = mesh.loadSelf();

        if (this.skeletalMeshes.has(mesh.uuid)) return this.skeletalMeshes.get(mesh.uuid);

        const result = mesh.getDecodeInfo(this, animations, materials, animationNotifies);

        this.library.geometries[mesh.uuid] = result.geometry;
        this.library.materials[mesh.uuid] = result.material;
        this.skeletalMeshes.set(mesh.uuid, result.object);

        return result.object;
    }

    public pullModel(model: UModel, levelInfo: ULevelInfo, geometry: boolean): void {
        if (!geometry) {
            const result = model.getZoneDecodeInfo(this.library, levelInfo);

            this.library.bspLeaves.push(...result.bspLeaves);
            this.library.bspZones.push(...result.bspZones);
            Object.assign(this.library.bspZoneIndexMap, result.bspZoneIndexMap);

            return;
        }

        const result = model.getDecodeInfo(this, levelInfo);

        this.library.bspLeaves.push(...result.bspLeaves);
        this.library.bspZones.push(...result.bspZones);
        Object.assign(this.library.bspZoneIndexMap, result.bspZoneIndexMap);

        this.library.bspRootOutside = result.bspRootOutside;
        this.library.bspNodes.push(...result.bspNodes);
        this.library.bspColliders.push(...result.bspColliders);
        this.library.leafActors.push(...result.leafActors);
        this.library.nodeToSection.push(...result.nodeToSection);
        this.library.nodeZoneMasks.push(...result.nodeZoneMasks);
        this.library.bspRenderBounds.push(...result.bspRenderBounds);
        this.library.bspSections.push(...result.bspSections);

        for (const [key, index] of result.bspSectionIndexMap)
            this.library.bspSectionIndexMap.set(key, index);

        for (const [uuid, geometryInfo] of result.geometries)
            this.library.geometries[uuid] = geometryInfo;

        for (const [uuid, materialInfo] of result.materials)
            this.library.materials[uuid] = materialInfo;
    }

    public pullTerrainSector(sector: UTerrainSector, info: ATerrainInfo, heightmap: HeightMapInfo_T): ITerrainSegmentDecodeInfo {
        sector = sector.loadSelf();

        const result = sector.getDecodeInfo(this, info, heightmap);

        if (result.geometry) this.library.geometries[sector.uuid] = result.geometry;
        if (result.material) this.library.materials[sector.uuid] = result.material;

        return result.object;
    }

    public pullTerrainInfo(info: ATerrainInfo): string {
        info = info.loadSelf();

        const result = info.getDecodeInfo(this);
        const zoneInfo = this.library.bspZones[this.library.bspZoneIndexMap[result.zoneUuid]].zoneInfo;

        this.library.materials[info.uuid] = result.material;
        zoneInfo.children.push(result.object);
        zoneInfo.bounds.isValid = true;

        for (const child of result.object.children) {
            const geometry = (child as any).geometry;
            if (!geometry) continue;

            const bounds = this.library.geometries[geometry].bounds;

            if (!bounds.box) continue;

            const { min, max } = bounds.box;

            [[Math.min, zoneInfo.bounds.min], [Math.max, zoneInfo.bounds.max]].forEach(
                ([fn, arr]: [(...values: number[]) => number, Vector3Arr]) => {
                    for (let i = 0; i < 3; i++)
                        arr[i] = fn(arr[i], min[i], max[i]);
                }
            );
        }

        return info.uuid;
    }

    public pullLevel(level: ULevel, sectorName: string): void {
        level = level.loadSelf();
        this.library.levelPackageName = (level as any).pkg.getObjectPath(0);
        this.library.levelObjectName = level.objectName;
        this.library.levelObjectOuter = (level as any).pkg.getObjectPath(level.exp.idPackage);

        const levelInfo = level.levelInfo.loadSelf();
        const batching = this.settings.batching ?? { terrain: true, staticMeshes: true };

        for (const actor of level.getActors()) {
            this.library.levelActorUuids.push(actor ? actor.uuid : null);
            if (!actor) { this.library.levelActors.push(null); continue; }

            actor.loadSelf();
            const info: Pick<IBaseObjectDecodeInfo, "uuid" | "name" | "scriptClassId" | "scriptProperties" | "sharedScriptProperties" | "ownerUuid"> = { uuid: actor.uuid, name: actor.objectName };

            this.setScriptClass(actor, info, true);
            this.library.levelActors.push(info);
        }

        // sectorName is the caller's own key, not level.url.map (stale on some packages, e.g. 23_17)
        const sectorMatch = /^(\d+)_(\d+)$/.exec(sectorName);

        this.library.brightness = levelInfo.brightness;
        this.library.levelInfo = levelInfo.getDecodeInfo(this.library);
        this.setScriptClass(levelInfo, this.library.levelInfo);
        const physicsVolume = levelInfo.physicsVolume ? levelInfo.physicsVolume.loadSelf() : null;
        if (physicsVolume) {
            this.library.levelInfo.physicsVolume = physicsVolume.getDecodeInfo(this.library);
            this.setScriptClass(physicsVolume, this.library.levelInfo.physicsVolume);
        }
        // Engine.dll MultiPointCheck 0x85f530..0x85f533: BSP hits return LevelInfo.
        this.library.levelInfoCollisionRadius = levelInfo.collisionRadius;
        this.library.name = level.url.map;
        this.library.isSkyLevel = this.settings.isSkyLevel === true;
        this.library.helpersZoneBounds = this.settings.helpersZoneBounds === true;
        this.library.batching.terrain = batching.terrain !== false;
        this.library.batching.staticMeshes = batching.staticMeshes !== false;

        if (sectorMatch)
            this.library.sector = [parseInt(sectorMatch[1], 10), parseInt(sectorMatch[2], 10)];

        const model = level.getModel().setLevelInfo(levelInfo).loadSelf();

        this.pullModel(model, levelInfo, this.settings.loadBaseModel !== false);
        const zoneActors = new Set<FZoneInfo>([levelInfo]);

        for (let i = 0; i < this.library.bspZones.length; i++) {
            const actor = model.getZoneActor(i).loadSelf();
            this.setScriptClass(actor, this.library.bspZones[i].zoneInfo);
            zoneActors.add(actor);
        }

        this.pullActors(level);
        this.pullScriptDumps(level.getActors(), level.getAmbientActors(), zoneActors, physicsVolume ? [physicsVolume] : []);
    }

    public pullScriptClasses(classes: Iterable<UClass>): void {
        pullScriptClasses(this.library, classes);
    }
    public pullScriptClassFunctions(classes: Iterable<UClass>): void { pullScriptClassFunctions(this.library, classes); }

    public pullScriptDumps(...actorLists: Iterable<UObject>[]): void {
        pullScriptDumps(this.library, ...actorLists);
    }

    public pullActors(level: ULevel): void {
        const actors = new Set<UAActor>(level.getActors());

        if (this.settings.loadAudio)
            for (const actor of level.getAmbientActors())
                actors.add(actor);

        for (const actor of actors) {
            if (!actor) continue;

            if ((actor as any).isPhysicsVolume) {
                const volume = actor.loadSelf() as UPhysicsVolume;
                this.pullVolumeCollisionActor(volume);
                const volumeInfo = volume.getDecodeInfo(this.library);

                this.setScriptClass(volume, volumeInfo);
                this.library.physicsVolumes.push(volumeInfo);
                if (volumeInfo.type === "WaterVolume" && volumeInfo.bsp) this.library.waterVolumes.push(volumeInfo as any);
                continue;
            }

            switch (actor.constructor.friendlyName) {
                case "TerrainInfo": {
                    if (this.settings.loadTerrain !== false)
                        this.pullTerrainInfo(actor.loadSelf() as ATerrainInfo);
                    break;
                }
                case "NSun":
                case "NMoon": {
                    if (this.settings.isSkyLevel === true) {
                        const celestial = actor.loadSelf() as UNSun | UNMoon;

                        this.library.celestials.push(celestial.getDecodeInfo(this));
                    }
                    break;
                }
                case "SkyZoneInfo": {
                    const skyZone = actor.loadSelf() as FZoneInfo;

                    this.library.skyZoneInfos.push(skyZone.getDecodeInfo(this.library));
                    break;
                }
                case "L2FogInfo": {
                    const fog = actor.loadSelf() as UL2FogInfo;

                    this.library.fogInfos.push(fog.getDecodeInfo(this));
                    break;
                }
                case "Emitter": {
                    if (this.settings.loadEmitters === false) break;

                    const emitter = actor.loadSelf() as UEmitter;
                    const emitterList = this.settings.loadEmitterList;

                    if (emitterList && emitterList.length) {
                        const entry = emitterList.find(e => e.name === emitter.objectName);

                        if (!entry) break;

                        emitter.setSubEmitterFilter(entry.emitters ?? null);
                    }

                    if (!emitter.isDeleteMe) this.pullEmitter(emitter);
                    break;
                }
                case "Pawn": {
                    try {
                        const pawn = actor.loadSelf() as UPawn;

                        if (pawn.isDeleteMe) break;

                        const pawnInfo = pawn.getDecodeInfo(this);

                        if (pawnInfo) {
                            this.setScriptClass(pawn, pawnInfo);
                            this.library.pawnActors.push(pawnInfo);
                        }
                    } catch (e) {
                        console.warn(`Pawn '${actor.objectName}' failed to decode`, e);
                    }
                    break;
                }
                case "StaticMeshActor":
                case "Mover":
                case "MovableStaticMeshActor": {
                    const staticMeshActor = actor.loadSelf() as UStaticMeshActor;

                    if (!staticMeshActor.isDeleteMe && staticMeshActor.isCollidingActors && staticMeshActor.mesh) {
                        const mesh = staticMeshActor.mesh as UStaticMesh;
                        this.library.staticMeshCollisionActors.push({ uuid: actor.uuid, name: actor.objectName, position: staticMeshActor.location.getElements(), collisionBounds: this.getStaticMeshBounds(mesh, staticMeshActor, true).getDecodeInfo(), collision: staticMeshActor.getCollisionDecodeInfo() });
                    }

                    if (this.settings.loadStaticModels === false) break;

                    const staticMeshList = this.settings.loadStaticModelList;

                    if (staticMeshList && staticMeshList.length && !staticMeshList.some(i => typeof i === "number" ? i === actor.exportIndex + 1 : i === actor.objectName))
                        break;

                    if (!staticMeshActor.isDeleteMe) this.pullStaticMeshActor(staticMeshActor);
                    break;
                }
                case "Light":
                case "NMovableSunLight": {
                    const light = actor.loadSelf() as ULight;

                    if (!light.isDeleteMe) this.library.lightActors.push(light.getDecodeInfo(this.library));
                    break;
                }
                case "BlockingVolume": {
                    const volume = actor.loadSelf() as UBlockingVolume;
                    this.pullVolumeCollisionActor(volume);

                    if (!volume.isDeleteMe) {
                        const volumeInfo = volume.getDecodeInfo();

                        this.setScriptClass(volume, volumeInfo);
                        this.library.blockingVolumes.push(volumeInfo);
                    }
                    break;
                }
                case "MusicVolume": {
                    const music = actor.loadSelf() as UMusicVolume;
                    this.pullVolumeCollisionActor(music);

                    const musicInfo = music.getDecodeInfo(this.library);

                    this.setScriptClass(music, musicInfo);
                    if (this.settings.loadAudio !== false) this.library.audioList.push(musicInfo);
                    this.library.musicVolumes.push(musicInfo);
                    break;
                }
                case "AmbientSoundObject": {
                    if (this.settings.loadAudio === false) break;

                    const ambientSound = actor.loadSelf() as UAmbientSoundObject;
                    const soundInfo = ambientSound.getDecodeInfo(this);

                    if (soundInfo) this.library.ambientSounds.push(soundInfo);
                    break;
                }
            }
        }
    }

    protected pullVolumeCollisionActor(volume: UVolume): void {
        if (volume.isDeleteMe || !volume.isCollidingActors) return;

        const bounds = volume.brush ? volume.brush.loadSelf().getCollisionBoundingBox(volume) : UPrimitive.getCylinderCollisionBoundingBox(volume);
        this.library.volumeCollisionActors.push({ uuid: volume.uuid, name: volume.objectName, position: volume.location.getElements(), collisionBounds: bounds.getDecodeInfo(), collision: volume.getCollisionDecodeInfo() });
    }

    public pullStaticMeshActor(actor: UStaticMeshActor): void {
        const result = actor.getDecodeInfo(this);

        if (!result) return;

        this.setScriptClass(actor, result.object, true);

        this.library.exportedActors.add(actor.uuid);
        this.library.geometryInstances[result.geometryUuid]++;

        const zoneInfo = this.library.bspZones[this.library.bspZoneIndexMap[result.zoneUuid]].zoneInfo;

        if (!this.library.isSkyLevel && zoneInfo.type === "Sky") zoneInfo.children.push(result.object);
        else for (const leafIndex of result.leafIndices)
            if (this.library.leafActors[leafIndex])
                this.library.leafActors[leafIndex].push(result.object);

        if (!result.zoneBounds) return;

        zoneInfo.bounds.isValid = true;

        [[Math.min, zoneInfo.bounds.min], [Math.max, zoneInfo.bounds.max]].forEach(
            ([fn, arr]: [(...values: number[]) => number, Vector3Arr]) => {
                const values = fn === Math.min ? result.zoneBounds.min : result.zoneBounds.max;

                for (let i = 0; i < 3; i++)
                    arr[i] = fn(arr[i], values[i]);
            }
        );
    }

    public pullEmitter(actor: UEmitter): void {
        const result = actor.getDecodeInfo(this);

        this.setScriptClass(actor, result.object);

        for (const leafIndex of result.leafIndices)
            if (this.library.leafActors[leafIndex])
                this.library.leafActors[leafIndex].push(result.object);

        this.library.allEmitterActors.push(result.object);

        const zoneInfo = this.library.bspZones[this.library.bspZoneIndexMap[result.zoneUuid]].zoneInfo;

        zoneInfo.children.push(result.object);
    }

    protected setScriptClass(actor: UObject, info: Pick<IBaseObjectDecodeInfo, "scriptClassId" | "scriptProperties" | "sharedScriptProperties" | "ownerUuid">, shareProperties: boolean = false): void {
        const cls = (actor.constructor as any).hostClass as UClass;

        if (!cls) return;

        const owner = actor.propertyDict.get("Owner") as UAActor;

        info.scriptClassId = cls.name;
        if (shareProperties) {
            const ctor = actor.constructor;
            let shared = this.cacheSharedScriptProperties.get(ctor);

            if (shared) info.scriptProperties = dumpObjectScriptProperties(actor, this.cacheScriptDefaults, shared.overrides);
            else {
                const properties = dumpObjectScriptProperties(actor, this.cacheScriptDefaults);
                const layout = (ctor as any)._classLayout as Map<string, any>;

                if (!layout) throw new Error(`Script class '${ctor.name}' has no property layout.`);

                shared = { properties: {}, overrides: new Set() };

                for (const name of Map.prototype.keys.call(actor.propertyDict))
                    if (layout.has(name)) shared.overrides.add(name);
                info.scriptProperties = {};

                for (const name of Object.keys(properties)) {
                    if (layout.has(name)) shared.properties[name] = properties[name];
                    else info.scriptProperties[name] = properties[name];
                }
                this.cacheSharedScriptProperties.set(ctor, shared);
            }
            info.sharedScriptProperties = shared.properties;
            info.scriptProperties.bStatic = actor.propertyDict.get("bStatic");
            info.scriptProperties.bAlwaysRelevant = actor.propertyDict.get("bAlwaysRelevant");
        } else info.scriptProperties = dumpObjectScriptProperties(actor, this.cacheScriptDefaults);
        if (this.library.levelPackageName) info.scriptProperties.Outer = (actor as any).pkg.getObjectPath(actor.exp.idPackage);
        info.ownerUuid = owner ? owner.uuid : null;
    }
}

export default DecodeLibraryBuilder;
