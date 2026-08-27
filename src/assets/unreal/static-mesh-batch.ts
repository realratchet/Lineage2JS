type BatchElementGroup_T = {
    start: number;
    count: number;
    materialIndex: number;
}

type BatchElement_T = {
    uuid: string;
    boundsMin: number[];
    boundsMax: number[];
    groups: BatchElementGroup_T[];
    zoneMask: bigint;
    isRangeIgnored: boolean;
    leaves: number[] | null; // bsp leaves holding the actor, for per-element pvs culling
}

type BatchLightEntry_T = {
    light: string;
    flags: Uint8Array;
    vertexRangeStart?: number;
    vertexRangeEnd?: number;
}

type StaticMeshBatchInfo_T = {
    uuid: string;
    name: string;
    geometry: string; // key into library.geometries
    materials: string;
    actors: GD.IStaticMeshActorDecodeInfo[];
    colliderIndices: Uint32Array | null;
    lights: { scene: BatchLightEntry_T[]; environment: BatchLightEntry_T[] } | null;
    perActorAmbient: { startVertex: number, count: number, ambient: any, scaledGlow: number, isSunAffected: boolean }[];
    batchElements: BatchElement_T[];
}

type StaticMeshBatchManifest_T = {
    batches: StaticMeshBatchInfo_T[];
    unbatchable: GD.IStaticMeshActorDecodeInfo[];
}

export type { StaticMeshBatchManifest_T, StaticMeshBatchInfo_T, BatchElement_T, BatchElementGroup_T, BatchLightEntry_T };
