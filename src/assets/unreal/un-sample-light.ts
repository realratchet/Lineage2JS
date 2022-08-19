import { Vector3 } from "three";

function sampleLightColor(light: any, sampPosition /* param_1 */: FVector, sampNormal /* param_2 */: FVector): FColor {
    return null;
}

function sampleLightIntensity(light: ILightRenderInfo, sampPosition /* param_1 */: FVector, sampNormal /* param_2 */: FVector): number {

    let lightEffect: LightEffect_T; // char
    let fVar2: number; // float
    let fVar3: number; // float10
    let fVar4: number; // float
    let fVar5: number; // float
    let dVar6: number; // double
    let in_stack_00000005: any = null; // undefined3
    let in_stack_00000009: any = null; // undefined3
    let in_stack_0000000c: number; // float
    let in_stack_00000010: number; // float
    let in_stack_00000014: number; // float
    let in_stack_00000018: number; // float
    let fVar7: number; // float
    let fStack20: number; // float
    let fStack16: number; // float
    let fStack12: number; // float

    lightEffect = light.effect;

    // debugger;

    if (lightEffect === 0x13) {
        const dotProduct = sampNormal.x * light.direction.x + sampNormal.z * light.direction.z + sampNormal.y * light.direction.y;

        if (dotProduct < 0.0) {
            return dotProduct * -2.0;
        }
    } else if (lightEffect === 0x11) {
        //   dt_pos.x = (this->likelyPosition).x - position.x;
        //   dt_pos.y = (this->likelyPosition).y - position.y;
        //   dt_pos.z = (this->likelyPosition).z - position.z;
        //   fVar1 = FVector::SizeSquared(&dt_pos);
        //   dVar5 = appSqrt((double)fVar1);
        //   if (dVar5 < (double)this->field4_0x20) {
        //     fVar1 = 1.0 - (dt_pos.x * dt_pos.x + dt_pos.y * dt_pos.y) /
        //                   (this->field4_0x20 * this->field4_0x20);
        //     if (fVar1 <= 0.0) {
        //       fVar1 = 0.0;
        //     }
        //     return fVar1 + fVar1;
        //   }

        debugger;
    } else if (lightEffect === 0xd) {
        //   dt_pos.x = (this->likelyPosition).x - position.x;
        //   dt_pos.y = (this->likelyPosition).y - position.y;
        //   dt_pos.z = (this->likelyPosition).z - position.z;
        //   fVar1 = FVector::SizeSquared(&dt_pos);
        //   dVar5 = appSqrt((double)fVar1);
        //   fVar1 = dt_pos.x * normal.x + dt_pos.z * normal.z + dt_pos.y * normal.y;
        //   if (((ushort)((ushort)(fVar1 < 0.0) << 0x8 | (ushort)(fVar1 == 0.0) << 0xe) == 0x0) &&
        //      ((float)dVar5 < this->field4_0x20)) {
        //     dVar5 = appSqrt((double)(1.02 - (float)dVar5 / this->field4_0x20));
        //     return (float)dVar5 + (float)dVar5;
        //   }

        debugger;
    } else if (lightEffect === 0x14) {
        //   dt_pos.x = (this->likelyPosition).x - position.x;
        //   dt_pos.y = (this->likelyPosition).y - position.y;
        //   dt_pos.z = (this->likelyPosition).z - position.z;
        //   fVar2 = FVector::SizeSquared(&dt_pos);
        //   fVar1 = this->field4_0x20 * this->field4_0x20;
        //   fVar4 = dt_pos.x * normal.x + dt_pos.z * normal.z + dt_pos.y * normal.y;
        //   if (((ushort)((ushort)(fVar4 < 0.0) << 0x8 | (ushort)(fVar4 == 0.0) << 0xe) == 0x0) &&
        //      (fVar2 < fVar1)) {
        //     fVar1 = 1.02 - fVar2 / fVar1;
        //     return fVar1 + fVar1;
        //   }

        debugger;
    } else if ((lightEffect !== 0xc) && (lightEffect !== 0x8)) {
        const dt = new Vector3().copy(light.position).sub(sampPosition);
        const radius = light.radius;
        const len = dt.length();
        const intensity = calculateIntensity(len, radius, dt.x, dt.y, dt.z, sampNormal.x, sampNormal.y, sampNormal.z);

        // debugger;

        return intensity;
    } else {
        const dt = new Vector3().copy(light.position).sub(sampPosition);
        const radius = light.radius;
        const lightSize = dt.lengthSq();
        const dVar1 = Math.sqrt(lightSize);
        const dx = calculateIntensity(dVar1, radius, dt.x, dt.y, dt.z, sampNormal.x, sampNormal.y, sampNormal.z);

        if (dx > 0.0) {
            const magicVariable = 128; // might be saturation
            const dy = 1.0 - magicVariable * 0.00390625;
            const dz = 1.0 / (1.0 - dy);
            const direction = light.direction;
            const fVar2 = -dt.x * direction.x + -dt.y * direction.y + -dt.z * direction.z;

            if (fVar2 > 0.0 &&
                (dy * dy * lightSize < fVar2 * fVar2)) {
                const finalLightSize = (fVar2 / dVar1) * dz - dz * dy;
                const value = finalLightSize * finalLightSize * dx;

                return value;
            }
        }

        // debugger;
    }
    return 0.0;
}

export { sampleLightColor, sampleLightIntensity };



function calculateIntensity(
    distance: number, lightRadius: number,
    x: number, y: number, z: number,
    nx: number, ny: number, nz: number
) {
    let fVar1: number;
    let fVar2: number;
    let planeOffset: number;

    planeOffset = nx * x + ny * y + nz * z;

    if (planeOffset > 0 && distance <= lightRadius) {
        fVar1 = distance * (1.0 / lightRadius);
        fVar2 = fVar1 * fVar1 * fVar1;
        planeOffset = (1.0 / lightRadius) * planeOffset;

        if (planeOffset < 0.0) planeOffset = -planeOffset;

        planeOffset = (planeOffset / fVar1) * (((fVar2 + fVar2) - fVar1 * fVar1 * 3.0) + 1.0);

        return 2 * planeOffset;
    }
    return 0.0;
}

