import FConstructable from "./un-constructable";
import { Vector3 } from "three";
import BufferValue from "../buffer-value";

type UPackage = import("./un-package").UPackage;

class USphere extends FConstructable {
    public center: Vector3 = new Vector3();
    public radius: number;

    public async load(pkg: UPackage): Promise<this> {
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