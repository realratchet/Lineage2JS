import UZoneInfo from "./un-zone-info";
import ULevelSummary from "./un-level-summary";

class ULevelInfo extends UZoneInfo/* implements IInfo*/ {
    // protected time: number;
    // protected summary: ULevelSummary;
    // protected visibleGroups: string;
    // protected isPathsRebuilt: boolean;

    // protected cameraLocationDynamic: FVector;
    // protected cameraLocationTop: FVector;
    // protected cameraLocationFront: FVector;
    // protected cameraLocationSide: FVector;
    // protected cameraRotationDynamic: FRotator;

    // protected navigationPointList: UPlayerStart;

    // protected hasPathNodes: boolean;

    // public static readonly friendlyName = "LevelInfo";

    // protected _timeDilation: any;
    // protected _year: any;
    // protected _month: any;
    // protected _day: any;
    // protected _dayOfWeek: any;
    // protected _hour: any;
    // protected _minute: any;
    // protected _second: any;
    // protected _millisecond: any;
    // protected _pauseDelay: any;
    // protected _decalStayScale: any;
    // protected _physicsDetailLevel: any;
    // protected _karmaTimeScale: any;
    // protected _ragdollTimeScale: any;
    // protected _maxRagdolls: any;
    // protected _karmaGravScale: any;
    // protected _bKStaticFriction: any;
    // protected _bKNoInit: any;
    // protected _title: any;
    // protected _author: any;
    // protected _levelEnterText: any;
    // protected _localizedPkg: any;
    // protected _pauser: any;
    // protected _recommendedNumPlayers: any;
    // protected _selectedGroups: any;
    // protected _bLonePlayer: any;
    // protected _bBegunPlay: any;
    // protected _bPlayersOnly: any;
    // protected _detailMode: any;
    // protected _bDropDetail: any;
    // protected _bAggressiveLOD: any;
    // protected _bStartup: any;
    // protected _bCapFramerate: any;
    // protected _bNeverPrecache: any;
    // protected _song: any;
    // protected _playerDoppler: any;
    // protected _musicVolumeOverride: any;
    // protected _brightness: any;
    // protected _screenshot: any;
    // protected _defaultTexture: any;
    // protected _wireframeTexture: any;
    // protected _whiteSquareTexture: any;
    // protected _largeVertex: any;
    // protected _hubStackLevel: any;
    // protected _levelAction: any;
    // protected _gRI: any;
    // protected _netMode: any;
    // protected _computerName: any;
    // protected _engineVersion: any;
    // protected _minNetVersion: any;
    // protected _defaultGameType: any;
    // protected _preCacheGame: any;
    // protected _game: any;
    // protected _defaultGravity: any;
    // protected _controllerList: any;
    // protected _localPlayerController: any;
    // protected _nextURL: any;
    // protected _bNextItems: any;
    // protected _nextSwitchCountdown: any;
    // protected _objectPool: any;
    // protected _precacheMaterials: any;
    // protected _precacheStaticMeshes: any;

    // protected getPropertyMap() {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         "TimeSeconds": "time",
    //         "Summary": "summary",
    //         "VisibleGroups": "visibleGroups",
    //         "bPathsRebuilt": "isPathsRebuilt",
    //         "CameraLocationDynamic": "cameraLocationDynamic",
    //         "CameraLocationTop": "cameraLocationTop",
    //         "CameraLocationFront": "cameraLocationFront",
    //         "CameraLocationSide": "cameraLocationSide",
    //         "CameraRotationDynamic": "cameraRotationDynamic",
    //         "NavigationPointList": "navigationPointList",

    //         "bHasPathNodes": "hasPathNodes",

    //         "TimeDilation": "_timeDilation",
    //         "Year": "_year",
    //         "Month": "_month",
    //         "Day": "_day",
    //         "DayOfWeek": "_dayOfWeek",
    //         "Hour": "_hour",
    //         "Minute": "_minute",
    //         "Second": "_second",
    //         "Millisecond": "_millisecond",
    //         "PauseDelay": "_pauseDelay",
    //         "DecalStayScale": "_decalStayScale",
    //         "PhysicsDetailLevel": "_physicsDetailLevel",
    //         "KarmaTimeScale": "_karmaTimeScale",
    //         "RagdollTimeScale": "_ragdollTimeScale",
    //         "MaxRagdolls": "_maxRagdolls",
    //         "KarmaGravScale": "_karmaGravScale",
    //         "bKStaticFriction": "_bKStaticFriction",
    //         "bKNoInit": "_bKNoInit",
    //         "Title": "_title",
    //         "Author": "_author",
    //         "LevelEnterText": "_levelEnterText",
    //         "LocalizedPkg": "_localizedPkg",
    //         "Pauser": "_pauser",
    //         "RecommendedNumPlayers": "_recommendedNumPlayers",
    //         "SelectedGroups": "_selectedGroups",
    //         "bLonePlayer": "_bLonePlayer",
    //         "bBegunPlay": "_bBegunPlay",
    //         "bPlayersOnly": "_bPlayersOnly",
    //         "DetailMode": "_detailMode",
    //         "bDropDetail": "_bDropDetail",
    //         "bAggressiveLOD": "_bAggressiveLOD",
    //         "bStartup": "_bStartup",
    //         "bCapFramerate": "_bCapFramerate",
    //         "bNeverPrecache": "_bNeverPrecache",
    //         "Song": "_song",
    //         "PlayerDoppler": "_playerDoppler",
    //         "MusicVolumeOverride": "_musicVolumeOverride",
    //         "Brightness": "_brightness",
    //         "Screenshot": "_screenshot",
    //         "DefaultTexture": "_defaultTexture",
    //         "WireframeTexture": "_wireframeTexture",
    //         "WhiteSquareTexture": "_whiteSquareTexture",
    //         "LargeVertex": "_largeVertex",
    //         "HubStackLevel": "_hubStackLevel",
    //         "LevelAction": "_levelAction",
    //         "GRI": "_gRI",
    //         "NetMode": "_netMode",
    //         "ComputerName": "_computerName",
    //         "EngineVersion": "_engineVersion",
    //         "MinNetVersion": "_minNetVersion",
    //         "DefaultGameType": "_defaultGameType",
    //         "PreCacheGame": "_preCacheGame",
    //         "Game": "_game",
    //         "DefaultGravity": "_defaultGravity",
    //         "ControllerList": "_controllerList",
    //         "LocalPlayerController": "_localPlayerController",
    //         "NextURL": "_nextURL",
    //         "bNextItems": "_bNextItems",
    //         "NextSwitchCountdown": "_nextSwitchCountdown",
    //         "ObjectPool": "_objectPool",
    //         "PrecacheMaterials": "_precacheMaterials",
    //         "PrecacheStaticMeshes": "_precacheStaticMeshes"
    //     });
    // }

    // public doLoad(pkg: UPackage, exp: UExport) {

    //     // debugger;

    //     super.doLoad(pkg, exp);

    //     this.readHead = pkg.tell();

    //     // debugger;

    // }

    // public getDecodeInfo(library: DecodeLibrary): ISectorDecodeInfo {
    //     return {
    //         uuid: this.uuid,
    //         type: "Sector",
    //         bounds: { isValid: false, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
    //         name: this.objectName,
    //         children: []
    //     };
    // }
}

export default ULevelInfo;
export { ULevelInfo };