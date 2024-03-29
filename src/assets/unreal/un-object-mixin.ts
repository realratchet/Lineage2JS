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
import UExport from "./un-export";

Object.assign(UObject.prototype, {
    readStruct(pkg: UPackage, tag: PropertyTag): any {
        if (!tag)
            debugger;

        const exp = new UExport();

        exp.objectName = `${tag.name}[Struct]`;
        exp.offset = pkg.tell();
        exp.size = tag.dataSize;

        switch (tag.structName as StructTypes_T) {
            case "Color": return new FColor().load(pkg);
            case "Plane": return new UPlane().load(pkg, exp);
            case "Scale": return new FScale().load(pkg);
            case "Vector": return new FVector().load(pkg);
            case "Rotator": return new FRotator().load(pkg);
            case "Matrix": return new UMatrix().load(pkg, exp);
            case "PointRegion": return new UPointRegion().load(pkg, exp);
            case "TextureModifyinfo": return new UTextureModifyInfo().load(pkg, exp);
            case "RangeVector": return new URangeVector().load(pkg, exp);
            case "Range": return new URange().load(pkg, exp);
            default: throw new Error(`Unsupported struct type: ${tag.structName}`);
        }
    }
});