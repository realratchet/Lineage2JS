import UObject from "@l2js/core";

abstract class UTextureModifyInfo extends UObject {
    declare public readonly useModify: boolean;
    declare public readonly doubleSide: boolean;
    declare public readonly alphaBlend: boolean;
    declare public readonly dummy: boolean;
    declare public readonly color: GA.FColor;
    declare public readonly alphaOp: number;
    declare public readonly colorOp: number;

    protected getPropertyMap(): Record<string, string> {
        return {
            "bUseModify": "useModify",
            "bTwoSide": "doubleSide",
            "bAlphaBlend": "alphaBlend",
            "bDummy": "dummy",
            "Color": "color",
            "AlphaOp": "alphaOp",
            "ColorOp": "colorOp"
        };
    }
}

export default UTextureModifyInfo;
export { UTextureModifyInfo };