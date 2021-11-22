import UObject from "./un-object";

type FColor = import("./un-color").FColor;
type UPackage = import("./un-package").UPackage;

class UTextureModifyInfo extends UObject {
    protected size: number;
    protected useModify: boolean;
    protected doubleSide: boolean;
    protected alphaBlend: boolean;
    protected dummy: boolean;
    protected color: FColor;
    protected alphaOp: number;
    protected colorOp: number;

    public constructor(size: number) {
        super();

        this.size = size;
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bUseModify": "useModify",
            "bTwoSide": "doubleSide",
            "bAlphaBlend": "alphaBlend",
            "bDummy": "dummy",
            "Color": "color",
            "AlphaOp": "alphaOp",
            "ColorOp": "colorOp"
        });
    }

    public async load(pkg: UPackage): Promise<this> {

        this.readHead = pkg.tell();
        this.readTail = this.readHead + this.size;

        await this.readNamedProps(pkg);

        // debugger;

        return this;
    }
}

export default UTextureModifyInfo;
export { UTextureModifyInfo };