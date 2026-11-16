import UObject from "./un-object";

export abstract class UNAtkConsumeItemParam extends UObject {
    public static readonly plainStructFields = true;

    declare public bowItemId: number;
    declare public bowUseItemId: number;

    protected getPropertyMap() {
        return { "BowItemID": "bowItemId", "BowUseItemID": "bowUseItemId" };
    }
}

export default UNAtkConsumeItemParam;
