/**
 * Runtime Terrain Lighting System
 * 
 * Ported from: src/assets/unreal/un-terrain-sector.ts (lines 174-255, getDecodeInfo method)
 * 
 * Key differences from Static Mesh lighting:
 * - NO scaleGlow multiplier (uses raw intensity)
 * - NO environment lights (only scene lights)
 * - Uses shadow maps that change with time of day
 * - Ambient light is applied with shadow map modulation
 * 
 * Lighting formula: color = ambient * shadow + Σ(lightColor * sampleIntensity(...))
 */
import DynamicLight from "./dynamic-light";
import { SectorObject } from "./zone-object";
import type { L2Environment } from "@client/rendering/l2-env";
import { Color, Mesh, Vector3, Float32BufferAttribute } from "three";
import type { ICollidable } from "./objects";
import RAPIER, { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";

const tmpVertex = new Vector3();
const tmpNormal = new Vector3();
const tmpColor = new Color();
const tmpAmbient = new Color();
const tmpSun = new Color();

class Terrain extends Mesh implements ICollidable {
    public readonly isCollidable = true;

    protected rigidbodyDesc: RigidBodyDesc;
    protected colliderDesc: ColliderDesc;

    protected collider: RAPIER.Collider;
    protected rigidbody: RAPIER.RigidBody;

    protected bounds: THREE.Box3;
    protected boundsSize: THREE.Vector3;
    protected boundsPosition: THREE.Vector3;

    protected lightingInfo?: TerrainLightingInfo;
    protected lastUpdatedTime: number = -1;
    protected lastShadowIndex: number = -1;
    protected staticLightingCache?: Float32Array;

    public useShadowLerp: boolean = true;

    constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], fieldInfo?: TerrainFieldInfo_T, lightingInfo?: TerrainLightingInfo) {
        super(geometry, material);

        this.lightingInfo = lightingInfo;

        if (fieldInfo) this.setTerrainField(fieldInfo);
    }

    public setTerrainField({ segments: [vx, vz], heightfield, bounds }: TerrainFieldInfo_T) {
        this.bounds = bounds;
        this.boundsSize = bounds.getSize(new Vector3());
        this.boundsPosition = bounds.getCenter(new Vector3());
        this.colliderDesc = ColliderDesc.heightfield(vx, vz, heightfield, { x: this.boundsSize.x, y: 1, z: this.boundsSize.z });
        this.rigidbodyDesc = RigidBodyDesc.fixed();
    }

    /**
     * Update terrain lighting for the current frame
     * 
     * This replaces the baked lighting from un-terrain-sector.ts:getDecodeInfo
     * with a runtime system that supports dynamic lights and time-of-day changes.
     * 
     * Static cache includes:
     * - Ambient light (modulated by shadow map for current time)
     * - Static scene lights (LT_Steady with bDynamicLight=false)
     * 
     * Dynamic pass includes:
     * - Dynamic scene lights (bDynamicLight=true or moving lights)
     * - Time-based lights (LT_Pulse, LT_Blink, etc.)
     */
    public update(sector: SectorObject, env: L2Environment) {
        if (!this.lightingInfo) return;

        const timeOfDay = env.getTimeOfDay();
        let shadowIndex = 0;
        let shadowNextIndex = 0;
        let alpha = 0;

        if (this.useShadowLerp && this.lightingInfo.shadowMapTimes.length > 0) {
            [shadowIndex, shadowNextIndex, alpha] = this.getShadowMapIndicesAndLerp(timeOfDay);
        } else {
            shadowIndex = this.getShadowMapIndex(timeOfDay);
        }

        // Check if any lights need updating
        // When lerping, we need to update every frame if alpha changes, so staticCache is always dirty unless alpha is 0 or 1
        // But practically, time always moves, so we just check if it's dirty
        let staticCacheDirty = !this.staticLightingCache || shadowIndex !== this.lastShadowIndex;

        if (this.useShadowLerp) {
            // Force update if lerping is enabled, as alpha changes continuously
            staticCacheDirty = true;
        }

        let anyDynamicLightNeedsUpdate = false;

        // Collect and augment light info
        const lights = this.lightingInfo.lights.map(l => ({ ...l, instance: sector.lights[l.light] }));

        // if (this.lightingInfo.lights.length > 0)
        //     debugger;

        for (const { instance: light } of lights) {
            if (!light) continue;

            if (light.isDynamic || light.isTimeBased) {
                if (light.needsUpdate) anyDynamicLightNeedsUpdate = true;
            } else if (light.needsUpdate) staticCacheDirty = true;
        }

        // Only recalculate if something changed (time or light)
        if (!staticCacheDirty && !anyDynamicLightNeedsUpdate) return;

        const attrColors = this.geometry.getAttribute("color");
        const colorArray = attrColors.array as Float32Array;

        // Rebuild static cache if necessary (ambient + shadows + static lights)
        if (staticCacheDirty) {
            if (!this.staticLightingCache || this.staticLightingCache.length !== colorArray.length) {
                this.staticLightingCache = new Float32Array(colorArray.length);
            }
            this.staticLightingCache.fill(0);

            // 1. Apply Ambient with Shadow Map (TintMap logic)
            // Final = Ambient + (Light * Intensity)
            // Note: hsvToRgb already normalizes to 0-1, so no additional halving needed
            const ambient = env.getAmbientPlaneTerrainLight(tmpAmbient);
            const light = env.getTerrainLightColor(tmpSun);

            const shadowMap = this.lightingInfo.shadowMaps[shadowIndex];
            const shadowMapNext = this.lightingInfo.shadowMaps[shadowNextIndex];

            for (let i = 0, len = this.staticLightingCache.length; i < len; i += 3) {
                let s = shadowMap ? shadowMap[i / 3] / 255 : 1;

                if (this.useShadowLerp && shadowMapNext) {
                    const sNext = shadowMapNext[i / 3] / 255;
                    s = s * (1 - alpha) + sNext * alpha;
                }

                // Ambient is constant (halved), Light is modulated by shadow map (Intensity)
                this.staticLightingCache[i + 0] = ambient.r + light.r * s;
                this.staticLightingCache[i + 1] = ambient.g + light.g * s;
                this.staticLightingCache[i + 2] = ambient.b + light.b * s;
            }

            // 2. Add Static Lights
            const staticLights = lights.filter(l => l.instance && !l.instance.isDynamic && (!l.instance.isTimeBased || l.instance.lightMethod === "Sunlight"));
            if (staticLights.length > 0) {
                this.computeLighting(staticLights, this.staticLightingCache);
            }

            this.lastShadowIndex = shadowIndex;
        }

        // Apply static cache to the vertex attribute
        colorArray.set(this.staticLightingCache!);

        // 3. Add Dynamic/Time-Based Lights
        const dynamicLights = lights.filter(l => l.instance && (l.instance.isDynamic || (l.instance.isTimeBased && l.instance.lightMethod !== "Sunlight")));
        if (dynamicLights.length > 0) {
            this.computeLighting(dynamicLights, colorArray);
        }

        // Clamp colors
        for (let i = 0, len = colorArray.length; i < len; i++) {
            colorArray[i] = Math.max(0, Math.min(1, colorArray[i]));
        }

        attrColors.needsUpdate = true;
    }

    /**
     * Compute lighting for terrain vertices
     * 
     * Reference: un-terrain-sector.ts lines 174-255 (getDecodeInfo)
     * Original game code:
     * - Iterates through lightInfos (scene lights only, no environment lights)
     * - Uses visibility bitmap to check which vertices are affected
     * - Samples intensity: dynLight.sampleIntensity(samplingPoint, samplingNormal)
     * - Applies color: colors[i] += color.x * intensity (NO scaleGlow multiplier)
     * 
     * Note: Terrain uses raw intensity without scaleGlow (unlike static meshes)
     * Note: Terrain only uses scene lights, not environment lights
     */
    protected computeLighting(lights: { flags: Uint8Array, instance?: DynamicLight }[], target: Float32Array) {
        if (lights.length === 0) return;

        const attrPositions = this.geometry.getAttribute("position");
        const attrNormals = this.geometry.getAttribute("normal");

        // Guard: skip if normals are missing
        if (!attrNormals) return;

        const vertexCount = attrPositions.count;

        const ox = this.position.x, oy = this.position.y, oz = this.position.z;

        for (const { instance: light, flags } of lights) {
            if (!light) continue;

            const bitPtrIter = this.iterFlags(flags);
            let bitMask = 0x1;
            let bitPtr = bitPtrIter.next().value;
            const col = light.color;

            for (let vi = 0; vi < vertexCount; vi++) {
                if ((bitPtr & bitMask) !== 0) {
                    tmpVertex.fromBufferAttribute(attrPositions, vi);
                    tmpVertex.x += ox;
                    tmpVertex.y += oy;
                    tmpVertex.z += oz;

                    tmpNormal.fromBufferAttribute(attrNormals, vi);

                    const intensity = light.sampleIntensity(tmpVertex, tmpNormal);

                    if (intensity > 0) {
                        target[vi * 3 + 0] += col.r * intensity;
                        target[vi * 3 + 1] += col.g * intensity;
                        target[vi * 3 + 2] += col.b * intensity;
                    }
                }

                bitMask = (bitMask << 1) % 0x100;
                if (!bitMask) {
                    bitPtr = bitPtrIter.next().value;
                    bitMask = 1;
                }
            }
        }
    }

    protected *iterFlags(arr: Uint8Array): Generator<number, null, unknown> {
        for (let i = 0, len = arr.length; i < len; i++) yield arr[i];
        return null;
    }

    protected getShadowMapIndex(timeOfDay: number): number {
        const times = this.lightingInfo!.shadowMapTimes;
        if (times.length === 0) return 0;

        let index = times.length - 1;
        for (let i = 0; i < times.length; i++) {
            if (timeOfDay <= times[i]) {
                index = i;
                break;
            }
        }
        return index;
    }

    protected getShadowMapIndicesAndLerp(timeOfDay: number): [number, number, number] {
        const times = this.lightingInfo!.shadowMapTimes;
        if (times.length === 0) return [0, 0, 0];
        if (times.length === 1) return [0, 0, 0];

        // Find current time slot
        let idxCurr = times.length - 1;
        for (let i = 0; i < times.length; i++) {
            if (timeOfDay <= times[i]) {
                idxCurr = i;
                break;
            }
        }

        // Previous slot is the "current" state we are coming from
        // If we found index at timeOfDay <= times[i], then times[i] is the END of the current interval
        // So the interval is [times[i-1], times[i]]

        // Wait, let's look at how un-terrain-sector uses timeToIndex. 
        // timeToIndex returns the index where timeOfDay <= times[i]. 
        // So this means index i is the active shadow map for that time.
        // Shadow maps are discrete states. 

        // If we want to lerp, we need to know the "center" time of each shadow map to lerp between them.
        // But we don't have that info easily.

        // Let's assume standard time distribution logic from un-l2env:
        // times[i] represents the START of the interval for shadow map i? 
        // "timeToIndex" implementation in un-l2env checks "timeOfDay <= times[i]". 
        // If true, returns i. 
        // This implies times[i] is the END of the interval for shadow map i.

        // Example: times = [6, 18, 24] (Day, Night, Day transition?)
        // time = 5 -> index 0 (Day)
        // time = 12 -> index 1 (Night)
        // time = 20 -> index 2 (Day transition)

        // If we want to lerp, we treat the time points as keyframes.
        // We need to find the interval [times[a], times[b]] that contains timeOfDay.

        // Let's reuse pickArrayIndices logic concept but adapted for simple number array

        // We need two indices: previous and next relative to timeOfDay

        // Let's assume the times array is sorted.
        // We need to find i such that times[i] <= timeOfDay < times[i+1]
        // But the previous logic was timeOfDay <= times[i] -> index i.

        // Let's try to interpret "times" as the precise moment that shadow map is fully active.

        let idxA = 0;
        let idxB = 0;

        // Find split point
        let found = false;
        for (let i = 0; i < times.length; i++) {
            if (timeOfDay < times[i]) {
                idxB = i;
                idxA = (i - 1 + times.length) % times.length;
                found = true;
                break;
            }
        }

        if (!found) {
            // changes wrap around 24h
            idxA = times.length - 1;
            idxB = 0;
        }

        let timeA = times[idxA];
        let timeB = times[idxB];

        // Handle wrapping
        if (timeB < timeA) {
            timeB += 24;
        }

        let localTime = timeOfDay;
        if (localTime < timeA) {
            localTime += 24;
        }

        const duration = timeB - timeA;
        if (duration <= 0.0001) return [idxA, idxA, 0];

        const alpha = (localTime - timeA) / duration;

        return [idxA, idxB, alpha];
    }

    public getCollider() { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }

    public createCollider(physicsWorld: RAPIER.World) {
        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        this.rigidbody.setTranslation(this.position, false);

        return this.collider;
    }
}

export default Terrain;
export { Terrain };

export type TerrainLightingInfo = {
    lights: { light: string, flags: Uint8Array }[];
    shadowMaps: Uint8Array[];
    shadowMapTimes: number[];
}

type TerrainFieldInfo_T = {
    segments: [number, number],
    heightfield: Float32Array,
    bounds: THREE.Box3
}