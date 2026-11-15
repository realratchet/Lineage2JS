import UObject from "./un-object";

export abstract class UNSilhouetteParam extends UObject {
    public static readonly plainStructFields = true;

    declare public type: number;
    declare public r: number;
    declare public g: number;
    declare public b: number;

    protected getPropertyMap() {
        return { "Type": "type", "R": "r", "G": "g", "B": "b" };
    }
}

export default UNSilhouetteParam;
