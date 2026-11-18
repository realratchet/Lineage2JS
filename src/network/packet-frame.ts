// Legacy packet lengths include their two-byte header.
export function readPacketFrame(bytes: Uint8Array, offset: number) {
    if (bytes.length - offset < 2) return null;
    const size = bytes[offset] | (bytes[offset + 1] << 8);

    if (size < 2) throw new Error(`L2 socket received invalid packet length ${size}.`);
    const end = offset + size;

    if (end > bytes.length) return null;
    return { body: bytes.slice(offset + 2, end), end };
}

export function checkPacketSize(size: number) {
    if (size + 2 > 0xffff) throw new Error(`L2 packet body length ${size} exceeds 65533 bytes.`);
}

export function writePacketFrame(body: Uint8Array) {
    checkPacketSize(body.length);
    const frame = new Uint8Array(body.length + 2);

    frame[0] = frame.length & 0xff;
    frame[1] = (frame.length >>> 8) & 0xff;
    frame.set(body, 2);
    return frame;
}
