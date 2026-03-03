import { randInt } from "three/src/math/MathUtils";

const replaceBytes = new Uint8Array("OggS".split("").map(x => x.charCodeAt(0)));

class AudioManager {
    protected readonly musicFiles: Record<number, string[]> = {};
    protected audioContext: AudioContext;
    protected masterGain: GainNode;
    protected unlocked = false;
    protected currentSource?: AudioBufferSourceNode;
    protected currentIndex?: number;
    protected nextBuffer?: AudioBuffer;

    protected constructor() {
        this.audioContext = new AudioContext();

        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.masterGain.gain.value = 1;

        this.setupUnlock();
    }


    public setMusicInfo(musicAssets: Record<number, string[]>) {
        Object.assign(this.musicFiles, musicAssets);
    }

    public async playMusic(index: number) {
        this.currentIndex = index;

        await this.ensureUnlocked();
        await this.stopMusic();

        const buffer = await this.fetchRandomBuffer(index);
        if (!buffer) return;

        this.playBuffer(buffer);
        this.preloadNext(index);
    }

    public async stopMusic() {
        if (this.currentSource) {
            try {
                this.currentSource.stop();
            } catch { }
            this.currentSource.disconnect();
            this.currentSource = undefined;
        }
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
        if (this.currentIndex === undefined) return;

        let buffer = this.nextBuffer;

        if (!buffer) {
            buffer = await this.fetchRandomBuffer(this.currentIndex);
        }

        if (!buffer) return;

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
            binary.set(replaceBytes, 0); // path the "encrypted" l2 oggs

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