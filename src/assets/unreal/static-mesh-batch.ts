
import type { IStaticMeshActorDecodeInfo } from "./static-mesh/un-static-mesh-actor";

export type BatchElementGroup_T = {
    start: number;
    count: number;
    materialIndex: number;
};

export type BatchElement_T = {
    uuid: string;
    boundsMin: number[];
    boundsMax: number[];
    groups: BatchElementGroup_T[];
    zoneMask: bigint;
    isRangeIgnored: boolean;
    leaves: number[] | null; // bsp leaves holding the actor, for per-element pvs culling
};

export type BatchLightEntry_T = {
    light: string;
    flags: Uint8Array;
    vertexRangeStart?: number;
    vertexRangeEnd?: number;
};

export type StaticMeshBatchInfo_T = {
    uuid: string;
    name: string;
    geometry: string; // key into library.geometries
    materials: string;
    actors: IStaticMeshActorDecodeInfo[];
    colliderIndices: Uint32Array | null;
    lights: { scene: BatchLightEntry_T[]; environment: BatchLightEntry_T[] } | null;
    perActorAmbient: { startVertex: number, count: number, ambient: any, scaledGlow: number, isSunAffected: boolean }[];
    batchElements: BatchElement_T[];
};

export type StaticMeshBatchManifest_T = {
    batches: StaticMeshBatchInfo_T[];
    unbatchable: IStaticMeshActorDecodeInfo[];
};