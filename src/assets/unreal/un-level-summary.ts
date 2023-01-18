import UObject from "./un-object";

class ULevelSummary extends UObject { 
    protected title: string;
    protected author: string;
    protected levelEnterText: string;
    protected idealPlayerCount: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Title": "title",
            "Author": "author",
            "IdealPlayerCount": "idealPlayerCount",
            "LevelEnterText": "levelEnterText"
        });
    }
}

export default ULevelSummary;
export { ULevelSummary };