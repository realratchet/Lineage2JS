import ULevelSummary from "./un-level-summary";
import UAActor from "./un-aactor";

class ULevelInfo extends UAActor implements IInfo {
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

    public static readonly friendlyName = "LevelInfo";

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

        // debugger;

        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        // debugger;

    }

    public getDecodeInfo(library: DecodeLibrary): ISectorDecodeInfo {
        return {
            uuid: this.uuid,
            type: "Sector",
            bounds: { isValid: false, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
            name: this.objectName,
            children: []
        };
    }
}

export default ULevelInfo;
export { ULevelInfo };