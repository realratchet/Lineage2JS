import UObject from "@l2js/core";

declare module "@l2js/core" {
    abstract class UObject {
        public uuid: string;
        public getDecodeInfo(library: GD.DecodeLibrary, ...args: any): any;

        /**
         * Force LSP to mark all inheriting classes as needing to implement this to remind about needing to make the class itself abstract.
         */
        public abstract forceAbstract(): void;

        public load(pkg: GA.UPackage): this;
        public load(pkg: GA.UPackage, info: C.UExport): this;
        public load(pkg: GA.UPackage, info: C.PropertyTag): this;
        public load(pkg: GA.UPackage, info?: any): this;

        protected loadWithPropertyTag(pkg: GA.UPackage, tag: C.PropertyTag): this;
        protected loadWithExport(pkg: GA.UPackage, exp: C.UExport): this;

        protected preLoad(pkg: GA.UPackage, exp: C.UExport): void;
        protected doLoad(pkg: GA.UPackage, exp: C.UExport): void;
        protected postLoad(pkg: GA.UPackage, exp: C.UExport): void;

        public static make<T extends UObject, K extends abstract new (...args: any[]) => T>(this: K, ...args: MakeParams<K>): InstanceType<K>;
        public static class<T extends UObject, K extends abstract new (...args: any[]) => T>(this: K): new (...args: MakeParams<K>) => InstanceType<K>;
    }
}

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

                export type FVector = import("@unreal/un-vector").FVector;
                export type FCoords = import("@unreal/un-coords").FCoords;
                export type FRotator = import("@unreal/un-rotator").FRotator;
                export type FPlane = import("@unreal/un-plane").FPlane;
                export type FBox = import("@unreal/un-box").FBox;
                export type FMatrix = import("@unreal/un-matrix").FMatrix;
                export type FColor = import("@unreal/un-color").FColor;
                export type FScale = import("@unreal/un-scale").FScale;
                export type FRange = import("@unreal/un-range").FRange;
                export type FRangeVector = import("@unreal/un-range").FRangeVector;

                export type UPlatte = import("@unreal/un-palette").UPlatte;
                export type UTexture = import("@unreal/un-texture").UTexture;
                export type UTextureModifyInfo = import("@unreal/un-texture-modify-info").UTextureModifyInfo;
                export type FStaticLightmapTexture = import("@unreal/model/un-multilightmap-texture").FStaticLightmapTexture;

                export type NativeClientTypes_T =
                    | C.NativeTypes_T
                    | "NMovableSunLight"
                    | "NSun"
                    | "NMoon"
                    | "L2FogInfo"
                    | "L2SeamlessInfo"
                    | "SceneManager"
                    | "MovableStaticMeshActor";

                export type USound = import("@unreal/un-sound").USound;
                export type UAmbientSoundObject = import("@unreal/un-ambient-sound").UAmbientSoundObject;

                export type UNSun = import("@unreal/un-nsun").UNSun;
                export type UNMoon = import("@unreal/un-nmoon").UNMoon;

                export type UPolys = import("@unreal/un-polys").UPolys;
                export type PolyFlags_T = import("@unreal/un-polys").PolyFlags_T;

                export type UBrush = import("@unreal/un-brush").UBrush;

                export type UMaterial = import("@unreal/un-material").UMaterial;
                export type UShader = import("@unreal/un-material").UShader;

                export type AActor = import("@unreal/un-aactor").UAActor;

                export type AInfo = import("@unreal/un-info").AInfo;
                export type FFogInfo = import("@unreal/un-fog-info").FFogInfo;
                export type FZoneInfo = import("@unreal/un-zone-info").FZoneInfo;
                export type FTerrainInfo = import("@unreal/un-terrain-info").FTerrainInfo;

                export type UStaticMesh = import("@unreal/static-mesh/un-static-mesh").UStaticMesh;
                export type UStaticMeshActor = import("@unreal/static-mesh/un-static-mesh-actor").UStaticMeshActor;
                export type UStaticMeshInstance = import("@unreal/static-mesh/un-static-mesh-instance").UStaticMeshInstance;
                export type UStaticMeshMaterial = import("@unreal/un-material").UStaticMeshMaterial;

                export type FTIntMap = import("@unreal/un-tint-map").FTIntMap;
                export type UDecoLayer = import("@unreal/un-deco-layer").UDecoLayer;

                export type UPointRegion = import("@unreal/un-point-region").UPointRegion;

                export type UPhysicsVolume = import("@unreal/un-physics-volume").UPhysicsVolume;

                export type SupportedBlendingTypes_T = "normal" | "masked" | "modulate" | "translucent" | "invisible" | "brighten" | "darken";


            }

            namespace Decoding {
                export type Vector2Arr = [number, number];
                export type Vector4Arr = [number, number, number, number];
                export type QuaternionArr = Vector4Arr;
                export type ColorArr = Vector4Arr;
                export type Vector3Arr = [number, number, number];
                export type EulerOrder = "XYZ" | "YZX" | "ZXY" | "XZY" | "YXZ" | "ZYX";
                export type EulerArr = [...Vector3Arr, EulerOrder];
                export type ArrGeometryGroup = [number, number, number];

                export type DecodeLibrary = import("@unreal/decode-library").DecodeLibrary;
            }
        }
    }
}