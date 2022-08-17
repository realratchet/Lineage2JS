import UAActor from "./un-aactor";

class UPlayerStart extends UAActor {
    public readonly careUnread = false;

    public nextNavigationPoint: UPlayerStart;
    public base: UStaticMeshActor;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "nextNavigationPoint": "nextNavigationPoint",
            "Base": "base"
        });
    }
}

export default UPlayerStart;
export { UPlayerStart };