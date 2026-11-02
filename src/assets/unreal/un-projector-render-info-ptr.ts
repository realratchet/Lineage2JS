import UObject from "./un-object";

export abstract class FProjectorRenderInfoPtr extends UObject {
    public static readonly plainStructFields = true;

    declare public ptr: number;

    protected getPropertyMap() {
        return { "Ptr": "ptr" };
    }
}

export default FProjectorRenderInfoPtr;
