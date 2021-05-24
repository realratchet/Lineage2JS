import BufferValue from "../buffer-value";
import { UNP_PropertyTypes, PropertyTag } from "./un-property";
import FArray from "./un-array";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

abstract class UObject {
    public constructor(...params: any[]) { }

    protected readHead: number = NaN;
    protected readTail: number = NaN;
    protected readHeadOffset: number = 0;

    protected getPropertyMap(): { [key: string]: string } { return {}; }

    protected setReadPointers(exp: UExport) {
        this.readHead = exp.offset.value as number + this.readHeadOffset;
        this.readTail = this.readHead + (exp.size.value as number);
    }

    protected async readNamedProps(pkg: UPackage) {
        do {
            const tag = await PropertyTag.from(pkg, this.readHead);

            if (!tag.isValid()) break;

            await this.loadProperty(pkg, tag);

            this.readHead = pkg.tell();

        } while (this.readHead < this.readTail);

        this.readHead = pkg.tell();
    }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        this.setReadPointers(exp);

        await this.readNamedProps(pkg);

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
                break;
            case UNP_PropertyTypes.UNP_NameProperty:
                this.setProperty(tag, pkg.nameTable[pkg.read(new BufferValue(BufferValue.compat32)).value as number].name.value);
                break;
            case UNP_PropertyTypes.UNP_StrProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.char)).value as string);
                break;
            case UNP_PropertyTypes.UNP_StringProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_ArrayProperty: await this.readArray(pkg, tag); break;
            case UNP_PropertyTypes.UNP_ClassProperty:
            case UNP_PropertyTypes.UNP_VectorProperty:
                this.setProperty(tag, (function () {
                    const f = new BufferValue(BufferValue.float);
                    const out = new Array<number>(3);

                    for (let i = 0; i < 3; i++)
                        out[i] = pkg.read(f).value as number;

                    return out;
                })());
                break;
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
            console.warn(`Unread '${tag.name}' ${offEnd - pkg.tell()} bytes for package '${pkg.path}'`);
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

        console.log(`Setting '${this.constructor.name}' property: ${propName}[${arrayIndex}] -> ${typeof (value) === "object" && value !== null ? value.constructor.name : value}`);

        return true;
    }

    protected async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> {
        throw new Error("Mixin not loaded.");
    }
}

export default UObject;
export { UObject };