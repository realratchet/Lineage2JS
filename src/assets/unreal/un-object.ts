import BufferValue from "../buffer-value";
import { UNP_PropertyTypes, PropertyTag } from "./un-property-tag";
import FArray, { FPrimitiveArray } from "./un-array";
import { generateUUID } from "three/src/math/MathUtils";
import { ObjectFlags_T } from "./un-export";
import UNativeRegistry from "./scripts/un-native-registry";
import UDependencyGraph from "./un-dependency-graph";

const CLEANUP_NAMESPACE = true;


type RegisterNativeMember_T = {
    isArray: boolean,
    arraySize: number
}

type RegisterNativeFunc_T = {
    nativeIndex: number
}

// const dependencyMap = new Array();

abstract class UObject {
    public objectName = "Exp_None";
    public exportIndex?: number = null;
    public exp?: UExport = null;

    protected readHeadOffset = 0;

    public readonly uuid = generateUUID();
    public readonly careUnread: boolean = true;

    public skipRemaining: boolean = false;

    protected readHead: number = NaN;
    protected readStart: number = NaN;
    protected readTail: number = NaN;

    public readonly isObject = true;
    protected pkg: UPackage;

    protected isLoading = false;
    protected isReady = false;

    // public name = "None";
    // public klass: UClass = null;
    // public flags: number = 0;

    protected getSignedMap(): Record<string, boolean> { return {}; }
    protected getPropertyMap(): Record<string, string> { return {}; }
    // protected getPropertyMap(): Record<string, string> {
    //     return {
    //         "ObjectInternal": "objectInternal",
    //         "Outer": "outer",
    //         "ObjectFlags": "objectFlags",
    //         "Name": "name",
    //         "Class": "cls",
    //         "CacheIndex": "cacheIndex",
    //         "HashNextBuffer": "hashNextBuffer",
    //         "IndexBuffer": "indexBuffer"
    //     };
    // }

    protected setReadPointers(exp: UExport) {
        this.readStart = this.readHead = exp.offset as number + this.readHeadOffset;
        this.readTail = this.readHead + (exp.size as number);
    }

    public get byteCount() { return this.readTail - this.readStart; }
    public get bytesUnread() { return this.readTail - this.readHead; }
    public get byteOffset() { return this.readHead - this.readStart; }

    public static addNativeMember(memberName: string, params = {} as RegisterNativeMember_T) {
        const props = this.prototype.getPropertyMap();

        if (!(memberName in props)) throw new Error(`'${this.name}' is missing '${memberName}'`)

        // maybe test for dtypes here
    }

    public static addConst(constName: string, value: any) {
        Object.defineProperty(this.prototype, constName, { get: () => value });
    }

    public static addStaticNativeFunc(funcName: string, { nativeIndex } = {} as RegisterNativeFunc_T) {
        if (!UNativeRegistry.hasNativeFunc(Number.isFinite(nativeIndex) ? nativeIndex : funcName)) {
            debugger;
            throw new Error(`Missing static function ${funcName}`);
        }
    }

    public static addNativeFunc(funcName: string, { nativeIndex } = {} as RegisterNativeFunc_T) {
        if (!UNativeRegistry.hasNativeFunc(Number.isFinite(nativeIndex) ? nativeIndex : funcName)) {
            debugger;
            throw new Error(`Missing static function ${funcName}`);
        }
    }

    public static addFunc(funcName: string, params: any, impl: Function) {
        (this.prototype as any)[funcName] = impl;
    }

    protected readNamedProps(pkg: UPackage) {
        pkg.seek(this.readHead, "set");

        if (this.readHead < this.readTail) {
            do {
                const tag = PropertyTag.from(pkg, this.readHead);

                if (!tag.isValid()) break;

                this.loadProperty(pkg, tag);

                this.readHead = pkg.tell();

            } while (this.readHead < this.readTail);

        }

        this.readHead = pkg.tell();
    }

    public setExport(pkg: UPackage, exp: UExport) {
        this.objectName = `Exp_${exp.objectName}`;
        this.exportIndex = exp.index;
        this.exp = exp;
        this.pkg = pkg.asReadable();
    }

    protected preLoad(pkg: UPackage, exp: UExport): void {
        const flags = exp.flags as number;

        // this.setExport(exp);

        pkg.seek(exp.offset as number, "set");

        if (flags & ObjectFlags_T.HasStack && exp.size > 0) {
            const offset = pkg.tell();
            const compat32 = new BufferValue(BufferValue.compat32);
            const int64 = new BufferValue(BufferValue.int64);
            const int32 = new BufferValue(BufferValue.int32);

            const node = pkg.read(compat32).value as number;
            /*const stateNode =*/ pkg.read(compat32).value as number;
            /*const probeMask =*/ pkg.read(int64).value as number;
            /*const latentAction =*/ pkg.read(int32).value as number;

            if (node !== 0) {
                /*const offset =*/ pkg.read(compat32).value as number;
            }

            this.readHeadOffset = pkg.tell() - offset;
        }

        this.setReadPointers(exp);
    }

    protected doLoad(pkg: UPackage, exp: UExport): void { this.readNamedProps(pkg); }

    protected postLoad(pkg: UPackage, exp: UExport): void {
        this.readHead = pkg.tell();

        if (this.skipRemaining) this.readHead = this.readTail;
        if (this.bytesUnread > 0 && this.bytesUnread !== this.readHeadOffset && this.careUnread)
            console.warn(`Unread '${this.objectName}' (${this.constructor.name}) ${this.bytesUnread} bytes (${((this.bytesUnread) / 1024).toFixed(2)} kB) in package '${pkg.path}'`);
    }

    public loadSelf() {
        return this.load(this.pkg, this.exp);
    }

    public load(pkg: UPackage, exp: UExport): this {
        if (this.isLoading || this.isReady)
            return this;

        this.isLoading = true;

        // if (exp.objectName === "DefaultTexture")
        //     debugger;

        this.preLoad(pkg, exp);

        if (!isFinite(this.readHead))
            debugger;

        if (!isFinite(this.readTail))
            debugger;

        if ((this.readTail - this.readHead) > 0) {
            this.doLoad(pkg, exp);
            this.postLoad(pkg, exp);
        }

        this.isLoading = false;
        this.isReady = true;

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

    protected loadProperty(pkg: UPackage, tag: PropertyTag) {
        const offStart = pkg.tell();
        const offEnd = offStart + tag.dataSize;
        const isSigned = this.getPropertyIsSigned(tag);

        switch (tag.type) {
            case UNP_PropertyTypes.UNP_ByteProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.uint8)).value as number);
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
                const obj = pkg.fetchObject(objIndex.value as number);

                this.setProperty(tag, obj);
                // pkg.seek(offEnd, "set");
                // }
            } break;
            case UNP_PropertyTypes.UNP_NameProperty:
                this.setProperty(tag, pkg.nameTable[pkg.read(new BufferValue(BufferValue.compat32)).value as number].name);
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
                // debugger;
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

        if (!(propName in props)) {
            debugger;
            throw new Error(`Unrecognized property '${propName}' for '${this.constructor.name}'`);
        }

        const varName = props[propName];

        if (!this.hasOwnProperty(varName))
            throw new Error(`Cannot map property '${propName}' -> ${varName}`);

        const _var = (this as any)[varName] as FArray;

        if (!(_var instanceof FArray) && !((_var as any) instanceof FPrimitiveArray))
            throw new Error(`Unrecognized property '${propName}' for '${this.constructor.name}' is not FArray`);

        // if (tag.name === "ColorScale")
        //     debugger;

        // if (tag.name === "SizeScale")
        //     debugger;

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
            throw new Error(`Cannot map property '${propName}' -> ${varName}`);

        if (tag.arrayIndex < 0 || tag.arrayIndex >= this.getPropCount(tag.name))
            throw new Error(`Something went wrong, expected index '${tag.arrayIndex} (max: '${this.getPropCount(tag.name)}')'.`);

        if ((this as any)[varName] instanceof Array) ((this as any)[varName] as Array<any>)[arrayIndex] = value;
        else if ((this as any)[varName] instanceof Set) ((this as any)[varName] as Set<any>).add(value);
        else (this as any)[varName] = value;

        // console.log(`Setting '${this.constructor.name}' property: ${propName}[${arrayIndex}] -> ${typeof (value) === "object" && value !== null ? value.constructor.name : value}`);

        return true;
    }

    protected readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> { throw new Error("Mixin not loaded."); }
}

export default UObject;
export { UObject };