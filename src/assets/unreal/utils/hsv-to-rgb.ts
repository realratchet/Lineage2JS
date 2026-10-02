export function saturationToBrightness(s: number) {
    return (s & 0xff) * 0.003921569;
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    let r: number, g: number, b: number;
    let lightness = v * 0.005882353; // 1.5 / 255.0

    const sqrLightness = Math.sqrt(lightness);

    lightness = (lightness / (sqrLightness + 0.01)) * 0.7;

    if (0.0 <= lightness) {
        if (1.0 <= lightness)
            lightness = 1.0;
    } else lightness = 0.0;

    if (h < 0x56) {
        b = 0.0;
        r = (0x55 - (h & 0xff)) * 0.01176471;
        g = (h & 0xff) * 0.01176471;
    } else {
        const hueOffset = h & 0xff;

        if (h < 0xab) {
            r = 0.0;
            g = (0xaa - hueOffset) * 0.01176471;
            b = (hueOffset - 0x55) * 0.01176471;
        } else {
            r = (hueOffset - 0xaa) * 0.01176471;
            g = 0.0;
            b = (0xff - hueOffset) * 0.01190476;
        }
    }

    const saturation = saturationToBrightness(s);

    // Calculate normalized values first (0.0-1.0) then scale to 255
    const x = (((1.0 - r) * saturation + r) * lightness);
    const y = (((1.0 - g) * saturation + g) * lightness);
    const z = (((1.0 - b) * saturation + b) * lightness);

    // Return as bytes (0-255)
    return [
        Math.floor(x * 255),
        Math.floor(y * 255),
        Math.floor(z * 255)
    ];
}

export default hsvToRgb;