import FVector from "./un-vector";
import { BufferValue, UObject } from "@l2js/core";

class USphere extends UObject {
    // public center: FVector = new FVector();
    // public radius: number;

    // public load(pkg: UPackage): this {
    //     const f = new BufferValue(BufferValue.float);

    //     ["x", "y", "z"].forEach((ax: "x" | "y" | "z") => {
    //         this.center[ax] = pkg.read(f).value as number;
    //     });

    //     this.radius = pkg.read(f).value as number;

    //     return this;
    // }
}

export default USphere;
export { USphere };