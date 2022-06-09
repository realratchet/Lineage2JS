import UAActor from "./un-aactor";

class UNMovableSunLight extends UAActor {
    protected readHeadOffset: number = 17;

    protected brightness: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "LightBrightness": "brightness"
        });
    }

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();
    }

    // protected doLoad(pkg: UPackage, exp: UExport): void {
    //     pkg.seek(this.readHead, "set");

    //     debugger;

    //     super.doLoad(pkg, exp);

    //     pkg.seek(this.readHead, "set");

    //     const objIndex = pkg.read(new BufferValue(BufferValue.compat32));

    //     debugger;
    // }
}

export default UNMovableSunLight;
export { UNMovableSunLight };