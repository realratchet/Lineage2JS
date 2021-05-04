import BufferValue from "../buffer-value";
import { UNP_PropertyTypes, PropertyTag } from "./un-property";
import { FColor } from "./un-color";
import { Vector3 } from "three/src/math/Vector3";
import { MathUtils } from "three/src/math/MathUtils";
import { Euler } from "three/src/math/Euler";
import { Matrix4 } from "three/src/math/Matrix4";
import FArray from "./un-array";
import FRangeVector from "./un-range";
import { Plane } from "three";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

abstract class UObject {
    protected constructor(...params: any[]) { }

    protected readHead: number = NaN;
    protected readTail: number = NaN;
    protected readHeadOffset: number = 0;

    protected getPropertyMap(): { [key: string]: string } { return {}; }

    protected setReadPointers(exp: UExport) {
        this.readHead = exp.offset.value as number + this.readHeadOffset;
        this.readTail = this.readHead + (exp.size.value as number);
    }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        this.setReadPointers(exp);

        do {
            const tag = await PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid())
                break;

            await this.loadProperty(pkg, tag);

            this.readHead = pkg.tell();

        } while (this.readHead < this.readTail);

        return this;
    }

    protected getPropCount(propName: string) {
        const props = this.getPropertyMap();
        const varName = props[propName];
        const _var = (this as any)[varName];

        return _var instanceof Array
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
            case UNP_PropertyTypes.UNP_ObjectProperty:
                if (tag.name === "StaticMeshLod01" || tag.name === "StaticMeshLod02" || tag.name === "PhysicsVolume") {
                    throw new Error("Unsupported yet.");
                    //printf("Skipping object property: %s\n", Name);
                    // pkg.read(index);
                } else {
                    const objIndex = pkg.read(new BufferValue(BufferValue.compat32));
                    const obj = await pkg.fetchObject(objIndex.value as number);
                    this.setProperty(tag, obj);
                }
                break;
            case UNP_PropertyTypes.UNP_NameProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_StrProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.char)).value as string);
                break;
            case UNP_PropertyTypes.UNP_StringProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_ArrayProperty: await this.readArray(pkg, tag); break;
            case UNP_PropertyTypes.UNP_ClassProperty:
            case UNP_PropertyTypes.UNP_VectorProperty:
                throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_RotatorProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_MapProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_FixedArrayProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_StructProperty:
                this.setProperty(tag, await this.readStruct(pkg, tag));
                break;
            default:
                pkg.seek(tag.dataSize);
                console.warn(`Unknown data type '${tag.type}' for '${tag.name}' skipping ${tag.dataSize} bytes.`);
                break;
        }

        if (pkg.tell() < offEnd)
            console.warn(`Unread ${offEnd - pkg.tell()} bytes for package '${pkg.path}'`);
    }

    protected async readArray(pkg: UPackage, tag: PropertyTag) {
        const props = this.getPropertyMap();
        const { name: propName } = tag;

        if (!(propName in props))
            throw new Error(`Unrecognized property '${propName}' for '${this.constructor.name}'`);

        const varName = props[propName];

        if (!this.hasOwnProperty(varName))
            throw new Error(`Cannot map property '${propName}' -> ${varName}`);

        const _var = (this as any)[varName] as FArray;

        if (!(_var instanceof FArray))
            throw new Error(`Unrecognized property '${propName}' for '${this.constructor.name}' is not FArray`);

        await _var.load(pkg, tag);

        return true;
    }

    protected setProperty(tag: PropertyTag, value: any) {
        const props = this.getPropertyMap();
        const { name: propName, arrayIndex } = tag;

        if (!(propName in props))
            throw new Error(`Unrecognized property '${propName}' for '${this.constructor.name}' of '${value === null ? "NULL" : typeof (value) === "object" ? value.constructor.name : typeof (value)}'`);

        const varName = props[propName];

        if (!this.hasOwnProperty(varName))
            throw new Error(`Cannot map property '${propName}' -> ${varName}`);

        if ((this as any)[varName] instanceof Array) ((this as any)[varName] as Array<any>)[arrayIndex] = value;
        else if ((this as any)[varName] instanceof Set) ((this as any)[varName] as Set<any>).add(value);
        else (this as any)[varName] = value;

        // console.log(`Setting '${this.constructor.name}' property: ${propName}[${arrayIndex}] -> ${typeof (value) === "object" && value !== null ? value.constructor.name : value}`);

        return true;
    }

    protected async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> {
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
            case "RangeVector": return await new FRangeVector().load(pkg);
            default: throw new Error(`Unsupported struct type: ${tag.structName}`);
        }
    }
}

export default UObject;
export { UObject };