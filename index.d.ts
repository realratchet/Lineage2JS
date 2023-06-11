import UObject from "@l2js/core";

declare module "@l2js/core" {
    class UObject {
        public uuid: string;
        public getDecodeInfo(library: GD.DecodeLibrary, ...args: any): any;

        public load(pkg: GA.UPackage): this;
        public load(pkg: GA.UPackage, info: C.UExport): this;
        public load(pkg: GA.UPackage, info: C.PropertyTag): this;
        public load(pkg: GA.UPackage, info?: any): this;

        protected loadWithPropertyTag(pkg: GA.UPackage, tag: C.PropertyTag): this;
        protected loadWithExport(pkg: GA.UPackage, exp: C.UExport): this;

        protected preLoad(pkg: GA.UPackage, exp: C.UExport): void;
        protected doLoad(pkg: GA.UPackage, exp: C.UExport): void
        protected postLoad(pkg: GA.UPackage, exp: C.UExport): void
    }
}

declare global {
    namespace L2JS {
        namespace Client {
            namespace Rendering {

            }

            namespace Assets {
                export type UPackage = import("./src/assets/unreal/un-package").UPackage;
                export type UNativePackage = import("./src/assets/unreal/un-package").UNativePackage;

                export type ULevel = import("./src/assets/unreal/un-level").ULevel;
                export type UModel = import("./src/assets/unreal/model/un-model").UModel;
                export type FVector = import("./src/assets/unreal/un-vector").FVector;
                export type FRotator = import("./src/assets/unreal/un-rotator").FRotator;
                export type FPlane = import("./src/assets/unreal/un-plane").FPlane;
                export type FBox = import("./src/assets/unreal/un-box").FBox;
                // export type UMatrix = import("./src/assets/unreal/un-matrix").UMatrix;

                export type UPlatte = import("./src/assets/unreal/un-palette").UPlatte;
                export type UTexture = import("./src/assets/unreal/un-texture").UTexture;

                export type NativeClientTypes_T =
                    | C.NativeTypes_T
                    | "NMovableSunLight"
                    | "NSun"
                    | "NMoon"
                    | "L2FogInfo"
                    | "L2SeamlessInfo"
                    | "SceneManager"
                    | "MovableStaticMeshActor";
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

                export type DecodeLibrary = import("./src/assets/unreal/decode-library").DecodeLibrary;
            }
        }
    }
}