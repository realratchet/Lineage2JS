import UObject from "@l2js/core";

declare module "@l2js/core" {
    class UObject {
        public uuid: string;
    }
}

declare global {
    namespace L2JS {
        namespace Client {
            namespace Rendering {

            }

            namespace Assets {
                export type ULevel = import("./src/assets/unreal/un-level").ULevel;
                export type UModel = import("./src/assets/unreal/model/un-model").UModel;
                export type FVector = import("./src/assets/unreal/un-vector").FVector;
                export type FRotator = import("./src/assets/unreal/un-rotator").FRotator;
                // export type UMatrix = import("./src/assets/unreal/un-matrix").UMatrix;
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
            }
        }
    }
}