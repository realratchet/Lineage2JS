import { UExport, UObject } from "@l2js/core";
// import { FColor } from "./un-color";
// import { URange, URangeVector } from "./un-range";
// import UPointRegion from "./un-point-region";
// import UTextureModifyInfo from "./un-texture-modify-info";
// import FScale from "./un-scale";
// import FMatrix from "./un-matrix";
// import { UPlane } from "./un-plane";
// import FVector from "./un-vector";
// import FRotator from "./un-rotator";
import { generateUUID } from "three/src/math/MathUtils";

Object.assign(UObject.prototype, {
    uuid: generateUUID(),
    getDecodeInfo() { debugger; throw new Error(`'${this.constructor.name}' must implemented 'getDecodeInfo' method!`) },

    // readStruct(pkg: C.APackage, tag: C.PropertyTag): any {
    //     if (!tag)
    //         debugger;

    //     const exp = new UExport();

    //     exp.objectName = `${tag.name}[Struct]`;
    //     exp.offset = pkg.tell();
    //     exp.size = tag.dataSize;

    //     // switch (tag.structName) {
    //     //     // case "Vector": debugger; break;
    //     //     case "Plane": debugger; break;
    //     // }

    //     // switch(tag.structName) {
    //     //     case "Matrix": debugger; break;
    //     //     case "PointRegion": debugger; break;
    //     //     case "TextureModifyinfo": debugger; break;
    //     //     case "RangeVector": debugger; break;
    //     //     case "Range": debugger; break;
    //     // }

    //     switch (tag.structName as StructTypes_T) {
    //         case "Color": return new FColor().load(pkg);
    //         case "Scale": return new FScale().load(pkg);
    //         case "Vector": return new FVector().load(pkg);
    //         case "Rotator": return new FRotator().load(pkg);
    //         case "Plane": return new UPlane().load(pkg, exp);
    //         case "Matrix": return new FMatrix().load(pkg, exp);
    //         case "PointRegion": return new UPointRegion().load(pkg, exp);
    //         case "TextureModifyinfo": return new UTextureModifyInfo().load(pkg, exp);
    //         case "RangeVector": return new URangeVector().load(pkg, exp);
    //         case "Range": return new URange().load(pkg, exp);
    //         default: throw new Error(`Unsupported struct type: ${tag.structName}`);
    //     }
    // }
});