import UPhysicsVolume from "./un-physics-volume";

class UBlockingVolume extends UPhysicsVolume {
    public readonly careUnread = false;

    protected isFluidClamped: boolean;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "bClampFluid": "isFluidClamped"
        });
    }
}

export default UBlockingVolume;
export { UBlockingVolume };