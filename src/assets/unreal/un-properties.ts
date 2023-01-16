import BufferValue from "../buffer-value";
import FArray, { FObjectArray, FPrimitiveArray } from "./un-array";
import FConstructable from "./un-constructable";
import UExport from "./un-export";
import UField from "./un-field";
import FNumber from "./un-number";
import UObject from "./un-object";
import UPackage from "./un-package";

abstract class UProperty extends UField {
    protected arrayDimensions: number;
    protected propertyFlags: number;
    protected replicationOffset: number;
    protected categoryNameId: number;
    protected categoryName: string;
    public propertyName: string;

    protected preLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.preLoad(pkg, exp);

        this.propertyName = exp.objectName;
    }

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);
        const compat32 = new BufferValue(BufferValue.compat32);

        this.arrayDimensions = pkg.read(uint32).value as number;
        this.propertyFlags = pkg.read(uint32).value as number;

        this.categoryNameId = pkg.read(compat32).value as number;
        this.categoryName = pkg.nameTable[this.categoryNameId].name as string;

        if (this.propertyFlags & PropertyFlags_T.Net)
            this.replicationOffset = pkg.read(uint16).value as number;

        this.readHead = pkg.tell();
    }

    public abstract loadValue(pkg: UPackage): this;
    public abstract createObject(): any;
}

abstract class UBaseExportProperty<T extends UField> extends UProperty {
    protected valueId: number;
    protected value: T;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        const compat32 = new BufferValue(BufferValue.compat32);

        this.valueId = pkg.read(compat32).value as number;
        this.readHead = pkg.tell();


        // if (this.valueId !== 0)
        //     this.value = pkg.fetchObject<T>(this.valueId);
    }
}

class UByteProperty extends UBaseExportProperty<UEnum> {
    static dtype = BufferValue.uint8;
    public createObject() {
        // if (this.valueId !== 0)
        //     debugger;

        return (pkg: UPackage) => {
            return pkg.read(new BufferValue(BufferValue.uint8)).value as number;
        }
    }
}

class UObjectProperty extends UBaseExportProperty<UClass> {
    static dtype = BufferValue.compat32;
    public createObject() {
        return (pkg: UPackage) => {
            return pkg.read(new BufferValue(BufferValue.compat32)).value as number;
        };
    }
}

class UClassProperty extends UObjectProperty {
    protected metaClassId: number;
    protected metaClass: UClass;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        const compat32 = new BufferValue(BufferValue.compat32);

        this.metaClassId = pkg.read(compat32).value as number;
        this.readHead = pkg.tell();

        // if (this.metaClassId !== 0)
        //     this.metaClass = pkg.fetchObject<UClass>(this.metaClassId);

    }
}

class UStructProperty extends UBaseExportProperty<UClass> {
    public createObject(): typeof FConstructable {
        // debugger;
        return (this.value as UStruct).buildClass() as any;
    }
}


class UIntProperty extends UProperty {
    static dtype = BufferValue.int32;
    public createObject() {
        return (pkg: UPackage) => {
            return pkg.read(new BufferValue(BufferValue.int32)).value as number
        };
    }
    // protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
    //     super.load(pkg, exp);

    //     this.readHead = pkg.tell();

    //     debugger;
    // }
}

class UBoolProperty extends UProperty {
    // protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
    //     super.load(pkg, exp);

    //     this.readHead = pkg.tell();

    //     debugger;
    // }
}

class UNameProperty extends UProperty {
    // protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
    //     super.load(pkg, exp);

    //     this.readHead = pkg.tell();

    //     debugger;
    // }
}

class UFloatProperty extends UProperty {
    static dtype = BufferValue.float;
    public createObject() {
        // debugger;
        return (pkg: UPackage) => {
            return pkg.read(new BufferValue(BufferValue.float)).value as number
        };
    }

    // protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
    //     super.load(pkg, exp);

    //     this.readHead = pkg.tell();

    //     debugger;
    // }

}

class UArrayProperty extends UBaseExportProperty<UProperty> {
    // protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
    //     super.load(pkg, exp);

    //     this.readHead = pkg.tell();

    //     debugger;
    // }

    get dtype() {
        if (this.valueId !== 0 && !this.value)
            this.value = this.pkg.fetchObject(this.valueId);

        if (this.value instanceof UIntProperty || this.value instanceof UFloatProperty) {
            return new FPrimitiveArray((this.value.constructor as (typeof UIntProperty | typeof UFloatProperty)).dtype);
        } else if (this.value instanceof UObjectProperty) {
            return new FObjectArray();
        } else if (!(this.value instanceof UStructProperty))
            throw new Error("Not yet implemented")

        const constrClass = (this.value.createObject() as any);

        return new FArray(constrClass as any);
    }

    public createObject() {
        return (pkg: UPackage, tag?: any) => this.dtype.load(pkg, tag);
    }
}

class UStrProperty extends UProperty {
    // protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
    //     super.load(pkg, exp);

    //     this.readHead = pkg.tell();

    //     debugger;
    // }
}

class UDelegateProperty extends UProperty {

}



export { UProperty, UByteProperty, UObjectProperty, UStructProperty, UIntProperty, UBoolProperty, UNameProperty, UFloatProperty, UArrayProperty, UClassProperty, UStrProperty, UDelegateProperty };

enum PropertyFlags_T {
    Edit = 0x00000001,          // Property is user - settable in the editor.
    Const = 0x00000002,         // Actor's property always matches class's default actor property.
    Input = 0x00000004,         // Variable is writable by the input system.
    ExportObject = 0x00000008,  // Object can be exported with actor.
    OptionalParm = 0x00000010,  // Optional parameter(if Param is set).
    Net = 0x00000020,           // Property is relevant to network replication
    ConstRef = 0x00000040,      // Reference to a constant object.
    Parm = 0x00000080,          // Function / When call parameter
    OutParm = 0x00000100,       // Value is copied out after function call.
    SkipParm = 0x00000200,      // Property is a short - circuitable evaluation function parm.
    ReturnParm = 0x00000400,    // Return value.
    CoerceParm = 0x00000800,    // Coerce args into this function parameter
    Native = 0x00001000,        // Property is native : C++ code is responsible for serializing it.
    Transient = 0x00002000,     // Property is transient : shouldn't be saved, zerofilled at load time.
    Config = 0x00004000,        // Property should be loaded / saved as permanent profile.
    Localized = 0x00008000,     // Property should be loaded as localizable text
    Travel = 0x00010000,        // Property travels across levels / servers.
    EditConst = 0x00020000,     // Property is uneditable in the editor
    GlobalConfig = 0x00040000,  // Load config from base class, not subclass.
    OnDemand = 0x00100000,      // Object or dynamic array loaded on demand only.
    New = 0x00200000,           // Automatically create inner object
    NeedCtorLink = 0x00400000   // Fields need construction / destruction
};