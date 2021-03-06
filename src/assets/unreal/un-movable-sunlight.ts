import UAActor from "./un-aactor";

class UNMovableSunLight extends UAActor {
    protected readHeadOffset: number = 17;

    protected lightness: number = 128;
    protected type = 0x13;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "LightBrightness": "lightness"
        });
    }

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<any> {
        await this.onLoaded();

        return {
            type: "Sunlight",
            name: this.objectName,
            position: this.location.getVectorElements(),
            rotation: this.rotation.getEulerElements(),
            scale: this.scale.getVectorElements(),
            lightness: this.lightness / 255,
            lightType: this.type
        };
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