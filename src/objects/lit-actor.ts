
import DynamicLight from "@client/objects/dynamic-light";
import { SectorObject } from "@client/objects/zone-object";
import { BufferAttribute, Matrix4, Vector3 } from "three";
import type { L2Environment } from "@client/rendering/l2-env";
import { ColorByte } from "@client/utils/color-byte";
import { NUM_ACTOR_LIGHTS } from "@client/materials/mesh-static-material/mesh-static-material";
import { GameMesh } from "@client/game/components";

const tmpVertex = new Vector3();
const tmpNormal = new Vector3();
const tmpHardwareCenter = new Vector3();
// const tmpColor = new Color();
const tmpColorByte = new ColorByte();
const arrHardwareLights: DynamicLight[] = [];

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

class LitActorMesh extends GameMesh {
    public readonly isUpdatable: boolean = true;

    protected lightInfo?: MeshLight_T;
    protected scaledGlow: number;
    protected isSunAffected: boolean;
    protected staticLightingCache?: Uint8ClampedArray;
    protected ambient?: { glow: number, vector: number[], isUnlit: boolean, hardwareLighting?: boolean };

    public isBatch?: boolean;
    public batchActorUuids?: string[];
    public perActorAmbient?: any[];
    public batchElements?: any[];
    public allGroups?: { start: number, count: number, materialIndex: number }[];
    public batchIndices?: Uint8Array | Uint16Array | Uint32Array | null;
    public transparentMaterialIndexes?: Set<number>;
    public sortedTransparentMaterialIndexes?: Set<number>;
    public elemVisibility?: Uint8Array;
    public elemRelight?: Uint8Array;
    public elemDistances?: Float64Array;
    public transparentSortPosition?: THREE.Vector3;
    public transparentLookup?: Uint8Array;
    public batchGroupPool?: { start: number, count: number, materialIndex: number, distance: number, transparent: number }[];
    public visibleBatchGroups?: { start: number, count: number, materialIndex: number, distance: number, transparent: number }[];
    public actorBoundsMin?: number[];
    public actorBoundsMax?: number[];
    public actorZoneMask?: bigint;
    public actorRangeIgnored?: boolean;

    public needsRelightPass?: boolean; // set by zone-object.ts when a batch element's visibility flips
    protected vertexToElement?: Uint32Array;

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo?: MeshLight_T, scaledGlow: number, isSunAffected?: boolean, ambient?: { glow: number, vector: number[], isUnlit: boolean, hardwareLighting?: boolean } }) {
        super(props.geometry, props.materials);

        this.lightInfo = props.lightInfo;
        this.scaledGlow = props.scaledGlow ?? 1.0;
        this.isSunAffected = props.isSunAffected ?? true;
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

            const sunAffected = new Uint8Array(attrPositions.count);
            if (this.isSunAffected) sunAffected.fill(255);
            this.geometry.setAttribute("sunAffected", new BufferAttribute(sunAffected, 1, true));
        }
    }

    public setPerActorAmbient(perActorAmbient: any[]) {
        this.perActorAmbient = perActorAmbient;

        const attrSunAffected = this.geometry.getAttribute("sunAffected");
        if (!attrSunAffected) return;

        const arrSunAffected = attrSunAffected.array as Uint8Array;
        arrSunAffected.fill(0);

        for (const actor of perActorAmbient)
            if (actor.isSunAffected)
                arrSunAffected.fill(255, actor.startVertex, actor.startVertex + actor.count);
    }

    protected perVertexGlow?: Float32Array;
    protected perVertexGlowSource?: unknown;

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
                // licensee pre-halves the baked light term for the Modulate2X domain: fmul dbl_AABA38=0.5 (0x90c0ed)
                const intensity = multiplier * scaleGlow * 0.5 * this.sampleIntensity(light, samplingPoint, samplingNormal);

                if (intensity > 0) {
                    target[vi * 3 + 0] += Math.floor(col.r * intensity);
                    target[vi * 3 + 1] += Math.floor(col.g * intensity);
                    target[vi * 3 + 2] += Math.floor(col.b * intensity);
                }
            }
        }
    }

    protected computeHardwareLighting(sector: SectorObject, target: Uint8ClampedArray) {
        const attrPositions = this.geometry.getAttribute("position");
        const perActorAmbient = this.perActorAmbient as { startVertex: number, count: number, scaledGlow: number, isSunAffected: boolean, ambient: typeof this.ambient }[] | undefined;

        if (perActorAmbient) {
            for (let ei = 0; ei < perActorAmbient.length; ei++) {
                const actor = perActorAmbient[ei];
                if (!actor.ambient?.hardwareLighting) continue;

                const elem = this.batchElements![ei];
                const min = elem.boundsMin, max = elem.boundsMax;
                const dx = max[0] - min[0], dy = max[1] - min[1], dz = max[2] - min[2];

                tmpHardwareCenter.set((min[0] + max[0]) * 0.5, (min[1] + max[1]) * 0.5, (min[2] + max[2]) * 0.5);
                this.computeHardwareLightingRange(sector, target, actor.startVertex, actor.count, actor.scaledGlow, actor.isSunAffected, Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.5);
            }
        } else if (this.ambient?.hardwareLighting) {
            if (!this.geometry.boundingSphere) this.geometry.computeBoundingSphere();

            tmpHardwareCenter.copy(this.geometry.boundingSphere!.center).applyMatrix4(this.matrixWorld);
            const radius = this.geometry.boundingSphere!.radius * this.matrixWorld.getMaxScaleOnAxis();

            this.computeHardwareLightingRange(sector, target, 0, attrPositions.count, this.scaledGlow, this.isSunAffected, radius);
        }
    }

    protected computeHardwareLightingRange(sector: SectorObject, target: Uint8ClampedArray, startVertex: number, count: number, scaledGlow: number, isSunAffected: boolean, radius: number) {
        sector.getRelevantLights(tmpHardwareCenter, radius, arrHardwareLights, NUM_ACTOR_LIGHTS, isSunAffected);

        const attrPositions = this.geometry.getAttribute("position");
        const attrNormals = this.geometry.getAttribute("normal");

        for (const light of arrHardwareLights) {
            if (light.isDynamic || light.isTimeBased) continue;

            const col = light.color;

            for (let vi = startVertex, end = startVertex + count; vi < end; vi++) {
                tmpVertex.fromBufferAttribute(attrPositions, vi).applyMatrix4(this.matrixWorld);
                tmpNormal.fromBufferAttribute(attrNormals, vi).transformDirection(this.matrixWorld);

                const intensity = scaledGlow * 0.5 * this.sampleIntensity(light, tmpVertex, tmpNormal);

                if (intensity > 0) {
                    target[vi * 3] += Math.floor(col.r * intensity);
                    target[vi * 3 + 1] += Math.floor(col.g * intensity);
                    target[vi * 3 + 2] += Math.floor(col.b * intensity);
                }
            }
        }
    }

    protected lastEnvVersion: number = -1;
    protected lastStaticEnvIndex: number = -1;
    protected lastStaticEnvNextIndex: number = -1;
    protected lastStaticEnvLerp: number = -1;

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

        if (sets.all.every(l => l.instance)) this.lightSets = sets;

        return sets;
    }

    public update(sector: SectorObject, env: L2Environment) {
        if (!this.lightInfo && !this.ambient && !this.isSunAffected) return;
        if (this.needsInitialLighting && !this.lightingGate) return;


        const attrColors = this.geometry.getAttribute("lighting");
        const colorArray = attrColors.array as Uint8ClampedArray;

        let staticCacheDirty = !this.staticLightingCache || this.staticLightingCache.length !== colorArray.length;

        const currentEnvVersion = env.getEnvVersion();
        if (this.lastEnvVersion !== currentEnvVersion) {
            this.lastEnvVersion = currentEnvVersion;
            staticCacheDirty = true;
        }

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

        if (!staticCacheDirty && !anyDynamicLightNeedsUpdate && !this.needsRelightPass) return;

        const perActorAmbientForFilter = this.perActorAmbient as { startVertex: number, count: number }[] | undefined;
        const canFilterByVisibility = !!this.elemVisibility && !!perActorAmbientForFilter;
        const vertexToElement = canFilterByVisibility ? this.getVertexToElement(perActorAmbientForFilter!, colorArray.length / 3) : undefined;
        const relight = canFilterByVisibility && !staticCacheDirty && !anyDynamicLightNeedsUpdate ? this.elemRelight : undefined;
        const filterVisibility = relight ?? (canFilterByVisibility ? this.elemVisibility : undefined);

        if (staticCacheDirty) {
            if (!this.staticLightingCache || this.staticLightingCache.length !== colorArray.length)
                this.staticLightingCache = new Uint8ClampedArray(colorArray.length);

            if (this.perActorAmbient) {
                const perActorAmbient = this.perActorAmbient as { startVertex: number, count: number, ambient: typeof this.ambient }[];
                for (const actor of perActorAmbient) {
                    if (actor.ambient && actor.ambient.isUnlit) {
                        // unlit renders at 1x: EnableLighting(1,1,0) + SetAmbientLight(255) (UnRenderStaticMesh.cpp line 470), 127 = 1.0 in the Modulate2X domain
                        for (let i = actor.startVertex * 3, end = (actor.startVertex + actor.count) * 3; i < end; i += 3) {
                            this.staticLightingCache[i] = 127;
                            this.staticLightingCache[i + 1] = 127;
                            this.staticLightingCache[i + 2] = 127;
                        }
                    } else if (actor.ambient) {
                        // zone ambient enters the vertex domain halved: FColor(FGetHSV(...) * 0.5f) (UnRenderLight.cpp line 967), ambient >> 1 (0x90d372)
                        tmpColorByte.set(actor.ambient.vector[0], actor.ambient.vector[1], actor.ambient.vector[2]);
                        const r = (tmpColorByte.r + actor.ambient.glow) >> 1;
                        const g = (tmpColorByte.g + actor.ambient.glow) >> 1;
                        const b = (tmpColorByte.b + actor.ambient.glow) >> 1;

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
                        this.staticLightingCache[i] = 127;
                        this.staticLightingCache[i + 1] = 127;
                        this.staticLightingCache[i + 2] = 127;
                    }
                } else {
                    tmpColorByte.set(vector[0], vector[1], vector[2]);
                    const r = (tmpColorByte.r + glow) >> 1;
                    const g = (tmpColorByte.g + glow) >> 1;
                    const b = (tmpColorByte.b + glow) >> 1;

                    for (let i = 0; i < this.staticLightingCache.length; i += 3) {
                        this.staticLightingCache[i] = r;
                        this.staticLightingCache[i + 1] = g;
                        this.staticLightingCache[i + 2] = b;
                    }
                }
            } else {
                this.staticLightingCache.fill(0);
            }

            if (this.lightInfo) this.computeLighting(sector, staticScene, this.staticLightingCache, 1.0);

            // if (staticEnv.length > 0)
            //     debugger;

            if (staticEnv.length >= 2) {
                const [currEnvIndex, nextEnvIndex, lerp] = env.selectEnvironmentLightIndices(staticEnv.length);
                if (lerp < 1.0) this.computeLighting(sector, [staticEnv[currEnvIndex]], this.staticLightingCache, 1.0 - lerp);
                if (lerp > 0.0) this.computeLighting(sector, [staticEnv[nextEnvIndex]], this.staticLightingCache, lerp);
            } else if (staticEnv.length === 1) this.computeLighting(sector, staticEnv, this.staticLightingCache, 1.0);

            this.computeHardwareLighting(sector, this.staticLightingCache);
        }

        if (relight) {
            for (let ei = 0; ei < relight.length; ei++) {
                if (!relight[ei]) continue;

                const { startVertex, count } = perActorAmbientForFilter![ei];
                colorArray.set(this.staticLightingCache!.subarray(startVertex * 3, (startVertex + count) * 3), startVertex * 3);
            }
        } else colorArray.set(this.staticLightingCache!);

        if (dynamicScene.length > 0) this.computeLighting(sector, dynamicScene, colorArray, 1.0, filterVisibility, vertexToElement);
        if (dynamicEnv.length >= 2) {
            const [currEnvIndex, nextEnvIndex, lerp] = env.selectEnvironmentLightIndices(dynamicEnv.length);
            if (lerp < 1.0) this.computeLighting(sector, [dynamicEnv[currEnvIndex]], colorArray, 1.0 - lerp, filterVisibility, vertexToElement);
            if (lerp > 0.0) this.computeLighting(sector, [dynamicEnv[nextEnvIndex]], colorArray, lerp, filterVisibility, vertexToElement);
        } else if (dynamicEnv.length === 1) this.computeLighting(sector, dynamicEnv, colorArray, 1.0, filterVisibility, vertexToElement);

        this.needsRelightPass = false;

        let rangeOffset = 0;
        let rangeCount = -1;

        if (relight) {
            let minVertex = Infinity, maxVertex = 0;

            for (let ei = 0; ei < relight.length; ei++) {
                if (!relight[ei]) continue;

                const { startVertex, count } = perActorAmbientForFilter![ei];
                if (startVertex < minVertex) minVertex = startVertex;
                if (startVertex + count > maxVertex) maxVertex = startVertex + count;
            }

            relight.fill(0);

            if (minVertex === Infinity) return;

            rangeOffset = minVertex * 3;
            rangeCount = (maxVertex - minVertex) * 3;
        } else if (this.elemRelight) this.elemRelight.fill(0);

        attrColors.updateRange.offset = rangeOffset;
        attrColors.updateRange.count = rangeCount;
        attrColors.needsUpdate = true;
    }

    protected sampleIntensity(light: DynamicLight, samplingPoint: Vector3, samplingNormal: Vector3): number {
        return light.sampleIntensity(samplingPoint, samplingNormal);
    }
}

export type MeshLight_T = {
    matrix: Matrix4,
    scene: { light: string, flags: Uint8Array, vertexRangeStart?: number, vertexRangeEnd?: number }[],
    environment: { light: string, flags: Uint8Array, vertexRangeStart?: number, vertexRangeEnd?: number }[]
}

export default LitActorMesh;
export { LitActorMesh }
