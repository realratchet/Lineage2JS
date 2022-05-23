import ULevelSummary from "./un-level-summary";
import FVector from "./un-vector";
import FRotator from "./un-rotator";
import UPlayerStart from "./un-player-start";
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
        });
    }

    // protected async readNamedProps(pkg: UPackage) {
    //     debugger;

    //     do {
    //         const tag = await PropertyTag.from(pkg, this.readHead);

    //         if (!tag.isValid()) break;

    //         if (tag.name === "LevelInfo") debugger;

    //         await this.loadProperty(pkg, tag);

    //         this.readHead = pkg.tell();

    //         console.log(this.readTail - this.readHead);

    //     } while (this.readHead < this.readTail);

    //     this.readHead = pkg.tell();
    // }

    // public async load(pkg: UPackage, exp: UExport): Promise<this> {
    //     debugger;

    //     await super.load(pkg, exp);

    //     debugger;

    //     return this;
    // }
}

export default ULevelInfo;
export { ULevelInfo };