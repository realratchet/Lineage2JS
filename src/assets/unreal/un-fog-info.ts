import UObject from "./un-object";
import FArray from "./un-array";
import FColor from "./un-color";

class UFogInfo extends UObject {
    protected affectRange: URange;
    protected fogRange1: URange;
    protected fogRange2: URange;
    protected fogRange3: URange;
    protected fogRange4: URange;
    protected fogRange5: URange;
    protected colors: FArray<FColor> = new FArray(FColor);

    public readonly careUnread = false;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "AffectRange": "affectRange",
            "FogRange1": "fogRange1",
            "FogRange2": "fogRange2",
            "FogRange3": "fogRange3",
            "FogRange4": "fogRange4",
            "FogRange5": "fogRange5",
            "Colors": "colors",
        });
    }
}

export default UFogInfo;
export { UFogInfo };