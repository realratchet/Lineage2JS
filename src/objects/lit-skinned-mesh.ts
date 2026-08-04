
import DynamicLight from "@client/objects/dynamic-light";
import { SkinnedMesh } from "three";
import { ColorByte } from "@client/utils/color-byte";

const tmpColorByte = new ColorByte();
const arrEmptyLights: DynamicLight[] = [];
const arrNoAmbient = [0, 0, 0];

class LitSkinnedMesh extends SkinnedMesh {
    public readonly isLitSkinnedMesh = true;

    public scaledGlow: number = 1;
    public ambientGlow: number = 0;
    public isUnlit: boolean = false;

    public updateActorLighting(zoneInfo: any, lights: DynamicLight[], sunAmbient: ColorByte) {
        if (this.isUnlit) {
            // unlit renders at 1x: EnableLighting(0,0) + SetAmbientLight(255) (UnSkeletalMesh.cpp line 4900), 127 = 1.0 in the Modulate2X domain
            tmpColorByte.set(127, 127, 127);
            lights = arrEmptyLights;
        } else if (zoneInfo?.isSunAffected) {
            // one env plane, halved per byte (shr at 0x959d63) - the sun itself arrives as a hardware light
            tmpColorByte.copy(sunAmbient);
        } else {
            // SetAmbientLight(Owner->AmbientColor) at 0x959d96, unshifted - measured (40,40,40) at
            // (17709,117342,-12072), exactly what this zone decodes to on our side
            const ambient = zoneInfo?.ambient ?? arrNoAmbient;

            tmpColorByte.set(
                ambient[0] + this.ambientGlow,
                ambient[1] + this.ambientGlow,
                ambient[2] + this.ambientGlow
            );
        }

        const materials = this.material instanceof Array ? this.material : [this.material];

        for (const material of materials) {
            const uniforms = (material as any)?.uniforms;

            if (!uniforms?.actorLights) continue;

            const entries = uniforms.actorLights.value;
            const count = Math.min(lights.length, entries.length);

            tmpColorByte.toFloats(uniforms.actorAmbient.value);
            uniforms.actorScaledGlow.value = this.scaledGlow;
            uniforms.numActorLights.value = count;

            for (let i = 0; i < count; i++) {
                const light = lights[i];
                const entry = entries[i];

                entry.position.copy(light.lightPosition);
                entry.direction.copy(light.lightDirection);
                light.color.toFloats(entry.color);
                entry.radius = light.lightRadius;
                entry.cone = light.cone;
                entry.effect = light.lightEffect;
            }
        }
    }
}

export default LitSkinnedMesh;
export { LitSkinnedMesh };
