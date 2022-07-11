import UObject from "./un-object";
import { FColor } from "./un-color";
import { URange, URangeVector } from "./un-range";
import UPointRegion from "./un-point-region";
import UTextureModifyInfo from "./un-texture-modify-info";
import FScale from "./un-scale";
import UMatrix from "./un-matrix";
import { UPlane } from "./un-plane";
import FVector from "./un-vector";
import FRotator from "./un-rotator";

Object.assign(UObject.prototype, {
    readStruct(pkg: UPackage, tag: PropertyTag): any {
        switch (tag.structName) {
            case "Color": return new FColor().load(pkg);
            case "Plane": return new UPlane().load(pkg, tag);
            case "Scale": return new FScale().load(pkg);
            case "Vector": return new FVector().load(pkg);
            case "Rotator": return new FRotator().load(pkg);
            case "Matrix": return new UMatrix().load(pkg, tag);
            case "PointRegion": return new UPointRegion().load(pkg, tag as any);
            case "TextureModifyinfo": return new UTextureModifyInfo().load(pkg, tag as any);
            case "RangeVector": return new URangeVector().load(pkg, tag);
            case "Range": return new URange().load(pkg, tag);
            default: throw new Error(`Unsupported struct type: ${tag.structName}`);
        }
    }
});