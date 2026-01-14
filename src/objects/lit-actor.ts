import DynamicLight from "@client/objects/dynamic-light";
import { ILightInfo, SectorObject } from "@client/objects/zone-object";
import { Color, Float32BufferAttribute, Matrix4, Mesh, Vector3 } from "three";
import type { L2Environment } from "@client/rendering/l2-env";

const tmpVertex = new Vector3();
const tmpNormal = new Vector3();
const tmpColor = new Color();

function* iterFlags(arr: Uint8Array): Generator<number, null, unknown> {
    for (let i = 0, len = arr.length; i < len; i++)
        yield arr[i];

    return null;
}

class LitActorMesh extends Mesh {
    public readonly isUpdatable: boolean = true;

    protected lightInfo?: MeshLight;
    protected scaledGlow: number;
    protected staticLightingCache?: Float32Array;

    public constructor(props: { geometry: THREE.BufferGeometry, materials: THREE.Material | THREE.Material[], lightInfo?: MeshLight, scaledGlow: number }) {
        super(props.geometry, props.materials);

        this.lightInfo = props.lightInfo;
        this.scaledGlow = props.scaledGlow;

        if (this.lightInfo) {
            const attrColor = this.geometry.getAttribute("color");

            (
                this.material instanceof Array
                    ? this.material
                    : [this.material]
            ).forEach(mat => (mat as any)?.setLit?.());

            this.geometry.setAttribute(
                "lighting",
                new Float32BufferAttribute(
                    new Float32Array(attrColor.count * attrColor.itemSize),
                    3
                )
            );
        }
    }

    protected computeLighting(sector: SectorObject, lights: { light: string, flags: Uint8Array, instance?: DynamicLight }[], target: Float32Array, multiplier: number) {
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

                    target[vi * 3 + 0] += col.r * intensity;
                    target[vi * 3 + 1] += col.g * intensity;
                    target[vi * 3 + 2] += col.b * intensity;
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

        // Check if any lights need updating
        let staticCacheDirty = !this.staticLightingCache;
        let anyDynamicLightNeedsUpdate = false;

        // Collect and augment light info
        const scene = this.lightInfo.scene.map(l => ({ ...l, instance: sector.lights[l.light] }));
        const environment = this.lightInfo.environment.map(l => ({ ...l, instance: sector.lights[l.light] }));
        const allLights = [...scene, ...environment];

        for (const { instance: light } of allLights) {
            if (!light) continue;

            if (light.isDynamic || light.isTimeBased) {
                if (light.needsUpdate) anyDynamicLightNeedsUpdate = true;
            } else if (light.needsUpdate) staticCacheDirty = true;
        }

        // Only recalculate if something changed
        if (!staticCacheDirty && !anyDynamicLightNeedsUpdate) return;

        const attrColors = this.geometry.getAttribute("lighting");
        const colorArray = attrColors.array as Float32Array;

        // Rebuild static cache if necessary
        if (staticCacheDirty) {
            if (!this.staticLightingCache || this.staticLightingCache.length !== colorArray.length)
                this.staticLightingCache = new Float32Array(colorArray.length);

            this.staticLightingCache.fill(0);

            const staticScene = scene.filter(l => l.instance && !l.instance.isDynamic && !l.instance.isTimeBased);
            const staticEnv = environment.filter(l => l.instance && !l.instance.isDynamic && !l.instance.isTimeBased);

            this.computeLighting(sector, staticScene, this.staticLightingCache, 1.0);

            if (staticEnv.length >= 2) {
                const [currEnvIndex, nextEnvIndex, lerp] = env.selectEnvironmentLightIndices(staticEnv.length);
                if (lerp < 1.0) this.computeLighting(sector, [staticEnv[currEnvIndex]], this.staticLightingCache, 1.0 - lerp);
                if (lerp > 0.0) this.computeLighting(sector, [staticEnv[nextEnvIndex]], this.staticLightingCache, lerp);
            } else if (staticEnv.length === 1) this.computeLighting(sector, staticEnv, this.staticLightingCache, 1.0);
        }

        // Apply static cache to the vertex attribute
        colorArray.set(this.staticLightingCache!);

        // Apply dynamic pass (lights that change over time or move)
        const dynamicScene = scene.filter(l => l.instance && (l.instance.isDynamic || l.instance.isTimeBased));
        const dynamicEnv = environment.filter(l => l.instance && (l.instance.isDynamic || l.instance.isTimeBased));

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