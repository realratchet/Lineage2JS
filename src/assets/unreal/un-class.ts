import UObject from "./un-object";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UClass extends UObject {
    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        this.objectName = `Exp_${exp.objectName}`;

        this.setReadPointers(exp);

        await this.readNamedProps(pkg);

        return this;
    }
}

export default UClass;
export { UClass };