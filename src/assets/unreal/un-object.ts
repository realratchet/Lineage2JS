import BufferValue from "../buffer-value";
import UProperty from "./un-property";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UObject {
    constructor() {

    }

    protected getPropertyMap(): { [key: string]: string } { return {}; }

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        throw new Error("Unresolved");
    }

    protected async loadProperty(pkg: UPackage, offset: number) {
        const index = new BufferValue(BufferValue.compat32);
        const info = new BufferValue(BufferValue.int8);

        pkg.seek(offset, "set");
        pkg.read(index);

        const prop = new UProperty();
        const propName = index.value as number > 0 && pkg.nameTable.length
            ? pkg.nameTable[index.value as number].name.string
            : "None";

        prop.name = propName;

        if (propName === "None") return prop;

        pkg.read(info);
        prop.setInfo(info.value as number);

        if (prop.type === UProperty.UNP_StructProperty) {
            pkg.read(index);
            prop.structType = pkg.nameTable[index.value as number].name.string;
        }

        let size;

        switch ((info.value as number) & UProperty.PROPERTY_SIZE_MASK) {
            case 0x00: prop.size = 1; break;
            case 0x10: prop.size = 2; break;
            case 0x20: prop.size = 4; break;
            case 0x30: prop.size = 12; break;
            case 0x40: prop.size = 16; break;
            case 0x50:
                size = new BufferValue(BufferValue.uint8);
                pkg.read(size);
                prop.size = size.value as number;
                break;
            case 0x60:
                size = new BufferValue(BufferValue.uint16);
                pkg.read(size);
                prop.size = size.value as number;
                break;
            case 0x70:
                size = new BufferValue(BufferValue.uint32);
                pkg.read(size);
                prop.size = size.value as number;
                break;
        }

        if (prop.isArray && prop.type !== UProperty.UNP_BoolProperty)
            throw new Error("Not yet implemented");

        switch (prop.type) {
            case UProperty.UNP_ByteProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_IntProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_BoolProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_FloatProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_ObjectProperty:
                if (prop.name === "StaticMeshLod01" || prop.name === "StaticMeshLod02" || prop.name === "PhysicsVolume") {
                    //printf("Skipping object property: %s\n", Name);
                    pkg.read(index);
                }
                else {
                    const objIndex = new BufferValue(BufferValue.compat32);
                    pkg.read(objIndex);

                    const obj = await pkg.fetchObject(objIndex.value as number);
                    this.setProperty(propName, obj);
                }
                break;
            case UProperty.UNP_NameProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_StrProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_StringProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_ArrayProperty:
                break;
            case UProperty.UNP_ClassProperty:
            case UProperty.UNP_VectorProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_RotatorProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_MapProperty:
                throw new Error("Not yet implemented");
            case UProperty.UNP_FixedArrayProperty:
                throw new Error("Not yet implemented");
        }

        return prop;
    }

    public setProperty(propName: string, value: any) {
        const props = this.getPropertyMap();

        if (!(propName in props))
            throw new Error(`Unrecognized property: ${propName}`);

        const varName = props[propName];

        if (!this.hasOwnProperty(varName))
            throw new Error(`Cannot map property '${propName}' -> ${varName}`);

        (this as any)[varName] = value;

        return true;
    }
}

export default UObject;
export { UObject };