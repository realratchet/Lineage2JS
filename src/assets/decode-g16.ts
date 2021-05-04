import { DataTexture, DepthFormat, UnsignedShortType } from "three";

async function decodeG16(width: number, height: number, data: Uint8Array) {
    return new DataTexture(new Uint16Array(data.buffer), width, height, DepthFormat, UnsignedShortType);
}

export default decodeG16;
export { decodeG16 };