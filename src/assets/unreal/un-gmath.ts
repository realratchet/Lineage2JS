import FCoords from "@client/assets/unreal/un-coords";
import FScale, { ESheerAxis_T } from "@client/assets/unreal/un-scale";
import FVector from "@client/assets/unreal/un-vector";



class GMathSingleton {
    public readonly ANGLE_SHIFT = 2;        // Bits to right-shift to get lookup value.
    public readonly ANGLE_BITS = 14;        // Number of valid bits in angles.
    public readonly NUM_ANGLES = 16384;     // Number of angles that are in lookup table.
    public readonly NUM_SQRTS = 16384;     // Number of square roots in lookup table.
    public readonly ANGLE_MASK = ((1 << this.ANGLE_BITS) - 1) << (16 - this.ANGLE_BITS);

    protected readonly TrigFLOAT: number[];
    protected readonly SqrtFLOAT: number[];

    public readonly worldMin: FVector;
    public readonly worldMax: FVector;
    public readonly unitCoords: FCoords;
    public readonly viewCoords: FCoords;
    public readonly unitScale: FScale;

    public sin(i: number) { return this.TrigFLOAT[((i >> this.ANGLE_SHIFT) & (this.NUM_ANGLES - 1))]; }
    public cos(i: number) { return this.TrigFLOAT[(((i + 16384) >> this.ANGLE_SHIFT) & (this.NUM_ANGLES - 1))]; };

    public constructor() {
        this.TrigFLOAT = new Array<number>(this.NUM_ANGLES);
        this.SqrtFLOAT = new Array<number>(this.NUM_SQRTS);

        // Init base angle table.
        for (let i = 0; i < this.NUM_ANGLES; i++)
            this.TrigFLOAT[i] = Math.sin(i * 2 * Math.PI / this.NUM_ANGLES);

        // Init square root table.

        for (let i = 0; i < this.NUM_SQRTS; i++)
            this.SqrtFLOAT[i] = Math.sqrt(i / 16384);

        this.worldMin = FVector.make(-32700, -32700, -32700)
        this.worldMax = FVector.make(32700, 32700, 32700)
        this.unitCoords = FCoords.make(FVector.make(0, 0, 0), FVector.make(1, 0, 0), FVector.make(0, 1, 0), FVector.make(0, 0, 1))
        this.viewCoords = FCoords.make(FVector.make(0, 0, 0), FVector.make(0, 1, 0), FVector.make(0, 0, -1), FVector.make(1, 0, 0))
        this.unitScale = FScale.make(FVector.make(1, 1, 1), 0, ESheerAxis_T.SHEER_ZX)
    }
}

let instance: GMathSingleton = null;

function GMath() {
    if (!instance)
        instance = new GMathSingleton();

    return instance;
}

export default GMath;
export { GMath };