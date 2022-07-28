import ULevelSummary from "./un-level-summary";
import UAActor from "./un-aactor";

class ULevelInfo extends UAActor {
    protected readHeadOffset: number = 17;

    protected time: number;
    protected summary: ULevelSummary;
    protected visibleGroups: string;
    protected isPathsRebuilt: boolean;

    protected cameraLocationDynamic: FVector;
    protected cameraLocationTop: FVector;
    protected cameraLocationFront: FVector;
    protected cameraLocationSide: FVector;
    protected cameraRotationDynamic: FRotator;

    protected navigationPointList: UPlayerStart;

    protected ambientVector: FVector;
    protected ambientBrightness: number;

    protected hasPathNodes: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "TimeSeconds": "time",
            "Summary": "summary",
            "VisibleGroups": "visibleGroups",
            "bPathsRebuilt": "isPathsRebuilt",
            "CameraLocationDynamic": "cameraLocationDynamic",
            "CameraLocationTop": "cameraLocationTop",
            "CameraLocationFront": "cameraLocationFront",
            "CameraLocationSide": "cameraLocationSide",
            "CameraRotationDynamic": "cameraRotationDynamic",
            "NavigationPointList": "navigationPointList",

            "AmbientVector": "ambientVector",
            "AmbientBrightness": "ambientBrightness",

            "bHasPathNodes": "hasPathNodes"
        });
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        // debugger;
        
    }
}

export default ULevelInfo;
export { ULevelInfo };