import DynamicLight from "@client/objects/dynamic-light";
import { SectorObject } from "@client/objects/zone-object";
import type { L2Environment } from "@client/rendering/l2-env";
import { Box3, Vector3 } from "three";
import type { CollisionPrimitive_T, ICollidable } from "./objects";
import RAPIER, { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";
import { ColorByte } from "@client/utils/color-byte";
import buildTriangleIndex from "@client/physics/triangle-index";
import { GameMesh } from "@client/game/components";
import { ColliderComponent } from "@client/physics/physics-component";

const tmpVertex = new Vector3();
const tmpNormal = new Vector3();
// const tmpAmbient = new Color();
// const tmpSun = new Color();
const cbAmbient = new ColorByte();
const cbLight = new ColorByte();

class Terrain extends GameMesh implements ICollidable {
    public readonly isCollidable = true;

    protected rigidbodyDesc: RigidBodyDesc;
    protected colliderDesc: ColliderDesc;

    protected collider: RAPIER.Collider;
    protected rigidbody: RAPIER.RigidBody;
    protected analyticalIndices: Uint32Array;
    protected readonly analyticalBounds = new Box3();
    protected analyticalPrimitive: CollisionPrimitive_T;

    public bounds: THREE.Box3;
    protected boundsSize: THREE.Vector3;
    protected boundsPosition: THREE.Vector3;

    protected lightingInfo?: TerrainLightingInfo_T;
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
    public terrainSegmentUuid: string;

    public useShadowLerp: boolean = true;
    public lightingRevision: number = 0;

    public batchGeometry: THREE.BufferGeometry | null = null;
    public batchVertexOffset: number = 0;
    public batchIndexOffset: number = 0;
    public batchSectorIndex: number = -1;

    public constructor(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], fieldInfo?: TerrainFieldInfo_T, lightingInfo?: TerrainLightingInfo_T) {
        super(geometry, material);

        this.lightingInfo = lightingInfo;

        if (fieldInfo) this.setTerrainField(fieldInfo);

        this.addComponent(new ColliderComponent());
    }

    public setTerrainField({ bounds, mapX, mapY, offsetX, offsetY, heightmapX, heightmapY }: TerrainFieldInfo_T) {
        this.bounds = bounds;
        this.boundsSize = bounds.getSize(new Vector3());
        this.boundsPosition = bounds.getCenter(new Vector3());

        const vertices = this.geometry.getAttribute("position").array as Float32Array;
        const arrIndices = this.geometry.index.array;
        const indices = arrIndices instanceof Uint32Array ? arrIndices : new Uint32Array(arrIndices);

        this.analyticalIndices = indices;
        this.analyticalPrimitive = { kind: "terrain", vertices, indices, index: buildTriangleIndex(vertices, indices), matrixWorld: this.matrixWorld, bounds: this.analyticalBounds, supportsZeroExtent: true, supportsNonZeroExtent: true, supportsPointCheck: true };
        this.colliderDesc = ColliderDesc.trimesh(vertices, indices);
        this.rigidbodyDesc = RigidBodyDesc.fixed();

        if (mapX !== undefined) this.mapX = mapX;
        if (mapY !== undefined) this.mapY = mapY;
        if (offsetX !== undefined) this.offsetX = offsetX;
        if (offsetY !== undefined) this.offsetY = offsetY;
        if (heightmapX !== undefined) this.heightmapX = heightmapX;
        if (heightmapY !== undefined) this.heightmapY = heightmapY;
    }

    public get needsInitialLighting(): boolean {
        return !!this.lightingInfo && !this.staticLightingCache;
    }

    public lightingGate: boolean = true;

    public update(sector: SectorObject, env: L2Environment) {
        if (!this.lightingInfo) return;
        if (this.needsInitialLighting && !this.lightingGate) return;

        const timeOfDay = env.getTimeOfDay();
        let shadowIndex = 0;
        let shadowNextIndex = 0;
        let alpha = 0;

        if (this.useShadowLerp && this.lightingInfo.shadowMapTimes.length > 0) {
            [shadowIndex, shadowNextIndex, alpha] = this.getShadowMapIndicesAndLerp(timeOfDay);
        } else {
            shadowIndex = this.getShadowMapIndex(timeOfDay);
        }

        env.getAmbientPlaneTerrainLightHalved(cbAmbient);
        env.getTerrainLightColor(cbLight);

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

        for (const l of this.lightingInfo.lights) {
            const light = sector.lights[l.light];
            if (!light) continue;

            if (light.isDynamic || light.isTimeBased) {
                if (light.needsUpdate) anyDynamicLightNeedsUpdate = true;
            } else if (light.needsUpdate) staticCacheDirty = true;
        }

        if (!staticCacheDirty && !anyDynamicLightNeedsUpdate) return;

        const lights = this.lightingInfo.lights.map(l => ({ ...l, instance: sector.lights[l.light] }));

        const targetGeometry = this.batchGeometry || this.geometry;
        const attrColors = targetGeometry.getAttribute("color");
        const colorArray = attrColors.array as Uint8ClampedArray;
        const vertexCount = this.geometry.getAttribute("position").count;
        const colorOffset = this.batchVertexOffset * 3;

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

                // UTerrainSector::SetIntensityMap (0x9a4160): sunPlane * flt_A68640=0.5 * intensity/255
                const sunR = cbLight.r * s * 0.5;
                const sunG = cbLight.g * s * 0.5;
                const sunB = cbLight.b * s * 0.5;

                this.staticLightingCache[i + 0] = (cbAmbient.r + (sunR / 255)) | 0;
                this.staticLightingCache[i + 1] = (cbAmbient.g + (sunG / 255)) | 0;
                this.staticLightingCache[i + 2] = (cbAmbient.b + (sunB / 255)) | 0;
            }

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

        this.syncStitchedBoundaryColors(); // stitched boundary row has no shadow-map data of its own - borrow the neighbor's real edge color
        colorArray.set(this.staticLightingCache!, colorOffset);

        const dynamicLights = lights.filter(l => l.instance && (l.instance.isDynamic || (l.instance.isTimeBased && l.instance.lightMethod !== "Sunlight")));
        if (dynamicLights.length > 0) {
            this.computeLighting(dynamicLights, colorArray, false);
        }

        attrColors.needsUpdate = true;
        this.lightingRevision++;
    }

    protected syncStitchedBoundaryColors() {
        const cache = this.staticLightingCache!;

        if (this.stitchEastNeighbor?.staticLightingCache) {
            const n = this.stitchEastNeighbor.staticLightingCache;
            for (let y = 0; y < 17; y++) {
                const selfIdx = (y * 17 + 16) * 3;
                const neighborIdx = (y * 17 + 0) * 3;
                cache[selfIdx + 0] = n[neighborIdx + 0];
                cache[selfIdx + 1] = n[neighborIdx + 1];
                cache[selfIdx + 2] = n[neighborIdx + 2];
            }
        }

        if (this.stitchSouthNeighbor?.staticLightingCache) {
            const n = this.stitchSouthNeighbor.staticLightingCache;
            for (let x = 0; x < 17; x++) {
                const selfIdx = (16 * 17 + x) * 3;
                const neighborIdx = (0 * 17 + x) * 3;
                cache[selfIdx + 0] = n[neighborIdx + 0];
                cache[selfIdx + 1] = n[neighborIdx + 1];
                cache[selfIdx + 2] = n[neighborIdx + 2];
            }
        }

        if (this.stitchCornerNeighbor?.staticLightingCache) {
            const n = this.stitchCornerNeighbor.staticLightingCache;
            const selfIdx = (16 * 17 + 16) * 3;
            const neighborIdx = (0 * 17 + 0) * 3;
            cache[selfIdx + 0] = n[neighborIdx + 0];
            cache[selfIdx + 1] = n[neighborIdx + 1];
            cache[selfIdx + 2] = n[neighborIdx + 2];
        }
    }

    protected computeLighting(lights: { flags: Uint8Array, instance?: DynamicLight }[], target: Uint8ClampedArray, isCache: boolean) {
        if (lights.length === 0) return;

        const sourceGeometry = this.batchGeometry || this.geometry;
        const attrPositions = sourceGeometry.getAttribute("position");
        const attrNormals = sourceGeometry.getAttribute("normal");

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

                    if (!this.batchGeometry) {
                        tmpVertex.x += ox;
                        tmpVertex.y += oy;
                        tmpVertex.z += oz;
                    }

                    tmpNormal.fromBufferAttribute(attrNormals, sourceVi);

                    // 0.5 inferred from the static-mesh bake constant (dbl_AABA38, 0x90c0ed) and the sun map's SampleIntensity*127.5 (flt_AAC438, 0x9a4514); CalcLight's own factor not independently read
                    const intensity = light.sampleIntensity(tmpVertex, tmpNormal) * 0.5;

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

        let idxA = 0;
        let idxB = 0;

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
            idxA = times.length - 1;
            idxB = 0;
        }

        let timeA = times[idxA];
        let timeB = times[idxB];

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

    public releaseCollider() {
        this.collider = null;
        this.rigidbody = null;
    }

    public getCollider() { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }

    public createCollider(physicsWorld: RAPIER.World) {
        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        this.rigidbody.setTranslation(this.getWorldPosition(tmpVertex), false);

        return this.collider;
    }

    public getCollisionPrimitive(): CollisionPrimitive_T {
        this.analyticalBounds.setFromArray(this.analyticalPrimitive.vertices).applyMatrix4(this.matrixWorld);

        return this.analyticalPrimitive;
    }

    public refreshCollisionGeometry() {
        const attrPositions = this.geometry.getAttribute("position");

        if (this.batchGeometry) {
            const arrPositions = attrPositions.array as Float32Array;
            const arrBatchPositions = this.batchGeometry.getAttribute("position").array as Float32Array;
            const offset = this.batchVertexOffset * 3;

            for (let i = 0, len = arrPositions.length; i < len; i += 3) {
                arrPositions[i] = arrBatchPositions[offset + i] - this.position.x;
                arrPositions[i + 1] = arrBatchPositions[offset + i + 1] - this.position.y;
                arrPositions[i + 2] = arrBatchPositions[offset + i + 2] - this.position.z;
            }

            attrPositions.needsUpdate = true;
            this.geometry.computeVertexNormals();
        }

        const arrIndices = this.geometry.index.array;
        const indices = arrIndices instanceof Uint32Array ? arrIndices : new Uint32Array(arrIndices);

        this.analyticalIndices = indices;
        this.analyticalPrimitive.vertices = attrPositions.array as Float32Array;
        this.analyticalPrimitive.indices = this.analyticalIndices;
        this.analyticalPrimitive.index = buildTriangleIndex(this.analyticalPrimitive.vertices, this.analyticalIndices);
        this.colliderDesc = ColliderDesc.trimesh(attrPositions.array as Float32Array, indices);
    }

    protected stitchEastNeighbor: Terrain | null = null;
    protected stitchSouthNeighbor: Terrain | null = null;
    protected stitchCornerNeighbor: Terrain | null = null;

    public stitchWestToEast(neighbor: Terrain) {
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
        let changed = false;

        for (let y = 0; y < 17; y++) {
            const selfIdx = selfOffset + (y * 17 + 16) * 3 + 2; // Right Edge (x=16)
            const neighborIdx = neighborOffset + (y * 17 + 0) * 3 + 2; // Neighbor Left Edge (x=0)
            const height = nPos[neighborIdx] + hDiff;

            if (pos[selfIdx] === height) continue;

            pos[selfIdx] = height;
            changed = true;
        }

        this.stitchEastNeighbor = neighbor;

        if (!changed) return false;

        attr.needsUpdate = true;
        if (!this.batchGeometry) this.geometry.computeVertexNormals();
        return true;
    }

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
        let changed = false;

        for (let x = 0; x < 17; x++) {
            const selfIdx = selfOffset + (16 * 17 + x) * 3 + 2; // Bottom Edge (y=16)
            const neighborIdx = neighborOffset + (0 * 17 + x) * 3 + 2; // Neighbor Top Edge (y=0)
            const height = nPos[neighborIdx] + hDiff;

            if (pos[selfIdx] === height) continue;

            pos[selfIdx] = height;
            changed = true;
        }

        this.stitchSouthNeighbor = neighbor;

        if (!changed) return false;

        attr.needsUpdate = true;
        if (!this.batchGeometry) this.geometry.computeVertexNormals();
        return true;
    }

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
        const height = nPos[neighborIdx] + hDiff;

        this.stitchCornerNeighbor = neighbor;

        if (pos[selfIdx] === height) return false;

        pos[selfIdx] = height;
        attr.needsUpdate = true;
        if (!this.batchGeometry) this.geometry.computeVertexNormals();
        return true;
    }

    public static stitchAll(terrains: Terrain[]) {
        if (terrains.length < 2) return { processed: terrains.length, stitches: 0, modified: [] as Terrain[] };

        const terrainMap = new Map<string, Terrain>();
        for (const t of terrains) {
            const key = `${t.mapX}_${t.mapY}_${t.offsetX}_${t.offsetY}`;
            terrainMap.set(key, t);
        }

        const modified = new Set<Terrain>();

        const debugInfo = {
            processed: terrains.length,
            stitches: 0,
            modified: [] as Terrain[]
        };

        for (const t of terrains) {
            const mapX = Number(t.mapX);
            const mapY = Number(t.mapY);

            if (t.offsetX === 240) {
                const neighbor = terrainMap.get(`${mapX + 1}_${mapY}_0_${t.offsetY}`);
                if (neighbor && t.stitchWestToEast(neighbor)) {
                    debugInfo.stitches++;
                    modified.add(t);
                }
            }

            if (t.offsetY === 240) {
                const neighbor = terrainMap.get(`${mapX}_${mapY + 1}_${t.offsetX}_0`);
                if (neighbor && t.stitchNorthToSouth(neighbor)) {
                    debugInfo.stitches++;
                    modified.add(t);
                }
            }

            if (t.offsetX === 240 && t.offsetY === 240) {
                const neighbor = terrainMap.get(`${mapX + 1}_${mapY + 1}_0_0`);
                if (neighbor && t.stitchCorner(neighbor)) {
                    debugInfo.stitches++;
                    modified.add(t);
                }
            }
        }

        debugInfo.modified = [...modified];

        return debugInfo;
    }
}

export default Terrain;
export { Terrain };

export type TerrainLightingInfo_T = {
    lights: { light: string, flags: Uint8Array }[];
    shadowMaps: Uint8Array[];
    shadowMapTimes: number[];
}

type TerrainFieldInfo_T = {
    bounds: THREE.Box3,
    mapX?: number,
    mapY?: number,
    offsetX?: number,
    offsetY?: number,
    heightmapX?: number,
    heightmapY?: number
}
