import type { StaticMeshBatchManifest_T } from "./static-mesh-batch";
import type { IBSPNodeDecodeInfo_T } from "./bsp/un-bsp-node";
import type { IBoxDecodeInfo } from "./un-box";
import type { IBSPLeafDecodeInfo_T } from "./un-leaf";
import type { IBSPZoneDecodeInfo_T } from "./un-zone-properties";
import type { IBSPSectionDecodeInfo_T } from "./model/un-model";
import type { IBaseMaterialDecodeInfo, IMaterialModifier } from "./un-material";
import type { ISkinnedMeshObjectDecodeInfo } from "./skeletal-mesh/un-skeletal-mesh";
import type { ILightDecodeInfo } from "./un-light";
import type { ISunLightDecodeInfo } from "./un-movable-sunlight";
import type { IMusicVolumeDecodeInfo } from "./un-music-volume";
import type { IWaterVolumeDecodeInfo } from "./un-physics-volume";
import type { IAmbientSoundObjectDecodeInfo } from "./un-ambient-sound";
import type { IScriptClassDecodeInfo, IScriptFunctionDecodeInfo, IScriptStateDecodeInfo, ScriptPropertyValue_T } from "./script-dump-loader";
import type { QuaternionArr, Vector3Arr, EulerArr, ArrGeometryGroup, IndexLikeArray } from "./library-types";
import type { EmitterConfig_T } from "./emitters/un-particle-emitter";
import type { IStaticMeshCollisionDecodeInfo } from "./static-mesh/un-static-mesh";
import type { IBoundsDecodeInfo } from "./un-primitive";

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
    | "WaterVolume"
    | "L2FogInfo";

export type IBaseObjectOrInstanceDecodeInfo = {
    uuid: string,
    type: DecodableObject_T | "StaticMeshInstance"
};

export type IBaseObjectDecodeInfo = IBaseObjectOrInstanceDecodeInfo & {
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
};

export type IBaseMeshObjectDecodeInfo = IBaseObjectDecodeInfo & {
    geometry: string,
    materials?: string
};

export type IGeometryDecodeInfo = {
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
};

export type IAudioDecodeInfo = {
    uuid: string,
    name: string,
    type: "MusicVolume" | "AmbientSoundObject"
};

export class DecodeLibrary {
    public name: string = "Untitled";
    public brightness: number = 1.0;
    public loadMipmaps = true;                                                              // should mipmaps be loaded into decode library
    public anisotropy = -1;                                                                 // which anisotropy level to set when decoding
    public sector: [number, number];
    public helpersZoneBounds = false;
    public readonly bspNodes: IBSPNodeDecodeInfo_T[] = [];
    public readonly bspColliders: IBoxDecodeInfo[] = [];
    public readonly bspLeaves: IBSPLeafDecodeInfo_T[] = [];
    public readonly bspZones: IBSPZoneDecodeInfo_T[] = [];
    public readonly bspZoneIndexMap: Record<string, number> = {};
    public readonly bspSections: IBSPSectionDecodeInfo_T[] = [];
    public readonly bspSectionIndexMap: Map<string, number> = new Map(); // key: "materialUuid/lightmapUuid" -> sectionIndex
    public readonly nodeToSection: number[] = []; // nodeIndex -> sectionIndex
    public readonly nodeZoneMasks: bigint[] = []; // nodeIndex -> zoneMask for subtree culling
    public readonly bspRenderBounds: IBoxDecodeInfo[] = []; // iRenderBound -> bounding box (swizzled to Three.js coordinates)
    // public readonly zones: Record<string, IBaseZoneDecodeInfo> = {};              // a dictionary containing all zone decode info
    public readonly geometries: Record<string, IGeometryDecodeInfo> = {};         // a dictionary containing all geometry decode info
    public readonly geometryInstances: Record<string, number> = {};               // a dictionary containing all geometray instance decode info
    public readonly materials: Record<string, IBaseMaterialDecodeInfo> = {};      // a dictionary containing all material decode info
    public readonly materialModifiers: Record<string, IMaterialModifier> = {};    // a dictionary containing all material modifiers
    public readonly leafActors: IBaseObjectOrInstanceDecodeInfo[][] = [];
    // flat (not leaf-indexed like leafActors) - emitters register at a single origin point
    // (un-emitter.ts), so gating on leaf membership on top of the zone mask double-gates them
    public readonly allEmitterActors: IBaseObjectOrInstanceDecodeInfo[] = [];
    // pawns (players, mobs/NPCs) move freely across sector boundaries, unlike StaticMeshActor
    // (leaf-baked at decode time) - no decode-time leaf/zone export, see RenderManager.updatePawnVisibility
    public readonly pawnActors: ISkinnedMeshObjectDecodeInfo[] = [];
    public readonly lightActors: (ILightDecodeInfo | ISunLightDecodeInfo)[] = [];
    public readonly audioList: IAudioDecodeInfo[] = []
    public readonly fogInfos: any[] = []; // Stores fog settings (FogInfoObject)
    public readonly celestials: any[] = []; // Stores Sun and Moon actors
    public readonly musicVolumes: IMusicVolumeDecodeInfo[] = []; // Stores runtime Music Volume tests
    public readonly waterVolumes: IWaterVolumeDecodeInfo[] = [];
    public readonly ambientSounds: IAmbientSoundObjectDecodeInfo[] = []; // Stores ambient sound emitters
    public readonly soundBlobCache = new Map<string, { uri: string, data: Uint8Array, mimeType: string }>(); // USound name → blob URL + raw bytes (dedup; bytes kept so the decode cache can re-mint session-scoped URLs)
    public readonly sounds: Record<string, string> = {};
    public readonly scriptClasses: Record<string, IScriptClassDecodeInfo> = {};
    public readonly scriptFunctions: Record<string, IScriptFunctionDecodeInfo> = {};
    public readonly scriptStates: Record<string, IScriptStateDecodeInfo> = {};
    public readonly effectTemplates: Record<string, IBaseObjectDecodeInfo> = {};
    public readonly actorTemplates: Record<string, ISkinnedMeshObjectDecodeInfo> = {};
    public readonly skyZoneInfos: any[] = []; // Stores SkyZoneInfo actors
    public isSkyLevel = false;
    public readonly skyLevel: {
        skybox: string;
        hazering: string;
        clouds: string[]
    }
    public readonly batching: {
        terrain: boolean,
        staticMeshes: boolean
    } = { terrain: true, staticMeshes: true };

    public staticMeshBatches?: StaticMeshBatchManifest_T; // precomputed batch manifest (decode worker or lazy sync build); merged geometries live in `geometries`

    public failed: any[] = [];
    public readonly exportedActors = new Set<string>(); // UUIDs of actors that passed geographic filtering
    public failedLoad: any[] = [];
    public failedDecode: any[] = [];
    // public sun: ISunDecodeInfo_T;

}

export default DecodeLibrary;
