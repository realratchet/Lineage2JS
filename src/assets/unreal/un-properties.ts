import BufferValue from "../buffer-value";
import UExport from "./un-export";
import UField from "./un-field";
import UObject from "./un-object";
import UPackage from "./un-package";

abstract class UProperty extends UField {
    protected unkInt0: number;
    protected unkInt1: number;
    protected unkInt2: number;
    protected unkIndex: number;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);
        const compat32 = new BufferValue(BufferValue.compat32);

        this.unkInt0 = pkg.read(uint32).value as number;
        this.unkInt1 = pkg.read(uint32).value as number;

        this.unkIndex = pkg.read(compat32).value as number;

        if (this.unkInt1 & 0x20) {
            debugger;
            this.unkInt2 = pkg.read(uint16).value as number;
        }

        this.readHead = pkg.tell();
    }
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
            if (this.valueId !== 0)
                this.value = await pkg.fetchObject<T>(this.valueId);

            resolve();
        }));
    }
}

class UByteProperty extends UBaseExportProperty<UEnum> { }
class UObjectProperty extends UBaseExportProperty<UClass> { }
class UClassProperty extends UBaseExportProperty<UClass> { }
class UStructProperty extends UBaseExportProperty<UClass> { }


class UIntProperty extends UProperty {

}

class UBoolProperty extends UProperty {

}

class UNameProperty extends UProperty {

}

class UFloatProperty extends UProperty {

}

class UArrayProperty extends UProperty {

}

class UStrProperty extends UProperty {

}



export { UProperty, UByteProperty, UObjectProperty, UStructProperty, UIntProperty, UBoolProperty, UNameProperty, UFloatProperty, UArrayProperty, UClassProperty, UStrProperty };