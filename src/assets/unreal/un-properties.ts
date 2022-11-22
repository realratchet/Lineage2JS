import BufferValue from "../buffer-value";
import UExport from "./un-export";
import UField from "./un-field";
import UObject from "./un-object";
import UPackage from "./un-package";

abstract class UProperty extends UField {
    protected arrayDimensions: number;
    protected propertyFlags: number;
    protected replicationOffset: number;
    protected categoryNameId: number;
    protected categoryName: string;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);
        const compat32 = new BufferValue(BufferValue.compat32);

        this.arrayDimensions = pkg.read(uint32).value as number;
        this.propertyFlags = pkg.read(uint32).value as number;

        this.categoryNameId = pkg.read(compat32).value as number;
        this.categoryName = pkg.nameTable[this.categoryNameId].name.value as string;

        if (this.propertyFlags & PropertyFlags_T.Net)
            this.replicationOffset = pkg.read(uint16).value as number;

        this.readHead = pkg.tell();
    }

    public abstract loadValue(pkg: UPackage): this;
}

abstract class UBaseExportProperty<T extends UField> extends UProperty {
    protected valueId: number;
    protected value: T;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        const compat32 = new BufferValue(BufferValue.compat32);

        this.valueId = pkg.read(compat32).value as number;
        this.readHead = pkg.tell();

        this.promisesLoading.push(new Promise<void>(async resolve => {
            if (this.valueId !== 0) {
                this.value = await pkg.fetchObject<T>(this.valueId);
                await this.value.onLoaded();
            }

            resolve();
        }));
    }
}

class UByteProperty extends UBaseExportProperty<UEnum> { }
class UObjectProperty extends UBaseExportProperty<UClass> { }

class UClassProperty extends UObjectProperty {
    protected metaClassId: number;
    protected metaClass: UClass;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        const compat32 = new BufferValue(BufferValue.compat32);

        this.metaClassId = pkg.read(compat32).value as number;
        this.readHead = pkg.tell();

        this.promisesLoading.push(new Promise<void>(async resolve => {
            if (this.metaClassId !== 0)
                this.metaClass = await pkg.fetchObject<UClass>(this.metaClassId);

            resolve();
        }));
    }
}

class UStructProperty extends UBaseExportProperty<UClass> { }


class UIntProperty extends UProperty {
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
}

class UStrProperty extends UProperty {
    // protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
    //     super.load(pkg, exp);

    //     this.readHead = pkg.tell();

    //     debugger;
    // }
}



export { UProperty, UByteProperty, UObjectProperty, UStructProperty, UIntProperty, UBoolProperty, UNameProperty, UFloatProperty, UArrayProperty, UClassProperty, UStrProperty };

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