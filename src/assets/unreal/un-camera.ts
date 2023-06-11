import UAActor from "./un-aactor";

class UCamera extends UAActor {
    // public readonly careUnread = false;

    // protected _pawn: any;
    // protected _playerNum: any;
    // protected _sightCounter: any;
    // protected _fovAngle: any;
    // protected _handedness: any;
    // protected _bIsPlayer: any;
    // protected _bGodMode: any;
    // protected _bLOSflag: any;
    // protected _bAdvancedTactics: any;
    // protected _bCanOpenDoors: any;
    // protected _bCanDoSpecial: any;
    // protected _bAdjusting: any;
    // protected _bPreparingMove: any;
    // protected _bControlAnimations: any;
    // protected _bEnemyInfoValid: any;
    // protected _bNotifyApex: any;
    // protected _bUsePlayerHearing: any;
    // protected _bJumpOverWall: any;
    // protected _bEnemyAcquired: any;
    // protected _bSoaking: any;
    // protected _bHuntPlayer: any;
    // protected _bAllowedToTranslocate: any;
    // protected _bAllowedToImpactJump: any;
    // protected _bRun: any;
    // protected _bDuck: any;
    // protected _bFire: any;
    // protected _bAltFire: any;
    // protected _adjustLoc: any;
    // protected _nextController: any;
    // protected _stimulus: any;
    // protected _moveTimer: any;
    // protected _moveTarget: any;
    // protected _destination: any;
    // protected _focalPoint: any;
    // protected _focus: any;
    // protected _bMoveLocationDone: any;
    // protected _selectedActor: any;
    // protected _bDead: any;
    // protected _bAutoAttacking: any;
    // protected _bAttackIntend: any;
    // protected _reservedMovePoint: any;
    // protected _reservedMoveActor: any;
    // protected _reservedMoveDistance: any;
    // protected _moveType: any;
    // protected _waitType: any;
    // protected _bMyController: any;
    // protected _pendingMover: any;
    // protected _goalList: any;
    // protected _home: any;
    // protected _minHitWall: any;
    // protected _respawnPredictionTime: any;
    // protected _acquisitionYawRate: any;
    // protected _enemy: any;
    // protected _target: any;
    // protected _lastSeenPos: any;
    // protected _lastSeeingPos: any;
    // protected _lastSeenTime: any;
    // protected _voiceType: any;
    // protected _oldMessageTime: any;
    // protected _routeCache: any;
    // protected _currentPath: any;
    // protected _currentPathDir: any;
    // protected _routeGoal: any;
    // protected _routeDist: any;
    // protected _lastRouteFind: any;
    // protected _playerReplicationInfoClass: any;
    // protected _playerReplicationInfo: any;
    // protected _pawnClass: any;
    // protected _previousPawnClass: any;
    // protected _groundPitchTime: any;
    // protected _viewX: any;
    // protected _viewY: any;
    // protected _viewZ: any;
    // protected _startSpot: any;
    // protected _monitorStartLoc: any;
    // protected _monitoredPawn: any;
    // protected _monitorMaxDistSq: any;
    // protected _fearSpots: any;
    // protected _lastFailedReach: any;
    // protected _failedReachTime: any;
    // protected _failedReachLocation: any;
    // protected _lastPawnWeapon: any;
    // protected _player: any;
    // protected _bLookUpStairs: any;
    // protected _bSnapToLevel: any;
    // protected _bAlwaysMouseLook: any;
    // protected _bKeyboardLook: any;
    // protected _bCenterView: any;
    // protected _bBehindView: any;
    // protected _bFrozen: any;
    // protected _bPressedJump: any;
    // protected _bDoubleJump: any;
    // protected _bUpdatePosition: any;
    // protected _bIsTyping: any;
    // protected _bFixedCamera: any;
    // protected _bJumpStatus: any;
    // protected _bUpdating: any;
    // protected _bNeverSwitchOnPickup: any;
    // protected _bViewBot: any;
    // protected _useFixedVisibility: any;
    // protected _bBlockCloseCamera: any;
    // protected _bValidBehindCamera: any;
    // protected _bForcePrecache: any;
    // protected _bNoVoiceMessages: any;
    // protected _bNoVoiceTaunts: any;
    // protected _bNoAutoTaunts: any;
    // protected _bAutoTaunt: any;
    // protected _bNoMatureLanguage: any;
    // protected _announcerLevel: any;
    // protected _announcerVolume: any;
    // protected _aimingHelp: any;
    // protected _maxResponseTime: any;
    // protected _waitDelay: any;
    // protected _aBaseX: any;
    // protected _aBaseY: any;
    // protected _aBaseZ: any;
    // protected _aMouseX: any;
    // protected _aMouseY: any;
    // protected _aForward: any;
    // protected _aTurn: any;
    // protected _aStrafe: any;
    // protected _aUp: any;
    // protected _aLookUp: any;
    // protected _bStrafe: any;
    // protected _bSnapLevel: any;
    // protected _bLook: any;
    // protected _bFreeLook: any;
    // protected _bTurn180: any;
    // protected _bTurnToNearest: any;
    // protected _bXAxis: any;
    // protected _bYAxis: any;
    // protected _doubleClickDir: any;
    // protected _showFlags: any;
    // protected _misc1: any;
    // protected _misc2: any;
    // protected _rendMap: any;
    // protected _orthoZoom: any;
    // protected _viewTarget: any;
    // protected _realViewTarget: any;
    // protected _cameraDist: any;
    // protected _oldCameraLoc: any;
    // protected _oldCameraRot: any;
    // protected _cameraEffects: any;
    // protected _bRenderWide: any;
    // protected _desiredFOV: any;
    // protected _defaultFOV: any;
    // protected _zoomLevel: any;
    // protected _fixedLocation: any;
    // protected _fixedRotation: any;
    // protected _renderWorldToCamera: any;
    // protected _flashScale: any;
    // protected _flashFog: any;
    // protected _constantGlowScale: any;
    // protected _constantGlowFog: any;
    // protected _lastDistanceFogColor: any;
    // protected _lastDistanceFogStart: any;
    // protected _lastDistanceFogEnd: any;
    // protected _currentDistanceFogEnd: any;
    // protected _timeSinceLastFogChange: any;
    // protected _lastZone: any;
    // protected _targetViewRotation: any;
    // protected _targetEyeHeight: any;
    // protected _targetWeaponViewOffset: any;
    // protected _myHUD: any;
    // protected _lastPlaySound: any;
    // protected _lastPlaySpeech: any;
    // protected _song: any;
    // protected _transition: any;
    // protected _savedMoves: any;
    // protected _freeMoves: any;
    // protected _pendingMove: any;
    // protected _currentTimeStamp: any;
    // protected _lastUpdateTime: any;
    // protected _serverTimeStamp: any;
    // protected _timeMargin: any;
    // protected _clientUpdateTime: any;
    // protected _maxTimeMargin: any;
    // protected _oldClientWeapon: any;
    // protected _weaponUpdate: any;
    // protected _progressMessage: any;
    // protected _progressColor: any;
    // protected _progressTimeOut: any;
    // protected _quickSaveString: any;
    // protected _noPauseMessage: any;
    // protected _viewingFrom: any;
    // protected _ownCamera: any;
    // protected _gameReplicationInfo: any;
    // protected _statsUsername: any;
    // protected _statsPassword: any;
    // protected _localMessageClass: any;
    // protected _maxShakeRoll: any;
    // protected _maxShakeOffset: any;
    // protected _shakeRollRate: any;
    // protected _shakeOffsetRate: any;
    // protected _shakeOffset: any;
    // protected _shakeRollTime: any;
    // protected _shakeOffsetTime: any;
    // protected _turnTarget: any;
    // protected _enemyTurnSpeed: any;
    // protected _groundPitch: any;
    // protected _turnRot180: any;
    // protected _oldFloor: any;
    // protected _cheatManager: any;
    // protected _cheatClass: any;
    // protected _playerInput: any;
    // protected _inputClass: any;
    // protected _failedPathStart: any;
    // protected _demoViewPitch: any;
    // protected _demoViewYaw: any;
    // protected _playerSecurity: any;
    // protected _forcePrecacheTime: any;
    // protected _lastPingUpdate: any;
    // protected _lastPhysicsVolume: any;
    // protected _currentDistanceFogStart: any;
    // protected _currentDistanceColor: any;
    // protected _volumeFogBlendRatio: any;
    // protected _underWaterLoopSound: any;
    // protected _bUseHoldCamera: any;
    // protected _compensateYaw: any;
    // protected _copmensatePitch: any;
    // protected _floatingSolid: any;
    // protected _sunBeam: any;
    // protected _lastSamplingLocation: any;

    // protected _bZooming: boolean;
    // protected _bAlwaysLevel: boolean;
    // protected _bSetTurnRot: boolean;
    // protected _bCheatFlying: boolean;
    // protected _bFreeCamera: boolean;
    // protected _bZeroRoll: boolean;
    // protected _bCameraPositionLocked: boolean;

    // protected getPropertyMap(): Record<string, string> {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         "Pawn": "_pawn",
    //         "PlayerNum": "_playerNum",
    //         "SightCounter": "_sightCounter",
    //         "FovAngle": "_fovAngle",
    //         "Handedness": "_handedness",
    //         "bIsPlayer": "_bIsPlayer",
    //         "bGodMode": "_bGodMode",
    //         "bLOSflag": "_bLOSflag",
    //         "bAdvancedTactics": "_bAdvancedTactics",
    //         "bCanOpenDoors": "_bCanOpenDoors",
    //         "bCanDoSpecial": "_bCanDoSpecial",
    //         "bAdjusting": "_bAdjusting",
    //         "bPreparingMove": "_bPreparingMove",
    //         "bControlAnimations": "_bControlAnimations",
    //         "bEnemyInfoValid": "_bEnemyInfoValid",
    //         "bNotifyApex": "_bNotifyApex",
    //         "bUsePlayerHearing": "_bUsePlayerHearing",
    //         "bJumpOverWall": "_bJumpOverWall",
    //         "bEnemyAcquired": "_bEnemyAcquired",
    //         "bSoaking": "_bSoaking",
    //         "bHuntPlayer": "_bHuntPlayer",
    //         "bAllowedToTranslocate": "_bAllowedToTranslocate",
    //         "bAllowedToImpactJump": "_bAllowedToImpactJump",
    //         "bRun": "_bRun",
    //         "bDuck": "_bDuck",
    //         "bFire": "_bFire",
    //         "bAltFire": "_bAltFire",
    //         "AdjustLoc": "_adjustLoc",
    //         "nextController": "_nextController",
    //         "Stimulus": "_stimulus",
    //         "MoveTimer": "_moveTimer",
    //         "MoveTarget": "_moveTarget",
    //         "Destination": "_destination",
    //         "FocalPoint": "_focalPoint",
    //         "Focus": "_focus",
    //         "bMoveLocationDone": "_bMoveLocationDone",
    //         "SelectedActor": "_selectedActor",
    //         "bDead": "_bDead",
    //         "bAutoAttacking": "_bAutoAttacking",
    //         "bAttackIntend": "_bAttackIntend",
    //         "ReservedMovePoint": "_reservedMovePoint",
    //         "ReservedMoveActor": "_reservedMoveActor",
    //         "ReservedMoveDistance": "_reservedMoveDistance",
    //         "MoveType": "_moveType",
    //         "WaitType": "_waitType",
    //         "bMyController": "_bMyController",
    //         "PendingMover": "_pendingMover",
    //         "GoalList": "_goalList",
    //         "home": "_home",
    //         "MinHitWall": "_minHitWall",
    //         "RespawnPredictionTime": "_respawnPredictionTime",
    //         "AcquisitionYawRate": "_acquisitionYawRate",
    //         "Enemy": "_enemy",
    //         "Target": "_target",
    //         "LastSeenPos": "_lastSeenPos",
    //         "LastSeeingPos": "_lastSeeingPos",
    //         "LastSeenTime": "_lastSeenTime",
    //         "VoiceType": "_voiceType",
    //         "OldMessageTime": "_oldMessageTime",
    //         "RouteCache": "_routeCache",
    //         "CurrentPath": "_currentPath",
    //         "CurrentPathDir": "_currentPathDir",
    //         "RouteGoal": "_routeGoal",
    //         "RouteDist": "_routeDist",
    //         "LastRouteFind": "_lastRouteFind",
    //         "PlayerReplicationInfoClass": "_playerReplicationInfoClass",
    //         "PlayerReplicationInfo": "_playerReplicationInfo",
    //         "PawnClass": "_pawnClass",
    //         "PreviousPawnClass": "_previousPawnClass",
    //         "GroundPitchTime": "_groundPitchTime",
    //         "ViewX": "_viewX",
    //         "ViewY": "_viewY",
    //         "ViewZ": "_viewZ",
    //         "StartSpot": "_startSpot",
    //         "MonitorStartLoc": "_monitorStartLoc",
    //         "MonitoredPawn": "_monitoredPawn",
    //         "MonitorMaxDistSq": "_monitorMaxDistSq",
    //         "FearSpots": "_fearSpots",
    //         "LastFailedReach": "_lastFailedReach",
    //         "FailedReachTime": "_failedReachTime",
    //         "FailedReachLocation": "_failedReachLocation",
    //         "LastPawnWeapon": "_lastPawnWeapon",
    //         "Player": "_player",
    //         "bLookUpStairs": "_bLookUpStairs",
    //         "bSnapToLevel": "_bSnapToLevel",
    //         "bAlwaysMouseLook": "_bAlwaysMouseLook",
    //         "bKeyboardLook": "_bKeyboardLook",
    //         "bCenterView": "_bCenterView",
    //         "bBehindView": "_bBehindView",
    //         "bFrozen": "_bFrozen",
    //         "bPressedJump": "_bPressedJump",
    //         "bDoubleJump": "_bDoubleJump",
    //         "bUpdatePosition": "_bUpdatePosition",
    //         "bIsTyping": "_bIsTyping",
    //         "bFixedCamera": "_bFixedCamera",
    //         "bJumpStatus": "_bJumpStatus",
    //         "bUpdating": "_bUpdating",
    //         "bNeverSwitchOnPickup": "_bNeverSwitchOnPickup",
    //         "bViewBot": "_bViewBot",
    //         "UseFixedVisibility": "_useFixedVisibility",
    //         "bBlockCloseCamera": "_bBlockCloseCamera",
    //         "bValidBehindCamera": "_bValidBehindCamera",
    //         "bForcePrecache": "_bForcePrecache",
    //         "bNoVoiceMessages": "_bNoVoiceMessages",
    //         "bNoVoiceTaunts": "_bNoVoiceTaunts",
    //         "bNoAutoTaunts": "_bNoAutoTaunts",
    //         "bAutoTaunt": "_bAutoTaunt",
    //         "bNoMatureLanguage": "_bNoMatureLanguage",
    //         "AnnouncerLevel": "_announcerLevel",
    //         "AnnouncerVolume": "_announcerVolume",
    //         "AimingHelp": "_aimingHelp",
    //         "MaxResponseTime": "_maxResponseTime",
    //         "WaitDelay": "_waitDelay",
    //         "aBaseX": "_aBaseX",
    //         "aBaseY": "_aBaseY",
    //         "aBaseZ": "_aBaseZ",
    //         "aMouseX": "_aMouseX",
    //         "aMouseY": "_aMouseY",
    //         "aForward": "_aForward",
    //         "aTurn": "_aTurn",
    //         "aStrafe": "_aStrafe",
    //         "aUp": "_aUp",
    //         "aLookUp": "_aLookUp",
    //         "bStrafe": "_bStrafe",
    //         "bSnapLevel": "_bSnapLevel",
    //         "bLook": "_bLook",
    //         "bFreeLook": "_bFreeLook",
    //         "bTurn180": "_bTurn180",
    //         "bTurnToNearest": "_bTurnToNearest",
    //         "bXAxis": "_bXAxis",
    //         "bYAxis": "_bYAxis",
    //         "DoubleClickDir": "_doubleClickDir",
    //         "ShowFlags": "_showFlags",
    //         "Misc1": "_misc1",
    //         "Misc2": "_misc2",
    //         "RendMap": "_rendMap",
    //         "OrthoZoom": "_orthoZoom",
    //         "ViewTarget": "_viewTarget",
    //         "RealViewTarget": "_realViewTarget",
    //         "CameraDist": "_cameraDist",
    //         "OldCameraLoc": "_oldCameraLoc",
    //         "OldCameraRot": "_oldCameraRot",
    //         "CameraEffects": "_cameraEffects",
    //         "bRenderWide": "_bRenderWide",
    //         "DesiredFOV": "_desiredFOV",
    //         "DefaultFOV": "_defaultFOV",
    //         "ZoomLevel": "_zoomLevel",
    //         "FixedLocation": "_fixedLocation",
    //         "FixedRotation": "_fixedRotation",
    //         "RenderWorldToCamera": "_renderWorldToCamera",
    //         "FlashScale": "_flashScale",
    //         "FlashFog": "_flashFog",
    //         "ConstantGlowScale": "_constantGlowScale",
    //         "ConstantGlowFog": "_constantGlowFog",
    //         "LastDistanceFogColor": "_lastDistanceFogColor",
    //         "LastDistanceFogStart": "_lastDistanceFogStart",
    //         "LastDistanceFogEnd": "_lastDistanceFogEnd",
    //         "CurrentDistanceFogEnd": "_currentDistanceFogEnd",
    //         "TimeSinceLastFogChange": "_timeSinceLastFogChange",
    //         "LastZone": "_lastZone",
    //         "TargetViewRotation": "_targetViewRotation",
    //         "TargetEyeHeight": "_targetEyeHeight",
    //         "TargetWeaponViewOffset": "_targetWeaponViewOffset",
    //         "myHUD": "_myHUD",
    //         "LastPlaySound": "_lastPlaySound",
    //         "LastPlaySpeech": "_lastPlaySpeech",
    //         "Song": "_song",
    //         "Transition": "_transition",
    //         "SavedMoves": "_savedMoves",
    //         "FreeMoves": "_freeMoves",
    //         "PendingMove": "_pendingMove",
    //         "CurrentTimeStamp": "_currentTimeStamp",
    //         "LastUpdateTime": "_lastUpdateTime",
    //         "ServerTimeStamp": "_serverTimeStamp",
    //         "TimeMargin": "_timeMargin",
    //         "ClientUpdateTime": "_clientUpdateTime",
    //         "MaxTimeMargin": "_maxTimeMargin",
    //         "OldClientWeapon": "_oldClientWeapon",
    //         "WeaponUpdate": "_weaponUpdate",
    //         "ProgressMessage": "_progressMessage",
    //         "ProgressColor": "_progressColor",
    //         "ProgressTimeOut": "_progressTimeOut",
    //         "QuickSaveString": "_quickSaveString",
    //         "NoPauseMessage": "_noPauseMessage",
    //         "ViewingFrom": "_viewingFrom",
    //         "OwnCamera": "_ownCamera",
    //         "GameReplicationInfo": "_gameReplicationInfo",
    //         "StatsUsername": "_statsUsername",
    //         "StatsPassword": "_statsPassword",
    //         "LocalMessageClass": "_localMessageClass",
    //         "MaxShakeRoll": "_maxShakeRoll",
    //         "MaxShakeOffset": "_maxShakeOffset",
    //         "ShakeRollRate": "_shakeRollRate",
    //         "ShakeOffsetRate": "_shakeOffsetRate",
    //         "ShakeOffset": "_shakeOffset",
    //         "ShakeRollTime": "_shakeRollTime",
    //         "ShakeOffsetTime": "_shakeOffsetTime",
    //         "TurnTarget": "_turnTarget",
    //         "EnemyTurnSpeed": "_enemyTurnSpeed",
    //         "GroundPitch": "_groundPitch",
    //         "TurnRot180": "_turnRot180",
    //         "OldFloor": "_oldFloor",
    //         "CheatManager": "_cheatManager",
    //         "CheatClass": "_cheatClass",
    //         "PlayerInput": "_playerInput",
    //         "InputClass": "_inputClass",
    //         "FailedPathStart": "_failedPathStart",
    //         "DemoViewPitch": "_demoViewPitch",
    //         "DemoViewYaw": "_demoViewYaw",
    //         "PlayerSecurity": "_playerSecurity",
    //         "ForcePrecacheTime": "_forcePrecacheTime",
    //         "LastPingUpdate": "_lastPingUpdate",
    //         "LastPhysicsVolume": "_lastPhysicsVolume",
    //         "CurrentDistanceFogStart": "_currentDistanceFogStart",
    //         "CurrentDistanceColor": "_currentDistanceColor",
    //         "VolumeFogBlendRatio": "_volumeFogBlendRatio",
    //         "UnderWaterLoopSound": "_underWaterLoopSound",
    //         "bUseHoldCamera": "_bUseHoldCamera",
    //         "CompensateYaw": "_compensateYaw",
    //         "CopmensatePitch": "_copmensatePitch",
    //         "FloatingSolid": "_floatingSolid",
    //         "SunBeam": "_sunBeam",
    //         "LastSamplingLocation": "_lastSamplingLocation",

    //         "bZooming": "_bZooming",
    //         "bAlwaysLevel": "_bAlwaysLevel",
    //         "bSetTurnRot": "_bSetTurnRot",
    //         "bCheatFlying": "_bCheatFlying",
    //         "bFreeCamera": "_bFreeCamera",
    //         "bZeroRoll": "_bZeroRoll",
    //         "bCameraPositionLocked": "_bCameraPositionLocked",
    //     });
    // }
}

export default UCamera;
export { UCamera };