import AInfo from "./un-info";

abstract class FFogInfo extends AInfo {
    declare protected readonly affectRange: GA.FRange;
    declare protected readonly fogRange1: GA.FRange;
    declare protected readonly fogRange2: GA.FRange;
    declare protected readonly fogRange3: GA.FRange;
    declare protected readonly fogRange4: GA.FRange;
    declare protected readonly fogRange5: GA.FRange;
    declare protected readonly colors: C.FArray<GA.FColor>;

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