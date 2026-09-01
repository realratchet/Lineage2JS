import { IEngineComponent } from "../game/components";
import type GameManager from "../game/game-manager";
import { randInt } from "three/src/math/MathUtils";
import type AmbientSoundComponent from "./components/ambient-sound-component";

const replaceBytes = new Uint8Array("OggS".split("").map(x => x.charCodeAt(0)));
const MAX_AUDIOCHANNELS = 32, ROLLOFF = 0.5; // hardcoded from l2.ini
const AL_SOURCE_RADIUS_FALLBACK = 10; // ALAudioSubsystem::PlaySound uses 10 when Radius is zero.

type AmbientInfo_T = {
    dataUri: string,
    soundName: string,
    position: [number, number, number],
    volume: number,
    pitch: number,
    refDistance: number,
    maxDistance: number,
    looping: boolean
};

type AmbientChannel_T = {
    source?: AudioBufferSourceNode,
    panner?: PannerNode,
    gain?: GainNode,
    priority: number,
    info: AmbientInfo_T
};

type AmbientCandidate_T = { component: AmbientSoundComponent, priority: number };

export class AudioManager implements IEngineComponent<GameManager> {
    protected readonly musicFiles: Record<number, string[]> = {};
    protected audioContext: AudioContext;
    protected masterGain: GainNode;
    protected soundscapeGainNode: GainNode;
    protected musicGainNode: GainNode;
    protected ambientGainNode: GainNode;
    protected effectsGainNode: GainNode;
    protected unlocked = false;
    protected currentSource?: AudioBufferSourceNode;
    protected currentGain?: GainNode;
    protected currentIndex?: number;
    protected playingIndex?: number;
    protected currentIsLooped = false;
    protected nextBuffer?: AudioBuffer;
    protected nextMusicTrackTime?: number;
    protected nextMusicPlayId?: number;
    protected fadeEndTime?: number;
    protected lastTime = 0;
    protected prevTime = 0;
    protected underwaterSoundUri: string = null;
    protected underwaterSource: AudioBufferSourceNode = null;
    protected underwaterGain: GainNode = null;
    protected underwaterPlayId = 0;
    protected isUnderwater = false;

    protected currentPlayId = 0;

    protected gameManager: GameManager;
    public setParent(parent: GameManager): this { this.gameManager = parent; return this; }
    public getParent(): GameManager { return this.gameManager; }

    public constructor() {
        this.audioContext = new AudioContext();

        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 1;

        this.soundscapeGainNode = this.audioContext.createGain();
        this.soundscapeGainNode.connect(this.masterGain);
        this.soundscapeGainNode.gain.value = 1;

        this.musicGainNode = this.audioContext.createGain();
        this.musicGainNode.connect(this.soundscapeGainNode);
        this.musicGainNode.gain.value = 0.1;

        this.ambientGainNode = this.audioContext.createGain();
        this.ambientGainNode.connect(this.soundscapeGainNode);
        this.ambientGainNode.gain.value = 0.3;

        this.effectsGainNode = this.audioContext.createGain();
        this.effectsGainNode.connect(this.masterGain);
        this.effectsGainNode.gain.value = 0.3;

        this.setupUnlock();
    }

    public get musicVolume(): number { return this.musicGainNode.gain.value; }
    public set musicVolume(v: number) { this.musicGainNode.gain.value = v; }

    public get ambientVolume(): number { return this.ambientGainNode.gain.value; }
    public set ambientVolume(v: number) {
        this.ambientGainNode.gain.value = v;
        this.effectsGainNode.gain.value = v;
    }

    public setMusicInfo(musicAssets: Record<number, string[]>) {
        Object.assign(this.musicFiles, musicAssets);
    }

    public setUnderwaterLoopSound(dataUri: string): void {
        if (this.underwaterSoundUri === dataUri) return;

        this.stopUnderwaterLoop();
        this.underwaterSoundUri = dataUri;

        if (this.isUnderwater) this.startUnderwaterLoop(++this.underwaterPlayId);
    }

    public setUnderwater(isUnderwater: boolean): void {
        if (this.isUnderwater === isUnderwater) return;

        this.isUnderwater = isUnderwater;

        const now = this.audioContext.currentTime;
        const gain = this.soundscapeGainNode.gain;

        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        gain.linearRampToValueAtTime(isUnderwater ? 0 : 1, now + 0.15);

        if (isUnderwater) {
            if (this.underwaterSoundUri) this.startUnderwaterLoop(++this.underwaterPlayId);
        } else {
            this.stopUnderwaterLoop();
        }
    }

    protected async startUnderwaterLoop(playId: number): Promise<void> {
        const dataUri = this.underwaterSoundUri;

        await this.ensureUnlocked();

        const buffer = await this.loadAmbientBuffer(dataUri);

        if (!buffer || !this.isUnderwater || dataUri !== this.underwaterSoundUri || playId !== this.underwaterPlayId) return;

        this.stopUnderwaterSource();

        const source = this.audioContext.createBufferSource();
        const gain = this.audioContext.createGain();

        source.buffer = buffer;
        source.loop = true;
        source.connect(gain);
        gain.connect(this.masterGain);
        source.start(0);

        this.underwaterSource = source;
        this.underwaterGain = gain;
    }

    protected stopUnderwaterLoop(): void {
        this.underwaterPlayId++;
        this.stopUnderwaterSource();
    }

    protected stopUnderwaterSource(): void {
        if (this.underwaterSource) {
            try { this.underwaterSource.stop(); } catch { }
            this.underwaterSource.disconnect();
            this.underwaterSource = null;
        }

        if (this.underwaterGain) {
            this.underwaterGain.disconnect();
            this.underwaterGain = null;
        }
    }

    public async playMusic(index: number, isLooped: boolean = false, isForced: boolean = false, currentTime?: number) {
        const time = currentTime ?? this.lastTime;

        if (this.playingIndex === index && (this.currentSource || this.nextMusicTrackTime !== undefined)) {
            this.currentIndex = index;
            this.currentIsLooped = isLooped;
            return;
        }

        if (!isForced && this.playingIndex !== undefined && (this.currentSource || this.nextMusicTrackTime !== undefined)) {
            // console.log(`[Music] Queuing track ${index} (not forced)`);
            this.currentIndex = index;
            this.currentIsLooped = isLooped;
            this.preloadNext(index);
            return;
        }

        const playId = ++this.currentPlayId;
        // console.log(`[Music] playMusic index=${index} forced=${isForced} playId=${playId}`);

        await this.ensureUnlocked();
        if (this.currentPlayId !== playId) return;

        const wasPlaying = !!this.currentSource || (this.fadeEndTime !== undefined && time < this.fadeEndTime);

        await this.stopMusicInternal(false, time);

        this.currentIndex = index;
        this.playingIndex = index;
        this.currentIsLooped = isLooped;

        if (wasPlaying && isForced) {
            // console.log(`[Music] Fading out old track, scheduling ${index} in 500ms...`);
            this.nextMusicTrackTime = time + 500;
            this.nextMusicPlayId = playId;
            this.preloadNext(index);
            return;
        }

        const buffer = await this.fetchRandomBuffer(index);
        if (this.currentPlayId !== playId || !buffer) return;

        this.playBuffer(buffer, time);
        this.preloadNext(index);
    }

    public async stopMusic(incrementPlayId = true, currentTime?: number) {
        if (incrementPlayId) {
            this.currentPlayId++;
        }
        await this.stopMusicInternal(incrementPlayId, currentTime ?? this.lastTime);
    }

    protected async stopMusicInternal(_incrementPlayId: boolean, currentTime: number) {
        this.nextMusicTrackTime = undefined;
        this.nextMusicPlayId = undefined;
        this.currentIndex = undefined;
        this.playingIndex = undefined;
        this.currentIsLooped = false;
        this.nextBuffer = undefined;

        if (this.currentSource) {
            const source = this.currentSource;
            const gain = this.currentGain;

            source.onended = null;
            this.currentSource = undefined;
            this.currentGain = undefined;

            if (gain) {
                const now = this.audioContext.currentTime;
                this.fadeEndTime = currentTime + 500;

                // Force an anchor point for the ramp
                gain.gain.setValueAtTime(gain.gain.value, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.5);

                try {
                    source.stop(now + 0.5);
                } catch (e) {
                    console.warn("[Music] Failed to schedule source stop", e);
                    try { source.stop(); } catch { }
                }

                setTimeout(() => {
                    try { source.disconnect(); } catch { }
                    try { gain.disconnect(); } catch { }
                }, 1000);
            } else {
                try { source.stop(); } catch { }
                try { source.disconnect(); } catch { }
            }
        }
    }

    public cancelMusic() {
        this.currentPlayId++;
        this.currentIndex = undefined;
        this.playingIndex = undefined;
        this.currentIsLooped = false;
        this.nextBuffer = undefined;
        this.nextMusicTrackTime = undefined;
        this.nextMusicPlayId = undefined;
        this.fadeEndTime = undefined;

        if (this.currentSource) {
            this.currentSource.onended = null;
            try {
                this.currentSource.stop();
            } catch (e) {
                // Ignore InvalidStateError if already stopped
            }
            this.currentSource.disconnect();
            this.currentSource = undefined;
        }

        if (this.currentGain) {
            this.currentGain.disconnect();
            this.currentGain = undefined;
        }
    }

    public letTrackFinish() {
        this.currentPlayId++;
        this.currentIndex = undefined;
        this.currentIsLooped = false;
        this.nextBuffer = undefined;
    }

    protected playBuffer(buffer: AudioBuffer, _startTime: number) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        const gain = this.audioContext.createGain();
        gain.connect(this.musicGainNode);
        source.connect(gain);

        source.onended = () => this.handleTrackEnd(this.lastTime);
        source.start(0);

        this.currentSource = source;
        this.currentGain = gain;
        this.fadeEndTime = undefined;
    }

    protected async handleTrackEnd(endTime: number) {
        this.currentSource = undefined;
        this.currentGain = undefined;

        if (this.currentIndex === undefined) {
            this.playingIndex = undefined;
            return;
        }

        const waitTime = this.currentIsLooped ? 0 : 10000;
        // if (waitTime > 0) console.log(`[Music] Track finished. Waiting ${waitTime / 1000}s before next track...`);

        this.nextMusicTrackTime = endTime + waitTime;
        this.nextMusicPlayId = this.currentPlayId;
    }

    public async update(currentTime: number) {
        this.prevTime = this.lastTime;
        this.lastTime = currentTime;

        if (this.nextMusicTrackTime !== undefined && currentTime >= this.nextMusicTrackTime) {
            const playId = this.nextMusicPlayId;
            this.nextMusicTrackTime = undefined;
            this.nextMusicPlayId = undefined;

            if (playId !== undefined && this.currentPlayId !== playId) return;

            let buffer = this.nextBuffer;
            const targetIndex = this.currentIndex;

            if (!buffer && targetIndex !== undefined) {
                buffer = await this.fetchRandomBuffer(targetIndex);
            }

            if (buffer && targetIndex !== undefined && (playId === undefined || this.currentPlayId === playId)) {
                this.playBuffer(buffer, currentTime);
                this.preloadNext(targetIndex);
            }
        }
    }

    protected async preloadNext(index: number) {
        this.nextBuffer = await this.fetchRandomBuffer(index);
    }

    protected async fetchRandomBuffer(index: number): Promise<AudioBuffer | null> {
        if (!(index in this.musicFiles)) return null;

        const files = this.musicFiles[index];
        const rand = randInt(0, files.length - 1);
        const path = files[rand];

        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(res.statusText);

            const rawBuffer = await res.arrayBuffer();
            const binary = new Uint8Array(rawBuffer);
            binary.set(replaceBytes, 0); // patch the "encrypted" l2 oggs

            return await this.audioContext.decodeAudioData(binary.buffer);
        } catch (e) {
            console.error(`Audio fetch/decode error: ${path}`, e);
            return null;
        }
    }

    protected setupUnlock() {
        const unlock = async () => {
            if (this.unlocked) return;
            try {
                await this.audioContext.resume();
            } finally {
                this.unlocked = true;
                window.removeEventListener("pointerdown", unlock);
                window.removeEventListener("keydown", unlock);
            }
        };
        window.addEventListener("pointerdown", unlock);
        window.addEventListener("keydown", unlock);
    }

    protected async ensureUnlocked() {
        if (!this.unlocked) {
            await this.audioContext.resume();
            this.unlocked = true;
        }
    }

    protected readonly activeAmbientSounds = new Map<string, AmbientChannel_T>();
    protected readonly ambientSounds = new Set<AmbientSoundComponent>();
    protected readonly ambientCandidates: AmbientCandidate_T[] = [];
    protected readonly audibleAmbientSounds = new Map<string, number>();
    protected readonly ambientBufferCache = new Map<string, AudioBuffer>();
    protected readonly ambientSlotAnchors = new Map<string, number>();
    protected readonly pendingAmbientBuffers = new Map<string, Promise<AudioBuffer | null>>();

    public registerAmbientSound(component: AmbientSoundComponent): void { this.ambientSounds.add(component); }

    public unregisterAmbientSound(component: AmbientSoundComponent): void {
        this.ambientSounds.delete(component);
        this.stopAmbientSound(component.info.uuid);
        this.ambientSlotAnchors.delete(component.info.uuid);
    }

    public updateAmbientSounds(currentTime: number, px: number, py: number, pz: number, isDaytime: boolean, isSubmerged: boolean): void {
        const candidates = this.ambientCandidates;
        const audibleSounds = this.audibleAmbientSounds;

        candidates.length = 0;
        audibleSounds.clear();

        for (const component of this.ambientSounds) {
            const info = component.info;

            if (info.soundType === "day" && !isDaytime) continue;
            if (info.soundType === "night" && isDaytime) continue;
            if (info.soundType === "water" && !isSubmerged) continue;

            const dx = info.position[0] - px;
            const dy = info.position[1] - py;
            const dz = info.position[2] - pz;
            const distSq = dx * dx + dy * dy + dz * dz;
            const maxDistSq = info.maxDistance * info.maxDistance;

            if (distSq > maxDistSq) continue;

            // SoundPriority: Volume * Clamp(1 - distSq / Square(GAudioMaxRadiusMultiplier*Radius), 0.01, 1)
            const priority = info.volume * Math.min(Math.max(1 - distSq / maxDistSq, 0.01), 1);

            audibleSounds.set(info.uuid, priority);

            if (this.activeAmbientSounds.has(info.uuid)) continue;
            if (!info.looping && !this.rollAmbientTrigger(info.uuid, component.dataUri, info.randomChance, currentTime)) continue;

            candidates.push({ component, priority });
        }

        // A playing ambient is never dropped for merely ranking below the newcomers
        for (const [id, entry] of this.activeAmbientSounds) {
            const priority = audibleSounds.get(id);

            if (priority === undefined) this.stopAmbientSound(id);
            else entry.priority = priority;
        }

        candidates.sort((a, b) => b.priority - a.priority);

        for (const candidate of candidates) {
            const component = candidate.component;
            const info = component.info;
            const placed = this.playAmbientSound(info.uuid, info.soundName, component.dataUri, info.position, info.volume, info.pitch, info.refDistance, info.maxDistance, info.looping, candidate.priority);

            if (!placed) break;
        }
    }

    // alaudio.dll 0x1000cb5f: a non-looping ambient is rerolled once per Sound->Duration slot counted from AmbientSoundStartTime, and enters the candidate list when appRand()%100 < AmbientRandom
    public rollAmbientTrigger(id: string, dataUri: string, randomChance: number, currentTime: number): boolean {
        const buffer = this.ambientBufferCache.get(dataUri);

        if (!buffer) {
            this.loadAmbientBuffer(dataUri);
            return false;
        }

        const anchor = this.ambientSlotAnchors.get(id);
        if (anchor === undefined) {
            this.ambientSlotAnchors.set(id, currentTime);
            return randInt(0, 99) < randomChance;
        }

        const slotMs = buffer.duration * 1000;
        if (Math.floor((currentTime - anchor) / slotMs) <= Math.floor((this.prevTime - anchor) / slotMs)) return false;

        return randInt(0, 99) < randomChance;
    }

    public setAmbientPriority(id: string, priority: number) {
        const entry = this.activeAmbientSounds.get(id);

        if (entry) entry.priority = priority;
    }

    // alaudio.dll 0x1000cd77 breaks out of the sorted candidate loop the first time this returns 0
    public playAmbientSound(
        id: string,
        soundName: string,
        dataUri: string,
        position: [number, number, number],
        volume: number,
        pitch: number,
        refDistance: number,
        maxDistance: number,
        looping: boolean,
        priority: number
    ): boolean {
        if (this.activeAmbientSounds.has(id)) return true;

        if (this.activeAmbientSounds.size >= MAX_AUDIOCHANNELS && !this.stealAmbientChannel(priority)) return false;

        const entry: AmbientChannel_T = {
            priority,
            info: { dataUri, soundName, position, volume, pitch, refDistance, maxDistance, looping }
        };

        this.activeAmbientSounds.set(id, entry);

        const buffer = this.ambientBufferCache.get(dataUri);
        if (buffer) this.startAmbientSource(id, buffer, entry);
        else this.startAmbientSoundAsync(id, entry);

        return true;
    }

    // PlaySound takes the lowest-priority voice still below the incoming priority
    protected stealAmbientChannel(priority: number): boolean {
        let victimId: string | undefined;
        let bestPriority = priority;

        for (const [id, entry] of this.activeAmbientSounds) {
            if (entry.priority >= bestPriority) continue;

            victimId = id;
            bestPriority = entry.priority;
        }

        if (victimId === undefined) return false;

        this.stopAmbientSound(victimId);

        return true;
    }

    protected async startAmbientSoundAsync(id: string, entry: AmbientChannel_T) {
        await this.ensureUnlocked();

        const buffer = await this.loadAmbientBuffer(entry.info.dataUri);
        if (!buffer) {
            this.activeAmbientSounds.delete(id);
            return;
        }

        if (this.activeAmbientSounds.get(id) !== entry) return;

        this.startAmbientSource(id, buffer, entry);
    }

    protected async loadAmbientBuffer(dataUri: string): Promise<AudioBuffer | null> {
        const cached = this.ambientBufferCache.get(dataUri);
        if (cached) return cached;

        if (this.pendingAmbientBuffers.has(dataUri)) return this.pendingAmbientBuffers.get(dataUri)!;

        const pending = (async () => {
            try {
                const res = await fetch(dataUri);
                const raw = await res.arrayBuffer();
                const buffer = await this.audioContext.decodeAudioData(raw);

                this.ambientBufferCache.set(dataUri, buffer);

                return buffer;
            } catch (e) {
                console.warn(`Failed to decode ambient sound ${dataUri}`, e);
                return null;
            } finally {
                this.pendingAmbientBuffers.delete(dataUri);
            }
        })();

        this.pendingAmbientBuffers.set(dataUri, pending);

        return pending;
    }

    protected startAmbientSource(id: string, buffer: AudioBuffer, entry: AmbientChannel_T) {
        const info = entry.info;

        const panner = this.audioContext.createPanner();
        panner.panningModel = "equalpower"; // hrtf convolution is too costly at 32 concurrent panners
        panner.distanceModel = "inverse";
        panner.refDistance = info.refDistance;
        panner.maxDistance = info.maxDistance;
        panner.rolloffFactor = ROLLOFF;
        panner.positionX.value = info.position[0];
        panner.positionY.value = info.position[1];
        panner.positionZ.value = info.position[2];

        const gain = this.audioContext.createGain();
        gain.gain.value = info.volume;

        gain.connect(panner);
        panner.connect(this.ambientGainNode);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = info.looping;
        source.playbackRate.value = info.pitch;
        source.connect(gain);

        if (!info.looping) source.onended = () => {
            if (this.activeAmbientSounds.get(id) !== entry || entry.source !== source) return;

            this.stopAmbientSound(id);
        };

        entry.panner = panner;
        entry.gain = gain;
        entry.source = source;

        source.start(0);
    }

    public async playOneShotSound(dataUri: string, position: [number, number, number] | { x: number, y: number, z: number }, volume: number, pitch: number, refDistance: number, maxDistance: number, attenuate: boolean = true) {
        const sourcePosition = position as any;
        const x = sourcePosition.x === undefined ? sourcePosition[0] : sourcePosition.x;
        const y = sourcePosition.y === undefined ? sourcePosition[1] : sourcePosition.y;
        const z = sourcePosition.z === undefined ? sourcePosition[2] : sourcePosition.z;
        const sourceRadius = refDistance === 0 ? AL_SOURCE_RADIUS_FALLBACK : refDistance;
        const sourceMaxDistance = maxDistance === 0 ? sourceRadius * 100 : maxDistance;

        await this.ensureUnlocked();

        let buffer = this.ambientBufferCache.get(dataUri);
        if (!buffer) {
            try {
                const res = await fetch(dataUri);
                const raw = await res.arrayBuffer();
                buffer = await this.audioContext.decodeAudioData(raw);
                this.ambientBufferCache.set(dataUri, buffer);
            } catch (e) {
                console.warn(`Failed to decode one-shot sound ${dataUri}`, e);
                return;
            }
        }

        const gain = this.audioContext.createGain();
        gain.gain.value = volume;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = pitch;

        source.connect(gain);

        let panner: PannerNode = null;

        if (attenuate) {
            panner = this.audioContext.createPanner();
            panner.panningModel = "equalpower";
            panner.distanceModel = "inverse";
            panner.refDistance = sourceRadius;
            panner.maxDistance = sourceMaxDistance;
            panner.rolloffFactor = ROLLOFF;
            panner.positionX.value = x;
            panner.positionY.value = y;
            panner.positionZ.value = z;
            gain.connect(panner);
            panner.connect(this.effectsGainNode);
        } else gain.connect(this.effectsGainNode);

        source.onended = () => {
            source.disconnect();
            gain.disconnect();
            if (panner) panner.disconnect();
        };

        source.start(0);
    }

    public stopAmbientSound(id: string) {
        const entry = this.activeAmbientSounds.get(id);
        if (!entry) return;

        if (entry.source) {
            entry.source.onended = null;
            try { entry.source.stop(); } catch { }
            entry.source.disconnect();
            entry.source = undefined;
        }
        if (entry.gain) entry.gain.disconnect();
        if (entry.panner) entry.panner.disconnect();

        this.activeAmbientSounds.delete(id);
    }

    // Sector re-decodes mint new blob URLs, so release unreachable decoded PCM keys.
    public releaseSound(dataUri: string) {
        this.ambientBufferCache.delete(dataUri);
        this.pendingAmbientBuffers.delete(dataUri);
    }

    public updateListenerPosition(px: number, py: number, pz: number, fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) {
        const listener = this.audioContext.listener;

        if (listener.positionX) {
            listener.positionX.value = px;
            listener.positionY.value = py;
            listener.positionZ.value = pz;
            listener.forwardX.value = fx;
            listener.forwardY.value = fy;
            listener.forwardZ.value = fz;
            listener.upX.value = ux;
            listener.upY.value = uy;
            listener.upZ.value = uz;
        } else {
            listener.setPosition(px, py, pz);
            listener.setOrientation(fx, fy, fz, ux, uy, uz);
        }
    }

    public getMusicState() {
        return {
            currentIndex: this.currentIndex,
            playingIndex: this.playingIndex,
            isLooped: this.currentIsLooped,
            isFading: this.fadeEndTime !== undefined && this.lastTime < this.fadeEndTime,
            nextTrackTime: this.nextMusicTrackTime,
            volume: this.musicVolume
        };
    }

    public getAmbientSounds() {
        const results: any[] = [];
        for (const [id, entry] of this.activeAmbientSounds) {
            results.push({
                id,
                info: entry.info,
                isPlaying: !!entry.source,
                priority: entry.priority
            });
        }
        return results;
    }

}

export default AudioManager;
