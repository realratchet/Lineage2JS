import { Vector3 } from "three";

function sampleLightColor(light: any, sampPosition /* param_1 */: FVector, sampNormal /* param_2 */: FVector): FColor {
    return null;
}

function sampleLightIntensity(light: ILightRenderInfo, sampPosition /* param_1 */: FVector, sampNormal /* param_2 */: FVector): number {

    let lightType: LightType_T; // char
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

    lightType = light.type;

    if (lightType === 0x13) {
        //   if (normal.x * (this->someVector).x +
        //       normal.z * (this->someVector).z + normal.y * (this->someVector).y < 0.0) {
        //     return (normal.x * (this->someVector).x +
        //            normal.z * (this->someVector).z + normal.y * (this->someVector).y) * -2.0;
        //   }
    } else if (lightType === 0x11) {
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
    } else if (lightType === 0xd) {
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
    } else if (lightType === 0x14) {
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
    } else if ((lightType !== 0xc) && (lightType !== 0x8)) {
        const dt = new Vector3().copy(light.position).sub(sampPosition);
        const radius = light.radius;
        const len = dt.length();
        const intensity = calculateIntensity(len, radius, dt.x, dt.y, dt.z, sampNormal.x, sampNormal.y, sampNormal.z);

        // debugger;

        return intensity;
    } else {
        //   dt_pos.x = (this->likelyPosition).x - position.x;
        //   dt_pos.y = (this->likelyPosition).y - position.y;
        //   dt_pos.z = (this->likelyPosition).z - position.z;
        //   fVar1 = FVector::SizeSquared(&dt_pos);
        //   dVar5 = appSqrt((double)fVar1);
        //   fVar4 = calculateIntensity((float)dVar5,this->field4_0x20,dt_pos.x,dt_pos.y,dt_pos.z,normal.x,
        //                              normal.y,normal.z);
        //   if ((ushort)((ushort)(fVar4 < 0.0) << 0x8 | (ushort)(fVar4 == 0.0) << 0xe) == 0x0) {
        //     fVar2 = 1.0 - (float)(uint)*(byte *)&this->light[0xb].field72_0x48 * 0.00390625;
        //     fVar6 = 1.0 / (1.0 - fVar2);
        //     fVar3 = -dt_pos.x * (this->someVector).x +
        //             -dt_pos.y * (this->someVector).y + -dt_pos.z * (this->someVector).z;
        //     if (((ushort)((ushort)(fVar3 < 0.0) << 0x8 | (ushort)(fVar3 == 0.0) << 0xe) == 0x0) &&
        //        (fVar2 * fVar2 * fVar1 < fVar3 * fVar3)) {
        //       fVar1 = (fVar3 / (float)dVar5) * fVar6 - fVar6 * fVar2;
        //       return fVar1 * fVar1 * fVar4;
        //     }
        //   }
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

    // debugger;

    if (
        (((Number(planeOffset < 0.0)) << 0x8 | (Number(planeOffset === 0.0)) << 0xe) === 0x0) &&
        (distance < lightRadius !== (distance === lightRadius))
    ) {

        fVar1 = distance * (1.0 / lightRadius);
        fVar2 = fVar1 * fVar1 * fVar1;
        planeOffset = (1.0 / lightRadius) * planeOffset;

        if (planeOffset < 0.0) planeOffset = -planeOffset;

        planeOffset = (planeOffset / fVar1) * (((fVar2 + fVar2) - fVar1 * fVar1 * 3.0) + 1.0);

        return planeOffset + planeOffset;
    }
    return 0.0;
}

