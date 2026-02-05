import DynamicLight from "@client/objects/dynamic-light";
import { SectorObject } from "@client/objects/zone-object";
import { BufferAttribute, Matrix4, Mesh, Vector3 } from "three";
import type { L2Environment } from "@client/rendering/l2-env";
import { ColorByte } from "@client/utils/color-byte";

const tmpVertex = new Vector3();
const tmpNormal = new Vector3();
// const tmpColor = new Color();
const tmpColorByte = new ColorByte();

function* iterFlags(arr: Uint8Array): Generator<number, null, unknown> {
    for (let i = 0, len = arr.length; i < len; i++)
        yield arr[i];

    return null;
}

class LitActorMesh extends Mesh {
    public readonly isUpdatable: boolean = true;

    protected lightInfo?: MeshLight;
    protected scaledGlow: number;
    protected isSunAffected: boolean;
    protected staticLightingCache?: Uint8ClampedArray;
    protected ambient?: { glow: number, vector: number[], isUnlit: boolean };

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo?: MeshLight, scaledGlow: number, isSunAffected?: boolean, ambient?: { glow: number, vector: number[], isUnlit: boolean } }) {
        super(props.geometry, props.materials);

        this.lightInfo = props.lightInfo;
        this.scaledGlow = props.scaledGlow ?? 1.0;
        this.isSunAffected = props.isSunAffected ?? true; // Default to true for backwards compatibility
        this.ambient = props.ambient;

        if (this.lightInfo) {
            const attrColor = this.geometry.getAttribute("color");

            (
                this.material instanceof Array
                    ? this.material
                    : [this.material]
            ).forEach(mat => (mat as any)?.setLit?.());

            this.geometry.setAttribute(
                "lighting",
                new BufferAttribute(
                    new Uint8ClampedArray(attrColor.count * attrColor.itemSize),
                    3,
                    true
                )
            );
        }
    }

    protected computeLighting(_sector: SectorObject, lights: { light: string, flags: Uint8Array, instance?: DynamicLight }[], target: Uint8ClampedArray, multiplier: number) {
        if (lights.length === 0) return;

        const attrPositions = this.geometry.getAttribute("position");
        const attrNormals = this.geometry.getAttribute("normal");

        const vertex = tmpVertex;
        const normal = tmpNormal;
        const localToWorld = this.lightInfo!.matrix;
        const scaleGlow = this.scaledGlow;

        const vertexArrayLen = attrPositions.count;

        for (const { instance: light, flags } of lights) {
            if (!light) continue;
            const bitPtrIter = iterFlags(flags);

            let bitMask = 0x1;
            let bitPtr = bitPtrIter.next().value;
            const col = light.color;

            for (let vi = 0; vi < vertexArrayLen; vi++) {
                if ((bitPtr & bitMask) !== 0) {
                    vertex.fromBufferAttribute(attrPositions, vi);
                    normal.fromBufferAttribute(attrNormals, vi);

                    const samplingPoint = vertex.applyMatrix4(localToWorld);
                    const samplingNormal = normal.transformDirection(localToWorld);

                    const intensity = multiplier * scaleGlow * this.sampleIntensity(light, samplingPoint, samplingNormal);

                    if (intensity > 0) {
                        target[vi * 3 + 0] += Math.floor(col.r * intensity);
                        target[vi * 3 + 1] += Math.floor(col.g * intensity);
                        target[vi * 3 + 2] += Math.floor(col.b * intensity);
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

    public update(sector: SectorObject, env: L2Environment) {
        if (!this.lightInfo) return;

        const attrColors = this.geometry.getAttribute("lighting");
        const colorArray = attrColors.array as Uint8ClampedArray;

        // Check if any lights need updating
        // CRITICAL FIX: Check length mismatch to prevent crash during copy
        let staticCacheDirty = !this.staticLightingCache || this.staticLightingCache.length !== colorArray.length;

        // Collect and augment light info
        const scene = this.lightInfo.scene.map(l => ({ ...l, instance: sector.lights[l.light] }));
        const environment = this.lightInfo.environment.map(l => ({ ...l, instance: sector.lights[l.light] }));
        const allLights = [...scene, ...environment];

        for (const { instance: light } of allLights) {
            if (!light) continue;

            if (light.isDynamic || (light.isTimeBased && light.lightMethod !== "Sunlight")) {
                // if (light.needsUpdate) anyDynamicLightNeedsUpdate = true;
            } else if (light.needsUpdate) staticCacheDirty = true;
        }

        // Always proceed to apply Ambient/Dynamic updates
        // if (!staticCacheDirty && !anyDynamicLightNeedsUpdate) return;

        // Rebuild static cache if necessary
        if (staticCacheDirty) {
            if (!this.staticLightingCache || this.staticLightingCache.length !== colorArray.length)
                this.staticLightingCache = new Uint8ClampedArray(colorArray.length);

            const staticScene = scene.filter(l => l.instance && !l.instance.isDynamic && (!l.instance.isTimeBased || l.instance.lightMethod === "Sunlight"));
            const staticEnv = environment.filter(l => l.instance && !l.instance.isDynamic && (!l.instance.isTimeBased || l.instance.lightMethod === "Sunlight"));

            if (this.ambient) {
                const { isUnlit, vector, glow } = this.ambient;

                if (isUnlit) {
                    for (let i = 0; i < this.staticLightingCache.length; i += 3) {
                        this.staticLightingCache[i] = 255;
                        this.staticLightingCache[i + 1] = 255;
                        this.staticLightingCache[i + 2] = 255;
                    }
                } else {
                    // Static mesh actors use ambient directly (zone ambient + glow)
                    // IDA: FinalRGB = AmbPlane + SunPlane * Diffuse
                    // Using ColorByte for accurate byte addition
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

            this.computeLighting(sector, staticScene, this.staticLightingCache, 1.0);

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

        // Apply sun ambient only to outdoor (sun-affected) meshes
        if (this.isSunAffected) {
            const ambient = env.getAmbientPlaneStaticMeshSunLight(tmpColorByte);
            if (ambient.r !== 0 || ambient.g !== 0 || ambient.b !== 0) {
                // ambient is ColorByte (0-255), use directly
                // scaledGlow is float scaler
                const r = ambient.r * this.scaledGlow;
                const g = ambient.g * this.scaledGlow;
                const b = ambient.b * this.scaledGlow;

                for (let i = 0; i < colorArray.length; i += 3) {
                    colorArray[i] += r;
                    colorArray[i + 1] += g;
                    colorArray[i + 2] += b;
                }
            }
        }

        // Apply dynamic pass (lights that change over time or move)
        const dynamicScene = scene.filter(l => l.instance && (l.instance.isDynamic || (l.instance.isTimeBased && l.instance.lightMethod !== "Sunlight")));
        const dynamicEnv = environment.filter(l => l.instance && (l.instance.isDynamic || (l.instance.isTimeBased && l.instance.lightMethod !== "Sunlight")));

        if (dynamicScene.length > 0) this.computeLighting(sector, dynamicScene, colorArray, 1.0);
        if (dynamicEnv.length >= 2) {
            const [currEnvIndex, nextEnvIndex, lerp] = env.selectEnvironmentLightIndices(dynamicEnv.length);
            if (lerp < 1.0) this.computeLighting(sector, [dynamicEnv[currEnvIndex]], colorArray, 1.0 - lerp);
            if (lerp > 0.0) this.computeLighting(sector, [dynamicEnv[nextEnvIndex]], colorArray, lerp);
        } else if (dynamicEnv.length === 1) this.computeLighting(sector, dynamicEnv, colorArray, 1.0);

        attrColors.needsUpdate = true;
    }

    protected sampleIntensity(light: DynamicLight, samplingPoint: Vector3, samplingNormal: Vector3): number {
        return light.sampleIntensity(samplingPoint, samplingNormal);
    }
}

export interface MeshLight {
    matrix: Matrix4,
    scene: { light: string, flags: Uint8Array }[],
    environment: { light: string, flags: Uint8Array }[]
}

export default LitActorMesh;
export { LitActorMesh }