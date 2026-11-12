import type { WebGLRenderer } from "three";

type Variant_T = { parameters: Record<string, unknown>, vertex: string, fragment: string, time: number };
type Store_T = { sources: Record<string, string>, variants: Record<string, Variant_T> };

const FILE_NAME = "program-variants.json";
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;
const SAVE_DELAY = 5000;
const USAGE_INTERVAL = 10000;

function hashSource(source: string): string {
    let hash = 5381;

    for (let i = 0; i < source.length; i++)
        hash = ((hash * 33) ^ source.charCodeAt(i)) >>> 0;

    return `${source.length}.${hash.toString(16)}`;
}

export class ProgramVariants {
    protected readonly programs: any[];
    protected readonly programCache: any;
    protected readonly cacheHashes = new Map<string, string>();
    protected readonly restored = new Map<any, Variant_T>();
    protected readonly arrLinking: any[] = [];
    protected readonly arrPending: Variant_T[] = [];
    protected store: Store_T = null;
    protected count = 0;
    protected saveTime = 0;
    protected usageTime = 0;
    protected loadTime = 0;
    protected isSaving = false;
    protected isRestoring = false;

    public constructor(renderer: WebGLRenderer) {
        this.programs = (renderer.info as any).programs;
        this.programCache = (renderer as any).programCache;

        void this.load();
    }

    protected async load(): Promise<void> {
        const store: Store_T = { sources: {}, variants: {} };

        if (globalThis.isSecureContext && navigator.storage?.getDirectory) {
            const root = await navigator.storage.getDirectory();
            let text = "";

            try { text = await (await (await root.getFileHandle(FILE_NAME)).getFile()).text(); }
            catch (e) { if (e.name !== "NotFoundError") throw e; }

            if (text) Object.assign(store, JSON.parse(text));
        }

        this.loadTime = Date.now();

        for (const [key, variant] of Object.entries(store.variants)) {
            if (this.loadTime - variant.time <= MAX_AGE) this.arrPending.push(variant);
            else delete store.variants[key];
        }

        this.store = store;
    }

    protected async save(): Promise<void> {
        const sources: Record<string, string> = {};

        for (const variant of Object.values(this.store.variants)) {
            sources[variant.vertex] = this.store.sources[variant.vertex];
            sources[variant.fragment] = this.store.sources[variant.fragment];
        }

        this.store.sources = sources;
        this.isSaving = true;

        try {
            const root = await navigator.storage.getDirectory();
            const writable = await (await root.getFileHandle(FILE_NAME, { create: true })).createWritable();

            await writable.write(JSON.stringify(this.store));
            await writable.close();
        } finally {
            this.isSaving = false;
        }
    }

    protected getHash(source: string): string {
        if (!this.cacheHashes.has(source)) this.cacheHashes.set(source, hashSource(source));

        return this.cacheHashes.get(source);
    }

    public isReady(): boolean { return this.store !== null && !this.isRestoring && this.arrLinking.length === 0; }

    public update(isLoading: boolean): void {
        if (!this.store) return;

        const now = performance.now(), deadline = now + (isLoading ? 8 : 1);

        for (; this.count < this.programs.length; this.count++) {
            const program = this.programs[this.count];

            if (program.parameters.shaderID) continue;

            const { uniforms, customVertexShaderID, customFragmentShaderID, vertexShader, fragmentShader, ...parameters } = program.parameters;
            const vertex = this.getHash(vertexShader), fragment = this.getHash(fragmentShader), cacheKey = program.cacheKey as string;
            const key = `${vertex},${fragment},${cacheKey.slice(cacheKey.indexOf(",", cacheKey.indexOf(",") + 1) + 1)}`;

            if (this.store.variants[key]) continue;

            this.store.sources[vertex] = vertexShader;
            this.store.sources[fragment] = fragmentShader;
            this.store.variants[key] = { parameters: JSON.parse(JSON.stringify(parameters)), vertex, fragment, time: Date.now() };
            this.saveTime = now + SAVE_DELAY;
        }

        if (isLoading) this.restore(deadline);

        while (this.arrLinking.length > 0 && this.arrLinking[0].isReady() && performance.now() < deadline) {
            const program = this.arrLinking.shift();

            program.getUniforms();
            program.getAttributes();
        }

        if (now > this.usageTime) {
            this.usageTime = now + USAGE_INTERVAL;

            for (const [program, variant] of this.restored) {
                if (variant.time >= this.loadTime || program.usedTimes < 2) continue;

                variant.time = Date.now();
                this.saveTime = now + SAVE_DELAY;
            }
        }

        if (this.saveTime === 0 || now < this.saveTime || this.isSaving || !globalThis.isSecureContext || !navigator.storage?.getDirectory) return;

        this.saveTime = 0;
        void this.save();
    }

    protected restore(deadline: number): void {
        this.isRestoring = false;

        for (let i = this.arrPending.length - 1; i >= 0; i--) {
            const variant = this.arrPending[i], vertexShader = this.store.sources[variant.vertex], fragmentShader = this.store.sources[variant.fragment];

            if (!this.programCache.hasShaderStage(vertexShader) || !this.programCache.hasShaderStage(fragmentShader)) continue;
            if (performance.now() > deadline) {
                this.isRestoring = true;
                return;
            }

            const program = this.programCache.restoreProgram({ ...variant.parameters, vertexShader, fragmentShader });

            this.restored.set(program, variant);
            this.arrLinking.push(program);
            this.arrPending.splice(i, 1);
        }
    }
}

export default ProgramVariants;
