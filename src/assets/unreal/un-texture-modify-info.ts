import UObject from "./un-object";

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
    protected useModify: boolean;
    protected doubleSide: boolean;
    protected alphaBlend: boolean;
    protected dummy: boolean;
    protected color: FColor;
    protected alphaOp: AlphaOperation_T;
    protected colorOp: ColorOperation_T;

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

    protected preLoad(pkg: UPackage, tag: any) {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + tag.dataSize;
    }
}

export default UTextureModifyInfo;
export { UTextureModifyInfo };