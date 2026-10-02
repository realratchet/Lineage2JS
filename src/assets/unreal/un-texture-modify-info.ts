import UObject from "./un-object";
import type { FColor } from "./un-color";

export abstract class UTextureModifyInfo extends UObject {
    declare public readonly useModify: boolean;
    declare public readonly doubleSide: boolean;
    declare public readonly alphaBlend: boolean;
    declare public readonly dummy: boolean;
    declare public readonly color: FColor;
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
