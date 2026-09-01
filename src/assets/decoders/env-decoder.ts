import decodeEnvColor from "./env-colors-decoder";
import EnvInfo from "../../rendering/env-info";
import ColorByte from "../../utils/color-byte";
import { Vector2 } from "three";
import type { IL2NEnvDecodeInfo } from "@l2js/engine/contracts/config";

function decodeEnv(props: IL2NEnvDecodeInfo): EnvInfo {
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
