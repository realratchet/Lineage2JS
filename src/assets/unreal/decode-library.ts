class DecodeLibrary {
    public name: string = "Untitled";
    public brightness: number = 1.0;
    public loadMipmaps = true;                                                              // should mipmaps be loaded into decode library
    public anisotropy = -1;                                                                 // which anisotropy level to set when decoding
    public sector: [number, number];
    public helpersZoneBounds = false;
    public readonly bspNodes: GD.IBSPNodeDecodeInfo_T[] = [];
    public readonly bspColliders: GD.IBoxDecodeInfo[] = [];
    public readonly bspLeaves: GD.IBSPLeafDecodeInfo_T[] = [];
    public readonly bspZones: GD.IBSPZoneDecodeInfo_T[] = [];
    public readonly bspZoneIndexMap: Record<string, number> = {};
    public readonly bspSections: GD.IBSPSectionDecodeInfo_T[] = [];
    public readonly bspSectionIndexMap: Map<string, number> = new Map(); // key: "materialUuid/lightmapUuid" -> sectionIndex
    public readonly nodeToSection: number[] = []; // nodeIndex -> sectionIndex
    public readonly nodeZoneMasks: bigint[] = []; // nodeIndex -> zoneMask for subtree culling
    public readonly bspRenderBounds: GD.IBoxDecodeInfo[] = []; // iRenderBound -> bounding box (swizzled to Three.js coordinates)
    // public readonly zones: Record<string, IBaseZoneDecodeInfo> = {};              // a dictionary containing all zone decode info
    public readonly geometries: Record<string, GD.IGeometryDecodeInfo> = {};         // a dictionary containing all geometry decode info
    public readonly geometryInstances: Record<string, number> = {};               // a dictionary containing all geometray instance decode info
    public readonly materials: Record<string, GD.IBaseMaterialDecodeInfo> = {};      // a dictionary containing all material decode info
    public readonly materialModifiers: Record<string, GD.IMaterialModifier> = {};    // a dictionary containing all material modifiers
    public readonly leafActors: GD.IBaseObjectOrInstanceDecodeInfo[][] = [];
    // flat (not leaf-indexed like leafActors) - emitters register at a single origin point
    // (un-emitter.ts), so gating on leaf membership on top of the zone mask double-gates them
    public readonly allEmitterActors: GD.IBaseObjectOrInstanceDecodeInfo[] = [];
    // pawns (players, mobs/NPCs) move freely across sector boundaries, unlike StaticMeshActor
    // (leaf-baked at decode time) - no decode-time leaf/zone export, see RenderManager.updatePawnVisibility
    public readonly pawnActors: GD.ISkinnedMeshObjectDecodeInfo[] = [];
    public readonly lightActors: (GD.ILightDecodeInfo | GD.ISunLightDecodeInfo)[] = [];
    public readonly audioList: GD.IAudioDecodeInfo[] = []
    public readonly fogInfos: any[] = []; // Stores fog settings (FogInfoObject)
    public readonly celestials: any[] = []; // Stores Sun and Moon actors
    public readonly musicVolumes: GD.IMusicVolumeDecodeInfo[] = []; // Stores runtime Music Volume tests
    public readonly waterVolumes: GD.IWaterVolumeDecodeInfo[] = [];
    public readonly ambientSounds: GD.IAmbientSoundObjectDecodeInfo[] = []; // Stores ambient sound emitters
    public readonly soundBlobCache = new Map<string, { uri: string, data: Uint8Array, mimeType: string }>(); // USound name → blob URL + raw bytes (dedup; bytes kept so the decode cache can re-mint session-scoped URLs)
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

    public staticMeshBatches?: import("../decoders/batch-data").StaticMeshBatchManifest_T; // precomputed batch manifest (decode worker or lazy sync build); merged geometries live in `geometries`

    public failed: any[] = [];
    public readonly exportedActors = new Set<string>(); // UUIDs of actors that passed geographic filtering
    public failedLoad: any[] = [];
    public failedDecode: any[] = [];
    // public sun: GD.ISunDecodeInfo_T;

}

export default DecodeLibrary;
export { DecodeLibrary };
