import DecodeWorkerClient from "./assets/decode-worker/decode-worker-client";
import { decodePackage } from "./assets/decoders/object3d-decoder";
import decodeEnv from "./assets/decoders/env-decoder";
import L2Environment from "./rendering/l2-env";
import GLOBAL_UNIFORMS from "./materials/global-uniforms";
import InstancedSpriteBatcher from "./objects/emitters/instanced-sprite-batcher";
import { Box3, Color, Frustum, Matrix4, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import type { SectorObject } from "./objects/zone-object";
import type { LoadSettings_T } from "@l2js/engine";

// Automated sector sweep (?sectorTest): decodes every level sector through the decode
// worker, instantiates it, then renders + simulates a few frames (shader compilation,
// emitter warmup, lighting, animated materials). Posts a JSONL row per sector to
// /sector-test/report -> sector-test-report.jsonl.
//
// query params:
//   start=N     resume from sector index N (self-navigates here when the worker dies)
//   only=a,b    only test the given sector ids
//   emitters=0  disable emitter loading (ON by default here, unlike core.ts)
//   cache=1     allow the decode cache (disabled by default)
//   free=0      keep worker-side packages alive after each sector
//   render=0    skip the render/simulation phase
//   forceRender=1 submit every renderable object once, ignoring visibility/frustum culling
//   textures=X  "auto" (default, s3tc when supported), "rgba" or "compressed"

const SECTOR_TIMEOUT_MS = 240_000;
const SIMULATION_STEPS = 6;
const SIMULATION_STEP_MS = 200;

interface SectorReport {
    sector?: string;
    index?: number;
    total?: number;
    ok?: boolean;
    phase?: "decode" | "instantiate" | "render";
    error?: string;
    stack?: string;
    ms?: number;
    done?: boolean;
    note?: string;
    warnings?: string[];
    bsp?: [number, number, number]; // nodes, sections, zones
    lum?: [number, number, number]; // avg luminance before/after lighting updates, % coverage
}

async function report(data: SectorReport): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch("/sector-test/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            if (response.ok) return;

            console.warn(`[sector-test] report rejected (${response.status}), retrying`);
        } catch (e) {
            console.warn("[sector-test] failed to post report, retrying:", e);
        }

        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms: ${what}`)), ms);

        promise.then(
            value => { clearTimeout(timer); resolve(value); },
            error => { clearTimeout(timer); reject(error); }
        );
    });
}

// continue the sweep from `index` in a fresh page (fresh decode worker)
function continueFrom(index: number): void {
    const params = new URLSearchParams(location.search);

    params.set("start", `${index}`);
    location.search = params.toString();
}

// Renders and simulates an instantiated sector the way RenderManager does: zone
// visibility, shader compilation of every material, then a few update+render steps.
class SectorRenderTester {
    public readonly renderer: WebGLRenderer;
    protected readonly scene = new Scene();
    protected readonly camera = new PerspectiveCamera(90, 4 / 3, 10, 500_000);
    protected readonly forceRenderObjects: boolean;
    protected environment: L2Environment;

    public constructor(forceRenderObjects: boolean) {
        const canvas = document.createElement("canvas");

        this.forceRenderObjects = forceRenderObjects;
        canvas.width = 256;
        canvas.height = 192;
        document.body.appendChild(canvas);

        // preserveDrawingBuffer so the luminance probe can read pixels back
        this.renderer = new WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
        this.scene.background = new Color(0xff00ff); // probe classifies magenta as background
    }

    // Average luminance (0-255) + coverage of non-background pixels, top-down view.
    // Terrain only - bsp water would hide unlit terrain from the probe.
    protected measureLuminance(sector: SectorObject): { lum: number, coverage: number } {
        const gl = this.renderer.getContext();
        const { width, height } = gl.canvas;
        const pixels = new Uint8Array(width * height * 4);
        const hidden: THREE.Object3D[] = [];

        sector.traverse(object => {
            const o = object as any;

            if (o.isMesh && o.visible && !o.isTerrain && !o.isTerrainBatch) {
                o.visible = false;
                hidden.push(object);
            }
        });

        try {
            this.renderer.render(this.scene, this.camera);
        } finally {
            for (const object of hidden) object.visible = true;
        }

        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        let sum = 0, count = 0;

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];

            if (r > 220 && b > 220 && g < 60) continue; // background

            sum += 0.299 * r + 0.587 * g + 0.114 * b;
            count++;
        }

        return { lum: count ? Math.round(sum / count) : -1, coverage: Math.round(count / (width * height) * 100) };
    }

    public async init(client: DecodeWorkerClient): Promise<void> {
        this.environment = new L2Environment(decodeEnv(await client.decodeEnv()));
    }

    // average of the terrain lighting color attribute (0-255), -1 when absent
    protected measureTerrainColors(sector: SectorObject): number {
        let sum = 0, count = 0;

        sector.traverse(object => {
            const o = object as any;

            if (!o.isTerrain && !o.isTerrainBatch) return;

            const attr = o.geometry?.getAttribute?.("color");

            if (!attr) return;

            const array = attr.array as Uint8ClampedArray;

            for (let i = 0; i < array.length; i += 199) { sum += array[i]; count++; }
        });

        return count ? Math.round(sum / count) : -1;
    }

    protected forceRender(sector: SectorObject): void {
        const objectStates: Array<[THREE.Object3D, boolean, boolean]> = [];
        const materialStates = new Map<THREE.Material, boolean>();

        sector.traverse(object => {
            objectStates.push([object, object.visible, object.frustumCulled]);
            object.visible = true;
            object.frustumCulled = false;

            const renderable = object as THREE.Mesh;

            if (!renderable.isMesh && !(renderable as any).isPoints && !(renderable as any).isSprite && !(renderable as any).isLine) return;

            const materials = Array.isArray(renderable.material) ? renderable.material : [renderable.material];

            for (const material of materials) {
                if (!material || !(material as any).isMaterial || materialStates.has(material)) continue;

                materialStates.set(material, material.visible);
                material.visible = true;
            }
        });

        try {
            this.renderer.render(this.scene, this.camera);
        } finally {
            for (const [material, visible] of materialStates) material.visible = visible;

            for (const [object, visible, frustumCulled] of objectStates) {
                object.visible = visible;
                object.frustumCulled = frustumCulled;
            }
        }
    }

    public run(sector: SectorObject): { lumBefore: number, lumAfter: number, coverage: number, colBefore: number, colAfter: number } {
        this.scene.add(sector);

        try {
            sector.updateMatrixWorld(true);

            const bounds = sector.worldBounds.isEmpty() ? new Box3().setFromObject(sector) : sector.worldBounds;
            const center = bounds.getCenter(new Vector3());

            // top-down view so the ground dominates the luminance probe
            this.camera.up.set(0, 0, 1);
            this.camera.position.set(center.x, bounds.max.y + 1000, center.z);
            this.camera.lookAt(center);
            this.camera.updateMatrixWorld(true);

            const frustum = new Frustum().setFromProjectionMatrix(
                new Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));

            // same visibility passes the render manager runs, the topLevelOnly one
            // exercises the outside-looking-in path used for neighbouring sectors
            sector.visible = true;
            sector.updateVisibility(this.environment, this.camera.position, frustum, true, true, Infinity);
            sector.updateVisibility(this.environment, this.camera.position, frustum, false, false, Infinity);

            // compile shaders of every material, visible or not. renderer.compile treats
            // anything with .material as renderable but emitters carry material CONFIGS
            // there (real render loop checks isMesh first), so hide those from it
            const stashedMaterials: Array<[any, any]> = [];

            sector.traverse(object => {
                const o = object as any;

                if (o.material && !o.isMesh && !o.isPoints && !o.isSprite && !o.isLine) {
                    stashedMaterials.push([o, o.material]);
                    o.material = undefined;
                }
            });

            try {
                this.renderer.compile(this.scene, this.camera);
            } finally {
                for (const [object, material] of stashedMaterials) object.material = material;
            }

            const colBefore = this.measureTerrainColors(sector);
            const { lum: lumBefore } = this.measureLuminance(sector);

            // the render manager batches additive sprite emitters into world-space instanced
            // batches (SpriteParticleBatch builds its material there) - exercise that path too
            const particleBatcher = new InstancedSpriteBatcher();
            const batchEmitters: any[] = [];

            this.scene.add(particleBatcher.root);

            for (let step = 0; step < SIMULATION_STEPS; step++) {
                const currentTime = performance.now() + step * SIMULATION_STEP_MS;

                GLOBAL_UNIFORMS.globalTimeSeconds.value = currentTime / 1000;
                batchEmitters.length = 0;

                // the app uses traverseVisible on the active sector, traverse everything
                // here so every emitter/material gets exercised
                this.scene.traverse(child => {
                    if ((child as any).isUpdatable) {
                        if ("computeLighting" in child) (child as any).update(sector, this.environment);
                        else (child as any).update(currentTime);
                    }

                    if ((child as any).instancedMesh) batchEmitters.push(child);

                    const material = (child as THREE.Mesh).material;

                    if (material) {
                        for (const m of Array.isArray(material) ? material : [material])
                            if ((m as any)?.isUpdatable) (m as any).update(currentTime);
                    }
                });

                particleBatcher.update(batchEmitters, this.camera);
                this.renderer.render(this.scene, this.camera);
            }

            particleBatcher.root.traverse(child => (child as THREE.Mesh).geometry?.dispose?.());
            this.scene.remove(particleBatcher.root);

            if (this.forceRenderObjects) this.forceRender(sector);

            const { lum: lumAfter, coverage } = this.measureLuminance(sector);
            const colAfter = this.measureTerrainColors(sector);

            return { lumBefore, lumAfter, coverage, colBefore, colAfter };
        } finally {
            this.scene.remove(sector);
            this.dispose(sector);
        }
    }

    // free GL resources so 142 sectors don't accumulate in the software rasterizer
    protected dispose(sector: SectorObject): void {
        sector.traverse(child => {
            const mesh = child as THREE.Mesh;

            mesh.geometry?.dispose?.();

            const material = mesh.material;

            if (!material) return;

            // emitter meshes may carry plain material-config objects, dispose defensively
            for (const m of Array.isArray(material) ? material : [material]) {
                for (const uniform of Object.values((m as THREE.ShaderMaterial)?.uniforms ?? {}))
                    (uniform as any)?.value?.isTexture && (uniform as any).value.dispose();

                (m as any)?.map?.dispose?.();
                (m as any)?.dispose?.();
            }
        });

        this.renderer.renderLists.dispose();
    }
}

async function runSectorTest(): Promise<void> {
    const params = new URLSearchParams(location.search);
    const start = parseInt(params.get("start") ?? "0", 10) || 0;
    const only = params.get("only")?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const loadEmitters = params.get("emitters") !== "0";
    const cacheEnabled = params.get("cache") === "1";
    const freeAfterDecode = params.get("free") !== "0";
    const renderEnabled = params.get("render") !== "0";
    const forceRenderObjects = params.get("forceRender") === "1";

    const loadSettings = {
        helpersZoneBounds: false,
        batching: { terrain: true, staticMeshes: true },
        cache: { enabled: cacheEnabled },
        loadTerrain: true,
        loadBaseModel: true,
        loadStaticModels: true,
        loadEmitters,
        loadAudio: false
    } as LoadSettings_T;

    const assetList = await (await fetch("asset-list.json")).json();
    let sectors = Object.keys(assetList.supported)
        .filter(path => /^maps\/\d+_\d+\.unr$/.test(path))
        .map(path => path.slice("maps/".length, -".unr".length))
        .sort();

    if (only) sectors = sectors.filter(s => only.includes(s));

    if (start === 0)
        await report({ note: `sweep started: ${sectors.length} sectors, emitters=${loadEmitters}, cache=${cacheEnabled}, render=${renderEnabled}, forceRender=${forceRenderObjects}` });

    const client = new DecodeWorkerClient();

    try {
        await withTimeout(client.ready, SECTOR_TIMEOUT_MS, "worker init");
    } catch (e) {
        await report({ note: `worker init failed: ${(e as Error).message}` });
        document.title = "sector-test: worker init failed";
        return;
    }

    let renderTester: SectorRenderTester = null;

    if (renderEnabled) {
        try {
            renderTester = new SectorRenderTester(forceRenderObjects);
            await renderTester.init(client);
        } catch (e) {
            await report({ note: `render tester unavailable (${(e as Error)?.message}), falling back to decode-only` });
            renderTester = null;
        }
    }

    // resolve texture mode like AssetManager does (auto = s3tc when the gpu has it)
    const textureMode = params.get("textures") ?? "auto";
    const hasS3TC = !!renderTester?.renderer.extensions.get("WEBGL_compressed_texture_s3tc");
    const preferCompressed = textureMode === "compressed" || (textureMode === "auto" && hasS3TC);

    (loadSettings as any).rgbaTextures = !preferCompressed;
    await report({ note: `textures: mode=${textureMode}, s3tc=${hasS3TC} -> ${preferCompressed ? "compressed" : "rgba"}` });

    // three reports shader compile/link failures via console.error, not exceptions
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = (...args: any[]) => {
        consoleErrors.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(" ").slice(0, 400));
        originalConsoleError.apply(console, args);
    };

    console.warn = (...args: any[]) => {
        consoleWarnings.push(args.map(a => (a instanceof Error ? a.message : String(a))).join(" ").slice(0, 400));
        originalConsoleWarn.apply(console, args);
    };

    for (let i = start; i < sectors.length; i++) {
        const sector = sectors[i];
        const startTime = performance.now();
        let phase: SectorReport["phase"] = "decode";

        document.title = `sector-test: ${i + 1}/${sectors.length} ${sector}`;
        console.log(`[sector-test] ${i + 1}/${sectors.length} '${sector}'`);
        consoleErrors.length = 0;
        consoleWarnings.length = 0;

        try {
            const library = await withTimeout(client.decodeSector(sector, loadSettings), SECTOR_TIMEOUT_MS, `decode '${sector}'`);

            library.anisotropy = 1;
            (library as any).preferCompressedTextures = preferCompressed;

            phase = "instantiate";
            const sectorObject = decodePackage(library);
            const bsp: [number, number, number] = [library.bspNodes.length, library.bspSections.length, library.bspZones.length];
            let lum: [number, number, number] = undefined;

            if (renderTester) {
                phase = "render";
                const stats = renderTester.run(sectorObject);

                lum = [stats.lumBefore, stats.lumAfter, stats.coverage];
                (lum as any).push(stats.colBefore, stats.colAfter);
            }

            if (freeAfterDecode) client.freeSector(sector);

            if (consoleErrors.length > 0) {
                await report({
                    sector, index: i, total: sectors.length, ok: false, phase, bsp, lum,
                    error: `console errors during ${phase}: ${consoleErrors.slice(0, 3).join(" | ")}`,
                    warnings: consoleWarnings.slice(0, 10),
                    ms: Math.round(performance.now() - startTime)
                });
            } else {
                await report({ sector, index: i, total: sectors.length, ok: true, bsp, lum, warnings: consoleWarnings.slice(0, 10), ms: Math.round(performance.now() - startTime) });
            }
        } catch (e) {
            const error = e as Error;

            await report({
                sector, index: i, total: sectors.length, ok: false, phase,
                error: error?.message ?? String(e),
                stack: error?.stack,
                warnings: consoleWarnings.slice(0, 10),
                ms: Math.round(performance.now() - startTime)
            });

            // a dead or hung worker poisons every later sector, restart the page past it
            if (client.isDead || /timed out/.test(error?.message ?? "")) {
                await report({ note: `worker lost at '${sector}', restarting sweep at index ${i + 1}` });
                continueFrom(i + 1);
                return;
            }
        }
    }

    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;

    await report({ done: true });
    document.title = "sector-test: done";
    console.log("[sector-test] done");
}

export default runSectorTest;
export { runSectorTest };
