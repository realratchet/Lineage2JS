import DynamicLight from "./dynamic-light";
import { BufferGeometry, Material, SkinnedMesh, Vector3 } from "three";
import { ColorByte } from "../utils/color-byte";
import type { IDynamicHairDecodeInfo } from "@l2js/engine/contracts/skeletal-mesh";
import type { PawnLight_T } from "../rendering/components/pawn-light-component";

const tmpColorByte = new ColorByte();
const arrEmptyLights: DynamicLight[] = [];
const arrEmptyPawnLights: PawnLight_T[] = [];
const arrNoAmbient = [0, 0, 0];

export class LitSkinnedMesh extends SkinnedMesh {
    declare public readonly isLitSkinnedMesh: boolean;

    public scaledGlow: number = 1;
    public ambientGlow: number = 0;
    public isUnlit: boolean = false;
    public dynamicHairInfo: IDynamicHairDecodeInfo = null;
    public readonly meshOrigin = new Vector3();

    public constructor(geometry: BufferGeometry, material: Material | Material[]) {
        super(geometry, material);

        (this as any).isLitSkinnedMesh = true;
    }

    public updateActorLighting(zoneInfo: any, lights: DynamicLight[], sunAmbient: ColorByte, pawnLights: readonly PawnLight_T[] = arrEmptyPawnLights) {
        if (this.isUnlit) {
            // unlit renders at 1x: EnableLighting(0,0) + SetAmbientLight(255) (UnSkeletalMesh.cpp line 4900), 127 = 1.0 in the Modulate2X domain
            tmpColorByte.set(127, 127, 127);
            lights = arrEmptyLights;
            pawnLights = arrEmptyPawnLights;
        } else if (zoneInfo?.isSunAffected) {
            // one env plane, halved per byte (shr at 0x959d63) - the sun itself arrives as a hardware light
            tmpColorByte.copy(sunAmbient);
        } else {
            // SetAmbientLight 0x959d96 uses the unshifted zone color; retail measured (40,40,40).
            const ambient = zoneInfo?.ambient ?? arrNoAmbient;

            tmpColorByte.set(
                ambient[0] + this.ambientGlow,
                ambient[1] + this.ambientGlow,
                ambient[2] + this.ambientGlow
            );
        }

        const materials = this.material;
        const materialCount = Array.isArray(materials) ? materials.length : 1;

        for (let materialIndex = 0; materialIndex < materialCount; materialIndex++) {
            const material = Array.isArray(materials) ? materials[materialIndex] : materials;
            const uniforms = (material as any)?.uniforms;

            if (!uniforms?.actorLights) continue;

            const entries = uniforms.actorLights.value;
            const count = Math.min(lights.length, entries.length);
            const pawnCount = Math.min(pawnLights.length, entries.length - count);

            tmpColorByte.toFloats(uniforms.actorAmbient.value);
            uniforms.actorScaledGlow.value = this.scaledGlow;
            uniforms.numActorLights.value = count + pawnCount;

            for (let i = 0; i < count; i++) {
                const light = lights[i];
                const entry = entries[i];

                entry.position.copy(light.lightPosition);
                entry.direction.copy(light.lightDirection);
                light.color.toFloats(entry.color);
                entry.radius = light.lightRadius;
                entry.cone = light.cone;
                entry.effect = light.lightEffect;
                entry.isPawnLight = false;
            }

            for (let i = 0; i < pawnCount; i++) {
                const light = pawnLights[i];
                const entry = entries[count + i];

                entry.position.copy(light.position);
                entry.direction.copy(light.direction);
                entry.cone = light.cone;
                // D3DDrv SetPawnLight RVA 0x1cadc: halve RGB under EnableLighting's Modulate2X.
                entry.color.copy(light.color).multiplyScalar(0.5);
                entry.radius = light.radius;
                entry.effect = 0;
                entry.isPawnLight = true;
                entry.attenuation.copy(light.attenuation);
            }
        }
    }
}

export default LitSkinnedMesh;
