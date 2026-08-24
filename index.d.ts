import * as THREE from "three";

type ExtendsUObject<T> = T & C.UObject;


declare global {
    namespace L2JS {
        namespace Client {
            namespace Rendering {

            }

            namespace Assets {
                export type UPackage = import("@unreal/un-package").UPackage;
                export type UNativePackage = import("@unreal/un-package").UNativePackage;
                export type UCorePackage = import("@unreal/un-package").UCorePackage;
                export type UEnginePackage = import("@unreal/un-package").UEnginePackage;

                export type ULevel = import("@unreal/un-level").ULevel;
                export type ULevelInfo = import("@unreal/un-level-info").ULevelInfo;

                export type UModel = import("@unreal/model/un-model").UModel;
                export type UTerrainLayer = import("@unreal/un-terrain-layer").UTerrainLayer;
                export type UTerrainSector = import("@unreal/un-terrain-sector").UTerrainSector;

                export type FLeaf = import("@unreal/un-leaf").FLeaf;

                export type FVector = import("@unreal/un-vector").FVector;
                export type FCoords = import("@unreal/un-coords").FCoords;
                export type FRotator = import("@unreal/un-rotator").FRotator;
                export type FQuaternion = import("@unreal/un-quaternion").FQuaternion;
                export type FPlane = import("@unreal/un-plane").FPlane;
                export type FBox = import("@unreal/un-box").FBox;
                export type FMatrix = import("@unreal/un-matrix").FMatrix;
                export type FColor = import("@unreal/un-color").FColor;
                export type FScale = import("@unreal/un-scale").FScale;
                export type FRange = import("@unreal/un-range").FRange;
                export type FRangeVector = import("@unreal/un-range").FRangeVector;

                export type UPlatte = import("@unreal/un-palette").UPlatte;
                export type UTexture = ExtendsUObject<import("@unreal/un-texture").UTexture>;

                export type UTextureModifyInfo = import("@unreal/un-texture-modify-info").UTextureModifyInfo;
                export type FStaticLightmapTexture = import("@unreal/model/un-multilightmap-texture").FStaticLightmapTexture;

                export type NativeClientTypes_T =
                    | C.NativeTypes_T
                    | "NMovableSunLight"
                    | "NSun"
                    | "NMoon"
                    | "L2FogInfo"
                    | "L2SeamlessInfo"
                    | "L2NTimeLight"
                    | "L2NEnvLight"
                    | "SceneManager"
                    | "MovableStaticMeshActor"
                    | "Combiner"
                    | "VertexColor"
                    | "LineagePlayerController"
                    | "SkillVisualEffect"
                    | "SkillAction"
                    | "SkillAction_LocateEffect"
                    | "SkillAction_SwordTrail"
                    | "AnimNotify"
                    | "AnimNotify_IdleSound"
                    | "AnimNotify_MatSubAction"
                    | "AnimNotify_Scripted"
                    | "AnimNotify_Script"
                    | "AnimNotify_Sound"
                    | "AnimNotify_SwimSound"
                    | "AnimNotify_DestroyEffect"
                    | "AnimNotify_Effect"
                    | "AnimNotify_AttackVoice"
                    | "AnimNotify_Channeling"
                    | "AnimNotify_AttackPreShot"
                    | "AnimNotify_AttackShot"
                    | "AnimNotify_AttackItem"
                    | "AnimNotify_ScreenFade"
                    | "AnimNotify_ViewShake"
                    | "AnimNotify_BoneScale";

                export type USound = import("@unreal/un-sound").USound;
                export type UAmbientSoundObject = import("@unreal/un-ambient-sound").UAmbientSoundObject;
                export type UMusicVolume = import("@unreal/un-music-volume").UMusicVolume;

                export type UNSun = import("@unreal/un-nsun").UNSun;
                export type UNMoon = import("@unreal/un-nmoon").UNMoon;

                export type UPolys = import("@unreal/un-polys").UPolys;
                export type PolyFlags_T = import("@unreal/un-polys").PolyFlags_T;

                export type UBrush = import("@unreal/un-brush").UBrush;

                export type UMaterial = import("@unreal/un-material").UMaterial;
                export type UShader = import("@unreal/un-material").UShader;

                export type AActor = import("@unreal/un-aactor").UAActor;

                export type AInfo = import("@unreal/un-info").AInfo;
                export type UL2FogInfo = import("@unreal/un-fog-info").UL2FogInfo;
                export type FZoneInfo = import("@unreal/un-zone-info").FZoneInfo;
                export type ATerrainInfo = import("@unreal/un-terrain-info").ATerrainInfo;

                export type UEmitter = import("@unreal/un-emitter").UEmitter;

                export interface IUserConfig {
                    clippingRange: IClippingRangeConfig;
                    display: IDisplayConfig;
                }

                export interface IDisplayConfig {
                    brightness: number;
                    contrast: number;
                    gamma: number;
                }

                export interface IClippingRangeConfig {
                    staticMesh: number;
                    staticMeshLod: number;
                    pawn: number;
                    terrain: number;
                    actor: number;
                    projector: number;
                    antiPortal: number;
                    pawnMin: number;
                    pawnMax: number;
                }

                export type UStaticMesh = import("@unreal/static-mesh/un-static-mesh").UStaticMesh;
                export type UStaticMeshActor = import("@unreal/static-mesh/un-static-mesh-actor").UStaticMeshActor;
                export type UStaticMeshInstance = import("@unreal/static-mesh/un-static-mesh-instance").UStaticMeshInstance;
                export type UStaticMeshMaterial = import("@unreal/un-material").UStaticMeshMaterial;

                export type USkeletalMesh = import("@unreal/skeletal-mesh/un-skeletal-mesh").USkeletalMesh;
                export type UPawn = import("@unreal/un-pawn").UPawn;
                export type UMeshAnimation = import("@unreal/skeletal-mesh/un-mesh-animation").UMeshAnimation;

                export type FTIntMap = import("@unreal/un-tint-map").FTIntMap;
                export type UDecoLayer = import("@unreal/un-deco-layer").UDecoLayer;

                export type UPointRegion = import("@unreal/un-point-region").UPointRegion;

                export type UPhysicsVolume = import("@unreal/un-physics-volume").UPhysicsVolume;

                export type SupportedBlendingTypes_T = "normal" | "masked" | "modulate" | "alphaModulate" | "translucent" | "invisible" | "brighten" | "darken";

                export type ULight = import("@unreal/un-light").ULight;
                export type LightEffect_T = import("@unreal/un-light").LightEffect_T;
                export type LightType_T = import("@unreal/un-light").LightType_T;
                export type UNMovableSunLight = import("@unreal/un-movable-sunlight").UNMovableSunLight;

                export type FNTimeColor = import("@unreal/un-l2env").FNTimeColor;
                export type FNTimeHSV = import("@unreal/un-l2env").FNTimeHSV;
                export type FNTimeScale = import("@unreal/un-l2env").FNTimeScale;
                export type UL2NEnvLight = import("@unreal/un-l2env").UL2NEnvLight;
                export type UL2NTimeLight = import("@unreal/un-l2env").UL2NTimeLight;
                export type EEnvCycle = import("@unreal/un-l2env").EEnvCycle;
            }

            namespace Decoding {
                export type IndexTypedArray = Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor;
                export type IndexTypedArrayAttribute = typeof THREE.Uint8BufferAttribute | typeof THREE.Uint16BufferAttribute | typeof THREE.Uint32BufferAttribute;

                export type Vector2Arr = [number, number];
                export type Vector4Arr = [number, number, number, number];
                export type Matrix4Arr = number[] & { length: 16 };
                export type QuaternionArr = Vector4Arr;
                export type ColorArr = Vector3Arr | Vector4Arr;
                export type Vector3Arr = [number, number, number];
                export type EulerOrder = "XYZ" | "YZX" | "ZXY" | "XZY" | "YXZ" | "ZYX";
                export type EulerArr = [...Vector3Arr, EulerOrder];
                export type ArrGeometryGroup = [number, number, number];

                export type DecodeLibrary = import("@unreal/decode-library").DecodeLibrary;
                export type DecodeLibraryBuilder = import("@unreal/decode-library-builder").DecodeLibraryBuilder;
                export type MapData_T = { texture: THREE.Texture, size: THREE.Vector2 };

                export interface INpcDefinition {
                    id: number;
                    name: string;
                    className: string;
                    mesh: string;
                    textures: string[];
                    enterEvent: INpcEnterEvent | null;
                }

                export interface INpcEnterEvent {
                    sound: string;
                    soundVolume: number;
                    soundRadius: number;
                    isRise: number;
                    spawnType: number;
                    effect: string;
                    animation: string;
                }

                export type ScriptBytecodeValue_T = number | string | null | Vector3Arr | IScriptBytecodeOffsetDecodeInfo | IScriptBytecodeLabelDecodeInfo;

                export interface IScriptBytecodeOffsetDecodeInfo {
                    virtualOffset: number,
                    entryIndex: number
                }

                export interface IScriptBytecodeLabelDecodeInfo extends IScriptBytecodeOffsetDecodeInfo {
                    name: string,
                }

                export interface IScriptBytecodeEntryDecodeInfo {
                    virtualOffset: number,
                    type: string,
                    value: ScriptBytecodeValue_T,
                    tokenName?: string
                }

                export interface IScriptProgramDecodeInfo {
                    virtualSize: number,
                    entries: IScriptBytecodeEntryDecodeInfo[]
                }

                export interface IScriptFieldDecodeInfo {
                    id: string,
                    name: string,
                    type: C.PropertyTypes_T,
                    arrayDimensions: number,
                    flags: number
                }

                export interface IScriptFunctionDecodeInfo {
                    id: string,
                    owner: string,
                    name: string,
                    nativeIndex: number,
                    operatorPrecedence: number,
                    flags: number,
                    replicationOffset: number,
                    fields: IScriptFieldDecodeInfo[],
                    program: IScriptProgramDecodeInfo
                }

                export interface IScriptStateDecodeInfo {
                    id: string,
                    owner: string,
                    name: string,
                    flags: number,
                    probeMask: bigint,
                    ignoreMask: bigint,
                    labelTableVirtualOffset: number,
                    fields: IScriptFieldDecodeInfo[],
                    functionIds: string[],
                    program: IScriptProgramDecodeInfo
                }

                export interface IScriptClassDecodeInfo extends IScriptStateDecodeInfo {
                    superClassId: string | null,
                    classFlags: number,
                    stateIds: string[],
                    defaults: Record<string, ScriptPropertyValue_T>
                }

                export type ScriptPropertyValue_T = number | boolean | string | null | ScriptPropertyValue_T[] | { [key: string]: ScriptPropertyValue_T };

                export type LoadSettings_T = {
                    loadTerrain?: boolean,
                    loadBaseModel?: boolean,
                    loadStaticModels?: boolean,
                    loadStaticModelList?: (number | string)[],
                    loadExtendedBoneInfluences?: boolean,
                    loadEmitters?: boolean,
                    loadEmitterList?: { name: string, emitters?: string[] }[],
                    loadAudio?: boolean,
                    textures: "auto" | "rgba" | "compressed",
                    helpersZoneBounds?: boolean,
                    isSkyLevel?: boolean,
                    decodeWorkerPoolSize?: number,
                    batching?: {
                        terrain?: boolean,
                        staticMeshes?: boolean
                    },
                    cache?: false | {
                        enabled?: boolean,
                        version?: number
                    },
                    [key: `_${string}`]: any // debug/testing overrides, see core.ts
                };

                export interface IDecodedParameter {
                    uniforms: Record<string, any>,
                    defines: Record<string, any>,
                    isUsingMap: boolean,
                    transformType: "none" | "pan" | "rotate" | "oscillate" | "envMap" | "envMapWorld",
                    sprites?: any[],
                    framerate?: number,
                    uvIndex?: number
                }

                export interface IDecodedSpriteParameter extends IDecodedParameter {
                    isSprite: true,
                    sprites: any[],
                    framerate: number
                }

                export interface IInfo { getDecodeInfo(library: DecodeLibrary): IBaseZoneDecodeInfo; }

                export interface IBoxDecodeInfo { isValid: boolean, min: Vector3Arr, max: Vector3Arr }
                export interface ISphereDecodeInfo { center: Vector3Arr, radius: number }

                export interface IZoneDecodeInfo extends IBaseZoneDecodeInfo { type: "Zone" }
                export interface ISkyZoneDecodeInfo extends IBaseZoneDecodeInfo { type: "Sky" }
                export interface ISectorDecodeInfo extends IBaseZoneDecodeInfo { type: "Sector" }

                export interface IZoneFogInfo {
                    start: number,
                    end: number,
                    color: ColorArr
                }

                export type DecodableObject_T =
                    | "Group"
                    | "Level"
                    | "TerrainInfo"
                    | "TerrainSegment"
                    | "TerrainDecoration"
                    | "StaticMeshActor"
                    | "StaticMesh"
                    | "Model"
                    | "Light"
                    | "Sunlight"
                    | "Edges"
                    | "SkinnedMesh"
                    | "Bone"
                    | "Emitter"
                    | "SpriteEmitter"
                    | "MeshEmitter"
                    | "BeamEmitter"
                    | "Zone"
                    | "Sky"
                    | "SkyZoneInfo"
                    | "L2FogInfo";

                // math structs that serialize through the standard decode method,
                // same encodings ([x,y,z] tuples, [min,max]) as the rest of decoding
                export interface IDecodableStruct<T = unknown> {
                    getDecodeInfo(library: DecodeLibrary): T;
                }

                export interface IBaseObjectOrInstanceDecodeInfo {
                    uuid: string,
                    type: DecodableObject_T | "StaticMeshInstance"
                }

                export interface IBaseObjectDecodeInfo extends IBaseObjectOrInstanceDecodeInfo {
                    type: DecodableObject_T,
                    name?: string,
                    scriptClassId?: string,
                    scriptProperties?: Record<string, ScriptPropertyValue_T>,
                    position?: Vector3Arr,
                    rotation?: EulerArr,
                    quaternion?: QuaternionArr,
                    scale?: Vector3Arr,
                    moveEvent?: string,
                    siblings?: IBaseObjectOrInstanceDecodeInfo[],
                    children?: (IBaseObjectOrInstanceDecodeInfo | EmitterConfig_T)[],
                    bounds?: IBoxDecodeInfo,
                    zoneMask?: bigint,
                    isRangeIgnored?: boolean
                }

                export interface IEmitterSpawnSoundDecodeInfo {
                    soundName: string;
                    volume: number;
                    radius: number;
                }

                export interface IEmitterActorDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "Emitter";
                    spawnSound?: IEmitterSpawnSoundDecodeInfo;
                    rotating?: IRotatingDecodeInfo;
                }

                export interface IStaticMeshActorDecodeInfo extends IBaseObjectDecodeInfo {
                    actorName: string;
                    type: "StaticMeshActor",
                    instance: IStaticMeshInstanceDecodeInfo,
                    bounds: IBoxDecodeInfo,
                    scaledGlow: number,
                    isSunAffected?: boolean,
                    dontBatch?: boolean,
                    mover?: IMoverDecodeInfo,
                    rotating?: IRotatingDecodeInfo,
                    swaying?: ISwayingDecodeInfo,
                    collision: IActorCollisionDecodeInfo,
                    ambient: {
                        glow: number,
                        vector: Vector3Arr,
                        isUnlit: boolean,
                        hardwareLighting?: boolean
                    }
                }

                export interface IActorCollisionDecodeInfo {
                    collideActors: boolean,
                    collideWorld: boolean,
                    blockActors: boolean,
                    blockPlayers: boolean,
                    blockZeroExtent: boolean,
                    blockNonZeroExtent: boolean,
                    worldGeometry: boolean,
                    useCylinderCollision: boolean,
                    collisionRadius: number,
                    collisionHeight: number
                }

                export interface IRotatingDecodeInfo {
                    rotator: Vector3Arr,
                    rate: Vector3Arr
                }

                export interface ISwayingDecodeInfo {
                    tags: string[],
                    orgRotator: Vector3Arr,
                    rate: Vector3Arr,
                    max: Vector3Arr,
                    accelRatio: Vector3Arr,
                    maxRandom: boolean,
                    randomStart: boolean
                }

                export interface IMoverDecodeInfo {
                    initialState: string,
                    keyNum: number,
                    keyPositions: Vector3Arr[],
                    keyQuaternions: QuaternionArr[],
                    moveTime: number,
                    stayOpenTime: number,
                    delayTime: number,
                    collisionRadius: number,
                    collisionHeight: number,
                    isGliding: boolean,
                    triggerOnceOnly: boolean,
                    moverEncroachType: "stop" | "return" | "crush" | "ignore"
                }

                export interface IBaseMeshObjectDecodeInfo extends IBaseObjectDecodeInfo {
                    geometry: string,
                    materials?: string
                }

                export interface IStaticMeshObjectDecodeInfo extends IBaseMeshObjectDecodeInfo {
                    type: "StaticMesh",
                    sway?: IStaticMeshSwayDecodeInfo
                }

                export interface IStaticMeshSwayDecodeInfo {
                    pivotZ: number,
                    frequency: number,
                    maxAngle: number
                }

                export interface ISkinnedMeshObjectDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "SkinnedMesh";
                    geometry: string;
                    materials?: string;
                    skeleton: IBoneDecodeInfo[];
                    animations: Record<string, IKeyframeDecodeInfo_T[]>;
                    animationNotifies: Record<string, IAnimationNotifyDecodeInfo[]>;
                    skinNotifies: Record<string, ISkinNotifyDecodeInfo>;
                    skinMaterials?: Record<number, string>;
                    animationSet?: string;
                    meshScale: Vector3Arr;
                    meshOrigin: Vector3Arr;
                    meshRotOrigin: Vector3Arr;
                    meshRotOriginQuaternion: QuaternionArr;
                    scaledGlow?: number;
                    ambient?: {
                        glow: number,
                        isUnlit: boolean
                    };
                }

                export interface ISkinNotifyEntryDecodeInfo {
                    time: number;
                    skinIndex: number;
                }

                export interface IFixedSkinNotifyDecodeInfo {
                    mode: "fixed";
                    frameCount: number;
                    timeline: ISkinNotifyEntryDecodeInfo[];
                }

                export interface IGroupedSkinNotifyDecodeInfo {
                    mode: "grouped";
                    frameCount: number;
                    groups: {
                        startFrame: number;
                        timeline: ISkinNotifyEntryDecodeInfo[];
                    }[];
                }

                export interface IRandomSkinNotifyDecodeInfo {
                    mode: "random";
                    frameCount: number;
                    intervalMin: number;
                    intervalMax: number;
                    timeline: ISkinNotifyEntryDecodeInfo[];
                }

                export type ISkinNotifyDecodeInfo = IFixedSkinNotifyDecodeInfo | IGroupedSkinNotifyDecodeInfo | IRandomSkinNotifyDecodeInfo;

                export interface IAnimationNotifyDecodeInfo {
                    time: number;
                    name: string;
                    object: IAnimationNotifyObjectDecodeInfo | null;
                }

                export type IAnimationNotifyObjectDecodeInfo = IAnimationSoundNotifyDecodeInfo | IAnimationSwimSoundNotifyDecodeInfo | IAnimationScreenFadeNotifyDecodeInfo | IAnimationViewShakeNotifyDecodeInfo | IAnimationEffectNotifyDecodeInfo | IAnimationNativeNotifyDecodeInfo;

                export interface IAnimationNativeNotifyDecodeInfo {
                    type: "native";
                    className: string;
                    objectName: string;
                }

                export interface IAnimationSoundNotifyDecodeInfo {
                    type: "sound";
                    className: "AnimNotify_Sound";
                    objectName: string;
                    sound: string | null;
                    volume: number;
                    radius: number;
                    random: number;
                    defaultWalkSounds: string[];
                    defaultRunSounds: string[];
                    grassWalkSounds: string[];
                    grassRunSounds: string[];
                    waterWalkSounds: string[];
                    waterRunSounds: string[];
                    defaultActorWalkSounds: string[];
                    defaultActorRunSounds: string[];
                }

                export interface IAnimationSwimSoundNotifyDecodeInfo {
                    type: "swimSound";
                    className: "AnimNotify_SwimSound";
                    objectName: string;
                    surface: IAnimationSwimSoundSetDecodeInfo | null;
                    underwater: IAnimationSwimSoundSetDecodeInfo | null;
                }

                export interface IAnimationSwimSoundSetDecodeInfo {
                    sounds: string[];
                    volume: number;
                    radius: number;
                    random: number;
                }

                export interface IAnimationScreenFadeNotifyDecodeInfo {
                    type: "screenFade";
                    className: "AnimNotify_ScreenFade";
                    objectName: string;
                    fadeOutDuration: number;
                    fadeOutColor: Vector4Arr;
                    blackOutDuration: number;
                    fadeInDuration: number;
                }

                export interface IAnimationViewShakeNotifyDecodeInfo {
                    type: "viewShake";
                    className: "AnimNotify_ViewShake";
                    objectName: string;
                    shakeType: "damage" | "vibration" | "user" | "up" | "down" | "upDown" | "downUp";
                    shakeIntensity: number;
                    shakeVector: Vector3Arr;
                    shakeRange: number;
                    shakeCount: number;
                }

                export interface IAnimationEffectNotifyDecodeInfo {
                    type: "effect";
                    className: "AnimNotify_Effect";
                    objectName: string;
                    effectClass: string | null;
                    bone: string;
                    offsetLocation: Vector3Arr;
                    offsetRotation: Vector3Arr;
                    attach: boolean;
                    tag: string;
                    drawScale: number;
                    drawScale3D: Vector3Arr;
                    trailCamera: boolean;
                    independentRotation: boolean;
                    effectScale: number;
                }

                export interface IEmitterDecodeInfo extends IBaseObjectDecodeInfo {
                    acceleration: Vector3Arr,
                    lifetime: [number, number],
                    maxParticles: number,
                    initial: {
                        particlesPerSecond: number,
                        scale: { min: Vector3Arr, max: Vector3Arr },
                        velocity: { min: Vector3Arr, max: Vector3Arr },
                        position: { min: Vector3Arr, max: Vector3Arr },
                        offset?: Vector3Arr,
                        angularVelocity: { min: Vector3Arr, max: Vector3Arr }
                    },
                    particlesPerSecond: number,
                    blendingMode: ParticleBlendModes_T,
                    opacity: number,
                    drawScale?: number,
                    changesOverLifetime: {
                        scale: { values: [number, number][], repeats: number }
                    },
                    fadeIn: Fade_T,
                    fadeOut: Fade_T,
                    colorMultiplierRange: { min: Vector3Arr, max: Vector3Arr },
                    angularVelocity?: { min: Vector3Arr, max: Vector3Arr },
                    revolutionCenterOffsetRange?: { min: Vector3Arr, max: Vector3Arr },
                    revolutionsPerSecondRange?: { min: Vector3Arr, max: Vector3Arr },
                    initialTimeRange: [number, number],
                    startMassRange: [number, number],
                    sphereRadiusRange?: [number, number],
                    startLocationPolarRange?: { min: Vector3Arr, max: Vector3Arr },
                    addVelocityMultiplierRange?: { min: Vector3Arr, max: Vector3Arr },
                    velocityLossRange?: { min: Vector3Arr, max: Vector3Arr },
                    warmupTime?: number,
                    warmupTicksPerSecond?: number,
                    settings: any // whitelisted plain emitter properties (see UParticleEmitter.getSettingsSnapshot)
                }

                export interface ISpriteEmitterDecodeInfo extends IEmitterDecodeInfo {
                    type: "SpriteEmitter",
                    texture: string,
                    spriteDirection?: SpriteDirections_T,
                    projectionNormal?: [number, number, number]
                }

                export interface IMeshEmitterDecodeInfo extends IEmitterDecodeInfo {
                    type: "MeshEmitter",
                    mesh: {
                        geometry: string,
                        materials: string
                    }
                }

                export interface ITerrainSegmentDecodeInfo extends IBaseMeshObjectDecodeInfo {
                    type: "TerrainSegment",
                    terrainInfoUuid?: string,
                    lighting?: {
                        lights: { light: string, flags: Uint8Array }[],
                        shadowMaps: Uint8Array[],
                        shadowMapTimes: number[]
                    },
                    mapX: number,
                    mapY: number,
                    offsetX: number,
                    offsetY: number,
                    heightmapX: number,
                    heightmapY: number
                }

                export interface ITerrainDecorationDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "TerrainDecoration",
                    terrainSegment: string,
                    mesh: IStaticMeshObjectDecodeInfo,
                    matrices: Float32Array,
                    colors: Uint8Array,
                    terrainVertexIndices?: Uint16Array,
                    fadeoutRadius: [number, number],
                    drawOrder: number,
                    forceRender: boolean
                }

                export interface ILightInstanceDecodeInfo {
                    matrix: Matrix4Arr,
                    flags: ArrayBuffer,
                    scene: [string, number, number][],
                    environment: [string, number, number][]
                }

                export interface IStaticMeshInstanceDecodeInfo {
                    uuid?: string,
                    name?: string,
                    type: "StaticMeshInstance",
                    mesh: IStaticMeshObjectDecodeInfo,
                    swayPhase?: number,
                    lights?: ILightInstanceDecodeInfo,
                    attributes?: {
                        colors?: Float32Array | Uint8Array
                    }
                }

                export interface IBoneDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "Bone",
                    name: string,
                    position: Vector3Arr,
                    quaternion: QuaternionArr,
                    scale: Vector3Arr,
                    parent: number
                }

                export interface IBaseZoneDecodeInfo {
                    type: "Sector" | "Zone" | "Sky",
                    uuid: string,
                    name?: string,
                    bounds: IBoxDecodeInfo,
                    children: IBaseObjectOrInstanceDecodeInfo[],
                    fog?: IZoneFogInfo,
                    isFogZone?: boolean,
                    isSunAffected?: boolean,
                    position?: Vector3Arr,
                    affectRange?: Vector2Arr,
                    fogRange1?: Vector2Arr,
                    fogRange2?: Vector2Arr,
                    fogRange3?: Vector2Arr,
                    fogRange4?: Vector2Arr,
                    fogRange5?: Vector2Arr,
                    ambient?: number[],
                    colors?: any[]
                }

                // BSP Types
                export interface IBSPNodeCollisionInfo_T {
                    flags: number[],
                    bounds: IBoxDecodeInfo
                }

                export interface IBSPNodeDecodeInfo_T {
                    children: [number, number],
                    plane: Vector4Arr,
                    leaves: [number, number],
                    zones: [number, number],
                    surfFlags: number,
                    iPlane: number,
                    iRenderBound: number,
                    spheres: {
                        exclusive: Vector4Arr,
                        inclusive: Vector4Arr
                    },
                    sectionIndex: number,
                    collision: IBSPNodeCollisionInfo_T,
                    zoneMask: bigint
                }

                export interface IBSPLeafDecodeInfo_T {
                    zone: number,
                    permiating: number,
                    volumetric: number,
                    visibleZones: bigint,
                    musicId?: number
                }

                export interface IMusicVolumeBspNode {
                    plane: Vector4Arr;
                    iFront: number;
                    iBack: number;
                    isCsg: boolean;
                }

                export interface IVolumeBspDecodeInfo {
                    isRootOutside: boolean;
                    worldToLocal: Matrix4Arr;
                    nodes: IMusicVolumeBspNode[];
                }

                export interface IL2FogInfoDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "L2FogInfo",
                    affectRange: { A: number, B: number },
                    fogRange1: { A: number, B: number },
                    fogRange2: { A: number, B: number },
                    fogRange3: { A: number, B: number },
                    fogRange4: { A: number, B: number },
                    fogRange5: { A: number, B: number },
                    colors: any[],
                    cloudTexture: any,
                    zoneMask: bigint
                }

                export type IKeyframeDecodeInfo_T = {
                    name: string,
                    times: Float32Array,
                    values: Float32Array,
                    type: "Vector" | "Quaternion"
                }

                export interface IBSPZoneDecodeInfo_T {
                    connectivity: bigint,
                    visibility: bigint,
                    zoneInfo: IBaseZoneDecodeInfo
                }

                export interface IBSPSectionDecodeInfo_T {
                    uuid: string,
                    sectionName: string;
                    priority: "opaque" | "transparent",
                    material: string,  // material UUID
                    lightmap: string | null,  // lightmap UUID (null if no lightmap)
                    geometry: string,  // geometry UUID
                    nodeIndices: number[],  // nodes in this section
                    isUnlit?: boolean,
                    isOutdoor?: boolean,
                    depthTest?: boolean,
                    depthWrite?: boolean,
                    side?: THREE.Side,
                    fog?: boolean,
                    blendingMode?: GA.SupportedBlendingTypes_T
                }

                // Material and Geometry Types
                export type DecodableTexture_T = "rgba" | "dds" | "g16" | "float" | "wet";
                export type DataTextureFormats_T = "r" | "rg" | "rgb" | "rgba";
                export type DecodableMaterial_T = "modifier" | "texture" | "shader" | "group" | "terrain" | "lightmapped" | "instance" | "terrainSegment" | "sprite" | "solid" | "particle" | "combiner" | "empty";
                export type DecodableMaterialModifier_T = "fadeColor" | "panTexture" | "rotateTexture" | "oscillateTexture" | "envMapTexture" | "colorModifier" | "finalBlend" | "texCoordSource";

                export interface IBaseMaterialDecodeInfo {
                    name?: string,
                    materialType: DecodableMaterial_T,
                    color?: boolean
                }

                export interface IAnimatedSpriteDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "sprite",
                    sprites: ITextureDecodeInfo[],
                    framerate: number
                }

                export interface IMaterialTerrainDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "terrain";
                    layers: { map: string, alphaMap: string }[]
                }

                export interface IMaterialTerrainSegmentDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "terrainSegment";
                    terrainMaterial: string,
                    uvs: ITextureDecodeInfo
                }

                export interface ISolidMaterialDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "solid",
                    solidColor: number
                }

                export interface IDataTextureDecodeInfo extends ITextureDecodeInfo {
                    format?: DataTextureFormats_T
                }

                export interface IWetTextureDecodeInfo extends IDataTextureDecodeInfo {
                    textureType: "wet",
                    waveAmp: number,
                    dropsX: number,
                    dropsY: number,
                    drops: { type: string, depth: number, x: number, y: number, byteA: number, byteB: number, byteC: number, byteD: number }[]
                }

                export interface ILightmappedDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "lightmapped",
                    material: string,
                    lightmap: string | null
                }

                export interface IMaterialGroupDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "group",
                    materials: string[]
                }

                export interface ICharacterGroup {
                    index: number,
                    name: string,
                    faceVariants: number,
                    hairStyles: number[],
                    hairColours: Record<number, number[]>,
                    armor: ICharacterArmorOptions
                }

                export interface ICharacterArmorOption {
                    id: number,
                    label: string
                }

                export interface ICharacterArmorOptions {
                    chest: ICharacterArmorOption[],
                    legs: ICharacterArmorOption[],
                    gloves: ICharacterArmorOption[],
                    boots: ICharacterArmorOption[]
                }

                export interface ICharacterArmorSelection {
                    chest: number,
                    legs: number,
                    gloves: number,
                    boots: number
                }

                export interface IParticleMaterialDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "particle",
                    material: string | null,
                    blendingMode: ParticleBlendModes_T,
                    opacity: number
                }

                export type IndexLikeArray = number[] | Uint8Array | Uint16Array | Uint32Array;

                export interface IGeometryDecodeInfo {
                    attributes: {
                        positions?: Float32Array;
                        normals?: Float32Array;
                        colors?: Float32Array | Uint8Array | Uint8ClampedArray,
                        colorsInstance?: Float32Array | Uint8Array | Uint8ClampedArray,
                        sway?: Float32Array,
                        uvs?: Float32Array | Float32Array[];
                        uvs2?: Float32Array | Float32Array[];
                        skinIndex?: Uint8Array | Uint16Array | Uint32Array;
                        skinWeight?: Float32Array;
                        skinIndex2?: Uint8Array | Uint16Array | Uint32Array;
                        skinWeight2?: Float32Array;
                        nodeIndex?: Uint32Array;
                    };
                    indices?: IndexLikeArray;
                    colliderIndices?: Uint32Array;
                    staticMeshCollision?: IStaticMeshCollisionDecodeInfo;
                    groups?: ArrGeometryGroup[],
                    bounds?: IBoundsDecodeInfo
                }

                export interface IStaticMeshCollisionDecodeInfo {
                    useSimpleLineCollision: boolean;
                    useSimpleBoxCollision: boolean;
                    collisionModel: IBSPCollisionModelDecodeInfo | null;
                    nodes: Int32Array;
                    bounds: Float32Array;
                }

                export interface IBSPCollisionModelDecodeInfo {
                    planes: Vector4Arr[];
                    hulls: IBSPNodeCollisionInfo_T[];
                }

                export interface IMaterialModifier {
                    type: string
                }

                export interface IBaseLightingMaterialModifier extends IMaterialModifier {
                    type: "Lighting",
                    mode: "Ambient" | "Directional"
                }

                export interface ILightAmbientMaterialModifier extends IBaseLightingMaterialModifier {
                    mode: "Ambient",
                    color: ColorArr,
                    brightness: number
                }

                export interface ILightDirectionalMaterialModifier extends IBaseLightingMaterialModifier {
                    mode: "Directional",
                    color: ColorArr,
                    brightness: number,
                    direction: Vector3Arr
                }

                export type ParticleBlendModes_T = "normal" | "alpha" | "modulate" | "translucent" | "alphaModulate" | "darken" | "brighten";
                export type SpriteDirections_T = "camera" | "up" | "right" | "forward" | "normal" | "upNormal" | "rightNormal" | "scale";
                export type AmbientSoundTypes_T = "always" | "day" | "night" | "water";

                export type EmitterConfig_T = {
                    type?: "SpriteEmitter" | "MeshEmitter" | "BeamEmitter",
                    name?: string,
                    blendingMode: ParticleBlendModes_T,
                    uniformScale?: boolean,
                    maxParticles: number,
                    drawScale?: number,
                    rotationOffset?: GD.QuaternionArr,
                    opacity: number,
                    lifetime: [number, number],
                    acceleration: GD.Vector3Arr,
                    maxAbsVelocity?: GD.Vector3Arr,
                    particlesPerSecond: number,
                    fadeIn: Fade_T
                    fadeOut: Fade_T,
                    warmupTime?: number,
                    warmupTicksPerSecond?: number,
                    colorMultiplierRange: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                    angularVelocity?: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                    revolutionCenterOffsetRange?: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                    revolutionsPerSecondRange?: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                    initialTimeRange: [number, number],
                    startMassRange: [number, number],
                    sphereRadiusRange?: [number, number],
                    startLocationPolarRange?: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                    addVelocityMultiplierRange?: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                    velocityLossRange?: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                    forcedMaxParticles?: boolean,
                    sounds?: IParticleSoundDecodeInfo[],
                    initial: {
                        particlesPerSecond: number,
                        angularVelocity: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                        velocity: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                        position: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                        offset?: GD.Vector3Arr,
                        scale: { min: GD.Vector3Arr, max: GD.Vector3Arr },
                    },
                    changesOverLifetime: {
                        scale: {
                            values: [number, number][],
                            repeats: number
                        },
                        color?: {
                            values: [number, GD.Vector4Arr][],
                            repeats: number
                        },
                        velocity?: {
                            values: [number, GD.Vector3Arr][],
                            repeats: number
                        },
                        revolution?: {
                            values: [number, GD.Vector3Arr][],
                            repeats: number
                        }
                    },
                    settings: any // whitelisted plain emitter properties (see UParticleEmitter.getSettingsSnapshot)
                };

                export type Fade_T = {
                    time: number,
                    color: ColorArr
                };

                export interface IParticleSoundDecodeInfo {
                    soundName: string, // resolved against the sector's soundBlobCache, see SectorObject.getSoundUri
                    radius: [number, number],
                    pitch: [number, number],
                    volume: [number, number],
                    probability: [number, number],
                    weight: number
                }

                export interface IMaterialInstancedDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "instance",
                    baseMaterial: string,
                    modifiers: string[]
                }


                export interface ITextureDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "texture",
                    textureType: DecodableTexture_T,
                    buffer: ArrayBuffer,
                    wrapS?: number, wrapT?: number,
                    width: number, height: number,
                    twoSided?: boolean,
                    isMasked?: boolean,
                    isAlphaTexture?: boolean
                }

                export interface IEdgesObjectDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "Edges",
                    geometry: string,
                    color?: [number, number, number],
                    ignoreDepth?: boolean
                }

                export interface ILightDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "Light",
                    dynamic: boolean,
                    hsv: [number, number, number],
                    radius: number,
                    directional: boolean,
                    lightType: GA.LightType_T,
                    lightEffect: GA.LightEffect_T,
                    cone: number,
                    isSunlightColor: boolean,
                    period: number,
                    phase: number
                }

                export interface ISunLightDecodeInfo extends Omit<ILightDecodeInfo, "type"> {
                    type: "Sunlight"
                }

                export interface IAudioDecodeInfo {
                    uuid: string,
                    name: string,
                    type: "MusicVolume" | "AmbientSoundObject"
                }

                export interface IMusicVolumeDecodeInfo extends IAudioDecodeInfo {
                    type: "MusicVolume",
                    musicId: number,
                    isMusicForced: boolean,
                    isMusicLooped: boolean,
                    zoneNumber: number,
                    priority: number,
                    bounds: IBoundsDecodeInfo,
                    bsp: IVolumeBspDecodeInfo
                }

                export interface IWaterVolumeDecodeInfo extends IBaseObjectDecodeInfo {
                    type: "WaterVolume",
                    priority: number,
                    fluidFriction: number,
                    gravity: Vector3Arr,
                    terminalVelocity: number,
                    zoneVelocity: Vector3Arr,
                    fog: {
                        color: ColorArr,
                        start: number,
                        end: number
                    } | null,
                    cellophane: ColorArr | null,
                    waitHitEffect: string | null,
                    runHitEffect: string | null,
                    bsp: IVolumeBspDecodeInfo
                }

                export interface IAmbientSoundObjectDecodeInfo extends IAudioDecodeInfo {
                    type: "AmbientSoundObject",
                    position: Vector3Arr,
                    refDistance: number,
                    maxDistance: number,
                    volume: number,
                    pitch: number,
                    soundName: string, // resolved against the sector's soundBlobCache, see SectorObject.getSoundUri
                    looping: boolean,
                    soundType: AmbientSoundTypes_T,
                    randomChance: number,
                }

                export interface IShaderDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "shader",
                    diffuse: string,
                    opacity: string,
                    specular: string,
                    specularMask: string,
                    selfIllumination: string,
                    selfIlluminationMask: string,
                    blendingMode: GA.SupportedBlendingTypes_T,
                    depthWrite: boolean,
                    depthTest: boolean,
                    doubleSide: boolean,
                    transparent: boolean,
                    alphaTest: number,
                    modulateStaticLighting2X: boolean,
                    visible: boolean
                }

                export interface ITexPannerDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "panTexture",
                    transform: {
                        matrix: number[],
                        rate: number,
                        map: string
                    }
                }

                export interface IBaseMaterialModifierDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "modifier",
                    modifierType: DecodableMaterialModifier_T
                }

                export interface IFadeColorDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "fadeColor",
                    fadeColors: {
                        color1: number[],
                        color2: number[],
                        period: number,
                        phase: number,
                        fadeType: "linear" | "sinusoidal"
                    }
                }

                export interface ITexRotatorDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "rotateTexture",
                    transform: {
                        matrix: number[],
                        map: string,
                        type: "fixed" | "rotating" | "oscillating",
                        rotation: EulerArr,
                        offsetU: number,
                        offsetV: number,
                        oscillationRate: [number, number, number],
                        oscillationAmplitude: [number, number, number],
                        oscillationPhase: [number, number, number]
                    }
                }

                export interface ITexOscillatorDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "oscillateTexture",
                    transform: {
                        matrix: number[],
                        map: string,
                        rateU: number,
                        rateV: number,
                        phaseU: number,
                        phaseV: number,
                        amplitudeU: number,
                        amplitudeV: number,
                        typeU: "pan" | "stretch" | "stretchRepeat" | "jitter",
                        typeV: "pan" | "stretch" | "stretchRepeat" | "jitter",
                        offsetU: number,
                        offsetV: number
                    }
                }

                export interface ITexEnvMapDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "envMapTexture",
                    envMapType: "world" | "camera",
                    map: string
                }

                export interface IColorModifierDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "colorModifier",
                    material: string,
                    modifierColor: ColorArr,
                    doubleSide: boolean,
                    alphaBlend: boolean
                }

                export interface IFinalBlendDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "finalBlend",
                    material: string,
                    blendingMode: GA.SupportedBlendingTypes_T,
                    doubleSide: boolean,
                    alphaTest: boolean,
                    alphaRef: number,
                    transparent: boolean,
                    depthWrite: boolean,
                    depthTest: boolean
                }

                export interface ITexCoordSourceDecodeInfo extends IBaseMaterialModifierDecodeInfo {
                    modifierType: "texCoordSource",
                    material: string,
                    uvIndex: number
                }

                export interface ICombinerDecodeInfo extends IBaseMaterialDecodeInfo {
                    materialType: "combiner",
                    combineMode: number, // 0=material1 1=modulate 2=modulate2x 3=modulate4x 4=add 5=subtract 6=alphaBlend 7=material2 - see UCombiner.getDecodeInfo
                    material1: string,
                    material2: string,
                    mask: string,
                    invertMask: boolean,
                    alphaFrom1: boolean,
                    alphaFrom2: boolean
                }

                export interface IBoundsDecodeInfo {
                    sphere?: ISphereDecodeInfo,
                    box: { min: Vector3Arr, max: Vector3Arr } | null
                }

                export type INTimeColorDecodeInfo = [number, number, number, number];
                export type INTimeHSVDecodeInfo = [number, number, number, number];
                export type INTimeScaleDecodeInfo = [number, number];
                export interface IL2NTimeLightDecodeInfo {
                    terrain: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                    actor: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                    staticMesh: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                    bsp: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] }
                }
                export interface ILNEnvSetupDecodeInfo {
                    isClock: boolean,
                    startTime: number,
                    timeRatio: number,
                    shadowTick: number,
                    staticLightingAdjust: number,
                    slopeSunAngle: number,
                    subLightNum: number
                    timeEnv: { [key in GA.EEnvCycle]: IL2NEnvLightDecodeInfo }
                    skybox: string,
                    hazering: string,
                    clouds: string[],
                }
                export interface IL2NEnvDecodeInfo {
                    envSetup: ILNEnvSetupDecodeInfo,
                    fog: {
                        ranges: GD.Vector2Arr[];
                        fogSpeed: number;
                    },
                    waterVolume: {
                        fogColor: GD.ColorArr;
                        fogStart: number;
                        fogEnd: number;
                        cellophaneColor: GD.ColorArr;
                    }
                }
                export interface IL2NEnvLightDecodeInfo {
                    type: GA.EEnvCycle,
                    light: IL2NTimeLightDecodeInfo,
                    color: {
                        sky: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        indexHaze: { type: "TypedArray", array: Int32Array },
                        haze: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        indexCloud: { type: "TypedArray", array: Int32Array },
                        cloud1: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        cloud2: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        cloud3: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        star: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        sun: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
                        moon: { type: "TimeColor", array: INTimeColorDecodeInfo[] }
                    },
                    ambient: {
                        terrain: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                        actor: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                        staticMesh: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                        bsp: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
                    },
                    scale: {
                        sun: { type: "TimeScale", array: INTimeScaleDecodeInfo[] },
                        moon: { type: "TimeScale", array: INTimeScaleDecodeInfo[] }
                    }
                }
            }
        }
    }
}
