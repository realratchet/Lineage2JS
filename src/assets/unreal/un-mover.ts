import UObject from "@l2js/core";

// Likely for doors and stuff
abstract class UMover extends UObject {
    public readonly careUnread: boolean = false;
}

export default UMover;
export { UMover };