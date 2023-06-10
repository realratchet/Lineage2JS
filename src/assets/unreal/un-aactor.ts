import FVector from "./un-vector";
import FRotator from "./un-rotator";
import { generateUUID } from "three/src/math/MathUtils";
import UObject from "@l2js/core";

abstract class UAActor extends UObject {
    // protected texModifyInfo: UTextureModifyInfo;
    // protected isDynamicActorFilterState: boolean;
    // protected level: ULevel;
    // protected region: UPointRegion;
    // protected drawScale: number = 1;
    // protected tag: string;
    // protected group: string = "None";
    // protected isSunAffected: boolean;
    // protected physicsVolume: UPhysicsVolume;
    // public readonly location: FVector = new FVector();
    // public readonly rotation: FRotator = new FRotator();
    // public readonly scale: FVector = new FVector(1, 1, 1);
    // protected swayRotationOrig: FRotator = new FRotator();

    // protected hasDistanceFog: boolean;
    // protected distanceFogEnd: number;
    // protected distanceFogStart: number;
    // protected distanceFogColor: FColor;

    // protected isHiddenInEditor: boolean;
    // protected isLightChanged: boolean;
    // protected isDeleteMe: boolean;
    // protected isPendingDelete: boolean;
    // protected isSelected: boolean;

    // protected mainScale: FScale;
    // protected dummy: boolean;

    // protected _mesh: any;
    // protected forcedRegionTag: string;

    // protected _physics: EPhysics_T;
    // protected _drawType: EDrawType_T;
    // protected _staticMesh: any;
    // protected _owner: any;
    // protected _base: any;
    // protected _actorRenderData: any;
    // protected _lightRenderData: any;
    // protected _renderRevision: any;
    // protected _staticFilterState: EFilterState_T;
    // protected _forcedVisibilityZoneTag: any;
    // protected _bSpecialLit: any;
    // protected _bActorShadows: any;
    // protected _bCorona: any;
    // protected _bLightingVisibility: any;
    // protected _bUseDynamicLights: any;
    // protected _bUpdateShadow: any;
    // protected _bHideShadow: any;
    // protected _bHideRightHandMesh: any;
    // protected _bHideLeftHandMesh: any;
    // protected _bNeedCleanup: any;
    // protected _bShadowOnly: any;
    // protected _creatureID: any;
    // protected _noCheatCollision: any;
    // protected _canIngnoreCollision: any;
    // protected _bDeleteNow: any;
    // protected _bAlwaysVisible: any;
    // protected _bStatic: any;
    // protected _bHidden: any;
    // protected _bNoDelete: any;
    // protected _bTicked: any;
    // protected _bTimerLoop: any;
    // protected _bOnlyOwnerSee: any;
    // protected _bHighDetail: any;
    // protected _bSuperHighDetail: any;
    // protected _bOnlyDrawIfAttached: any;

    // protected _bStasis: any;
    // protected _bTrailerAllowRotation: any;
    // protected _bTrailerSameRotation: any;
    // protected _bTrailerPrePivot: any;
    // protected _bTrailerNoOwnerDestroy: any;
    // protected _bRelativeTrail: any;
    // protected _relativeTrailOffset: any;
    // protected _bSelfRotation: any;
    // protected _bWorldGeometry: any;
    // protected _bAcceptsProjectors: any;
    // protected _bOrientOnSlope: any;
    // protected _bOnlyAffectPawns: any;
    // protected _bIgnoreEncroachers: any;
    // protected _bShowOctreeNodes: any;
    // protected _bWasSNFiltered: any;
    // protected _bNetTemporary: any;
    // protected _bOnlyRelevantToOwner: any;
    // protected _bNetDirty: any;
    // protected _bAlwaysRelevant: any;
    // protected _bReplicateInstigator: any;
    // protected _bReplicateMovement: any;
    // protected _bSkipActorPropertyReplication: any;
    // protected _bUpdateSimulatedPosition: any;
    // protected _bTearOff: any;
    // protected _bOnlyDirtyReplication: any;
    // protected _bReplicateAnimations: any;
    // protected _bNetInitialRotation: any;
    // protected _bCompressedPosition: any;
    // protected _bAlwaysZeroBoneOffset: any;
    // protected _relativeLocInVehicle: any;
    // protected _vehicleID: any;
    // protected _bVehicleTargetMove: any;
    // protected _bVehicleCompensativeMove: any;
    // protected _bHasActorTarget: any;
    // protected _bL2DesiredRotated: any;
    // protected _l2DesriedRotator: any;
    // protected _l2NeedTick: any;
    // protected _bCheckChangableLevel: any;
    // protected _bImmediatelyStop: any;
    // protected _l2ActorViewtype: any;
    // protected _l2ActorViewDuration: any;
    // protected _l2ActorViewElapsedTime: any;
    // protected _l2LodViewType: any;
    // protected _l2LodViewElapsedTime: any;
    // protected _remoteRole: any;
    // protected _role: any;
    // protected _netTag: any;
    // protected _netUpdateTime: any;
    // protected _netUpdateFrequency: any;
    // protected _netPriority: any;
    // protected _instigator: any;
    // protected _attachmentBone: any;
    // protected _attachType: any;
    // protected _xLevel: any;
    // protected _lifeSpan: any;
    // protected _timerRate: any;
    // protected _lastRenderTime: any;

    // protected _bDisableSorting: any;
    // protected _l2LodViewDuration: any;
    // protected _l2CurrentLod: any;
    // protected _l2ServerObjectRealID: any;
    // protected _l2ServerObjectID: any;
    // protected _l2ServerObjectType: any;
    // protected _forcedRegion: any;
    // protected _leaves: any;
    // protected _event: any;
    // protected _l2GameEvent: any;
    // protected _inventory: any;
    // protected _timerCounter: any;
    // protected _meshInstance: any;
    // protected _l2MoveEvent: any;
    // protected _targetSpineStatus: any;
    // protected _lODBias: any;
    // protected _initialState: any;
    // protected _child: any;
    // protected _touching: any;
    // protected _octreeNodes: any;
    // protected _octreeBox: any;
    // protected _octreeBoxCenter: any;
    // protected _octreeBoxRadii: any;
    // protected _deleted: any;
    // protected _latentFloat: any;
    // protected _collisionTag: any;
    // protected _joinedTag: any;
    // protected _velocity: any;
    // protected _acceleration: any;
    // protected _attachTag: any;
    // protected _attached: any;
    // protected _relativeLocation: any;
    // protected _relativeRotation: any;
    // protected _bHardAttach: any;
    // protected _hardRelMatrix: any;
    // protected _projectors: any;
    // protected _staticMeshProjectors: any;
    // protected _texture: any;
    // protected _staticMeshInstance: any;

    // protected _overlayMaterial: any;
    // protected _overlayTimer: any;
    // protected _overlayColor: any;
    // protected _repSkin: any;
    // protected _ambientGlow: any;
    // protected _maxLights: any;
    // protected _antiPortal: any;
    // protected _cullDistance: any;
    // protected _scaleGlow: any;
    // protected _nMoverActor: any;
    // protected _l2NMover: any;
    // protected _sWXLevel: any;
    // protected _bDontBatch: any;
    // protected _bUnlit: any;
    // protected _bUseLightingFromBase: any;
    // protected _bUnlitCheck: any;
    // protected _bCulledSunlight: any;
    // protected _bHurtEntry: any;
    // protected _bGameRelevant: any;
    // protected _bCollideWhenPlacing: any;
    // protected _bTravel: any;
    // protected _bMovable: any;
    // protected _bDestroyInPainVolume: any;
    // protected _bShouldBaseAtStartup: any;
    // protected _bAnimByOwner: any;
    // protected _bOwnerNoSee: any;
    // protected _bCanTeleport: any;
    // protected _bClientAnim: any;
    // protected _bDisturbFluidSurface: any;
    // protected _bAlwaysTick: any;
    // protected _transientSoundVolume: any;
    // protected _transientSoundRadius: any;
    // protected _collisionRadius: any;
    // protected _collisionHeight: any;
    // protected _bCollideActors: any;
    // protected _bCollideWorld: any;
    // protected _bProjTarget: any;
    // protected _bBlockZeroExtentTraces: any;
    // protected _bBlockNonZeroExtentTraces: any;
    // protected _bAutoAlignToTerrain: any;
    // protected _bUseCylinderCollision: any;
    // protected _bNetNotify: any;
    // protected _bIgnoreOutOfWorld: any;
    // protected _bBounce: any;
    // protected _bFixedRotationDir: any;
    // protected _bRotateToDesired: any;
    // protected _bInterpolating: any;
    // protected _bJustTeleported: any;
    // protected _mass: any;
    // protected _buoyancy: any;
    // protected _rotationRate: any;
    // protected _kayboardRotationRate: any;
    // protected _keyboardRotationYawFromServer: any;
    // protected _desiredRotation: any;
    // protected _pendingTouch: any;
    // protected _colLocation: any;
    // protected _kParams: any;
    // protected _kStepTag: any;
    // protected _simAnim: any;
    // protected _forceType: any;
    // protected _forceRadius: any;
    // protected _forceScale: any;
    // protected _bNetInitial: any;
    // protected _bNetOwner: any;
    // protected _bNetRelevant: any;
    // protected _bDemoRecording: any;
    // protected _bClientDemoRecording: any;
    // protected _bClientDemoNetFunc: any;
    // protected _bNoRepMesh: any;
    // protected _bHiddenEdGroup: any;
    // protected _bEdShouldSnap: any;
    // protected _bEdSnap: any;
    // protected _bTempEditor: any;
    // protected _bObsolete: any;
    // protected _bPathColliding: any;
    // protected _bPathTemp: any;
    // protected _bScriptInitialized: any;
    // protected _bLockLocation: any;
    // protected _bLockUndelete: any;
    // protected _messageClass: any;
    // protected _nSkillProjectileActor: any;
    // protected _spelledNEffectActor: any;
    // protected _nProjectileActor: any;
    // protected _nAttackStatus: any;
    // protected _effectOwner: any;
    // protected _spawnPos: any;
    // protected _l2ActorEffecttype: any;

    // protected _unusedLightMesh: any;
    // protected _tempScale: any;
    // protected _brushColor: any;
    // protected _bColored: any;
    // protected _associatedActor: any;
    // protected _associatedActorTag: any;

    // protected skins = new FObjectArray();
    // protected style: ERenderStyle_T;
    // protected isIgnoredRange: boolean;
    // protected isDirectional: boolean = false;

    // protected csgOper: number;

    // protected postScale: FScale;
    // protected polyFlags: number;
    // protected brush: UModel;
    // protected prePivot: FVector = new FVector();
    // protected postPivot: FVector = new FVector();
    // protected isRangeIgnored: boolean;
    // protected isBlockingActors: boolean;
    // protected isBlockingPlayers: boolean;
    // protected isBlockingKarma: boolean;
    // protected isDynamicLight: boolean;
    // protected isStaticLighting: boolean;


    // protected isCastingShadow: boolean;

    // public getRegion() { return this.region; }
    // public getZone() { return this.region?.loadSelf().getZone(); }

    // protected getRegionLineHelper(library: DecodeLibrary, color: [number, number, number] = [1, 0, 1], ignoreDepth: boolean = false) {
    //     const lineGeometryUuid = generateUUID();
    //     const _a = this.region.getZone().location;
    //     const _b = this.location;

    //     const a = new FVector(_a.x, _a.z, _a.y);
    //     const b = new FVector(_b.x, _b.z, _b.y);

    //     const geoPosition = a.sub(b).applyRotator(this.rotation, true);
    //     const regionHelper = {
    //         type: "Edges",
    //         geometry: lineGeometryUuid,
    //         color,
    //         ignoreDepth
    //     } as IEdgesObjectDecodeInfo;

    //     library.geometries[lineGeometryUuid] = {
    //         indices: new Uint8Array([0, 1]),
    //         attributes: {
    //             positions: new Float32Array([
    //                 0, 0, 0,
    //                 geoPosition.x, geoPosition.y, geoPosition.z
    //             ])
    //         }
    //     };

    //     return regionHelper;
    // }

    // protected getPropertyMap(): Record<string, string> {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         "MainScale": "mainScale",

    //         "bDummy": "dummy",

    //         "bDynamicActorFilterState": "isDynamicActorFilterState",
    //         "Level": "level",
    //         "Region": "region",
    //         "Tag": "tag",
    //         "bSunAffect": "isSunAffected",
    //         "PhysicsVolume": "physicsVolume",
    //         "Location": "location",
    //         "Rotation": "rotation",
    //         "SwayRotationOrig": "swayRotationOrig",
    //         "DrawScale": "drawScale",
    //         "TexModifyInfo": "texModifyInfo",
    //         "DrawScale3D": "scale",
    //         "Group": "group",

    //         "bDistanceFog": "hasDistanceFog",
    //         "DistanceFogEnd": "distanceFogEnd",
    //         "DistanceFogStart": "distanceFogStart",
    //         "DistanceFogColor": "distanceFogColor",

    //         "bHiddenEd": "isHiddenInEditor",
    //         "bLightChanged": "isLightChanged",
    //         "bSelected": "isSelected",

    //         "bDeleteMe": "isDeleteMe",
    //         "bPendingDelete": "isPendingDelete",

    //         "ForcedRegionTag": "forcedRegionTag",
    //         "Skins": "skins",
    //         "Style": "style",
    //         "bDirectional": "isDirectional",

    //         "bShadowCast": "isCastingShadow",
    //         "CsgOper": "csgOper",
    //         "PostScale": "postScale",
    //         "PolyFlags": "polyFlags",
    //         "Brush": "brush",
    //         "PrePivot": "prePivot",
    //         "PostPivot": "postPivot",
    //         "bIgnoredRange": "isRangeIgnored",
    //         "bBlockActors": "isBlockingActors",
    //         "bBlockPlayers": "isBlockingPlayers",
    //         "bBlockKarma": "isBlockingKarma",
    //         "bDynamicLight": "isDynamicLight",
    //         "bStaticLighting": "isStaticLighting",

    //         "Mesh": "_mesh",

    //         "Physics": "_physics",
    //         "DrawType": "_drawType",
    //         "StaticMesh": "_staticMesh",
    //         "Owner": "_owner",
    //         "Base": "_base",
    //         "ActorRenderData": "_actorRenderData",
    //         "LightRenderData": "_lightRenderData",
    //         "RenderRevision": "_renderRevision",
    //         "StaticFilterState": "_staticFilterState",
    //         "ForcedVisibilityZoneTag": "_forcedVisibilityZoneTag",
    //         "bSpecialLit": "_bSpecialLit",
    //         "bActorShadows": "_bActorShadows",
    //         "bCorona": "_bCorona",
    //         "bLightingVisibility": "_bLightingVisibility",
    //         "bUseDynamicLights": "_bUseDynamicLights",
    //         "bUpdateShadow": "_bUpdateShadow",
    //         "bHideShadow": "_bHideShadow",
    //         "bHideRightHandMesh": "_bHideRightHandMesh",
    //         "bHideLeftHandMesh": "_bHideLeftHandMesh",
    //         "bNeedCleanup": "_bNeedCleanup",
    //         "bShadowOnly": "_bShadowOnly",
    //         "CreatureID": "_creatureID",
    //         "NoCheatCollision": "_noCheatCollision",
    //         "CanIngnoreCollision": "_canIngnoreCollision",
    //         "bDeleteNow": "_bDeleteNow",
    //         "bAlwaysVisible": "_bAlwaysVisible",
    //         "bStatic": "_bStatic",
    //         "bHidden": "_bHidden",
    //         "bNoDelete": "_bNoDelete",
    //         "bTicked": "_bTicked",

    //         "bTimerLoop": "_bTimerLoop",
    //         "bOnlyOwnerSee": "_bOnlyOwnerSee",
    //         "bHighDetail": "_bHighDetail",
    //         "bSuperHighDetail": "_bSuperHighDetail",
    //         "bOnlyDrawIfAttached": "_bOnlyDrawIfAttached",

    //         "bStasis": "_bStasis",
    //         "bTrailerAllowRotation": "_bTrailerAllowRotation",
    //         "bTrailerSameRotation": "_bTrailerSameRotation",
    //         "bTrailerPrePivot": "_bTrailerPrePivot",
    //         "bTrailerNoOwnerDestroy": "_bTrailerNoOwnerDestroy",
    //         "bRelativeTrail": "_bRelativeTrail",
    //         "RelativeTrailOffset": "_relativeTrailOffset",
    //         "bSelfRotation": "_bSelfRotation",
    //         "bWorldGeometry": "_bWorldGeometry",
    //         "bAcceptsProjectors": "_bAcceptsProjectors",
    //         "bOrientOnSlope": "_bOrientOnSlope",
    //         "bOnlyAffectPawns": "_bOnlyAffectPawns",
    //         "bIgnoreEncroachers": "_bIgnoreEncroachers",
    //         "bShowOctreeNodes": "_bShowOctreeNodes",
    //         "bWasSNFiltered": "_bWasSNFiltered",
    //         "bNetTemporary": "_bNetTemporary",
    //         "bOnlyRelevantToOwner": "_bOnlyRelevantToOwner",
    //         "bNetDirty": "_bNetDirty",
    //         "bAlwaysRelevant": "_bAlwaysRelevant",
    //         "bReplicateInstigator": "_bReplicateInstigator",
    //         "bReplicateMovement": "_bReplicateMovement",
    //         "bSkipActorPropertyReplication": "_bSkipActorPropertyReplication",
    //         "bUpdateSimulatedPosition": "_bUpdateSimulatedPosition",
    //         "bTearOff": "_bTearOff",
    //         "bOnlyDirtyReplication": "_bOnlyDirtyReplication",
    //         "bReplicateAnimations": "_bReplicateAnimations",
    //         "bNetInitialRotation": "_bNetInitialRotation",
    //         "bCompressedPosition": "_bCompressedPosition",
    //         "bAlwaysZeroBoneOffset": "_bAlwaysZeroBoneOffset",
    //         "RelativeLocInVehicle": "_relativeLocInVehicle",
    //         "VehicleID": "_vehicleID",
    //         "bVehicleTargetMove": "_bVehicleTargetMove",
    //         "bVehicleCompensativeMove": "_bVehicleCompensativeMove",
    //         "bHasActorTarget": "_bHasActorTarget",
    //         "bL2DesiredRotated": "_bL2DesiredRotated",
    //         "L2DesriedRotator": "_l2DesriedRotator",
    //         "L2NeedTick": "_l2NeedTick",
    //         "bCheckChangableLevel": "_bCheckChangableLevel",
    //         "bImmediatelyStop": "_bImmediatelyStop",
    //         "L2ActorViewtype": "_l2ActorViewtype",
    //         "L2ActorViewDuration": "_l2ActorViewDuration",
    //         "L2ActorViewElapsedTime": "_l2ActorViewElapsedTime",
    //         "L2LodViewType": "_l2LodViewType",
    //         "L2LodViewElapsedTime": "_l2LodViewElapsedTime",
    //         "RemoteRole": "_remoteRole",
    //         "Role": "_role",
    //         "NetTag": "_netTag",
    //         "NetUpdateTime": "_netUpdateTime",
    //         "NetUpdateFrequency": "_netUpdateFrequency",
    //         "NetPriority": "_netPriority",
    //         "Instigator": "_instigator",
    //         "AttachmentBone": "_attachmentBone",
    //         "AttachType": "_attachType",
    //         "XLevel": "_xLevel",
    //         "LifeSpan": "_lifeSpan",
    //         "TimerRate": "_timerRate",
    //         "LastRenderTime": "_lastRenderTime",

    //         "bDisableSorting": "_bDisableSorting",
    //         "L2LodViewDuration": "_l2LodViewDuration",
    //         "L2CurrentLod": "_l2CurrentLod",
    //         "L2ServerObjectRealID": "_l2ServerObjectRealID",
    //         "L2ServerObjectID": "_l2ServerObjectID",
    //         "L2ServerObjectType": "_l2ServerObjectType",
    //         "ForcedRegion": "_forcedRegion",
    //         "Leaves": "_leaves",
    //         "Event": "_event",
    //         "L2GameEvent": "_l2GameEvent",
    //         "Inventory": "_inventory",
    //         "TimerCounter": "_timerCounter",
    //         "MeshInstance": "_meshInstance",
    //         "L2MoveEvent": "_l2MoveEvent",
    //         "TargetSpineStatus": "_targetSpineStatus",
    //         "LODBias": "_lODBias",
    //         "InitialState": "_initialState",
    //         "Child": "_child",
    //         "Touching": "_touching",
    //         "OctreeNodes": "_octreeNodes",
    //         "OctreeBox": "_octreeBox",
    //         "OctreeBoxCenter": "_octreeBoxCenter",
    //         "OctreeBoxRadii": "_octreeBoxRadii",
    //         "Deleted": "_deleted",
    //         "LatentFloat": "_latentFloat",
    //         "CollisionTag": "_collisionTag",
    //         "JoinedTag": "_joinedTag",
    //         "Velocity": "_velocity",
    //         "Acceleration": "_acceleration",
    //         "AttachTag": "_attachTag",
    //         "Attached": "_attached",
    //         "RelativeLocation": "_relativeLocation",
    //         "RelativeRotation": "_relativeRotation",
    //         "bHardAttach": "_bHardAttach",
    //         "HardRelMatrix": "_hardRelMatrix",
    //         "Projectors": "_projectors",
    //         "StaticMeshProjectors": "_staticMeshProjectors",
    //         "Texture": "_texture",
    //         "StaticMeshInstance": "_staticMeshInstance",

    //         "UnusedLightMesh": "_unusedLightMesh",
    //         "TempScale": "_tempScale",
    //         "BrushColor": "_brushColor",
    //         "bColored": "_bColored",
    //         "AssociatedActor": "_associatedActor",
    //         "AssociatedActorTag": "_associatedActorTag",

    //         "OverlayMaterial": "_overlayMaterial",
    //         "OverlayTimer": "_overlayTimer",
    //         "OverlayColor": "_overlayColor",
    //         "RepSkin": "_repSkin",
    //         "AmbientGlow": "_ambientGlow",
    //         "MaxLights": "_maxLights",
    //         "AntiPortal": "_antiPortal",
    //         "CullDistance": "_cullDistance",
    //         "ScaleGlow": "_scaleGlow",
    //         "NMoverActor": "_nMoverActor",
    //         "L2NMover": "_l2NMover",
    //         "SWXLevel": "_sWXLevel",
    //         "bDontBatch": "_bDontBatch",
    //         "bUnlit": "_bUnlit",
    //         "bUseLightingFromBase": "_bUseLightingFromBase",
    //         "bUnlitCheck": "_bUnlitCheck",
    //         "bCulledSunlight": "_bCulledSunlight",
    //         "bHurtEntry": "_bHurtEntry",
    //         "bGameRelevant": "_bGameRelevant",
    //         "bCollideWhenPlacing": "_bCollideWhenPlacing",
    //         "bTravel": "_bTravel",
    //         "bMovable": "_bMovable",
    //         "bDestroyInPainVolume": "_bDestroyInPainVolume",
    //         "bShouldBaseAtStartup": "_bShouldBaseAtStartup",
    //         "bAnimByOwner": "_bAnimByOwner",
    //         "bOwnerNoSee": "_bOwnerNoSee",
    //         "bCanTeleport": "_bCanTeleport",
    //         "bClientAnim": "_bClientAnim",
    //         "bDisturbFluidSurface": "_bDisturbFluidSurface",
    //         "bAlwaysTick": "_bAlwaysTick",
    //         "TransientSoundVolume": "_transientSoundVolume",
    //         "TransientSoundRadius": "_transientSoundRadius",
    //         "CollisionRadius": "_collisionRadius",
    //         "CollisionHeight": "_collisionHeight",
    //         "bCollideActors": "_bCollideActors",
    //         "bCollideWorld": "_bCollideWorld",

    //         "bProjTarget": "_bProjTarget",
    //         "bBlockZeroExtentTraces": "_bBlockZeroExtentTraces",
    //         "bBlockNonZeroExtentTraces": "_bBlockNonZeroExtentTraces",
    //         "bAutoAlignToTerrain": "_bAutoAlignToTerrain",
    //         "bUseCylinderCollision": "_bUseCylinderCollision",
    //         "bNetNotify": "_bNetNotify",
    //         "bIgnoreOutOfWorld": "_bIgnoreOutOfWorld",
    //         "bBounce": "_bBounce",
    //         "bFixedRotationDir": "_bFixedRotationDir",
    //         "bRotateToDesired": "_bRotateToDesired",
    //         "bInterpolating": "_bInterpolating",
    //         "bJustTeleported": "_bJustTeleported",
    //         "Mass": "_mass",
    //         "Buoyancy": "_buoyancy",
    //         "RotationRate": "_rotationRate",
    //         "KayboardRotationRate": "_kayboardRotationRate",
    //         "KeyboardRotationYawFromServer": "_keyboardRotationYawFromServer",
    //         "DesiredRotation": "_desiredRotation",
    //         "PendingTouch": "_pendingTouch",
    //         "ColLocation": "_colLocation",
    //         "KParams": "_kParams",
    //         "KStepTag": "_kStepTag",
    //         "SimAnim": "_simAnim",
    //         "ForceType": "_forceType",
    //         "ForceRadius": "_forceRadius",
    //         "ForceScale": "_forceScale",
    //         "bNetInitial": "_bNetInitial",
    //         "bNetOwner": "_bNetOwner",
    //         "bNetRelevant": "_bNetRelevant",
    //         "bDemoRecording": "_bDemoRecording",
    //         "bClientDemoRecording": "_bClientDemoRecording",
    //         "bClientDemoNetFunc": "_bClientDemoNetFunc",
    //         "bNoRepMesh": "_bNoRepMesh",
    //         "bHiddenEdGroup": "_bHiddenEdGroup",
    //         "bEdShouldSnap": "_bEdShouldSnap",
    //         "bEdSnap": "_bEdSnap",
    //         "bTempEditor": "_bTempEditor",
    //         "bObsolete": "_bObsolete",
    //         "bPathColliding": "_bPathColliding",
    //         "bPathTemp": "_bPathTemp",
    //         "bScriptInitialized": "_bScriptInitialized",
    //         "bLockLocation": "_bLockLocation",
    //         "bLockUndelete": "_bLockUndelete",
    //         "MessageClass": "_messageClass",
    //         "NSkillProjectileActor": "_nSkillProjectileActor",
    //         "SpelledNEffectActor": "_spelledNEffectActor",
    //         "NProjectileActor": "_nProjectileActor",
    //         "NAttackStatus": "_nAttackStatus",
    //         "EffectOwner": "_effectOwner",
    //         "SpawnPos": "_spawnPos",
    //         "L2ActorEffecttype": "_l2ActorEffecttype",
    //     });
    // };
}

export default UAActor;
export { UAActor };

enum ERenderStyle_T {
    STY_None,
    STY_Normal,
    STY_Masked,
    STY_Translucent,
    STY_Modulated,
    STY_Alpha,
    STY_Additive,
    STY_Subtractive,
    STY_Particle,
    STY_AlphaZ,
};

enum EPhysics_T {
    PHYS_None,
    PHYS_Walking,
    PHYS_Falling,
    PHYS_Swimming,
    PHYS_Flying,
    PHYS_Rotating,
    PHYS_Projectile,
    PHYS_Interpolating,
    PHYS_MovingBrush,
    PHYS_Spider,
    PHYS_Trailer,
    PHYS_Ladder,
    PHYS_RootMotion,
    PHYS_Karma,
    PHYS_KarmaRagDoll,
    PHYS_MovingTrailer,
    PHYS_EffectTrailer,
    PHYS_NProjectile,
    PHYS_NMover,
    PHYS_L2Movement,
};

enum EDrawType_T {
    DT_None,
    DT_Sprite,
    DT_Mesh,
    DT_Brush,
    DT_RopeSprite,
    DT_VerticalSprite,
    DT_Terraform,
    DT_SpriteAnimOnce,
    DT_StaticMesh,
    DT_DrawType,
    DT_Particle,
    DT_AntiPortal,
    DT_FluidSurface,
    DT_Sun,
    DT_MusicVolume,
    DT_Custom // need collision detection even without its mesh
};

enum EFilterState_T {
    FS_Maybe,
    FS_Yes,
    FS_No
};

enum EDetailMode_T {
    DM_Low,
    DM_High,
    DM_SuperHigh
};

enum EL2EventCmd_T {
    LEC_None,
    LEC_Show,
    LEC_Play
};