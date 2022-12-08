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

abstract class UObject {
    public objectName = "Exp_None";
    public exportIndex?: number = null;
    public exp?: UExport = null;

    protected readHeadOffset = 0;

    public readonly uuid = generateUUID();
    public readonly careUnread: boolean = true;

    public skipRemaining: boolean = false;

    protected promisesLoading: Promise<any>[] = [];
    protected readHead: number = NaN;
    protected readStart: number = NaN;
    protected readTail: number = NaN;

    public readonly isObject = true;

    protected getSignedMap(): GenericObjectContainer_T<boolean> { return {}; }
    protected getPropertyMap(): GenericObjectContainer_T<string> {
        return {
            "ObjectInternal": "objectInternal",
            "Outer": "outer",
            "ObjectFlags": "objectFlags",
            "Name": "name",
            "Class": "cls",
            "CacheIndex": "cacheIndex",
            "HashNextBuffer": "hashNextBuffer",
            "IndexBuffer": "indexBuffer"
        };
    }

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

        // const tags = [];

        do {
            const tag = PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid()) break;

            // tags.push(tag.name + "/" + tag.type);

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

        const flags = exp.flags as number;

        pkg.seek(exp.offset as number, "set");

        if (flags & ObjectFlags_T.HasStack) {
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
        if (this.skipRemaining) this.readHead = this.readTail;
        if (this.bytesUnread > 0 && this.bytesUnread !== this.readHeadOffset && this.careUnread)
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

    public async onDecodeReady(): Promise<void> {
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