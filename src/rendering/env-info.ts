import EnvColor from "@client/rendering/env-color"
import ColorByte from "@client/utils/color-byte";
import { Vector2 } from "three";

type EnvSetup = {
    isClock: boolean;
    startTime: number;
    timeRatio: number;
    shadowTick: number;
    staticLightingAdjust: number;
    slopeSunAngle: number;
    subLightNum: number;
    timeEnv: { [key in GA.EEnvCycle]: EnvColor };
    skybox: string;
    hazering: string;
    clouds: string[];
}

type EnvFog = Readonly<{
    ranges: Vector2[],
    fogSpeed: number;
}>;

type EnvWaterVolume = Readonly<{
    fogColor: ColorByte;
    fogStart: number;
    fogEnd: number;
    cellophaneColor: ColorByte;
}>;

class EnvInfo {
    public readonly setup: EnvSetup;
    public readonly fog: EnvFog;
    public readonly waterVolume: EnvWaterVolume;

    public constructor(setup: EnvSetup, fog: EnvFog, waterVolume: EnvWaterVolume) {
        this.setup  = setup;
        this.fog = fog;
        this.waterVolume = waterVolume;
    }
}

export default EnvInfo;
export { EnvInfo };