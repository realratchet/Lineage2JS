import UAActor from "./un-aactor";

class UPlayerStart extends UAActor {
    public readonly careUnread = false;

    protected nextNavigationPoint: UPlayerStart;
    protected base: UStaticMeshActor;
    protected relativeLocation: FVector;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "nextNavigationPoint": "nextNavigationPoint",
            "Base": "base",
            "RelativeLocation": "relativeLocation"
        });
    }
}

export default UPlayerStart;
export { UPlayerStart };