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
    async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> {
        switch (tag.structName) {
            case "Color": return await new FColor().load(pkg, tag);
            case "Plane": return await new UPlane().load(pkg, tag);
            case "Scale": return new FScale().load(pkg, tag);
            case "Vector": return await new FVector().load(pkg);
            case "Rotator": return new FRotator().load(pkg);
            case "Matrix": return await new UMatrix().load(pkg, tag);
            case "PointRegion": return await new UPointRegion(tag.dataSize).load(pkg);
            case "TextureModifyinfo": return await new UTextureModifyInfo(tag.dataSize).load(pkg);
            case "RangeVector": return await new URangeVector().load(pkg, tag);
            case "Range": return await new URange().load(pkg, tag);
            default: throw new Error(`Unsupported struct type: ${tag.structName}`);
        }
    }
});