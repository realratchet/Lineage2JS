import type * as THREE from "three";

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
export type IndexLikeArray = number[] | Uint8Array | Uint16Array | Uint32Array;
