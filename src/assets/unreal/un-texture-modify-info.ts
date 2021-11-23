import UObject from "./un-object";

type FColor = import("./un-color").FColor;
type UPackage = import("./un-package").UPackage;

enum AlphaOperation_T {
    AO_Use_Mask,
    AO_Multiply,
    AO_Add,
    AO_Use_Alpha_From_Material1,
    AO_Use_Alpha_From_Material2,
};

enum ColorOperation_T {
    CO_Use_Color_From_Material1,
    CO_Use_Color_From_Material2,
    CO_Multiply,
    CO_Add,
    CO_Subtract,
    CO_AlphaBlend_With_Mask,
    CO_Add_With_Mask_Modulation,
    CO_Use_Color_From_Mask,
};

class UTextureModifyInfo extends UObject {
    protected size: number;
    protected useModify: boolean;
    protected doubleSide: boolean;
    protected alphaBlend: boolean;
    protected dummy: boolean;
    protected color: FColor;
    protected alphaOp: AlphaOperation_T;
    protected colorOp: ColorOperation_T;

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

        return this;
    }
}

export default UTextureModifyInfo;
export { UTextureModifyInfo };