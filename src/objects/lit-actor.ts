
import DynamicLight from "@client/objects/dynamic-light";
import { SectorObject } from "@client/objects/zone-object";
import { BufferAttribute, Matrix4, Mesh, Vector3 } from "three";
import type { L2Environment } from "@client/rendering/l2-env";
import { ColorByte } from "@client/utils/color-byte";

const tmpVertex = new Vector3();
const tmpNormal = new Vector3();
// const tmpColor = new Color();
const tmpColorByte = new ColorByte();
const tmpColorByte2 = new ColorByte();

// Vertex indices a light actually influences, decoded once from its flags bitmask
// (LSB-first per byte). The dynamic pass runs per animated light per frame, and
// walking every vertex of a batched geometry just to test bits dominated the frame
// time (~20M vertex×light iterations/frame in the 18_20 necropolis). rangeStart/rangeEnd
// (mergeMeshLightFlags, batch-data.ts) narrow the scan to the actors that reference the light.
const affectedVertexCache = new WeakMap<Uint8Array, Uint32Array>();

function getAffectedVertices(flags: Uint8Array, vertexCount: number, rangeStart: number = 0, rangeEnd: number = vertexCount): Uint32Array {
    let indices = affectedVertexCache.get(flags);

    if (!indices) {
        let count = 0;

        for (let vi = rangeStart; vi < rangeEnd; vi++)
            if (flags[vi >> 3] & (1 << (vi & 7))) count++;

        indices = new Uint32Array(count);

        for (let vi = rangeStart, k = 0; vi < rangeEnd; vi++)
            if (flags[vi >> 3] & (1 << (vi & 7))) indices[k++] = vi;

        affectedVertexCache.set(flags, indices);
    }

    return indices;
}

type AugmentedLight_T = { light: string, flags: Uint8Array, vertexRangeStart?: number, vertexRangeEnd?: number, instance?: DynamicLight };

class LitActorMesh extends Mesh {
    public readonly isUpdatable: boolean = true;

    protected lightInfo?: MeshLight;
    protected scaledGlow: number;
    protected isSunAffected: boolean;
    protected staticLightingCache?: Uint8ClampedArray;
    protected ambient?: { glow: number, vector: number[], isUnlit: boolean };

    public isBatch?: boolean;
    public batchActorUuids?: string[];
    public perActorAmbient?: any[];
    public batchElements?: any[];
    public allGroups?: { start: number, count: number, materialIndex: number }[];
    public batchIndices?: Uint8Array | Uint16Array | Uint32Array | null;
    public transparentMaterialIndexes?: Set<number>;
    public sortedTransparentMaterialIndexes?: Set<number>;
    public elemVisibility?: Uint8Array;
    public elemDistances?: Float64Array;
    public transparentSortPosition?: THREE.Vector3;
    public actorBoundsMin?: number[];
    public actorBoundsMax?: number[];
    public actorZoneMask?: bigint;
    public actorRangeIgnored?: boolean;

    public needsRelightPass?: boolean; // set by zone-object.ts when a batch element's visibility flips
    protected vertexToElement?: Uint32Array;

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo?: MeshLight, scaledGlow: number, isSunAffected?: boolean, ambient?: { glow: number, vector: number[], isUnlit: boolean } }) {
        super(props.geometry, props.materials);

        this.lightInfo = props.lightInfo;
        this.scaledGlow = props.scaledGlow ?? 1.0;
        this.isSunAffected = props.isSunAffected ?? true; // Default to true for backwards compatibility
        this.ambient = props.ambient;

        if (this.lightInfo || (this.ambient && !this.ambient.isUnlit) || this.isSunAffected) {
            const attrPositions = this.geometry.getAttribute("position");

            (
                this.material instanceof Array
                    ? this.material
                    : [this.material]
            ).forEach(mat => (mat as any)?.setLit?.());

            this.geometry.setAttribute(
                "lighting",
                new BufferAttribute(
                    new Uint8ClampedArray(attrPositions.count * 3),
                    3,
                    true
                )
            );
        }
    }

    protected perVertexGlow?: Float32Array;
    protected perVertexGlowSource?: unknown;

    // Per-vertex scaledGlow lookup, replicating the original sequential range scan:
    // an actor's glow applies until its range ends, the last actor's glow carries
    // past the end. Built once - batch ranges never change after decode.
    protected getPerVertexGlow(perActorAmbient: { startVertex: number, count: number, scaledGlow: number }[], vertexCount: number): Float32Array {
        if (this.perVertexGlowSource !== perActorAmbient || this.perVertexGlow?.length !== vertexCount) {
            const arr = new Float32Array(vertexCount);

            let currentActorIndex = 0;
            let currentActor = perActorAmbient[0] ?? null;
            let scaleGlow = currentActor ? currentActor.scaledGlow : this.scaledGlow;

            for (let vi = 0; vi < vertexCount; vi++) {
                if (currentActor && vi >= currentActor.startVertex + currentActor.count) {
                    currentActorIndex++;
                    currentActor = perActorAmbient[currentActorIndex] ?? null;
                    if (currentActor) scaleGlow = currentActor.scaledGlow;
                }
                arr[vi] = scaleGlow;
            }

            this.perVertexGlow = arr;
            this.perVertexGlowSource = perActorAmbient;
        }

        return this.perVertexGlow;
    }

    // vertex -> batch element index, same order as elemVisibility (batch-data.ts)
    protected getVertexToElement(perActorAmbient: { startVertex: number, count: number }[], vertexCount: number): Uint32Array {
        if (!this.vertexToElement || this.vertexToElement.length !== vertexCount) {
            const arr = new Uint32Array(vertexCount);

            for (let ei = 0; ei < perActorAmbient.length; ei++) {
                const { startVertex, count } = perActorAmbient[ei];
                arr.fill(ei, startVertex, startVertex + count);
            }

            this.vertexToElement = arr;
        }

        return this.vertexToElement;
    }

    protected computeLighting(_sector: SectorObject, lights: AugmentedLight_T[], target: Uint8ClampedArray, multiplier: number, elemVisibility?: Uint8Array, vertexToElement?: Uint32Array) {
        if (lights.length === 0) return;

        const attrPositions = this.geometry.getAttribute("position");
        const attrNormals = this.geometry.getAttribute("normal");

        const vertex = tmpVertex;
        const localToWorld = this.lightInfo!.matrix;

        const vertexArrayLen = attrPositions.count;
        const perActorAmbient: { startVertex: number, count: number, scaledGlow: number }[] | undefined = this.perActorAmbient;
        const glowPerVertex = perActorAmbient ? this.getPerVertexGlow(perActorAmbient, vertexArrayLen) : null;
        const uniformGlow = this.scaledGlow;

        for (const { instance: light, flags, vertexRangeStart, vertexRangeEnd } of lights) {
            if (!light) continue;

            const indices = getAffectedVertices(flags, vertexArrayLen, vertexRangeStart, vertexRangeEnd);
            const col = light.color;

            for (let k = 0, len = indices.length; k < len; k++) {
                const vi = indices[k];

                if (elemVisibility && !elemVisibility[vertexToElement![vi]]) continue;

                vertex.fromBufferAttribute(attrPositions, vi);
                tmpNormal.fromBufferAttribute(attrNormals, vi);

                const samplingPoint = vertex.applyMatrix4(localToWorld);
                const samplingNormal = tmpNormal.transformDirection(localToWorld);

                const scaleGlow = glowPerVertex ? glowPerVertex[vi] : uniformGlow;
                const intensity = multiplier * scaleGlow * this.sampleIntensity(light, samplingPoint, samplingNormal);

                if (intensity > 0) {
                    target[vi * 3 + 0] += Math.floor(col.r * intensity);
                    target[vi * 3 + 1] += Math.floor(col.g * intensity);
                    target[vi * 3 + 2] += Math.floor(col.b * intensity);
                }
            }
        }
    }

    protected lastEnvVersion: number = -1;
    // the blended env-light index/lerp that actually drives the static cache, not raw
    // time - matches Terrain.update, since raw time is never equal frame to frame once
    // timeScale != 0 and was forcing a full per-vertex recompute every single frame
    protected lastStaticEnvIndex: number = -1;
    protected lastStaticEnvNextIndex: number = -1;
    protected lastStaticEnvLerp: number = -1;

    // true until the first lighting pass ran (see Terrain.needsInitialLighting)
    public get needsInitialLighting(): boolean {
        return !this.staticLightingCache && (!!this.lightInfo || !!this.ambient || this.isSunAffected);
    }

    public lightingGate: boolean = true; // set false by RenderManager while a sector's higher-priority tiers are still loading

    protected lightSets?: {
        all: AugmentedLight_T[],
        staticScene: AugmentedLight_T[], staticEnv: AugmentedLight_T[],
        dynamicScene: AugmentedLight_T[], dynamicEnv: AugmentedLight_T[]
    };

    protected resolveLightSets(sector: SectorObject) {
        if (this.lightSets) return this.lightSets;

        const scene: AugmentedLight_T[] = this.lightInfo?.scene.map(l => ({ ...l, instance: sector.lights[l.light] })) || [];
        const environment: AugmentedLight_T[] = this.lightInfo?.environment.map(l => ({ ...l, instance: sector.lights[l.light] })) || [];

        const isStatic = (l: AugmentedLight_T) => l.instance && !l.instance.isDynamic && !l.instance.isTimeBased;
        const isDynamic = (l: AugmentedLight_T) => l.instance && (l.instance.isDynamic || l.instance.isTimeBased);

        const sets = {
            all: [...scene, ...environment],
            staticScene: scene.filter(isStatic),
            staticEnv: environment.filter(isStatic),
            dynamicScene: scene.filter(isDynamic),
            dynamicEnv: environment.filter(isDynamic)
        };

        // only cache once every referenced light resolved, so lights that stream in
        // later than the mesh still get picked up by a retry on the next update
        if (sets.all.every(l => l.instance)) this.lightSets = sets;

        return sets;
    }

    public update(sector: SectorObject, env: L2Environment) {
        if (!this.lightInfo && !this.ambient && !this.isSunAffected) return;
        if (this.needsInitialLighting && !this.lightingGate) return;


        const attrColors = this.geometry.getAttribute("lighting");
        const colorArray = attrColors.array as Uint8ClampedArray;

        // Check if any lights need updating
        let staticCacheDirty = !this.staticLightingCache || this.staticLightingCache.length !== colorArray.length;

        const currentEnvVersion = env.getEnvVersion();
        if (this.lastEnvVersion !== currentEnvVersion) {
            this.lastEnvVersion = currentEnvVersion;
            staticCacheDirty = true;
        }

        // Collect and augment light info (cached - a light's static/dynamic
        // classification is immutable, and this used to allocate fresh arrays of
        // hundreds of entries on every update of every mesh)
        const { all: allLights, staticScene, staticEnv, dynamicScene, dynamicEnv } = this.resolveLightSets(sector);

        if (staticEnv.length >= 2) {
            const [currEnvIndex, nextEnvIndex, lerp] = env.selectEnvironmentLightIndices(staticEnv.length);

            if (currEnvIndex !== this.lastStaticEnvIndex || nextEnvIndex !== this.lastStaticEnvNextIndex || Math.abs(lerp - this.lastStaticEnvLerp) >= 0.02) {
                this.lastStaticEnvIndex = currEnvIndex;
                this.lastStaticEnvNextIndex = nextEnvIndex;
                this.lastStaticEnvLerp = lerp;
                staticCacheDirty = true;
            }
        }

        let anyDynamicLightNeedsUpdate = false;
        for (const { instance: light } of allLights) {
            if (!light) continue;

            if (light.isDynamic || light.isTimeBased) {
                if (light.needsUpdate) anyDynamicLightNeedsUpdate = true;
            } else if (light.needsUpdate) staticCacheDirty = true;
        }

        // Return early if no lighting parameters have changed
        if (!staticCacheDirty && !anyDynamicLightNeedsUpdate && !this.needsRelightPass) return;

        // dynamic pass below filters by elemVisibility - a batch's .visible flag covers every merged actor
        const perActorAmbientForFilter = this.perActorAmbient as { startVertex: number, count: number }[] | undefined;
        const canFilterByVisibility = !!this.elemVisibility && !!perActorAmbientForFilter;
        const filterVisibility = canFilterByVisibility ? this.elemVisibility : undefined;
        const vertexToElement = canFilterByVisibility ? this.getVertexToElement(perActorAmbientForFilter!, colorArray.length / 3) : undefined;

        // Rebuild static cache if necessary
        if (staticCacheDirty) {
            if (!this.staticLightingCache || this.staticLightingCache.length !== colorArray.length)
                this.staticLightingCache = new Uint8ClampedArray(colorArray.length);

            if (this.perActorAmbient) {
                const perActorAmbient = this.perActorAmbient as { startVertex: number, count: number, ambient: typeof this.ambient }[];
                for (const actor of perActorAmbient) {
                    if (actor.ambient && actor.ambient.isUnlit) {
                        for (let i = actor.startVertex * 3, end = (actor.startVertex + actor.count) * 3; i < end; i += 3) {
                            this.staticLightingCache[i] = 255;
                            this.staticLightingCache[i + 1] = 255;
                            this.staticLightingCache[i + 2] = 255;
                        }
                    } else if (actor.ambient) {
                        tmpColorByte.set(actor.ambient.vector[0], actor.ambient.vector[1], actor.ambient.vector[2]);
                        const r = tmpColorByte.r + actor.ambient.glow;
                        const g = tmpColorByte.g + actor.ambient.glow;
                        const b = tmpColorByte.b + actor.ambient.glow;

                        for (let i = actor.startVertex * 3, end = (actor.startVertex + actor.count) * 3; i < end; i += 3) {
                            this.staticLightingCache[i] = r;
                            this.staticLightingCache[i + 1] = g;
                            this.staticLightingCache[i + 2] = b;
                        }
                    } else {
                        for (let i = actor.startVertex * 3, end = (actor.startVertex + actor.count) * 3; i < end; i += 3) {
                            this.staticLightingCache[i] = 0;
                            this.staticLightingCache[i + 1] = 0;
                            this.staticLightingCache[i + 2] = 0;
                        }
                    }
                }
            } else if (this.ambient) {
                const { isUnlit, vector, glow } = this.ambient;

                if (isUnlit) {
                    for (let i = 0; i < this.staticLightingCache.length; i += 3) {
                        this.staticLightingCache[i] = 255;
                        this.staticLightingCache[i + 1] = 255;
                        this.staticLightingCache[i + 2] = 255;
                    }
                } else {
                    tmpColorByte.set(vector[0], vector[1], vector[2]);
                    const r = tmpColorByte.r + glow;
                    const g = tmpColorByte.g + glow;
                    const b = tmpColorByte.b + glow;

                    for (let i = 0; i < this.staticLightingCache.length; i += 3) {
                        this.staticLightingCache[i] = r;
                        this.staticLightingCache[i + 1] = g;
                        this.staticLightingCache[i + 2] = b;
                    }
                }
            } else {
                this.staticLightingCache.fill(0);
            }

            // not filtered by elemVisibility, unlike the dynamic pass - staticLightingCache is a
            // persistent baseline and needsRelightPass can't backfill a skipped contribution later
            if (this.lightInfo) this.computeLighting(sector, staticScene, this.staticLightingCache, 1.0);

            // if (staticEnv.length > 0)
            //     debugger;

            if (staticEnv.length >= 2) {
                const [currEnvIndex, nextEnvIndex, lerp] = env.selectEnvironmentLightIndices(staticEnv.length);
                if (lerp < 1.0) this.computeLighting(sector, [staticEnv[currEnvIndex]], this.staticLightingCache, 1.0 - lerp);
                if (lerp > 0.0) this.computeLighting(sector, [staticEnv[nextEnvIndex]], this.staticLightingCache, lerp);
            } else if (staticEnv.length === 1) this.computeLighting(sector, staticEnv, this.staticLightingCache, 1.0);
        }

        // Apply static cache to the vertex attribute
        colorArray.set(this.staticLightingCache!);

        // GetColorPlane_HSVStaticMeshSunLight + (ambient >> 1)
        if (this.perActorAmbient) {
            const ambientSun = env.getAmbientPlaneStaticMeshSunLightHalved(tmpColorByte);
            const sunColor = env.getBaseColorPlaneStaticMeshSunLightScaled(tmpColorByte2);
            const r = ambientSun.r + sunColor.r;
            const g = ambientSun.g + sunColor.g;
            const b = ambientSun.b + sunColor.b;

            if (r !== 0 || g !== 0 || b !== 0) {
                for (const actor of this.perActorAmbient as { startVertex: number, count: number, isSunAffected: boolean }[]) {
                    if (actor.isSunAffected) {
                        for (let i = actor.startVertex * 3, end = (actor.startVertex + actor.count) * 3; i < end; i += 3) {
                            colorArray[i] += r;
                            colorArray[i + 1] += g;
                            colorArray[i + 2] += b;
                        }
                    }
                }
            }
        } else if (this.isSunAffected) {
            const ambient = env.getAmbientPlaneStaticMeshSunLightHalved(tmpColorByte);
            const sunColor = env.getBaseColorPlaneStaticMeshSunLightScaled(tmpColorByte2);
            const r = ambient.r + sunColor.r;
            const g = ambient.g + sunColor.g;
            const b = ambient.b + sunColor.b;

            if (r !== 0 || g !== 0 || b !== 0) {
                for (let i = 0; i < colorArray.length; i += 3) {
                    colorArray[i] += r;
                    colorArray[i + 1] += g;
                    colorArray[i + 2] += b;
                }
            }
        }

        // Apply dynamic pass (lights that change over time or move)
        if (dynamicScene.length > 0) this.computeLighting(sector, dynamicScene, colorArray, 1.0, filterVisibility, vertexToElement);
        if (dynamicEnv.length >= 2) {
            const [currEnvIndex, nextEnvIndex, lerp] = env.selectEnvironmentLightIndices(dynamicEnv.length);
            if (lerp < 1.0) this.computeLighting(sector, [dynamicEnv[currEnvIndex]], colorArray, 1.0 - lerp, filterVisibility, vertexToElement);
            if (lerp > 0.0) this.computeLighting(sector, [dynamicEnv[nextEnvIndex]], colorArray, lerp, filterVisibility, vertexToElement);
        } else if (dynamicEnv.length === 1) this.computeLighting(sector, dynamicEnv, colorArray, 1.0, filterVisibility, vertexToElement);

        this.needsRelightPass = false;

        attrColors.needsUpdate = true;
    }

    protected sampleIntensity(light: DynamicLight, samplingPoint: Vector3, samplingNormal: Vector3): number {
        return light.sampleIntensity(samplingPoint, samplingNormal);
    }
}

export interface MeshLight {
    matrix: Matrix4,
    scene: { light: string, flags: Uint8Array, vertexRangeStart?: number, vertexRangeEnd?: number }[],
    environment: { light: string, flags: Uint8Array, vertexRangeStart?: number, vertexRangeEnd?: number }[]
}

export default LitActorMesh;
export { LitActorMesh }