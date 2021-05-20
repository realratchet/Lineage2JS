import UObject from "./un-object";
import BufferValue from "../buffer-value";
import { FColor } from "./un-color";
import { Vector3 } from "three/src/math/Vector3";
import { MathUtils } from "three/src/math/MathUtils";
import { Euler } from "three/src/math/Euler";
import { Matrix4 } from "three/src/math/Matrix4";
import FRangeVector from "./un-range";
import { Plane } from "three";
import UPointRegion from "./un-point-region";

type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property").PropertyTag;

Object.assign(UObject.prototype, {
    async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> {
        switch (tag.structName) {
            case "Color": return await new FColor().load(pkg, tag);
            case "Plane": return (function () {
                const f = new BufferValue(BufferValue.float);
                const normal = ["x", "y", "z"].reduce((vec, ax: "x" | "y" | "z") => {
                    vec[ax] = pkg.read(f).value as number;
                    return vec;
                }, new Vector3());
                const constant = pkg.read(f).value as number;
                return new Plane(normal, constant);
            })();
            case "Vector": return ["x", "y", "z"].reduce((vec, ax: "x" | "y" | "z") => {
                vec[ax] = pkg.read(new BufferValue(BufferValue.float)).value as number;
                return vec;
            }, new Vector3());
            case "Rotator": return ["x", "y", "z"].reduce((euler, ax: "x" | "y" | "z") => {
                euler[ax] = pkg.read(new BufferValue(BufferValue.int32)).value as number * MathUtils.DEG2RAD;
                return euler;
            }, new Euler());
            case "Matrix": return (function () {
                const mat = new Matrix4();

                mat.elements.forEach((_, i, arr) => {
                    arr[i] = pkg.read(new BufferValue(BufferValue.float)).value as number;
                });

                return mat;
            })();
            case "PointRegion": return await new UPointRegion(tag.dataSize).load(pkg);
            case "RangeVector": return await new FRangeVector().load(pkg);
            default: throw new Error(`Unsupported struct type: ${tag.structName}`);
        }
    }
});