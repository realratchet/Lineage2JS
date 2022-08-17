import BufferValue from "../buffer-value";
import { UNP_PropertyTypes, PropertyTag } from "./un-property";
import FArray, { FPrimitiveArray } from "./un-array";
import { generateUUID } from "three/src/math/MathUtils";

const CLEANUP_NAMESPACE = true;

abstract class UObject {
    public objectName = "Exp_None";
    public exportIndex?: number = null;
    public exp?: UExport = null;

    public readonly uuid = generateUUID();
    public readonly careUnread: boolean = true;

    public skipRemaining: boolean = false;

    protected promisesLoading: Promise<any>[] = [];
    protected readHead: number = NaN;
    protected readStart: number = NaN;
    protected readTail: number = NaN;
    protected readHeadOffset: number = 0;

    public constructor(...params: any[]) { }

    protected getSignedMap(): GenericObjectContainer_T<boolean> { return {}; }
    protected getPropertyMap(): GenericObjectContainer_T<string> { return {}; }

    protected setReadPointers(exp: UExport) {
        this.readStart = this.readHead = exp.offset.value as number + this.readHeadOffset;
        this.readTail = this.readHead + (exp.size.value as number);
    }

    public get byteCount() { return this.readTail - this.readStart; }
    public get bytesUnread() { return this.readTail - this.readHead; }
    public get byteOffset() { return this.readHead - this.readStart; }

    protected readNamedProps(pkg: UPackage) {
        pkg.seek(this.readHead, "set");

        const tags = [];

        do {
            const tag = PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid()) break;

            tags.push(tag.name + "/" + tag.type);

            this.promisesLoading.push(this.loadProperty(pkg, tag));
            this.readHead = pkg.tell();

        } while (this.readHead < this.readTail);

        // if (this.objectName === "Exp_TerrainInfo0") {
        //     console.log(this.objectName, "\n\t->" + tags.join("\n\t->"));

        //     debugger;
        // }

        this.readHead = pkg.tell();
    }

    protected preLoad(pkg: UPackage, exp: UExport): void {
        this.objectName = `Exp_${exp.objectName}`;
        this.exportIndex = exp.index;
        this.exp = exp;

        // const compat32 = new BufferValue(BufferValue.compat32);
        // const int32 = new BufferValue(BufferValue.int32);
        // const int8 = new BufferValue(BufferValue.int8);
        // const uint8 = new BufferValue(BufferValue.uint8);
        // pkg.seek(exp.offset.value as number, "set");

        // let hasOffset = false;
        // let headOffset: number = 0;

        // const imports = [];
        // const exports = [];


        // // if (this.readHeadOffset > 0)
        // //     debugger;

        // if (this.objectName === "Exp_Brush150")
        //     debugger;

        // if (this.readHeadOffset > 0/*this.objectName === "Exp_Brush52"*/) {
        //     // debugger;
        //     // pkg.seek(exp.offset.value as number, "set");
        //     // pkg.dump(2);

        //     // pkg.seek((exp.offset.value as number) + (exp.size.value as number) - 32, "set");
        //     // pkg.dump(2);


        //     // debugger;

        //     // const a = pkg.read(uint8).value as number;
        //     // const offset = pkg.tell() - (exp.offset.value as number)

        //     // pkg.seek((exp.offset.value as number) + (exp.size.value as number) - offset, "set");

        //     // const b = pkg.read(uint8).value as number;

        //     // debugger;



        //     // debugger;
        //     const b1 = pkg.read(compat32).value as number;

        //     if (b1 < 0) {
        //         const b2 = pkg.read(compat32).value as number;
        //         const runningOffset_2 = pkg.tell() - (exp.offset.value as number)

        //         const b3 = pkg.read(compat32).value as number;
        //         const runningOffset_3 = pkg.tell() - (exp.offset.value as number)

        //         if (b3 !== 1)
        //             debugger;

        //         // debugger;

        //         const b4 = pkg.read(compat32).value as number;
        //         const runningOffset_4 = pkg.tell() - (exp.offset.value as number)

        //         if (b4 !== 0) {
        //             const b5 = pkg.read(compat32).value as number;
        //             const runningOffset_5 = pkg.tell() - (exp.offset.value as number)

        //             debugger;
        //         }


        //         // const b5 = pkg.read(compat32).value as number;
        //         // const runningOffset_5 = pkg.tell() - (exp.offset.value as number)


        //         let runningOffset = runningOffset_4;

        //         // const bytes = [];
        //         // let moreThanOne = false;

        //         // do {
        //         //     const b4 = pkg.read(uint8).value as number;
        //         //     runningOffset = pkg.tell() - (exp.offset.value as number)

        //         //     bytes.push(`0x${b4.toString(16)}`)

        //         //     if (b4 & 0x80) {
        //         //         if (!moreThanOne) continue;
        //         //         break;
        //         //     }


        //         //     moreThanOne = b4 !== 0;
        //         // } while (true);

        //         // debugger;

        //         // const b4 = pkg.read(uint8).value as number;
        //         // const runningOffset_4 = pkg.tell() - (exp.offset.value as number)

        //         // const b5 = pkg.read(uint8).value as number;
        //         // const runningOffset_5 = pkg.tell() - (exp.offset.value as number)

        //         // const b6 = pkg.read(uint8).value as number;
        //         // const runningOffset_6 = pkg.tell() - (exp.offset.value as number)

        //         // const b7 = pkg.read(uint8).value as number;
        //         // const runningOffset_7 = pkg.tell() - (exp.offset.value as number)


        //         // debugger;

        //         // const b7 = pkg.read(int32).value as number;
        //         // const runningOffset_7 = pkg.tell() - (exp.offset.value as number)

        //         // console.assert(runningOffset_7 === this.readHeadOffset);

        //         // pkg.seek(8)

        //         // const b7 = pkg.read(compat32).value as number;
        //         // const runningOffset_7 = pkg.tell() - (exp.offset.value as number)

        //         // const b3 = pkg.read(int32).value as number;
        //         // const runningOffset_3 = pkg.tell() - (exp.offset.value as number)

        //         // const b4 = pkg.read(int32).value as number;
        //         // const runningOffset_4 = pkg.tell() - (exp.offset.value as number)

        //         // const b5 = pkg.read(int8).value as number;
        //         // const runningOffset_5 = pkg.tell() - (exp.offset.value as number)

        //         // const b6 = pkg.read(int8).value as number;
        //         // const runningOffset_6 = pkg.tell() - (exp.offset.value as number)

        //         // const b7 = pkg.read(compat32).value as number;
        //         // const runningOffset_7 = pkg.tell() - (exp.offset.value as number)


        //         // debugger;

        //         // if (runningOffset !== 15 && runningOffset !== 17)
        //         //     debugger;

        //         if (this.objectName === "Exp_Brush150")
        //             debugger;

        //         if (this.objectName === "Exp_Brush52")
        //             debugger;

        //         // debugger;

        //         // if (runningOffset < 15)
        //         //     debugger;


        //         // if (this.readHeadOffset === runningOffset) {
        //         //     debugger;
        //         // } else {
        //         //     debugger;
        //         // }

        //         // this.readHeadOffset = runningOffset + 4;
        //     }
        // }

        // // do {
        // //     const b = pkg.read(compat32).value as number;
        // //     const runningOffset = pkg.tell() - (exp.offset.value as number)

        // //     if (b < 0) {
        // //         hasOffset = true;

        // //         // if (b === -1) {
        // //         //     headOffset = runningOffset;
        // //         //     break;
        // //         // }

        // //         // imports.push(pkg.imports[-b - 1].objectName);

        // //         continue;
        // //     }

        // //     if (!hasOffset) { //  roll back
        // //         headOffset = 0;
        // //         break;
        // //     } else {
        // //         exports.push(pkg.nameTable[b].name.value);
        // //     }

        // // } while (true);

        // // this.readHeadOffset = headOffset;

        this.setReadPointers(exp);
    }

    protected doLoad(pkg: UPackage, exp: UExport): void { this.readNamedProps(pkg); }

    protected postLoad(pkg: UPackage, exp: UExport): void {
        if (this.skipRemaining) this.readHead = this.readTail;
        if (this.bytesUnread > this.readHeadOffset && this.careUnread)
            console.warn(`Unread '${this.objectName}' (${this.constructor.name}) ${this.bytesUnread} bytes (${((this.bytesUnread) / 1024).toFixed(2)} kB) in package '${pkg.path}'`);

        this.readHead = pkg.tell();
    }

    public load(pkg: UPackage, exp: UExport): this {
        this.preLoad(pkg, exp);
        this.doLoad(pkg, exp);
        this.postLoad(pkg, exp);

        return this;
    }

    protected getPropCount(propName: string) {
        const props = this.getPropertyMap();
        const varName = props[propName];
        const _var = (this as any)[varName];

        return _var instanceof Array && !(_var instanceof FArray)
            ? _var.length
            : _var instanceof Set
                ? Infinity
                : 1;
    }

    protected async loadProperty(pkg: UPackage, tag: PropertyTag) {
        const offStart = pkg.tell();
        const offEnd = offStart + tag.dataSize;

        if (tag.arrayIndex < 0 || tag.arrayIndex >= this.getPropCount(tag.name))
            throw new Error(`Something went wrong, expected index '${tag.arrayIndex} (max: '${this.getPropCount(tag.name)}')'.`);

        const isSigned = this.getPropertyIsSigned(tag);

        switch (tag.type) {
            case UNP_PropertyTypes.UNP_ByteProperty:
                this.setProperty(tag, pkg.read(new BufferValue(isSigned ? BufferValue.int8 : BufferValue.uint8)).value as number);
                break;
            case UNP_PropertyTypes.UNP_IntProperty:
                this.setProperty(tag, pkg.read(new BufferValue(isSigned ? BufferValue.int32 : BufferValue.uint32)).value as number);
                break;
            case UNP_PropertyTypes.UNP_BoolProperty: this.setProperty(tag, tag.boolValue); break;
            case UNP_PropertyTypes.UNP_FloatProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.float)).value as number);
                break;
            case UNP_PropertyTypes.UNP_ObjectProperty: {
                // if (tag.name === "StaticMeshLod01" || tag.name === "StaticMeshLod02" || tag.name === "PhysicsVolume") {
                //     throw new Error("Unsupported yet.");
                //     //printf("Skipping object property: %s\n", Name);
                //     // pkg.read(index);
                // } else {
                const objIndex = pkg.read(new BufferValue(BufferValue.compat32));
                const obj = await pkg.fetchObject(objIndex.value as number);

                this.setProperty(tag, obj);
                // pkg.seek(offEnd, "set");
                // }
            } break;
            case UNP_PropertyTypes.UNP_NameProperty:
                this.setProperty(tag, pkg.nameTable[pkg.read(new BufferValue(BufferValue.compat32)).value as number].name.value);
                break;
            case UNP_PropertyTypes.UNP_StrProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.char)).value as string);
                break;
            case UNP_PropertyTypes.UNP_StringProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_ArrayProperty: this.readArray(pkg, tag); break;
            case UNP_PropertyTypes.UNP_ClassProperty: {
                // const start = pkg.tell();
                // const objIndex = pkg.read(new BufferValue(BufferValue.compat32));
                // const offset = pkg.tell() - start;
                // pkg.seek(4 * 3);
                debugger;
            } break;
            case UNP_PropertyTypes.UNP_VectorProperty:
            case UNP_PropertyTypes.UNP_RotatorProperty:
                debugger;
                // this.setProperty(tag, (function () {
                //     const f = new BufferValue(BufferValue.float);
                //     const out = new Array<number>(3);

                //     for (let i = 0; i < 3; i++)
                //         out[i] = pkg.read(f).value as number;

                //     return out;
                // })());
                break;
            case UNP_PropertyTypes.UNP_MapProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_FixedArrayProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_StructProperty:
                this.setProperty(tag, this.readStruct(pkg, tag));
                break;
            default:
                debugger;
                pkg.seek(tag.dataSize);
                console.warn(`Unknown data type '${tag.type}' for '${tag.name}' skipping ${tag.dataSize} bytes.`);
                break;
        }

        pkg.seek(offEnd, "set");

        if (pkg.tell() < offEnd)
            console.warn(`Unread '${tag.name}' ${offEnd - pkg.tell()} bytes (${((offEnd - pkg.tell()) / 1024).toFixed(2)} kB) for package '${pkg.path}'`);
    }

    protected readArray(pkg: UPackage, tag: PropertyTag) {
        const props = this.getPropertyMap();
        const { name: propName } = tag;

        if (!(propName in props))
            throw new Error(`Unrecognized property '${propName}' for '${this.constructor.name}'`);

        const varName = props[propName];

        if (!this.hasOwnProperty(varName))
            throw new Error(`Cannot map property '${propName}' -> ${varName}`);

        const _var = (this as any)[varName] as FArray;

        if (!(_var instanceof FArray) && !((_var as any) instanceof FPrimitiveArray))
            throw new Error(`Unrecognized property '${propName}' for '${this.constructor.name}' is not FArray`);

        _var.load(pkg, tag);

        return true;
    }

    protected getPropertyIsSigned(tag: PropertyTag): boolean {
        const props = this.getSignedMap();
        const { name: propName } = tag;

        if (!(propName in props))
            return true;

        return props[propName];
    }

    protected getPropertyVarName(tag: PropertyTag): string {
        const props = this.getPropertyMap();
        const { name: propName } = tag;

        if (!(propName in props))
            return null;

        return props[propName];
    }

    protected setProperty(tag: PropertyTag, value: any) {
        const varName = this.getPropertyVarName(tag);
        const { name: propName, arrayIndex } = tag;

        if (!varName)
            throw new Error(`Unrecognized property '${propName}' for '${this.constructor.name}' of type '${value === null ? "NULL" : typeof (value) === "object" ? value.constructor.name : typeof (value)}'`);

        if (!this.hasOwnProperty(varName))
            throw new Error(`Cannot map property '${propName}' -> ${varName}`);;

        if ((this as any)[varName] instanceof Array) ((this as any)[varName] as Array<any>)[arrayIndex] = value;
        else if ((this as any)[varName] instanceof Set) ((this as any)[varName] as Set<any>).add(value);
        else (this as any)[varName] = value;

        // console.log(`Setting '${this.constructor.name}' property: ${propName}[${arrayIndex}] -> ${typeof (value) === "object" && value !== null ? value.constructor.name : value}`);

        return true;
    }

    public async onLoaded(): Promise<void> {
        try {
            await Promise.all(this.promisesLoading);

            if (CLEANUP_NAMESPACE) {
                Object.values(this.getPropertyMap()).forEach(propName => {
                    if ((this as any)[propName] === undefined)
                        delete (this as any)[propName];
                });
            }
        } catch (e) {
            // debugger;
            throw e;
        }
    }

    protected async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> { throw new Error("Mixin not loaded."); }
}

export default UObject;
export { UObject };