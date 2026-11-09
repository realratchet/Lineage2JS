export class MusicSource {
    public readonly element: HTMLAudioElement;
    public readonly buffer: Blob;
    public readonly path: string;
    public error: Error = null;
    public readonly ready: Promise<MusicSource | null>;
    public onended: () => void = null;
    public hasStarted = false;
    public isDisposed = false;

    protected readonly context: AudioContext;
    protected readonly node: MediaElementAudioSourceNode;
    protected readonly uri: string;
    protected stopSignal: ConstantSourceNode = null;
    protected resolveReady: (source: MusicSource | null) => void = null;
    protected isConnected = false;

    public constructor(context: AudioContext, path: string, buffer: Blob) {

        this.context = context;
        this.buffer = buffer;
        this.path = path;

        this.element = new Audio();
        this.uri = URL.createObjectURL(buffer);
        this.node = context.createMediaElementSource(this.element);

        this.ready = new Promise((resolve, reject) => {
            this.resolveReady = resolve;
            this.element.oncanplay = () => {
                this.element.oncanplay = null;
                this.resolveReady = null;
                resolve(this);
            };
            this.element.onerror = () => {
                const error = this.error = new Error(`Music stream '${this.path}' ${this.element.error.code}: ${this.element.error.message}`);
                const pending = !!this.resolveReady;
                this.resolveReady = null;
                this.finish();
                if (pending) reject(error);
                else throw error;
            };
        });

        this.element.onended = () => this.finish();
        this.element.preload = "auto";
        this.element.src = this.uri;
        this.element.load();
    }

    public connect(destination: AudioNode): void {
        this.node.connect(destination);
        this.isConnected = true;
    }

    public disconnect(): void {
        if (!this.isConnected) return;
        this.node.disconnect();
        this.isConnected = false;
    }

    public async start(): Promise<void> {
        this.hasStarted = true;
        try { await this.element.play(); }
        catch (error) {
            if (this.isDisposed) return;
            this.finish();
            throw error;
        }
    }

    public stop(time = 0): void {
        if (this.isDisposed) return;
        if (time > this.context.currentTime) {
            if (!this.stopSignal) {
                // Stops must follow the audio clock while game ticks are paused.
                const signal = this.stopSignal = this.context.createConstantSource();
                signal.offset.value = 0;
                signal.onended = () => this.finish();
                signal.connect(this.context.destination);
                signal.start();
            }
            this.stopSignal.stop(time);
            return;
        }
        this.finish();
    }

    protected finish(): void {
        if (this.isDisposed) return;
        const onended = this.onended;
        this.dispose();
        if (onended) onended();
    }

    public dispose(): void {
        if (this.isDisposed) return;
        this.isDisposed = true;
        this.onended = null;
        if (this.stopSignal) {
            this.stopSignal.onended = null;
            this.stopSignal.stop();
            this.stopSignal.disconnect();
            this.stopSignal = null;
        }
        this.element.oncanplay = null;
        this.element.onerror = null;
        this.element.onended = null;
        this.element.pause();
        this.element.removeAttribute("src");
        this.element.load();
        this.disconnect();
        URL.revokeObjectURL(this.uri);

        if (this.resolveReady) {
            const resolve = this.resolveReady;
            this.resolveReady = null;
            resolve(null);
        }
    }
}

export default MusicSource;
