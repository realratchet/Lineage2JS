import UObject from "./un-object";

class USound extends UObject {
    protected static getConstructorName() { return "Sound"; }

    public readonly careUnread: boolean = false;
}

export default USound;
export { USound };