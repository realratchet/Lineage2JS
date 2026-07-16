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
    protected currentGain?: GainNode;
    protected currentIndex?: number;
    protected playingIndex?: number;
    protected currentIsLooped = false;
    protected nextBuffer?: AudioBuffer;
    protected nextMusicTrackTime?: number;
    protected nextMusicPlayId?: number;
    protected fadeEndTime?: number;
    protected lastTime = 0;

    protected currentPlayId = 0;

    public constructor() {
        this.audioContext = new AudioContext();

        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 1;

        this.musicGainNode = this.audioContext.createGain();
        this.musicGainNode.connect(this.masterGain);
        this.musicGainNode.gain.value = 0.1;

        this.ambientGainNode = this.audioContext.createGain();
        this.ambientGainNode.connect(this.masterGain);
        this.ambientGainNode.gain.value = 0.3;

        this.setupUnlock();
    }

    public get musicVolume(): number { return this.musicGainNode.gain.value; }
    public set musicVolume(v: number) { this.musicGainNode.gain.value = v; }

    public get ambientVolume(): number { return this.ambientGainNode.gain.value; }
    public set ambientVolume(v: number) { this.ambientGainNode.gain.value = v; }

    public setMusicInfo(musicAssets: Record<number, string[]>) {
        Object.assign(this.musicFiles, musicAssets);
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
                    try { source.stop(); } catch {}
                }

                setTimeout(() => {
                    try { source.disconnect(); } catch {}
                    try { gain.disconnect(); } catch {}
                }, 1000);
            } else {
                try { source.stop(); } catch {}
                try { source.disconnect(); } catch {}
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
        this.lastTime = currentTime;

        // Handle music delays
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

        // Handle ambient delays
        for (const [id, entry] of this.activeAmbientSounds) {
            if (entry.nextReplayTime !== undefined && currentTime >= entry.nextReplayTime) {
                entry.nextReplayTime = undefined;
                const buffer = this.ambientBufferCache.get(entry.info.dataUri);
                if (buffer) {
                    this.startAmbientSource(id, buffer, entry, currentTime);
                }
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

    protected readonly activeAmbientSounds = new Map<string, {
        source?: AudioBufferSourceNode,
        panner: PannerNode,
        gain: GainNode,
        nextReplayTime?: number,
        info: {
            dataUri: string,
            soundName: string,
            position: [number, number, number],
            volume: number,
            pitch: number,
            refDistance: number,
            maxDistance: number,
            randomDelay: number,
            looping: boolean
        }
    }>();
    protected readonly ambientBufferCache = new Map<string, AudioBuffer>();

    public async playAmbientSound(
        id: string,
        soundName: string,
        dataUri: string,
        position: [number, number, number],
        volume: number,
        pitch: number,
        refDistance: number,
        maxDistance: number,
        randomDelay: number,
        looping: boolean,
        currentTime?: number
    ) {
        if (this.activeAmbientSounds.has(id)) return;

        const time = currentTime ?? this.lastTime;

        this.activeAmbientSounds.set(id, {
            info: { dataUri, soundName, position, volume, pitch, refDistance, maxDistance, randomDelay, looping }
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
        if (!entry) return;

        const panner = this.audioContext.createPanner();
        panner.panningModel = "equalpower"; // hrtf convolution is too costly at 24 concurrent panners
        panner.distanceModel = "inverse";
        panner.refDistance = refDistance;
        panner.maxDistance = maxDistance;
        panner.rolloffFactor = 1.0;
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
            entry.nextReplayTime = time + Math.random() * entry.info.randomDelay * 1000;
        } else {
            this.startAmbientSource(id, buffer, entry, time);
        }
    }

    protected startAmbientSource(id: string, buffer: AudioBuffer, entry: any, _startTime: number) {
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
                updatedEntry.nextReplayTime = this.lastTime + Math.random() * entry.info.randomDelay * 1000;
            };
        }

        entry.source = source;
        source.start(0);
    }

    public stopAmbientSound(id: string) {
        const entry = this.activeAmbientSounds.get(id);
        if (!entry) return;

        entry.nextReplayTime = undefined;
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
                nextReplayTime: entry.nextReplayTime
            });
        }
        return results;
    }

    public get activeAmbientSoundIds(): Set<string> {
        return new Set(this.activeAmbientSounds.keys());
    }
}

export default AudioManager;
export { AudioManager };