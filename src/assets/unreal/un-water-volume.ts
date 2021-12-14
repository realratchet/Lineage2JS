import UBrush from "./un-brush";

class UWaterVolume extends UBrush {
    protected readHeadOffset = 17;

    protected colLocation: FVector;
    protected nextPhysicsVolume: UPhysicsVolume;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "ColLocation": "colLocation",
            "NextPhysicsVolume": "nextPhysicsVolume"
        });
    }

}

export default UWaterVolume;
export { UWaterVolume };