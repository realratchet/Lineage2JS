import UObject from "@l2js/core";

abstract class ULevelSummary extends UObject { 
    declare public readonly title: string;
    declare public readonly author: string;
    declare public readonly levelEnterText: string;
    declare public readonly idealPlayerCount: number;

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