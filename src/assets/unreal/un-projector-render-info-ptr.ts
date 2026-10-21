import UObject from "./un-object";

export abstract class FProjectorRenderInfoPtr extends UObject {
    public static readonly plainStructFields = true;

    declare public Ptr: number;

    protected getPropertyMap() {
        return { "Ptr": "Ptr" };
    }
}

export default FProjectorRenderInfoPtr;
