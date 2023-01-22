function decryptModulo(array: Uint8Array, cryptKey: number) {
    for (let i = 0, len = array.length; i < len; i++)
        array[i] ^= cryptKey;

    return array.buffer;
}

export default decryptModulo;
export { decryptModulo };