import DecodeWorkerClient from "../assets/decode-worker/decode-worker-client";
import type DecodeLibrary from "../assets/unreal/decode-library";
import type { LoadSettings_T } from "@l2js/engine/contracts/config";
import type { ICharacterArmorSelection, INpcDefinition } from "@l2js/engine/contracts/pawn";

type NpcPreload_T = { library: Promise<DecodeLibrary> };

export class SkillViewerDecodeWorkerClient extends DecodeWorkerClient {
    protected readonly cacheNpcPreloads = new Map<number, NpcPreload_T>();
    protected readonly arrCharacterPreloads: Promise<DecodeLibrary>[] = [];
    protected characterPoolSize = 0;
    protected characterSettings: LoadSettings_T = null;
    protected isEnterEventEnabled = true;
    protected readonly arrUsedLibraries: DecodeLibrary[] = [];
    protected readonly consumedAnimationSets = new Set<string>();

    public setEnterEventEnabled(enabled: boolean): void { this.isEnterEventEnabled = enabled; }

    public async resolveNpc(selector: string | number): Promise<INpcDefinition> {
        const npc = await super.resolveNpc(selector);

        return this.isEnterEventEnabled ? npc : Object.assign({}, npc, { enterEvent: null });
    }

    public preloadNpcs(settings: LoadSettings_T, npcs: readonly INpcDefinition[]): void {
        for (const [id, preload] of this.cacheNpcPreloads) {
            if (npcs.some(npc => npc.id === id)) continue;

            this.cacheNpcPreloads.delete(id);
            void this.releasePreload(preload);
        }

        for (const npc of npcs) {
            if (this.cacheNpcPreloads.has(npc.id)) continue;

            const index = npc.mesh.indexOf(".");

            if (index < 0) throw new Error(`NPC '${npc.id}' has invalid mesh path '${npc.mesh}'.`);

            const packageName = npc.mesh.slice(0, index), meshName = npc.mesh.slice(index + 1);
            const library = super.decodeSkeletalMesh(settings, packageName, meshName, npc.className, npc.textures, npc.id);

            void reportPreloadFailure(npc, library);

            this.cacheNpcPreloads.set(npc.id, { library });
        }
    }

    public preloadCharacters(settings: LoadSettings_T, count: number): void {
        this.characterSettings = settings;
        this.characterPoolSize = count;

        while (this.arrCharacterPreloads.length < count) this.arrCharacterPreloads.push(super.decodeCharacter(settings));
    }

    public decodeSkeletalMesh(settings: LoadSettings_T, packageName: string, meshName: string, scriptClassPath: string = null, texturePaths: string[] = [], npcId: number = null): Promise<DecodeLibrary> {
        const preload = npcId === null ? null : this.cacheNpcPreloads.get(npcId);

        if (preload) this.cacheNpcPreloads.delete(npcId);

        return this.consumeSkeletalMesh(preload ? preload.library : super.decodeSkeletalMesh(settings, packageName, meshName, scriptClassPath, texturePaths, npcId), settings, packageName, meshName, scriptClassPath, texturePaths, npcId);
    }

    // animations travel only with the first decode of a set, and only a consumed library reaches decodeObject3D's cache
    protected async consumeSkeletalMesh(pending: Promise<DecodeLibrary>, settings: LoadSettings_T, packageName: string, meshName: string, scriptClassPath: string, texturePaths: string[], npcId: number): Promise<DecodeLibrary> {
        const animationSet = `${packageName}.${meshName}`.toLowerCase();
        let library = await pending;

        if (npcId !== null && !this.consumedAnimationSets.has(animationSet) && !hasAnimations(library)) {
            revokeSounds(library);
            this.npcAnimationSets.delete(animationSet);
            library = await super.decodeSkeletalMesh(settings, packageName, meshName, scriptClassPath, texturePaths, npcId);
        }

        if (hasAnimations(library)) this.consumedAnimationSets.add(animationSet);

        this.arrUsedLibraries.push(library);

        return library;
    }

    public decodeCharacter(settings: LoadSettings_T, charIndex: number = 1, faceVariant: number = 0, hairVariant: number = 0, hairColour: number = 0, armor: ICharacterArmorSelection = { chest: 0, legs: 0, gloves: 0, boots: 0 }): Promise<DecodeLibrary> {
        const isDefault = charIndex === 1 && faceVariant === 0 && hairVariant === 0 && hairColour === 0 && !armor.chest && !armor.legs && !armor.gloves && !armor.boots;

        if (!isDefault || this.arrCharacterPreloads.length === 0) return this.trackLibrary(super.decodeCharacter(settings, charIndex, faceVariant, hairVariant, hairColour, armor));

        const library = this.arrCharacterPreloads.shift();

        this.preloadCharacters(this.characterSettings, this.characterPoolSize);

        return this.trackLibrary(library);
    }

    public takeUsedLibraries(): DecodeLibrary[] { return this.arrUsedLibraries.splice(0); }

    protected async trackLibrary(pending: Promise<DecodeLibrary>): Promise<DecodeLibrary> {
        const library = await pending;

        this.arrUsedLibraries.push(library);

        return library;
    }

    protected async releasePreload(preload: NpcPreload_T): Promise<void> {
        try {
            revokeSounds(await preload.library);
        } catch {
            return;
        }
    }
}

function hasAnimations(library: DecodeLibrary): boolean { return library.pawnActors.some(info => Object.keys(info.animations).length > 0); }

function revokeSounds(library: DecodeLibrary): void {
    for (const sound of library.soundBlobCache.values())
        if (sound.uri) URL.revokeObjectURL(sound.uri);
}

async function reportPreloadFailure(npc: INpcDefinition, library: Promise<DecodeLibrary>): Promise<void> {
    try {
        await library;
    } catch (e) {
        console.error(`[skill-viewer] preloading NPC '${npc.id}' ${npc.name} failed: ${(e as Error).message}`);
    }
}

export default SkillViewerDecodeWorkerClient;
