import UObject from "./un-object";
import UPackage from "./un-package";
import UExport from "./un-export";

class UClass extends UObject {
    public async load(pkg: UPackage, exp: UExport): Promise<this> {

        debugger;

        this.objectName = `Exp_${exp.objectName}`;

        this.setReadPointers(exp);

        await this.readNamedProps(pkg);

        return this;
    }
}

export default UClass;
export { UClass };