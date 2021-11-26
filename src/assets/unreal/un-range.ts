// import FConstructable from "./un-constructable";
// import UPackage from "./un-package";
// import { Vector2 } from "three";
// import BufferValue from "../buffer-value";

// class FRangeVector extends FConstructable {
//     public static readonly typeSize: number = 1;

//     public x: Vector2 = new Vector2();
//     public y: Vector2 = new Vector2();
//     public z: Vector2 = new Vector2();

//     public async load(pkg: UPackage): Promise<this> {
//         const f = new BufferValue(BufferValue.float);

//         ["x", "y"].forEach((r: "x" | "y") => {
//             [this.x, this.y, this.z].forEach(ax => {
//                 ax[r] = pkg.read(f).value as number;
//             });
//         });

//         return this;
//     }
// }

// export default FRangeVector;
// export { FRangeVector };

import { PropertyTag } from "./un-property";
import UPackage from "./un-package";
import UObject from "./un-object";

class URange extends UObject {
    protected min: number;
    protected max: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Min": "min",
            "Max": "max"
        });
    }

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;

        this.readNamedProps(pkg);

        return this;
    }
}

class URangeVector extends UObject {
    protected x: URange;
    protected y: URange;
    protected z: URange;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "X": "x",
            "Y": "y",
            "Z": "z"
        });
    }

    public load(pkg: UPackage, tag: PropertyTag): this {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;

        this.readNamedProps(pkg);

        return this;
    }
}

export default URange;
export { URange, URangeVector };