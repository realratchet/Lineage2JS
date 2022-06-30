function sampleLightColor(light: any, sampPosition /* param_1 */: FVector, sampNormal /* param_2 */: FVector): FColor {
    return null;
}

function sampleLightIntensity(light: any, sampPosition /* param_1 */: FVector, sampNormal /* param_2 */: FVector): number {

    let cVar1: number; // char
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

    /* 0x10f82  7629  ?SampleIntensity@FDynamicLight@@QAEMVFVector@@0@Z */
    // cVar1 = * (char *)(* (int *)this + 0x3a9);

    if (cVar1 === 0x13) { // what light type this may be?

        // what is this stack data?
        const unkA = 0; // in_stack_00000010 * * (float *)(this + 0x14); /// what is this???
        const unkB = 0; // in_stack_00000018 * * (float *)(this + 0x1c); /// what is this???
        const unkC = 0; // in_stack_00000014 * * (float *)(this + 0x18); /// what is this???

        const sumABC = unkA + unkB + unkC;

        if (sumABC < 0.0)
            return sumABC * -2.0;

    } else if (cVar1 === 0x11) { // what light type this may be?
        // fStack20 = * (float *)(this + 8) - _param_1;
        // fStack16 = * (float *)(this + 0xc) - _param_2;
        // fStack12 = * (float *)(this + 0x10) - in_stack_0000000c;
        // fVar4 = FVector:: SizeSquared((FVector *) & fStack20);
        // dVar6 = appSqrt((double)fVar4);
        // if (dVar6 < (double) * (float *)(this + 0x20)) {
        //     fVar4 = 1.0 - (fStack20 * fStack20 + fStack16 * fStack16) /
        //         (* (float *)(this + 0x20) * * (float *)(this + 0x20));
        //     if (fVar4 <= 0.0) {
        //         fVar4 = 0.0;
        //     }
        //     return fVar4 + fVar4;
        // }
    } else if (cVar1 === 0x0d) { // what light type this may be?
        // fStack20 = * (float *)(this + 8) - _param_1;
        // fStack16 = * (float *)(this + 0xc) - _param_2;
        // fStack12 = * (float *)(this + 0x10) - in_stack_0000000c;
        // fVar4 = FVector:: SizeSquared((FVector *) & fStack20);
        // dVar6 = appSqrt((double)fVar4);
        // fVar4 = fStack20 * in_stack_00000010 +
        //     fStack12 * in_stack_00000018 + fStack16 * in_stack_00000014;
        // if (((ushort)((ushort)(fVar4 < 0.0) << 8 | (ushort)(fVar4 == 0.0) << 0xe) == 0) &&
        //     ((float)dVar6 < * (float *)(this + 0x20))) {
        //     dVar6 = appSqrt((double)(1.02 - (float)dVar6 / * (float *)(this + 0x20)));
        //     return (float)dVar6 + (float)dVar6;
        // }
    } else if (cVar1 === 0x14) { // what light type this may be?
        // fStack20 = * (float *)(this + 8) - _param_1;
        // fStack16 = * (float *)(this + 0xc) - _param_2;
        // fStack12 = * (float *)(this + 0x10) - in_stack_0000000c;
        // fVar5 = FVector:: SizeSquared((FVector *) & fStack20);
        // fVar4 = * (float *)(this + 0x20) * * (float *)(this + 0x20);
        // fVar7 = fStack20 * in_stack_00000010 +
        //     fStack12 * in_stack_00000018 + fStack16 * in_stack_00000014;
        // if (((ushort)((ushort)(fVar7 < 0.0) << 8 | (ushort)(fVar7 == 0.0) << 0xe) == 0) &&
        //     (fVar5 < fVar4)) {
        //     fVar4 = 1.02 - fVar5 / fVar4;
        //     return fVar4 + fVar4;
        // }
    } else {
        if ((cVar1 !== 0x0C) && (cVar1 !== 0x08)) {
            // _param_1 = * (float *)(this + 8) - _param_1;
            // _param_2 = * (float *)(this + 0xc) - _param_2;
            // fVar7 = * (float *)(this + 0x10) - in_stack_0000000c;
            // fVar4 = * (float *)(this + 0x20);
            // fStack20 = _param_1;
            // fStack16 = _param_2;
            // fStack12 = fVar7;
            // fVar5 = FVector:: SizeSquared((FVector *) & fStack20);
            // dVar6 = appSqrt((double)fVar5);
            // fVar3 = thunk_FUN_10633cc0((float)dVar6, fVar4, _param_1, _param_2, fVar7, in_stack_00000010,
            //     in_stack_00000014, in_stack_00000018);
            // return (float)fVar3;
        }
        // fStack20 = * (float *)(this + 8) - _param_1;
        // fStack16 = * (float *)(this + 0xc) - _param_2;
        // fStack12 = * (float *)(this + 0x10) - in_stack_0000000c;
        // fVar4 = FVector:: SizeSquared((FVector *) & fStack20);
        // dVar6 = appSqrt((double)fVar4);
        // fVar3 = thunk_FUN_10633cc0((float)dVar6,* (float *)(this + 0x20), fStack20, fStack16, fStack12,
        //     in_stack_00000010, in_stack_00000014, in_stack_00000018);
        // if ((ushort)((ushort)(fVar3 < (float10)0.0) << 8 | (ushort)(fVar3 == (float10)0.0) << 0xe) == 0) {
        //     fVar7 = 1.0 - (float)(uint) * (byte *)(* (int *)this + 0x3b8) * 0.00390625;
        //     fVar5 = 1.0 / (1.0 - fVar7);
        //     fVar2 = -fStack20 * * (float *)(this + 0x14) +
        //         -fStack16 * * (float *)(this + 0x18) + -fStack12 * * (float *)(this + 0x1c);
        //     if (((ushort)((ushort)(fVar2 < 0.0) << 8 | (ushort)(fVar2 == 0.0) << 0xe) == 0) &&
        //         (fVar7 * fVar7 * fVar4 < fVar2 * fVar2)) {
        //         fVar4 = (fVar2 / (float)dVar6) * fVar5 - fVar5 * fVar7;
        //         return fVar4 * fVar4 * (float)fVar3;
        //     }
        // }
    }
    return 0.0;
}

export { sampleLightColor, sampleLightIntensity };