import type * as THREE from "three";

type IndexTypedArray = Uint8ArrayConstructor | Uint16ArrayConstructor | Uint32ArrayConstructor;

type IndexTypedArrayAttribute = typeof THREE.Uint8BufferAttribute | typeof THREE.Uint16BufferAttribute | typeof THREE.Uint32BufferAttribute;

type Vector2Arr = [number, number];

type Vector4Arr = [number, number, number, number];

type Matrix4Arr = number[] & { length: 16 };

type QuaternionArr = Vector4Arr;

type ColorArr = Vector3Arr | Vector4Arr;

type Vector3Arr = [number, number, number];

type EulerOrder = "XYZ" | "YZX" | "ZXY" | "XZY" | "YXZ" | "ZYX";

type EulerArr = [...Vector3Arr, EulerOrder];

type ArrGeometryGroup = [number, number, number];

type IndexLikeArray = number[] | Uint8Array | Uint16Array | Uint32Array;
export type { IndexTypedArray, IndexTypedArrayAttribute, Vector2Arr, Vector4Arr, Matrix4Arr, QuaternionArr, ColorArr, Vector3Arr, EulerOrder, EulerArr, ArrGeometryGroup, IndexLikeArray };
