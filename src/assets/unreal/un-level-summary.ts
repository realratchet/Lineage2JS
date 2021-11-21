import UObject from "./un-object";

class ULevelSummary extends UObject { 
    protected title: string;
    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Title": "title",
        });
    }
}

export default ULevelSummary;
export { ULevelSummary };