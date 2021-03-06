import FConstructable from "./un-constructable";
import BufferValue from "../buffer-value";
import FVector from "./un-vector";

class USphere extends FConstructable {
    public center: FVector = new FVector();
    public radius: number;

    public load(pkg: UPackage): this {
        const f = new BufferValue(BufferValue.float);

        ["x", "y", "z"].forEach((ax: "x" | "y" | "z") => {
            this.center[ax] = pkg.read(f).value as number;
        });

        this.radius = pkg.read(f).value as number;

        return this;
    }

}

export default USphere;
export { USphere };