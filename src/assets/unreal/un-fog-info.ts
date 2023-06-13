import FArray from "./un-array";
import FColor from "./un-color";
import AInfo from "./un-info";

class FFogInfo extends AInfo {
    protected affectRange: FRange;
    protected fogRange1: FRange;
    protected fogRange2: FRange;
    protected fogRange3: FRange;
    protected fogRange4: FRange;
    protected fogRange5: FRange;
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

export default FFogInfo;
export { FFogInfo };