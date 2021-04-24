import BufferValue from "../buffer-value";
import { UNP_PropertyTypes } from "./un-property";
import { Vector3 } from "three/src/math/Vector3";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;
type PropertyTag = import("./un-property").PropertyTag;

class UObject {
    constructor() {

    }

    protected getPropertyMap(): { [key: string]: string } { return {}; }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        throw new Error("Unresolved");
    }

    protected findProperty(name: string) {

    }

    protected getPropCount(propName: string) {
        const props = this.getPropertyMap();
        const varName = props[propName];
        const _var = (this as any)[varName];

        return _var instanceof Array ? _var.length : 1;
    }

    protected async loadProperty(pkg: UPackage, tag: PropertyTag) {
        const offStart = pkg.tell();
        const offEnd = offStart + tag.dataSize;
        const prop = this.findProperty(tag.name);

        if (tag.type === UNP_PropertyTypes.UNP_ArrayProperty) {
            throw new Error("Unsupported yet.");
        } else if (tag.arrayIndex < 0 || tag.arrayIndex >= this.getPropCount(tag.name)) {
            throw new Error("Unsupported yet.");
        }

        switch (tag.type) {
            case UNP_PropertyTypes.UNP_ByteProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.int8)).value as number);
                break;
            case UNP_PropertyTypes.UNP_IntProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.int32)).value as number);
                break;
            case UNP_PropertyTypes.UNP_BoolProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_FloatProperty:
                this.setProperty(tag, pkg.read(new BufferValue(BufferValue.float)).value as number);
                break;
            case UNP_PropertyTypes.UNP_ObjectProperty:
                if (tag.name === "StaticMeshLod01" || tag.name === "StaticMeshLod02" || tag.name === "PhysicsVolume") {
                    throw new Error("Unsupported yet.");
                    //printf("Skipping object property: %s\n", Name);
                    // pkg.read(index);
                }
                else {
                    const objIndex = pkg.read(new BufferValue(BufferValue.compat32));
                    const obj = await pkg.fetchObject(objIndex.value as number);
                    this.setProperty(tag, obj);
                }
                break;
            case UNP_PropertyTypes.UNP_NameProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_StrProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_StringProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_ArrayProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_ClassProperty:
            case UNP_PropertyTypes.UNP_VectorProperty:
                throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_RotatorProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_MapProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_FixedArrayProperty: throw new Error("Not yet implemented");
            case UNP_PropertyTypes.UNP_StructProperty:
                this.setProperty(tag, await this.readStruct(pkg, tag));
                break;
            default: throw new Error("Not yet implemented");;
        }

        return prop;
    }

    protected setProperty(tag: PropertyTag, value: any) {
        const props = this.getPropertyMap();
        const { name: propName, arrayIndex } = tag;

        if (!(propName in props))
            throw new Error(`Unrecognized property: ${propName}`);

        const varName = props[propName];

        if (!this.hasOwnProperty(varName))
            throw new Error(`Cannot map property '${propName}' -> ${varName}`);

        if ((this as any)[varName] instanceof Array) (this as any)[varName][arrayIndex] = value;
        else (this as any)[varName] = value;

        console.log(`Setting property: ${propName}[${arrayIndex}] -> ${typeof (value) === "object" ? value.constructor.name : value}`);

        return true;
    }

    protected async readStruct(pkg: UPackage, tag: PropertyTag): Promise<any> {
        switch (tag.structName) {
            case "Color": return pkg.read(new BufferValue(BufferValue.uint32)).value as number;
            case "Vector": return ["x", "y", "z"].reduce((vec, ax: "x" | "y" | "z") => {
                vec[ax] = pkg.read(new BufferValue(BufferValue.float)).value as number;
                return vec;
            }, new Vector3());
            default: throw new Error(`Unsupported struct type: ${tag.structName}`);
        }
    }
}

export default UObject;
export { UObject };