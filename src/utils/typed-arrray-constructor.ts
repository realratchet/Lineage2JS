function getTypedArrayConstructor(countFaces: number): IndexTypedArray {
    if (countFaces < (2 ** 8)) return Uint8Array;
    if (countFaces < (2 ** 16)) return Uint16Array;
    return Uint32Array;
}

export default getTypedArrayConstructor;
export { getTypedArrayConstructor };