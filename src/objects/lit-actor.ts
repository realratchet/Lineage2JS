
import DynamicLight from "@client/objects/dynamic-light";
import { SectorObject } from "@client/objects/zone-object";
import { BufferAttribute, Matrix4, Mesh, LOD, Object3D, Vector3, Camera } from "three";
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

class LitActorMesh extends LOD {
    public readonly isUpdatable: boolean = true;
    public readonly isMesh: boolean = true;

    public readonly lod0: Mesh;
    protected lightInfo?: MeshLight;
    protected scaledGlow: number;
    protected isSunAffected: boolean;
    protected staticLightingCache?: Uint8ClampedArray;
    protected ambient?: { glow: number, vector: number[], isUnlit: boolean };
    protected lods?: LodLevel[];

    public get geometry() { return this.lod0.geometry; }
    public get material() { return this.lod0.material; }

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo?: MeshLight, scaledGlow: number, isSunAffected?: boolean, ambient?: { glow: number, vector: number[], isUnlit: boolean }, lods?: LodLevel[] }) {
        super();

        this.lod0 = new Mesh(props.geometry, props.materials);
        this.addLevel(this.lod0, 0);

        this.lightInfo = props.lightInfo;
        this.scaledGlow = props.scaledGlow ?? 1.0;
        this.isSunAffected = props.isSunAffected ?? true; // Default to true for backwards compatibility
        this.ambient = props.ambient;
        this.lods = props.lods;

        if (this.lightInfo || this.ambient) {
            const mesh0 = this.findMesh(this.lod0);
            if (mesh0) {
                (
                    mesh0.material instanceof Array
                        ? mesh0.material
                        : [mesh0.material]
                ).forEach(mat => (mat as any)?.setLit?.());

                const attrPositions = mesh0.geometry.getAttribute("position");
                mesh0.geometry.setAttribute(
                    "lighting",
                    new BufferAttribute(
                        new Uint8ClampedArray(attrPositions.count * 3),
                        3,
                        true
                    )
                );
            }
        }

        if (this.lods) {
            for (const [obj, distance] of this.lods) {
                this.addLevel(obj, distance * 2000);

                const mesh = this.findMesh(obj);
                if (mesh) {
                    // Lower LODs don't need lit attributes, they use simple color multiplier
                    if (mesh.material instanceof Array) {
                        mesh.material.forEach(mat => (mat as any)?.setUnlit?.());
                    } else {
                        (mesh.material as any)?.setUnlit?.();
                    }
                }
            }
        }
    }

    protected findMesh(object: Object3D): Mesh | null {
        if (object instanceof Mesh) return object;
        let found: Mesh | null = null;
        object.traverse(child => {
            if (child instanceof Mesh && !found) found = child;
        });
        return found;
    }

    protected computeLighting(geometry: THREE.BufferGeometry, _sector: SectorObject, lights: { light: string, flags: Uint8Array, instance?: DynamicLight }[], target: Uint8ClampedArray, multiplier: number) {
        if (lights.length === 0) return;

        const attrPositions = geometry.getAttribute("position");
        const attrNormals = geometry.getAttribute("normal");

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

    public update(camera: Camera, env?: L2Environment, sector?: SectorObject | null): void {
        super.update(camera);

        if (!env || !sector) return;

        const attrColors = this.lod0.geometry.getAttribute("lighting");
        if (!attrColors) return;

        const colorArray = attrColors.array as Uint8ClampedArray;

        // Check if any lights need updating
        let staticCacheDirty = !this.staticLightingCache || this.staticLightingCache.length !== colorArray.length;

        // Collect and augment light info
        const scene = this.lightInfo?.scene.map(l => ({ ...l, instance: sector.lights[l.light] })) || [];
        const environment = this.lightInfo?.environment.map(l => ({ ...l, instance: sector.lights[l.light] })) || [];
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

            if (this.lightInfo) this.computeLighting(this.lod0.geometry, sector, staticScene, this.staticLightingCache, 1.0);

            if (staticEnv.length >= 2) {
                const [currEnvIndex, nextEnvIndex, lerp] = env.selectEnvironmentLightIndices(staticEnv.length);
                if (lerp < 1.0) this.computeLighting(this.lod0.geometry, sector, [staticEnv[currEnvIndex]], this.staticLightingCache, 1.0 - lerp);
                if (lerp > 0.0) this.computeLighting(this.lod0.geometry, sector, [staticEnv[nextEnvIndex]], this.staticLightingCache, lerp);
            } else if (staticEnv.length === 1) this.computeLighting(this.lod0.geometry, sector, staticEnv, this.staticLightingCache, 1.0);
        }

        // Apply static cache to the vertex attribute
        colorArray.set(this.staticLightingCache!);

        // Calculate ambient contribution for other LODs
        let ambR = 0, ambG = 0, ambB = 0;
        if (this.ambient) {
            if (this.ambient.isUnlit) {
                ambR = ambG = ambB = 255;
            } else {
                tmpColorByte.set(this.ambient.vector[0], this.ambient.vector[1], this.ambient.vector[2]);
                ambR = tmpColorByte.r + this.ambient.glow;
                ambG = tmpColorByte.g + this.ambient.glow;
                ambB = tmpColorByte.b + this.ambient.glow;
            }
        } else {
            const bspAmb = env.getAmbientPlaneBSPLight(tmpColorByte);
            ambR = bspAmb.r;
            ambG = bspAmb.g;
            ambB = bspAmb.b;
        }

        // Apply sun ambient only to outdoor (sun-affected) meshes
        if (this.isSunAffected) {
            const sunAmbient = env.getAmbientPlaneStaticMeshSunLight(tmpColorByte);
            if (sunAmbient.r !== 0 || sunAmbient.g !== 0 || sunAmbient.b !== 0) {
                const r = sunAmbient.r;
                const g = sunAmbient.g;
                const b = sunAmbient.b;

                for (let i = 0; i < colorArray.length; i += 3) {
                    colorArray[i] += r;
                    colorArray[i + 1] += g;
                    colorArray[i + 2] += b;
                }

                ambR += r;
                ambG += g;
                ambB += b;
            }
        }

        // Update other LOD levels with material color multiplier
        for (let i = 1; i < this.levels.length; i++) {
            const levelObj = this.levels[i].object;
            const mesh = this.findMesh(levelObj);
            if (mesh) {
                const materials = mesh.material instanceof Array ? mesh.material : [mesh.material];
                for (const mat of materials) {
                    const m = mat as any;
                    if (m.uniforms?.diffuse) {
                        m.uniforms.diffuse.value.setRGB(ambR / 255, ambG / 255, ambB / 255);
                    } else if ("color" in m) {
                        m.color.setRGB(ambR / 255, ambG / 255, ambB / 255);
                    }
                }
            }
        }

        // Apply dynamic pass (lights that change over time or move) - ONLY LOD0
        const dynamicScene = scene.filter(l => l.instance && (l.instance.isDynamic || (l.instance.isTimeBased && l.instance.lightMethod !== "Sunlight")));
        const dynamicEnv = environment.filter(l => l.instance && (l.instance.isDynamic || (l.instance.isTimeBased && l.instance.lightMethod !== "Sunlight")));

        if (dynamicScene.length > 0) this.computeLighting(this.lod0.geometry, sector, dynamicScene, colorArray, 1.0);
        if (dynamicEnv.length >= 2) {
            const [currEnvIndex, nextEnvIndex, lerp] = env.selectEnvironmentLightIndices(dynamicEnv.length);
            if (lerp < 1.0) this.computeLighting(this.lod0.geometry, sector, [dynamicEnv[currEnvIndex]], colorArray, 1.0 - lerp);
            if (lerp > 0.0) this.computeLighting(this.lod0.geometry, sector, [dynamicEnv[nextEnvIndex]], colorArray, lerp);
        } else if (dynamicEnv.length === 1) this.computeLighting(this.lod0.geometry, sector, dynamicEnv, colorArray, 1.0);

        attrColors.needsUpdate = true;
    }

    protected sampleIntensity(light: DynamicLight, samplingPoint: Vector3, samplingNormal: Vector3): number {
        return light.sampleIntensity(samplingPoint, samplingNormal);
    }
}

export type LodLevel = [Object3D, number];

export interface MeshLight {
    matrix: Matrix4,
    scene: { light: string, flags: Uint8Array }[],
    environment: { light: string, flags: Uint8Array }[]
}

export default LitActorMesh;
export { LitActorMesh }