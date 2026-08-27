import FPlane from "./un-plane";

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