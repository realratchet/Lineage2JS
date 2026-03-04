import { randInt } from "three/src/math/MathUtils";

const replaceBytes = new Uint8Array("OggS".split("").map(x => x.charCodeAt(0)));

class AudioManager {
    protected readonly musicFiles: Record<number, string[]> = {};
    protected audioContext: AudioContext;
    protected masterGain: GainNode;
    protected unlocked = false;
    protected currentSource?: AudioBufferSourceNode;
    protected currentIndex?: number;
    protected playingIndex?: number;
    protected nextBuffer?: AudioBuffer;

    public constructor() {
        this.audioContext = new AudioContext();

        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 1;

        this.setupUnlock();
    }

    public setMusicInfo(musicAssets: Record<number, string[]>) {
        Object.assign(this.musicFiles, musicAssets);
    }

    protected currentPlayId = 0;

    public async playMusic(index: number) {
        // If same track is still audibly playing (e.g. finishing after leaving volume), just resume looping
        if (this.playingIndex === index && this.currentSource) {
            this.currentIndex = index;
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
        this.currentIndex = undefined;
        this.playingIndex = undefined;
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
        this.nextBuffer = undefined;
    }

    protected playBuffer(buffer: AudioBuffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.masterGain);

        source.onended = () => this.handleTrackEnd();
        source.start(0);

        this.currentSource = source;
    }

    protected async handleTrackEnd() {
        if (this.currentIndex === undefined) {
            this.playingIndex = undefined;
            this.currentSource = undefined;
            return;
        }

        const playId = this.currentPlayId;
        let buffer = this.nextBuffer;

        if (!buffer) {
            buffer = await this.fetchRandomBuffer(this.currentIndex);
        }

        // Check if playback was stopped or changed while we were fetching
        if (this.currentPlayId !== playId || !buffer || this.currentIndex === undefined) return;

        this.playBuffer(buffer);
        this.preloadNext(this.currentIndex);
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
}

export default AudioManager;
export { AudioManager };