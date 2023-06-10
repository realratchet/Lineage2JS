import UObject from "@l2js/core";

class USound extends UObject {
    protected static getConstructorName() { return "Sound"; }

    public readonly careUnread: boolean = false;
}

export default USound;
export { USound };