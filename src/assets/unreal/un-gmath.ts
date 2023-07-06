class GMath {
    static ANGLE_SHIFT = 2;		// Bits to right-shift to get lookup value.
    static ANGLE_BITS = 14;		// Number of valid bits in angles.
    static NUM_ANGLES = 16384; 	// Number of angles that are in lookup table.
    static NUM_SQRTS = 16384;	// Number of square roots in lookup table.
    static ANGLE_MASK = ((1 << GMath.ANGLE_BITS) - 1) << (16 - GMath.ANGLE_BITS);

    static sin(i: number) { return TrigFLOAT[((i >> GMath.ANGLE_SHIFT) & (GMath.NUM_ANGLES - 1))]; }
    static cos(i: number) { return TrigFLOAT[(((i + 16384) >> GMath.ANGLE_SHIFT) & (GMath.NUM_ANGLES - 1))]; };
}

const TrigFLOAT = new Array<number>(GMath.NUM_ANGLES);
const SqrtFLOAT = new Array<number>(GMath.NUM_SQRTS);

// Init base angle table.
for (let i = 0; i < GMath.NUM_ANGLES; i++)
    TrigFLOAT[i] = Math.sin(i * 2 * Math.PI / GMath.NUM_ANGLES);

// Init square root table.

for (let i = 0; i < GMath.NUM_SQRTS; i++)
    SqrtFLOAT[i] = Math.sqrt(i / 16384);

export default GMath;
export { GMath };