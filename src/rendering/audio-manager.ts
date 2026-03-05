import { randInt } from "three/src/math/MathUtils";

const replaceBytes = new Uint8Array("OggS".split("").map(x => x.charCodeAt(0)));

class AudioManager {
    protected readonly musicFiles: Record<number, string[]> = {};
    protected audioContext: AudioContext;
    protected masterGain: GainNode;
    protected musicGainNode: GainNode;
    protected ambientGainNode: GainNode;
    protected unlocked = false;
    protected currentSource?: AudioBufferSourceNode;
    protected currentIndex?: number;
    protected playingIndex?: number;
    protected currentIsLooped = false;
    protected nextBuffer?: AudioBuffer;
    protected musicTimer?: any;

    public constructor() {
        this.audioContext = new AudioContext();

        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 1;

        this.musicGainNode = this.audioContext.createGain();
        this.musicGainNode.connect(this.masterGain);
        this.musicGainNode.gain.value = 0;

        this.ambientGainNode = this.audioContext.createGain();
        this.ambientGainNode.connect(this.masterGain);
        this.ambientGainNode.gain.value = 0.9;

        this.setupUnlock();
    }

    public get musicVolume(): number { return this.musicGainNode.gain.value; }
    public set musicVolume(v: number) { this.musicGainNode.gain.value = v; }

    public get ambientVolume(): number { return this.ambientGainNode.gain.value; }
    public set ambientVolume(v: number) { this.ambientGainNode.gain.value = v; }

    public setMusicInfo(musicAssets: Record<number, string[]>) {
        Object.assign(this.musicFiles, musicAssets);
    }

    protected currentPlayId = 0;

    public async playMusic(index: number, isLooped: boolean = false, isForced: boolean = false) {
        // If same track is already playing or queued, just update loop state
        if (this.playingIndex === index && this.currentSource) {
            this.currentIndex = index;
            this.currentIsLooped = isLooped;
            return;
        }

        if (this.musicTimer) {
            clearTimeout(this.musicTimer);
            this.musicTimer = undefined;
        }

        // If not forced and something is currently playing, just queue it for next
        if (!isForced && (this.currentSource || this.musicTimer) && this.playingIndex !== undefined) {
            console.log(`[Music] Queuing track ${index} (not forced)`);
            this.currentIndex = index;
            this.currentIsLooped = isLooped;
            this.preloadNext(index);
            return;
        }

        const playId = ++this.currentPlayId;

        await this.ensureUnlocked();

        // If another play request has started while we were unlocking, abort this one
        if (this.currentPlayId !== playId) return;

        await this.stopMusic(false);

        this.currentIndex = index;
        this.playingIndex = index;
        this.currentIsLooped = isLooped;

        const buffer = await this.fetchRandomBuffer(index);
        
        // If another play request has started while fetching, abort and do not play
        if (this.currentPlayId !== playId || !buffer) return;

        this.playBuffer(buffer);
        this.preloadNext(index);
    }

    public async stopMusic(incrementPlayId = true) {
        if (incrementPlayId) {
            this.currentPlayId++;
        }
        if (this.musicTimer) {
            clearTimeout(this.musicTimer);
            this.musicTimer = undefined;
        }
        this.currentIndex = undefined;
        this.playingIndex = undefined;
        this.currentIsLooped = false;
        this.nextBuffer = undefined;

        if (this.currentSource) {
            this.currentSource.onended = null;
            try {
                this.currentSource.stop();
            } catch { }
            this.currentSource.disconnect();
            this.currentSource = undefined;
        }
    }

    public letTrackFinish() {
        this.currentPlayId++;
        this.currentIndex = undefined;
        this.currentIsLooped = false;
        this.nextBuffer = undefined;
    }

    protected playBuffer(buffer: AudioBuffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.musicGainNode);

        source.onended = () => this.handleTrackEnd();
        source.start(0);

        this.currentSource = source;
    }

    protected async handleTrackEnd() {
        this.currentSource = undefined;

        if (this.currentIndex === undefined) {
            this.playingIndex = undefined;
            return;
        }

        const waitTime = this.currentIsLooped ? 0 : 10000;
        if (waitTime > 0) {
            console.log(`[Music] Track finished. Waiting ${waitTime / 1000}s before next track...`);
        }

        const playId = this.currentPlayId;
        this.musicTimer = setTimeout(async () => {
            this.musicTimer = undefined;
            
            let buffer = this.nextBuffer;

            if (!buffer) {
                buffer = await this.fetchRandomBuffer(this.currentIndex as number);
            }

            // Check if playback was stopped or changed while we were fetching/waiting
            if (this.currentPlayId !== playId || !buffer || this.currentIndex === undefined) return;

            this.playBuffer(buffer);
            this.preloadNext(this.currentIndex);
        }, waitTime);
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
            if (!res.ok)
                throw new Error(res.statusText);

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

    // --- Ambient Sound Spatial Playback ---

    protected readonly activeAmbientSounds = new Map<string, {
        source?: AudioBufferSourceNode,
        panner: PannerNode,
        gain: GainNode,
        timer?: any,
        info: {
            dataUri: string,
            position: [number, number, number],
            volume: number,
            pitch: number,
            radius: number,
            randomDelay: number,
            looping: boolean
        }
    }>();
    protected readonly ambientBufferCache = new Map<string, AudioBuffer>();

    public async playAmbientSound(
        id: string,
        dataUri: string,
        position: [number, number, number],
        volume: number,
        pitch: number,
        radius: number,
        randomDelay: number, // max delay between plays
        looping: boolean,    // seamless loop (randomDelay should be 0)
    ) {
        if (this.activeAmbientSounds.has(id)) return; // already playing or waiting

        // Register immediately to prevent race conditions during async decoding
        this.activeAmbientSounds.set(id, {
            info: { dataUri, position, volume, pitch, radius, randomDelay, looping }
        } as any);

        await this.ensureUnlocked();

        let buffer = this.ambientBufferCache.get(dataUri);
        if (!buffer) {
            try {
                const res = await fetch(dataUri);
                const raw = await res.arrayBuffer();
                buffer = await this.audioContext.decodeAudioData(raw);
                this.ambientBufferCache.set(dataUri, buffer);
            } catch (e) {
                console.warn(`Failed to decode ambient sound ${id}`, e);
                this.activeAmbientSounds.delete(id);
                return;
            }
        }

        const entry = this.activeAmbientSounds.get(id);
        if (!entry) return; // Stopped while decoding

        const panner = this.audioContext.createPanner();
        panner.panningModel = "HRTF";
        panner.distanceModel = "linear";
        panner.refDistance = 1;
        panner.maxDistance = radius;
        panner.rolloffFactor = 1;
        panner.positionX.value = position[0];
        panner.positionY.value = position[1];
        panner.positionZ.value = position[2];

        const gain = this.audioContext.createGain();
        gain.gain.value = volume;

        gain.connect(panner);
        panner.connect(this.ambientGainNode);

        entry.panner = panner;
        entry.gain = gain;

        if (!entry.info.looping && entry.info.randomDelay > 0) {
            const delay = Math.random() * entry.info.randomDelay * 1000;
            // console.log(`[AudioManager] Initial delay for ${id} in ${delay.toFixed(0)}ms (max ${entry.info.randomDelay}s)`);
            entry.timer = setTimeout(() => {
                const finalEntry = this.activeAmbientSounds.get(id);
                if (finalEntry) {
                    this.startAmbientSource(id, buffer, finalEntry);
                }
            }, delay);
        } else {
            this.startAmbientSource(id, buffer, entry);
        }
    }

    protected startAmbientSource(id: string, buffer: AudioBuffer, entry: any) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = entry.info.looping;
        source.playbackRate.value = entry.info.pitch;
        source.connect(entry.gain);

        if (!entry.info.looping && entry.info.randomDelay > 0) {
            source.onended = () => {
                const updatedEntry = this.activeAmbientSounds.get(id);
                if (!updatedEntry || updatedEntry.source !== source) return;

                updatedEntry.source = undefined;
                const delay = Math.random() * entry.info.randomDelay * 1000;
                // console.log(`[AudioManager] Scheduled replay for ${id} in ${delay.toFixed(0)}ms (max ${entry.info.randomDelay}s)`);
                updatedEntry.timer = setTimeout(() => {
                    const finalEntry = this.activeAmbientSounds.get(id);
                    if (finalEntry) {
                        this.startAmbientSource(id, buffer, finalEntry);
                    }
                }, delay);
            };
        }

        entry.source = source;
        // console.log(`[AudioManager] Playing ambient ${id} (looping: ${entry.info.looping}, randomDelay: ${entry.info.randomDelay}s)`);
        source.start(0);
    }

    public stopAmbientSound(id: string) {
        const entry = this.activeAmbientSounds.get(id);
        if (!entry) return;

        if (entry.timer) clearTimeout(entry.timer);
        if (entry.source) {
            entry.source.onended = null;
            try { entry.source.stop(); } catch { }
            entry.source.disconnect();
        }
        entry.gain.disconnect();
        entry.panner.disconnect();

        this.activeAmbientSounds.delete(id);
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

    public get activeAmbientSoundIds(): Set<string> {
        return new Set(this.activeAmbientSounds.keys());
    }
}

export default AudioManager;
export { AudioManager };