import DecodeLibrary from "./decode-library";
import pullScriptDumps, { pullScriptClasses } from "./script-dump-loader";
import type { HeightMapInfo_T } from "./un-terrain-sector";
import type UPhysicsVolume from "./un-physics-volume";

class DecodeLibraryBuilder {
    public readonly library: DecodeLibrary;

    protected readonly materialsLoading = new Set<string>();
    protected readonly skeletalMeshes = new Map<string, GD.ISkinnedMeshObjectDecodeInfo>();
    protected readonly settings: GD.LoadSettings_T;

    public constructor(library: DecodeLibrary, settings: GD.LoadSettings_T) {

        this.library = library;
        this.settings = settings;
    }

    public pullMaterial(material: GA.UMaterial): string {
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

    public pullStaticLightmap(lightmap: GA.FStaticLightmapTexture): string {
        if (lightmap.uuid in this.library.materials) return lightmap.uuid;

        this.library.materials[lightmap.uuid] = lightmap.getDecodeInfo(this);

        return lightmap.uuid;
    }

    public pullStaticMesh(mesh: GA.UStaticMesh, modifiers?: string[]): GD.IStaticMeshObjectDecodeInfo {
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

    public pullSound(sound: GA.USound): { uri: string, data: Uint8Array, mimeType: string } | null {
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

    public pullSkeletalMesh(mesh: GA.USkeletalMesh, animations: boolean = true, materials: boolean = true, animationNotifies: boolean = animations): GD.ISkinnedMeshObjectDecodeInfo {
        mesh = mesh.loadSelf();

        if (this.skeletalMeshes.has(mesh.uuid)) return this.skeletalMeshes.get(mesh.uuid);

        const result = mesh.getDecodeInfo(this, animations, materials, animationNotifies);

        this.library.geometries[mesh.uuid] = result.geometry;
        this.library.materials[mesh.uuid] = result.material;
        this.skeletalMeshes.set(mesh.uuid, result.object);

        return result.object;
    }

    public pullModel(model: GA.UModel, levelInfo: GA.ULevelInfo, geometry: boolean): void {
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

    public pullTerrainSector(sector: GA.UTerrainSector, info: GA.ATerrainInfo, heightmap: HeightMapInfo_T): GD.ITerrainSegmentDecodeInfo {
        sector = sector.loadSelf();

        const result = sector.getDecodeInfo(this, info, heightmap);

        if (result.geometry) this.library.geometries[sector.uuid] = result.geometry;
        if (result.material) this.library.materials[sector.uuid] = result.material;

        return result.object;
    }

    public pullTerrainInfo(info: GA.ATerrainInfo): string {
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

    public pullLevel(level: GA.ULevel, sectorName: string): void {
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

    public pullScriptClasses(classes: Iterable<C.UClass>): void {
        pullScriptClasses(this.library, classes);
    }

    public pullScriptDumps(...actorLists: Iterable<C.UObject>[]): void {
        pullScriptDumps(this.library, ...actorLists);
    }

    public pullActors(level: GA.ULevel): void {
        const actors = new Set<GA.AActor>(level.getActors());

        if (this.settings.loadAudio !== false)
            for (const actor of level.getAmbientActors())
                actors.add(actor);

        for (const actor of actors) {
            if (!actor) continue;

            if ((actor as any).isPhysicsVolume) {
                const volumeInfo = (actor.loadSelf() as UPhysicsVolume).getDecodeInfo(this.library);

                if (volumeInfo) this.library.waterVolumes.push(volumeInfo);
                continue;
            }

            switch (actor.constructor.friendlyName) {
                case "TerrainInfo": {
                    if (this.settings.loadTerrain !== false)
                        this.pullTerrainInfo(actor.loadSelf() as GA.ATerrainInfo);
                    break;
                }
                case "NSun":
                case "NMoon": {
                    if (this.settings.isSkyLevel === true) {
                        const celestial = actor.loadSelf() as GA.UNSun | GA.UNMoon;

                        this.library.celestials.push(celestial.getDecodeInfo(this));
                    }
                    break;
                }
                case "SkyZoneInfo": {
                    const skyZone = actor.loadSelf() as GA.FZoneInfo;

                    this.library.skyZoneInfos.push(skyZone.getDecodeInfo(this.library));
                    break;
                }
                case "L2FogInfo": {
                    const fog = actor.loadSelf() as GA.UL2FogInfo;

                    this.library.fogInfos.push(fog.getDecodeInfo(this));
                    break;
                }
                case "Emitter": {
                    if (this.settings.loadEmitters === false) break;

                    const emitter = actor.loadSelf() as GA.UEmitter;
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
                        const pawn = actor.loadSelf() as GA.UPawn;

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

                    const staticMeshActor = actor.loadSelf() as GA.UStaticMeshActor;

                    if (!staticMeshActor.isDeleteMe) this.pullStaticMeshActor(staticMeshActor);
                    break;
                }
                case "Light":
                case "NMovableSunLight": {
                    const light = actor.loadSelf() as GA.ULight;

                    if (!light.isDeleteMe) this.library.lightActors.push(light.getDecodeInfo(this.library));
                    break;
                }
                case "MusicVolume": {
                    if (this.settings.loadAudio === false) break;

                    const music = actor.loadSelf() as GA.UMusicVolume;
                    const musicInfo = music.getDecodeInfo(this.library);

                    this.library.audioList.push(musicInfo);
                    this.library.musicVolumes.push(musicInfo);
                    break;
                }
                case "AmbientSoundObject": {
                    if (this.settings.loadAudio === false) break;

                    const ambientSound = actor.loadSelf() as GA.UAmbientSoundObject;
                    const soundInfo = ambientSound.getDecodeInfo(this);

                    if (soundInfo) this.library.ambientSounds.push(soundInfo);
                    break;
                }
            }
        }
    }

    public pullStaticMeshActor(actor: GA.UStaticMeshActor): void {
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

    public pullEmitter(actor: GA.UEmitter): void {
        const result = actor.getDecodeInfo(this);

        this.setScriptClass(actor, result.object);

        for (const leafIndex of result.leafIndices)
            if (this.library.leafActors[leafIndex])
                this.library.leafActors[leafIndex].push(result.object);

        this.library.allEmitterActors.push(result.object);

        const zoneInfo = this.library.bspZones[this.library.bspZoneIndexMap[result.zoneUuid]].zoneInfo;

        zoneInfo.children.push(result.object);
    }

    protected setScriptClass(actor: C.UObject, info: GD.IBaseObjectDecodeInfo): void {
        const cls = (actor.constructor as any).hostClass as C.UClass;

        if (cls) info.scriptClassId = cls.name;
    }
}

export default DecodeLibraryBuilder;
export { DecodeLibraryBuilder };
