import decodeEnvColor from "@client/assets/decoders/env-colors-decoder";
import EnvInfo from "@client/rendering/env-info";
import ColorByte from "@client/utils/color-byte";
import { Vector2 } from "three";

function decodeEnv(props: GD.IL2NEnvDecodeInfo): EnvInfo {
    const setup = {
        ...props.envSetup,
        timeEnv: Object.fromEntries(Object.entries(props.envSetup.timeEnv).map(([k, v]) => [k, decodeEnvColor(v)])) as any,
    };

    const fog = {
        ranges: props.fog.ranges.map(([a, b]) => new Vector2(a, b)),
        fogSpeed: props.fog.fogSpeed
    };

    const waterVolume = {
        ...props.waterVolume,
        fogColor: new ColorByte(...props.waterVolume.fogColor),
        cellophaneColor: new ColorByte(...props.waterVolume.cellophaneColor)
    };

    return new EnvInfo(setup, fog, waterVolume);
}

export default decodeEnv;
export { decodeEnv };