import type { UClass, UObject } from "@l2js/core";
import DecodeLibrary from "./decode-library";
import pullScriptDumps, { dumpObjectScriptProperties, pullScriptClasses } from "./script-dump-loader";
import type { HeightMapInfo_T, UTerrainSector } from "./un-terrain-sector";
import type UPhysicsVolume from "./un-physics-volume";
import type { UMaterial } from "./un-material";
import type { FStaticLightmapTexture } from "./model/un-multilightmap-texture";
import type { UStaticMesh } from "./static-mesh/un-static-mesh";
import type { USound } from "./un-sound";
import type { USkeletalMesh } from "./skeletal-mesh/un-skeletal-mesh";
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
import type { UAmbientSoundObject } from "./un-ambient-sound";

class DecodeLibraryBuilder {
    public readonly library: DecodeLibrary;

    protected readonly materialsLoading = new Set<string>();
    protected readonly skeletalMeshes = new Map<string, GD.ISkinnedMeshObjectDecodeInfo>();
    protected readonly settings: GD.LoadSettings_T;

    public constructor(library: DecodeLibrary, settings: GD.LoadSettings_T) {

        this.library = library;
        this.settings = settings;
    }

    public isLoadingExtendedBoneInfluences() { return this.settings.loadExtendedBoneInfluences !== false; }

    public pullMaterial(material: UMaterial): string {
        if (!material) return null;

        material = material.loadSelf();

        if (material.uuid in this.library.materials) return material.uuid;
        if (this.materialsLoading.has(material.uuid)) return material.uuid;

        this.materialsLoading.add(material.uuid);

        const info = material.getDecodeInfo(this);

        this.materialsLoading.delete(material.uuid);

        if (typeof info === "string") return info;
        if (!info) return null;

        this.library.materials[material.uuid] = info;

        return material.uuid;
    }

    public pullStaticLightmap(lightmap: FStaticLightmapTexture): string {
        if (lightmap.uuid in this.library.materials) return lightmap.uuid;

        this.library.materials[lightmap.uuid] = lightmap.getDecodeInfo(this);

        return lightmap.uuid;
    }

    public pullStaticMesh(mesh: UStaticMesh, modifiers?: string[]): GD.IStaticMeshObjectDecodeInfo {
        mesh = mesh.loadSelf();

        const result = mesh.getDecodeInfo(this, modifiers);

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

        return result.object;
    }

    public pullSound(sound: USound): { uri: string, data: Uint8Array, mimeType: string } | null {
        if (!sound) return null;

        sound = sound.loadSelf();

        const soundKey = sound.objectName ?? sound.uuid;
        let soundEntry = this.library.soundBlobCache.get(soundKey);

        if (soundEntry) return soundEntry;

        const audioData = sound.getAudioData();

        if (!audioData || audioData.length === 0) return null;

        const fileType = sound.getFileType()?.toLowerCase() ?? "wav";
        const mimeType = fileType === "ogg" ? "audio/ogg" : "audio/wav";

        // Blob URLs are minted by refreshSoundBlobUris on the thread that owns the library.
        soundEntry = { uri: null, data: audioData, mimeType };
        this.library.soundBlobCache.set(soundKey, soundEntry);

        return soundEntry;
    }

    public pullSkeletalMesh(mesh: USkeletalMesh, animations: boolean = true, materials: boolean = true, animationNotifies: boolean = animations): GD.ISkinnedMeshObjectDecodeInfo {
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

    public pullTerrainSector(sector: UTerrainSector, info: ATerrainInfo, heightmap: HeightMapInfo_T): GD.ITerrainSegmentDecodeInfo {
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
                ([fn, arr]: [(...values: number[]) => number, GD.Vector3Arr]) => {
                    for (let i = 0; i < 3; i++)
                        arr[i] = fn(arr[i], min[i], max[i]);
                }
            );
        }

        return info.uuid;
    }

    public pullLevel(level: ULevel, sectorName: string): void {
        level = level.loadSelf();

        const levelInfo = level.levelInfo.loadSelf();
        const batching = this.settings.batching ?? { terrain: true, staticMeshes: true };

        // sectorName is the caller's own key, not level.url.map (stale on some packages, e.g. 23_17)
        const sectorMatch = /^(\d+)_(\d+)$/.exec(sectorName);

        this.library.brightness = levelInfo.brightness;
        this.library.name = level.url.map;
        this.library.isSkyLevel = this.settings.isSkyLevel === true;
        this.library.helpersZoneBounds = this.settings.helpersZoneBounds === true;
        this.library.batching.terrain = batching.terrain !== false;
        this.library.batching.staticMeshes = batching.staticMeshes !== false;

        if (sectorMatch)
            this.library.sector = [parseInt(sectorMatch[1], 10), parseInt(sectorMatch[2], 10)];

        const model = level.getModel().setLevelInfo(levelInfo).loadSelf();

        this.pullModel(model, levelInfo, this.settings.loadBaseModel !== false);
        this.pullActors(level);
        this.pullScriptDumps(level.getActors(), level.getAmbientActors());
    }

    public pullScriptClasses(classes: Iterable<UClass>): void {
        pullScriptClasses(this.library, classes);
    }

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
                const volumeInfo = volume.getDecodeInfo(this.library);

                if (volumeInfo) {
                    this.setScriptClass(volume, volumeInfo);
                    this.library.waterVolumes.push(volumeInfo);
                }
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
                    if (this.settings.loadStaticModels === false) break;

                    const staticMeshList = this.settings.loadStaticModelList;

                    if (staticMeshList && staticMeshList.length && !staticMeshList.some(i => typeof i === "number" ? i === actor.exportIndex + 1 : i === actor.objectName))
                        break;

                    const staticMeshActor = actor.loadSelf() as UStaticMeshActor;

                    if (!staticMeshActor.isDeleteMe) this.pullStaticMeshActor(staticMeshActor);
                    break;
                }
                case "Light":
                case "NMovableSunLight": {
                    const light = actor.loadSelf() as ULight;

                    if (!light.isDeleteMe) this.library.lightActors.push(light.getDecodeInfo(this.library));
                    break;
                }
                case "MusicVolume": {
                    if (this.settings.loadAudio === false) break;

                    const music = actor.loadSelf() as UMusicVolume;
                    const musicInfo = music.getDecodeInfo(this.library);

                    this.library.audioList.push(musicInfo);
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

    public pullStaticMeshActor(actor: UStaticMeshActor): void {
        const result = actor.getDecodeInfo(this);

        if (!result) return;

        this.setScriptClass(actor, result.object);

        for (const leafIndex of result.leafIndices)
            if (this.library.leafActors[leafIndex])
                this.library.leafActors[leafIndex].push(result.object);

        this.library.exportedActors.add(actor.uuid);
        this.library.geometryInstances[result.geometryUuid]++;

        if (!result.zoneBounds) return;

        const zoneInfo = this.library.bspZones[this.library.bspZoneIndexMap[result.zoneUuid]].zoneInfo;

        zoneInfo.bounds.isValid = true;

        [[Math.min, zoneInfo.bounds.min], [Math.max, zoneInfo.bounds.max]].forEach(
            ([fn, arr]: [(...values: number[]) => number, GD.Vector3Arr]) => {
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

    protected setScriptClass(actor: UObject, info: GD.IBaseObjectDecodeInfo): void {
        const cls = (actor.constructor as any).hostClass as UClass;

        if (!cls) return;

        info.scriptClassId = cls.name;
        info.scriptProperties = dumpObjectScriptProperties(actor);
    }
}

export default DecodeLibraryBuilder;
export { DecodeLibraryBuilder };
