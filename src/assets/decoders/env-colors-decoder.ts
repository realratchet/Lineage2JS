import EnvColor, { TimeColor, TimeHSV, TimeScale } from "../../rendering/env-color";
import type { IL2NEnvLightDecodeInfo, INTimeHSVDecodeInfo, INTimeScaleDecodeInfo } from "@l2js/engine";


function decodeEnvColor(envColor: IL2NEnvLightDecodeInfo): EnvColor {
    const type = envColor.type;
    const decodedColor = decodeInfo(envColor.color);
    const decodedAmbient = decodeInfo(envColor.ambient);
    const decodedLight = decodeInfo(envColor.light as any);
    const decodedLScale = decodeInfo(envColor.scale);

    return new EnvColor(
        type, decodedLight, decodedColor, decodedAmbient, decodedLScale
    );
}

export default decodeEnvColor;
export { decodeEnvColor };

function decodeTimeColor(array: [number, number, number, number, number][]) {
    return array.map(args => new TimeColor(args[0], args[1], args[2], args[3], args[4] ?? 255));
}

function decodeTimeHSV(array: INTimeHSVDecodeInfo[]) {
    return array.map(args => new TimeHSV(...args));
}

function decodeTimeScale(array: INTimeScaleDecodeInfo[]) {
    return array.map(args => new TimeScale(...args));
}

function decodeEntry({ type, array }: { type: unknown, array: ArrayLike<unknown> }) {
    switch (type) {
        case "TimeColor": return decodeTimeColor(array as any);
        case "TimeHSV": return decodeTimeHSV(array as any);
        case "TimeScale": return decodeTimeScale(array as any);
        case "TypedArray": return array;
    }

    throw new Error(`Not implemented type: ${type}`)
}

function decodeInfo(infos: Record<string, { type: unknown, array: ArrayLike<unknown> }>): any {
    return Object.fromEntries(
        Object
            .entries(infos)
            .map(([key, val]) => ([key, decodeEntry(val)]))
    )
}
