import UObject from "../un-object";
import BufferValue from "../../buffer-value";
import FArray, { FPrimitiveArray } from "../un-array";
import FNumber from "../un-number";
import FRawColorStream from "../un-raw-color-stream";

class UStaticMeshIsntance extends UObject {
    protected unk: number; // unk compat
    protected unkZeroes = new FPrimitiveArray(BufferValue.uint32);
    protected readHeadOffset = 0;
    protected colorStream = new FRawColorStream();

    protected doLoad(pkg: UPackage, exp: UExport): this {
        const compat32 = new BufferValue(BufferValue.compat32);

        // // pkg.seek(12);

        super.doLoad(pkg, exp);

        this.colorStream.load(pkg, null);

        debugger;
        // this.colorStream.load(pkg, null);

        // debugger;

        const unkArr0 = new FPrimitiveArray(BufferValue.int32).load(pkg, null).getTypedArray();
        const unkArr1 = new FPrimitiveArray(BufferValue.int32).load(pkg, null).getTypedArray();

        const unkIndex0 = pkg.read(compat32).value as number;
        const unkIndex1 = pkg.read(compat32).value as number;

        this.readHead = pkg.tell();

        debugger;

        // this.unk = pkg.read(compat32).value as number;
        // this.unkZeroes.load(pkg);

        // this.readHead = pkg.tell();

        // debugger;

        return this;
    }

    // public async load(pkg: UPackage, exp: UExport): Promise<this> {
    //     const compat32 = new BufferValue(BufferValue.compat32);
    //     const uint32 = new BufferValue(BufferValue.uint32);
    //     const float = new BufferValue(BufferValue.float);

    //     this.objectName = `Exp_${exp.objectName}`;

    //     this.setReadPointers(exp);
    //     pkg.seek(this.readHead, "set");

    //     // console.log(this.readTail - this.readHead);

    //     this.unk = await pkg.read(compat32).value as number;
    //     await this.unkZeroes.load(pkg);

    //     this.readHead = pkg.tell();

    //     // console.log(this.readTail - this.readHead);

    //     // const arr = new Int32Array((await pkg.read(BufferValue.allocBytes(this.readTail - this.readHead)).value as DataView).buffer);

    //     // // const unk2 = await pkg.read(compat32).value as number;
    //     // // const unkInt = await pkg.read(float).value as number;

    //     // debugger;

    //     // // const unk2 = await pkg.read(compat32).value as number;

    //     let offset = pkg.tell();
    //     let bytesLeft = this.readTail - pkg.tell();

    //     // debugger;

    //     for (let i = 0; i < bytesLeft; i++) {

    //         const objectId = await pkg.read(compat32).value as number;

    //         if (objectId !== 0) {
    //             try {
    //                 const pkgName = pkg.getPackageName(objectId);
    //                 // console.log(`${objectId} -> ${pkgName}`);
    //             } catch (e) { }
    //         }

    //         // const tag = await PropertyTag.from(pkg, offset + i);

    //         // if (!tag.isValid()) continue;

    //         // if (
    //         //     true
    //         //     && tag.name !== "None"
    //         //     && tag.dataSize > 0
    //         //     && tag.type >= 0x1 && tag.type <= 0xf
    //         //     && tag.arrayIndex >= 0
    //         //     && !tag.name.startsWith("None,")
    //         //     // && tag.structName !== "EnableCollision" && tag.structName !== "EnableCollisionforShadow" && tag.structName !== "Material" && tag.structName !== "Cm_dg_inner_deco5" && tag.structName !== "Cm_dg_statue3"
    //         //     && (tag.type !== UNP_PropertyTypes.UNP_StructProperty || tag.type === UNP_PropertyTypes.UNP_StructProperty && tag.structName)
    //         //     // && (tag.type !== UNP_PropertyTypes.UNP_ArrayProperty || tag.type === UNP_PropertyTypes.UNP_ArrayProperty && tag.arrayIndex === 0 && tag.dataSize > 1)
    //         //     // && (tag.type === UNP_PropertyTypes.UNP_ObjectProperty || tag.type === UNP_PropertyTypes.UNP_ArrayProperty /*|| tag.type === UNP_PropertyTypes.UNP_ClassProperty*/)
    //         //     && !tag.name.startsWith("Cm_") && !tag.name.startsWith("oren_") && !tag.name.startsWith("cm_") && !tag.name.startsWith("dion_")
    //         //     && (tag.dataSize < bytesLeft)
    //         //     // && (tag.type !== UNP_PropertyTypes.UNP_ObjectProperty || tag.type === UNP_PropertyTypes.UNP_ObjectProperty && tag.dataSize <= 4)
    //         //     // && tag.name !== "EnableCollisionforShadow" && tag.name !== "EnableCollision" && tag.name !== "bNoDynamicShadowCast"
    //         // ) {
    //         //     console.log(i, tag);
    //         // }

    //     }

    //     // debugger;

    //     // // pkg.seek(20);


    //     // // pkg.dump(1);
    //     // // debugger;

    //     // this.readHead = pkg.tell();

    //     // await this.readNamedProps(pkg);

    //     // const bytesOffset = this.readTail - pkg.tell();

    //     // debugger;

    //     return this;
    // }

}

export default UStaticMeshIsntance;
export { UStaticMeshIsntance };