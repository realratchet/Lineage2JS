import UObject from "./un-object";

export abstract class UNPrimeActionParam extends UObject {
    public static readonly plainStructFields = true;

    declare public actionId: number;
    declare public damage: number;
    declare public isMiss: boolean;
    declare public isCritical: boolean;
    declare public isShieldDefense: boolean;
    declare public isSpirit: boolean;
    declare public soulshotGrade: number;
    declare public actionTarget: UObject;
    declare public maxAtkShotNum: number;
    declare public curAtkShotNum: number;
    public associatedAttackParams: UObject[] = [];

    protected getPropertyMap() {
        return {
            "ActionID": "actionId",
            "Damage": "damage",
            "bMiss": "isMiss",
            "bCritical": "isCritical",
            "bShieldDefense": "isShieldDefense",
            "bSpirit": "isSpirit",
            "SoulshotGrade": "soulshotGrade",
            "ActionTarget": "actionTarget",
            "MaxAtkShotNum": "maxAtkShotNum",
            "CurAtkShotNum": "curAtkShotNum",
            "NAssociatedAttackParam": "associatedAttackParams"
        };
    }
}

export default UNPrimeActionParam;
