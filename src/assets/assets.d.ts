type AssetLoader = import("./asset-loader").AssetLoader;
type ValueTypeNames_T = "int64" | "uint64" | "int32" | "uint32" | "int16" | "uint16" | "int8" | "uint8" | "guid" | "char" | "buffer" | "compat32" | "float" | "utf16";
type IndexTypedArray = Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor;
type IndexTypedArrayAttribute = typeof THREE.Uint8BufferAttribute | typeof THREE.Uint16BufferAttribute | typeof THREE.Uint32BufferAttribute;
type ValidTypes_T<T extends ValueTypeNames_T> = {
    bytes?: number;
    signed: boolean;
    name: T;
    dtype?: BigInt64ArrayConstructor | BigUint64ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor | Float32ArrayConstructor;
};

type NativePropertyTypes_T =
    | "Property"
    | "ByteProperty"
    | "ObjectProperty"
    | "StructProperty"
    | "IntProperty"
    | "BoolProperty"
    | "NameProperty"
    | "FloatProperty"
    | "ArrayProperty"
    | "ClassProperty"
    | "StrProperty"
    | "PointerProperty"
    | "FixedArrayProperty"
    | "MapProperty"
    | "StringProperty"
    | "DelegateProperty";

type NativeEngineTypes_T =
    | "Font"
    | "Palette"
    | "Sound"
    | "Music"
    | "Primitive"
    | "Mesh"
    | "MeshAnimation"
    | "TerrainSector"
    | "TerrainPrimitive"
    | "LodMesh"
    | "StaticMesh"
    | "SkeletalMesh"
    | "Animation"
    | "ConvexVolume"
    | "MeshInstance"
    | "LodMeshInstance"
    | "SkeletalMeshInstance"
    | "StaticMeshInstance"
    | "Model"
    | "LevelBase"
    | "Level"
    | "LevelSummary"
    | "Polys"
    | "BspNodes"
    | "BspSurfs"
    | "Vectors"
    | "Verts"
    | "Texture"
    | "FractalTexture"
    | "FireTexture"
    | "IceTexture"
    | "WaterTexture"
    | "WaveTexture"
    | "WetTexture"
    | "ScriptedTexture"
    | "Client"
    | "Viewport"
    | "Canvas"
    | "Console"
    | "Player"
    | "NetConnection"
    | "DemoRecConnection"
    | "PendingLevel"
    | "NetPendingLevel"
    | "DemoPlayPendingLevel"
    | "Channel"
    | "ControlChannel"
    | "ActorChannel"
    | "FileChannel"
    | "Actor"
    | "Light"
    | "Inventory"
    | "Weapon"
    | "NavigationPoint"
    | "LiftExit"
    | "LiftCenter"
    | "WarpZoneMarker"
    | "InventorySpot"
    | "TriggerMarker"
    | "ButtonMarker"
    | "PlayerStart"
    | "Teleporter"
    | "PathNode"
    | "Decoration"
    | "Carcass"
    | "Projectile"
    | "Keypoint"
    | "locationid"
    | "InterpolationPoint"
    | "Triggers"
    | "Trigger"
    | "HUD"
    | "Menu"
    | "Info"
    | "Mutator"
    | "GameInfo"
    | "ZoneInfo"
    | "LevelInfo"
    | "WarpZoneInfo"
    | "SkyZoneInfo"
    | "SavedMove"
    | "ReplicationInfo"
    | "PlayerReplicationInfo"
    | "GameReplicationInfo"
    | "InternetInfo"
    | "StatLog"
    | "StatLogFile"
    | "Decal"
    | "SpawnNotify"
    | "Brush"
    | "Mover"
    | "Pawn"
    | "Scout"
    | "PlayerPawn"
    | "Camera"
    | "Bitmap";

type NativeCoreTypes_T =
    | "Object"
    | "Field"
    | "Const"
    | "Enum"
    | "Struct"
    | "Function"
    | "State"
    | "Class"
    | "TextBuffer"
    | NativePropertyTypes_T;

type NativeTypes_T =
    | NativeCoreTypes_T
    | NativeEngineTypes_T
    | "FinalBlend"
    | "StaticMesh"
    | "Shader"
    | "TerrainSector"
    | "PhysicsVolume"
    | "Model"
    | "AmbientSoundObject"
    | "TerrainInfo"
    | "StaticMeshActor"
    | "WaterVolume"
    | "Emitter"
    | "MusicVolume"
    | "BlockingVolume"
    | "FadeColor"
    | "StaticMeshInstance"
    | "TexRotator"
    | "TexPanner"
    | "ColorModifier"
    | "TexOscillator"
    | "DefaultPhysicsVolume"
    | "TexEnvMap"
    | "Cubemap"
    | "MeshAnimation"
    | "MeshEmitter"
    | "SpriteEmitter";

type UObjectTypes_T =
    | NativeTypes_T
    | "NMovableSunLight"
    | "NSun"
    | "NMoon"
    | "L2FogInfo";

type StructTypes_T =
    | "Color"
    | "Plane"
    | "Scale"
    | "Vector"
    | "Rotator"
    | "Matrix"
    | "PointRegion"
    | "TextureModifyinfo"
    | "RangeVector"
    | "Range"
    | "DecorationLayer"
    | "TerrainIntensityMap"
    | "ParticleRevolutionScale"
    | "ParticleTimeScale"
    | "ParticleSound"
    | "ParticleVelocityScale"
    | "Particle"
    | "ParticleColorScale";


type Seek_T = "current" | "set";
type FNumber<T> = typeof import("./unreal/un-number").FNumber;
type FNumberExt<T> = new (...params: any) => FNumber<T>;

interface IConstructable {
    load(pkg: import("../assets/unreal/un-package").UPackage, tag?: import("./unreal/un-property-tag").PropertyTag): this;
}

type ValidConstructables_T<T> =
    | typeof import("./unreal/un-constructable").FConstructable
    | typeof import("./unreal/un-object").UObject
    | FNumberExt<T>;

type IAssetListInfo = Record<string, string>;