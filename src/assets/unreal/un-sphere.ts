import FPlane from "./un-plane";
import type { Vector3Arr } from "./library-types";

type ISphereDecodeInfo = { center: Vector3Arr, radius: number };

abstract class USphere extends FPlane {
    // public center: FVector = new FVector();
    // public radius: number;

    // public load(pkg: UPackage): this {
    //     ["x", "y", "z"].forEach((ax: "x" | "y" | "z") => {
    //         this.center[ax] = pkg.read("float");
    //     });

    //     this.radius = pkg.read("float");

    //     return this;
    // }
}

export default USphere;
export { USphere };
export type { ISphereDecodeInfo };
