
import UAActor from "./un-aactor";
import FVector from "./un-vector";

class UBrush extends UAActor {
    protected csgOper: number;
    protected mainScale: FScale;
    protected postScale: FScale;
    protected polyFlags: number;
    protected brush: UModel;
    protected prePivot: FVector = new FVector();
    protected isRangeIgnored: boolean;
    protected isBlockingActors: boolean;
    protected isBlockingPlayers: boolean;
    protected isBlockingKarma: boolean;
    protected isDynamicLight: boolean;
    protected isStaticLighting: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "CsgOper": "csgOper",
            "MainScale": "mainScale",
            "PostScale": "postScale",
            "PolyFlags": "polyFlags",
            "Brush": "brush",
            "PrePivot": "prePivot",
            "bIgnoredRange": "isRangeIgnored",
            "bBlockActors": "isBlockingActors",
            "bBlockPlayers": "isBlockingPlayers",
            "bBlockKarma": "isBlockingKarma",
            "bDynamicLight": "isDynamicLight",
            "bStaticLighting": "isStaticLighting"
        });
    }
}

export default UBrush;
export { UBrush };