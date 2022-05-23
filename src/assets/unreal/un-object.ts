import BufferValue from "../buffer-value";
import { UNP_PropertyTypes, PropertyTag } from "./un-property";
import FArray, { FPrimitiveArray } from "./un-array";
import { generateUUID } from "three/src/math/MathUtils";

abstract class UObject {
    public objectName = "Exp_None";
    public readonly uuid = generateUUID();

    protected promisesLoading: Promise<any>[] = [];
    protected readHead: number = NaN;
    protected readStart: number = NaN;
    protected readTail: number = NaN;
    protected readHeadOffset: number = 0;

    public constructor(...params: any[]) { }

    protected getPropertyMap(): { [key: string]: string } { return {}; }

    protected setReadPointers(exp: UExport) {
        this.readStart = this.readHead = exp.offset.value as number + this.readHeadOffset;
        this.readTail = this.readHead + (exp.size.value as number);
    }

    public get byteCount() { return this.readTail - this.readStart; }
    public get bytesUnread() { return this.readTail - this.readHead; }
    public get byteOffset() { return this.readHead - this.readStart; }

    protected readNamedProps(pkg: UPackage) {
        pkg.seek(this.readHead, "set");
        do {
            const tag = PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid()) break;

            // if (tag.name === "USize" || tag.name === "UClamp")
            //     debugger;

            this.promisesLoading.push(this.loadProperty(pkg, tag));
            this.readHead = pkg.tell();

        } while (this.readHead < this.readTail);

        // debugger;

        this.readHead = pkg.tell();

        // debugger;
    }

    protected preLoad(pkg: UPackage, exp: UExport): void {
        this.objectName = `Exp_${exp.objectName}`;
        this.setReadPointers(exp);
    }

    protected doLoad(pkg: UPackage, exp: UExport): void { this.readNamedProps(pkg); }

    protected postLoad(pkg: UPackage, exp: UExport): void {
        if (pkg.tell() < this.readTail && (this.readTail - pkg.tell()) > 17 && this.constructor.name !== "USound" && this.constructor.name !== "UStaticMesh")
            console.warn(`Unread '${this.objectName}' (${this.constructor.name}) ${this.readTail - pkg.tell()} bytes (${((this.readTail - pkg.tell()) / 1024).toFixed(2)} kB) in package '${pkg.path}'`);

        this.readHead = pkg.tell();
    }

    public load(pkg: UPackage, exp: UExport): this {
        // if(exp.objectName.includes("LOD")) debugger;

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

        switch (tag.type) {
            case UNP_PropertyTypes.UNP_ByteProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.int8)).value as number);
                break;
            case UNP_PropertyTypes.UNP_IntProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.int32)).value as number);
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
                pkg.seek(offEnd, "set");
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
                const start = pkg.tell();
                const objIndex = pkg.read(new BufferValue(BufferValue.compat32));
                const offset = pkg.tell() - start;
                debugger;
            } break;
            case UNP_PropertyTypes.UNP_VectorProperty:
            case UNP_PropertyTypes.UNP_RotatorProperty:
                debugger;
                this.setProperty(tag, (function () {
                    const f = new BufferValue(BufferValue.float);
                    const out = new Array<number>(3);

                    for (let i = 0; i < 3; i++)
                        out[i] = pkg.read(f).value as number;

                    return out;
                })());
                break;
            case UNP_PropertyTypes.UNP_MapProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_FixedArrayProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_StructProperty:
                this.setProperty(tag, this.readStruct(pkg, tag));
                break;
            default:
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

    protected getPropertyVarName(tag: PropertyTag): string {
        const props = this.getPropertyMap();
        const { name: propName } = tag;

        if (!(propName in props))
            return null;

        const varName = props[propName];

        return varName;
    }

    protected setProperty(tag: PropertyTag, value: any) {
        const varName = this.getPropertyVarName(tag);
        const { name: propName, arrayIndex } = tag;

        if (!varName)
            throw new Error(`Unrecognized property '${propName}' for '${this.constructor.name}' of '${value === null ? "NULL" : typeof (value) === "object" ? value.constructor.name : typeof (value)}'`);

        if (!this.hasOwnProperty(varName))
            throw new Error(`Cannot map property '${propName}' -> ${varName}`);

        if ((this as any)[varName] instanceof Array) ((this as any)[varName] as Array<any>)[arrayIndex] = value;
        else if ((this as any)[varName] instanceof Set) ((this as any)[varName] as Set<any>).add(value);
        else (this as any)[varName] = value;

        // console.log(`Setting '${this.constructor.name}' property: ${propName}[${arrayIndex}] -> ${typeof (value) === "object" && value !== null ? value.constructor.name : value}`);

        return true;
    }

    public async onLoaded(): Promise<void> {
        try {
            await Promise.all(this.promisesLoading);
        } catch (e) {
            debugger;
            throw e;
        }
    }

    protected async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> { throw new Error("Mixin not loaded."); }
}

export default UObject;
export { UObject };