import UAActor from "./un-aactor";

class UPlayerStart extends UAActor {
    public readonly careUnread = false;

    protected nextNavigationPoint: UPlayerStart;

    protected _pathList: any;
    protected _proscribedPaths: any;
    protected _forcedPaths: any;
    protected _visitedWeight: any;
    protected _bestPathWeight: any;
    protected _nextOrdered: any;
    protected _prevOrdered: any;
    protected _previousPath: any;
    protected _cost: any;
    protected _extraCost: any;
    protected _transientCost: any;
    protected _fearCost: any;
    protected _bEndPoint: any;
    protected _bTransientEndPoint: any;
    protected _taken: any;
    protected _bBlocked: any;
    protected _bPropagatesSound: any;
    protected _bOneWayPath: any;
    protected _bNeverUseStrafing: any;
    protected _bAlwaysUseStrafing: any;
    protected _bForceNoStrafing: any;
    protected _bAutoBuilt: any;
    protected _bSpecialMove: any;
    protected _bNoAutoConnect: any;
    protected _bNotBased: any;
    protected _bPathsChanged: any;
    protected _bDestinationOnly: any;
    protected _bSourceOnly: any;
    protected _bSpecialForced: any;
    protected _bMustBeReachable: any;
    protected _inventoryCache: any;
    protected _inventoryDist: any;
    protected _teamNumber: any;
    protected _bSinglePlayerStart: any;
    protected _bCoopStart: any;
    protected _bEnabled: any;
    protected _bPrimaryStart: any;
    protected _lastSpawnCampTime: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "nextNavigationPoint": "nextNavigationPoint",
            
            "PathList": "_pathList",
            "ProscribedPaths": "_proscribedPaths",
            "ForcedPaths": "_forcedPaths",
            "visitedWeight": "_visitedWeight",
            "bestPathWeight": "_bestPathWeight",
            "nextOrdered": "_nextOrdered",
            "prevOrdered": "_prevOrdered",
            "previousPath": "_previousPath",
            "cost": "_cost",
            "ExtraCost": "_extraCost",
            "TransientCost": "_transientCost",
            "FearCost": "_fearCost",
            "bEndPoint": "_bEndPoint",
            "bTransientEndPoint": "_bTransientEndPoint",
            "taken": "_taken",
            "bBlocked": "_bBlocked",
            "bPropagatesSound": "_bPropagatesSound",
            "bOneWayPath": "_bOneWayPath",
            "bNeverUseStrafing": "_bNeverUseStrafing",
            "bAlwaysUseStrafing": "_bAlwaysUseStrafing",
            "bForceNoStrafing": "_bForceNoStrafing",
            "bAutoBuilt": "_bAutoBuilt",
            "bSpecialMove": "_bSpecialMove",
            "bNoAutoConnect": "_bNoAutoConnect",
            "bNotBased": "_bNotBased",
            "bPathsChanged": "_bPathsChanged",
            "bDestinationOnly": "_bDestinationOnly",
            "bSourceOnly": "_bSourceOnly",
            "bSpecialForced": "_bSpecialForced",
            "bMustBeReachable": "_bMustBeReachable",
            "InventoryCache": "_inventoryCache",
            "InventoryDist": "_inventoryDist",
            "TeamNumber": "_teamNumber",
            "bSinglePlayerStart": "_bSinglePlayerStart",
            "bCoopStart": "_bCoopStart",
            "bEnabled": "_bEnabled",
            "bPrimaryStart": "_bPrimaryStart",
            "LastSpawnCampTime": "_lastSpawnCampTime",
        });
    }
}

export default UPlayerStart;
export { UPlayerStart };