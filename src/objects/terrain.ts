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
import DynamicLight from "@client/objects/dynamic-light";
import { SectorObject } from "@client/objects/zone-object";
import type { L2Environment } from "@client/rendering/l2-env";
import { Mesh, Vector3 } from "three";
import type { ICollidable } from "./objects";
import RAPIER, { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { ColorByte } from "@client/utils/color-byte";

const tmpVertex = new Vector3();
const tmpNormal = new Vector3();
// const tmpAmbient = new Color();
// const tmpSun = new Color();
const cbAmbient = new ColorByte();
const cbLight = new ColorByte();

class Terrain extends Mesh implements ICollidable {
    public readonly isCollidable = true;

    protected rigidbodyDesc: RigidBodyDesc;
    protected colliderDesc: ColliderDesc;

    protected collider: RAPIER.Collider;
    protected rigidbody: RAPIER.RigidBody;

    public bounds: THREE.Box3;
    protected boundsSize: THREE.Vector3;
    protected boundsPosition: THREE.Vector3;

    protected lightingInfo?: TerrainLightingInfo;
    protected lastUpdatedTime: number = -1;
    protected lastShadowIndex: number = -1;
    protected lastShadowNextIndex: number = -1;
    protected lastAlpha: number = -1;

    protected lastAmbientR: number = -1;
    protected lastAmbientG: number = -1;
    protected lastAmbientB: number = -1;
    protected lastSunR: number = -1;
    protected lastSunG: number = -1;
    protected lastSunB: number = -1;

    protected staticLightingCache?: Uint8ClampedArray;
    public readonly isTerrain = true;
    public mapX: number = 0;
    public mapY: number = 0;
    public offsetX: number = 0;
    public offsetY: number = 0;
    public heightmapX: number = 0;
    public heightmapY: number = 0;

    public useShadowLerp: boolean = true;

    // Batch mode: when set, this sector writes to a shared geometry buffer at vertexOffset
    public batchGeometry: THREE.BufferGeometry | null = null;
    public batchVertexOffset: number = 0;
    public batchIndexOffset: number = 0;
    public batchSectorIndex: number = -1;

    constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], fieldInfo?: TerrainFieldInfo_T, lightingInfo?: TerrainLightingInfo) {
        super(geometry, material);

        this.lightingInfo = lightingInfo;

        if (fieldInfo) this.setTerrainField(fieldInfo);
    }

    public setTerrainField({ segments: [vx, vz], heightfield, bounds, mapX, mapY, offsetX, offsetY, heightmapX, heightmapY }: TerrainFieldInfo_T) {
        this.bounds = bounds;
        this.boundsSize = bounds.getSize(new Vector3());
        this.boundsPosition = bounds.getCenter(new Vector3());
        this.colliderDesc = ColliderDesc.heightfield(vx, vz, heightfield, { x: this.boundsSize.x, y: 1, z: this.boundsSize.z });
        this.rigidbodyDesc = RigidBodyDesc.fixed();

        if (mapX !== undefined) this.mapX = mapX;
        if (mapY !== undefined) this.mapY = mapY;
        if (offsetX !== undefined) this.offsetX = offsetX;
        if (offsetY !== undefined) this.offsetY = offsetY;
        if (heightmapX !== undefined) this.heightmapX = heightmapX;
        if (heightmapY !== undefined) this.heightmapY = heightmapY;
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
    // true until the first lighting pass ran, vertex colors start out black
    public get needsInitialLighting(): boolean {
        return !!this.lightingInfo && !this.staticLightingCache;
    }

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

        env.getAmbientPlaneTerrainLight(cbAmbient);
        env.getTerrainLightColor(cbLight);

        // When lerping, we need to update if alpha changes significantly, or if light colors change
        let staticCacheDirty = !this.staticLightingCache || shadowIndex !== this.lastShadowIndex;

        if (this.useShadowLerp && this.staticLightingCache) {
            const colorsChanged = cbAmbient.r !== this.lastAmbientR || Math.abs(cbAmbient.g - this.lastAmbientG) > 0 || Math.abs(cbAmbient.b - this.lastAmbientB) > 0 ||
                cbLight.r !== this.lastSunR || Math.abs(cbLight.g - this.lastSunG) > 0 || Math.abs(cbLight.b - this.lastSunB) > 0;
            const alphaChanged = Math.abs(alpha - this.lastAlpha) >= 0.02 || shadowNextIndex !== this.lastShadowNextIndex;

            if (colorsChanged || alphaChanged) {
                staticCacheDirty = true;
            }
        }

        let anyDynamicLightNeedsUpdate = false;

        // Collect and augment light info
        const lights = this.lightingInfo.lights.map(l => ({ ...l, instance: sector.lights[l.light] }));

        for (const { instance: light } of lights) {
            if (!light) continue;

            if (light.isDynamic || light.isTimeBased) {
                if (light.needsUpdate) anyDynamicLightNeedsUpdate = true;
            } else if (light.needsUpdate) staticCacheDirty = true;
        }

        // Only recalculate if something changed (time or light)
        if (!staticCacheDirty && !anyDynamicLightNeedsUpdate) return;

        // In batch mode, we use the shared geometry's color attribute
        const targetGeometry = this.batchGeometry || this.geometry;
        const attrColors = targetGeometry.getAttribute("color");
        const colorArray = attrColors.array as Uint8ClampedArray;
        const vertexCount = this.geometry.getAttribute("position").count;
        const colorOffset = this.batchVertexOffset * 3;

        // Rebuild static cache if necessary (ambient + shadows + static lights)
        if (staticCacheDirty) {
            if (!this.staticLightingCache || this.staticLightingCache.length !== vertexCount * 3) {
                this.staticLightingCache = new Uint8ClampedArray(vertexCount * 3);
            }
            this.staticLightingCache.fill(0);

            const shadowMap = this.lightingInfo.shadowMaps[shadowIndex];
            const shadowMapNext = this.lightingInfo.shadowMaps[shadowNextIndex];

            for (let i = 0, len = this.staticLightingCache.length; i < len; i += 3) {
                let s = shadowMap ? shadowMap[i / 3] : 255;

                if (this.useShadowLerp && shadowMapNext) {
                    const sNext = shadowMapNext[i / 3];
                    s = s * (1 - alpha) + sNext * alpha;
                }

                const sunR = cbLight.r * s;
                const sunG = cbLight.g * s;
                const sunB = cbLight.b * s;

                this.staticLightingCache[i + 0] = (cbAmbient.r + (sunR / 255)) | 0;
                this.staticLightingCache[i + 1] = (cbAmbient.g + (sunG / 255)) | 0;
                this.staticLightingCache[i + 2] = (cbAmbient.b + (sunB / 255)) | 0;
            }

            // 2. Add Static Lights
            const staticLights = lights.filter(l => l.instance && !l.instance.isDynamic && (!l.instance.isTimeBased || l.instance.lightMethod === "Sunlight"));
            if (staticLights.length > 0) {
                this.computeLighting(staticLights, this.staticLightingCache, true);
            }

            this.lastShadowIndex = shadowIndex;
            this.lastShadowNextIndex = shadowNextIndex;
            this.lastAlpha = alpha;
            this.lastAmbientR = cbAmbient.r;
            this.lastAmbientG = cbAmbient.g;
            this.lastAmbientB = cbAmbient.b;
            this.lastSunR = cbLight.r;
            this.lastSunG = cbLight.g;
            this.lastSunB = cbLight.b;
        }

        // Apply static cache to the vertex attribute (at the correct offset)
        colorArray.set(this.staticLightingCache!, colorOffset);

        // 3. Add Dynamic/Time-Based Lights
        const dynamicLights = lights.filter(l => l.instance && (l.instance.isDynamic || (l.instance.isTimeBased && l.instance.lightMethod !== "Sunlight")));
        if (dynamicLights.length > 0) {
            this.computeLighting(dynamicLights, colorArray, false);
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
    protected computeLighting(lights: { flags: Uint8Array, instance?: DynamicLight }[], target: Uint8ClampedArray, isCache: boolean) {
        if (lights.length === 0) return;

        // In batch mode, positions and normals are also in the shared geometry
        const sourceGeometry = this.batchGeometry || this.geometry;
        const attrPositions = sourceGeometry.getAttribute("position");
        const attrNormals = sourceGeometry.getAttribute("normal");

        // Guard: skip if normals are missing
        if (!attrNormals) return;

        const vertexCount = this.geometry.getAttribute("position").count;
        const vertexOffset = this.batchVertexOffset;
        const targetOffset = isCache ? 0 : this.batchVertexOffset * 3;

        const ox = this.position.x, oy = this.position.y, oz = this.position.z;

        for (const { instance: light, flags } of lights) {
            if (!light) continue;

            const bitPtrIter = this.iterFlags(flags);
            let bitMask = 0x1;
            let bitPtr = bitPtrIter.next().value;
            const col = light.color;

            for (let vi = 0; vi < vertexCount; vi++) {
                if ((bitPtr & bitMask) !== 0) {
                    const sourceVi = vertexOffset + vi;
                    tmpVertex.fromBufferAttribute(attrPositions, sourceVi);

                    // In batch mode, vertices are already shifted to world space in the shared buffer.
                    // Otherwise, we must add the sector's own position.
                    if (!this.batchGeometry) {
                        tmpVertex.x += ox;
                        tmpVertex.y += oy;
                        tmpVertex.z += oz;
                    }

                    tmpNormal.fromBufferAttribute(attrNormals, sourceVi);

                    const intensity = light.sampleIntensity(tmpVertex, tmpNormal);

                    if (intensity > 0) {
                        target[targetOffset + vi * 3 + 0] += Math.floor(col.r * intensity);
                        target[targetOffset + vi * 3 + 1] += Math.floor(col.g * intensity);
                        target[targetOffset + vi * 3 + 2] += Math.floor(col.b * intensity);
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

    /**
     * Stitches this terrain's Eastern (Right) edge to match a Western neighbor's Left edge.
     * Only applied at inter-map boundaries (offsetX === 240).
     */
    public stitchWestToEast(neighbor: Terrain) {
        const targetGeometry = this.batchGeometry || this.geometry;
        const attr = targetGeometry.getAttribute("position");
        const nAttr = (neighbor.batchGeometry || neighbor.geometry).getAttribute("position");
        if (!attr || !nAttr) return false;

        const pos = attr.array as Float32Array;
        const nPos = nAttr.array as Float32Array;

        const selfOffset = this.batchVertexOffset * 3;
        const neighborOffset = neighbor.batchVertexOffset * 3;

        // If both are in batch mode, vertices are absolute and should match perfectly.
        // Otherwise, use relative offsets.
        const useAbsolute = !!(this.batchGeometry && neighbor.batchGeometry);
        const hDiff = useAbsolute ? 0 : neighbor.position.z - this.position.z;

        for (let y = 0; y < 17; y++) {
            const selfIdx = selfOffset + (y * 17 + 16) * 3 + 2; // Right Edge (x=16)
            const neighborIdx = neighborOffset + (y * 17 + 0) * 3 + 2; // Neighbor Left Edge (x=0)
            pos[selfIdx] = nPos[neighborIdx] + hDiff;
        }

        attr.needsUpdate = true;
        if (!this.batchGeometry) this.geometry.computeVertexNormals();
        return true;
    }

    /**
     * Stitches this terrain's Southern (Bottom) edge to match a Northern neighbor's Top edge.
     * Only applied at inter-map boundaries (offsetY === 240).
     */
    public stitchNorthToSouth(neighbor: Terrain) {
        const targetGeometry = this.batchGeometry || this.geometry;
        const attr = targetGeometry.getAttribute("position");
        const nAttr = (neighbor.batchGeometry || neighbor.geometry).getAttribute("position");
        if (!attr || !nAttr) return false;

        const pos = attr.array as Float32Array;
        const nPos = nAttr.array as Float32Array;

        const selfOffset = this.batchVertexOffset * 3;
        const neighborOffset = neighbor.batchVertexOffset * 3;

        const useAbsolute = !!(this.batchGeometry && neighbor.batchGeometry);
        const hDiff = useAbsolute ? 0 : neighbor.position.z - this.position.z;

        for (let x = 0; x < 17; x++) {
            const selfIdx = selfOffset + (16 * 17 + x) * 3 + 2; // Bottom Edge (y=16)
            const neighborIdx = neighborOffset + (0 * 17 + x) * 3 + 2; // Neighbor Top Edge (y=0)
            pos[selfIdx] = nPos[neighborIdx] + hDiff;
        }

        attr.needsUpdate = true;
        if (!this.batchGeometry) this.geometry.computeVertexNormals();
        return true;
    }

    /**
     * Stitches this terrain's South-Eastern (Bottom-Right) corner to match neighbor's Top-Left corner.
     * Only applied at inter-map boundaries (offsetX === 240 && offsetY === 240).
     */
    public stitchCorner(neighbor: Terrain) {
        const targetGeometry = this.batchGeometry || this.geometry;
        const attr = targetGeometry.getAttribute("position");
        const nAttr = (neighbor.batchGeometry || neighbor.geometry).getAttribute("position");
        if (!attr || !nAttr) return false;

        const pos = attr.array as Float32Array;
        const nPos = nAttr.array as Float32Array;

        const selfOffset = this.batchVertexOffset * 3;
        const neighborOffset = neighbor.batchVertexOffset * 3;

        const useAbsolute = !!(this.batchGeometry && neighbor.batchGeometry);
        const hDiff = useAbsolute ? 0 : neighbor.position.z - this.position.z;

        const selfIdx = selfOffset + (16 * 17 + 16) * 3 + 2; // Bottom-Right corner
        const neighborIdx = neighborOffset + (0 * 17 + 0) * 3 + 2; // Neighbor Top-Left corner
        pos[selfIdx] = nPos[neighborIdx] + hDiff;

        attr.needsUpdate = true;
        if (!this.batchGeometry) this.geometry.computeVertexNormals();
        return true;
    }

    /**
     * Orchestrates stitching for a collection of terrain objects.
     * Identifies neighbors and delegates to instance stitching methods.
     */
    public static stitchAll(terrains: Terrain[]) {
        if (terrains.length < 2) return { processed: terrains.length, stitches: 0 };

        const terrainMap = new Map<string, Terrain>();
        for (const t of terrains) {
            const key = `${t.mapX}_${t.mapY}_${t.offsetX}_${t.offsetY}`;
            terrainMap.set(key, t);
        }

        const debugInfo = {
            processed: terrains.length,
            stitches: 0
        };

        for (const t of terrains) {
            const mapX = Number(t.mapX);
            const mapY = Number(t.mapY);

            // Horizontal: The Western map (t.offsetX === 240) modifies its Right Edge 
            // to match the Eastern map's (mapX + 1, offsetX === 0) Left Edge.
            if (t.offsetX === 240) {
                const neighbor = terrainMap.get(`${mapX + 1}_${mapY}_0_${t.offsetY}`);
                if (neighbor && t.stitchWestToEast(neighbor)) {
                    debugInfo.stitches++;
                }
            }

            // Vertical: The Northern map (t.offsetY === 240) modifies its Bottom Edge 
            // to match the Southern map's (mapY + 1, offsetY === 0) Top Edge.
            if (t.offsetY === 240) {
                const neighbor = terrainMap.get(`${mapX}_${mapY + 1}_${t.offsetX}_0`);
                if (neighbor && t.stitchNorthToSouth(neighbor)) {
                    debugInfo.stitches++;
                }
            }

            // Diagonal: The North-Western map (240, 240) modifies its single Bottom-Right corner 
            // to match the South-Eastern map's (mapX + 1, mapY + 1, 0, 0) Top-Left corner vertex.
            if (t.offsetX === 240 && t.offsetY === 240) {
                const neighbor = terrainMap.get(`${mapX + 1}_${mapY + 1}_0_0`);
                if (neighbor && t.stitchCorner(neighbor)) {
                    debugInfo.stitches++;
                }
            }
        }

        return debugInfo;
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
    bounds: THREE.Box3,
    mapX?: number,
    mapY?: number,
    offsetX?: number,
    offsetY?: number,
    heightmapX?: number,
    heightmapY?: number
}