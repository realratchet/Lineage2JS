import DynamicLight from "./dynamic-light";
import { SectorObject } from "./zone-object";
import type { L2Environment } from "@client/rendering/l2-env";
import { Color, Mesh, Vector3, Float32BufferAttribute } from "three";
import type { ICollidable } from "./objects";
import RAPIER, { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d";

const tmpVertex = new Vector3();
const tmpColor = new Color();
const tmpAmbient = new Color();

class Terrain extends Mesh implements ICollidable {
    public readonly isCollidable = true;
    public readonly isUpdatable = true;

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

    public update(sector: SectorObject, env: L2Environment) {
        if (!this.lightingInfo) return;

        const timeOfDay = env.getTimeOfDay();
        const shadowIndex = this.getShadowMapIndex(timeOfDay);

        // Check if any lights need updating
        let staticCacheDirty = !this.staticLightingCache || shadowIndex !== this.lastShadowIndex;
        let anyDynamicLightNeedsUpdate = false;

        // Collect and augment light info
        const lights = this.lightingInfo.lights.map(l => ({ ...l, instance: sector.lights[l.light] }));

        for (const { instance: light } of lights) {
            if (!light) continue;

            if (light.isDynamic || light.isTimeBased) {
                if (light.needsUpdate) {
                    anyDynamicLightNeedsUpdate = true;
                }
            } else {
                if (light.needsUpdate) {
                    staticCacheDirty = true;
                }
            }
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

            // 1. Apply Ambient with Shadow Map
            const ambient = env.getAmbientPlaneTerrainLight(tmpAmbient);
            const shadowMap = this.lightingInfo.shadowMaps[shadowIndex];

            for (let i = 0, len = this.staticLightingCache.length; i < len; i += 3) {
                const s = shadowMap ? shadowMap[i / 3] / 255 : 1;
                this.staticLightingCache[i + 0] = ambient.r * s;
                this.staticLightingCache[i + 1] = ambient.g * s;
                this.staticLightingCache[i + 2] = ambient.b * s;
            }

            // 2. Add Static Lights
            const staticLights = lights.filter(l => l.instance && !l.instance.isDynamic && !l.instance.isTimeBased);
            if (staticLights.length > 0) {
                this.computeLighting(staticLights, this.staticLightingCache);
            }

            this.lastShadowIndex = shadowIndex;
        }

        // Apply static cache to the vertex attribute
        colorArray.set(this.staticLightingCache!);

        // 3. Add Dynamic/Time-Based Lights
        const dynamicLights = lights.filter(l => l.instance && (l.instance.isDynamic || l.instance.isTimeBased));
        if (dynamicLights.length > 0) {
            this.computeLighting(dynamicLights, colorArray);
        }

        // Clamp colors
        for (let i = 0, len = colorArray.length; i < len; i++) {
            colorArray[i] = Math.max(0, Math.min(1, colorArray[i]));
        }

        attrColors.needsUpdate = true;
    }

    protected computeLighting(lights: { flags: Uint8Array, instance?: DynamicLight }[], target: Float32Array) {
        if (lights.length === 0) return;

        const attrPositions = this.geometry.getAttribute("position");
        const attrNormals = this.geometry.getAttribute("normal");
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

                    // Terrain normals are already in world space
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

    public getCollider() { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }

    public createCollider(physicsWorld: RAPIER.World) {
        this.rigidbody = physicsWorld.createRigidBody(this.rigidbodyDesc);
        this.collider = physicsWorld.createCollider(this.colliderDesc, this.rigidbody);

        this.rigidbody.setTranslation(this.position, false);

        return this.collider;
    }
}

const tmpNormal = new Vector3();

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