import UObject from "./un-object";
import { Vector3 } from "three";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;

class UBrush extends UObject {
    protected readHeadOffset = 15;
    protected csgOper: number;
    protected mainScale: Vector3;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "CsgOper": "csgOper",
            "MainScale": "mainScale"
        });
    }

    // public async load(pkg: UPackage, exp: UExport): Promise<this> {
    //     this.setReadPointers(exp);

    //     await this.readNamedProps(pkg);

    //     return this;
    // }
}

export default UBrush;
export { UBrush };