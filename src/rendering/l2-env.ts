import EnvColor, { TimeColor, TimeHSV, TimeScale } from "@client/rendering/env-color";
import { Color, MathUtils } from "three";
import hsvToRgb from "@client/utils/hsv-to-rgb";
import { ColorByte } from "@client/utils/color-byte";
import EnvInfo from "@client/rendering/env-info";

// const tmpColor_1 = new Color();
// const tmpColor_2 = new Color();
// const tmpColor_3 = new Color();
const tmpColorByte = new ColorByte();
const tmpColorByte_2 = new ColorByte();

class FogBlendState {
    public targetColor = new ColorByte();
    public targetStart = 2000;
    public targetEnd = 8000;

    public prevColor = new ColorByte();
    public prevStart = 2000;
    public prevEnd = 8000;

    public currentColor = new ColorByte();
    public currentStart = 2000;
    public currentEnd = 8000;

    public totalTime = 1.0;
    public remainingTime = 0;

    public update(deltaTime: number): void {
        if (this.remainingTime <= 0) {
            this.currentColor.copy(this.targetColor);
            this.currentStart = this.targetStart;
            this.currentEnd = this.targetEnd;
            return;
        }

        this.remainingTime = Math.max(0, this.remainingTime - deltaTime);

        const t = 1.0 - (this.remainingTime / this.totalTime);

        this.currentStart = MathUtils.lerp(this.prevStart, this.targetStart, t);
        this.currentEnd = MathUtils.lerp(this.prevEnd, this.targetEnd, t);
        this.currentColor.set(
            MathUtils.lerp(this.prevColor.r, this.targetColor.r, t),
            MathUtils.lerp(this.prevColor.g, this.targetColor.g, t),
            MathUtils.lerp(this.prevColor.b, this.targetColor.b, t)
        );
    }

    public setTarget(color: ColorByte, start: number, end: number): void {
        const colorChanged = color.r !== this.targetColor.r ||
            color.g !== this.targetColor.g ||
            color.b !== this.targetColor.b;
        const rangeChanged = start !== this.targetStart || end !== this.targetEnd;

        if (!colorChanged && !rangeChanged) return;

        this.prevColor.copy(this.currentColor);
        this.prevStart = this.currentStart;
        this.prevEnd = this.currentEnd;

        this.targetColor.copy(color);
        this.targetStart = start;
        this.targetEnd = end;

        this.remainingTime = this.totalTime;
    }

    public snapToTarget(color: ColorByte, start: number, end: number): void {
        this.targetColor.copy(color);
        this.targetStart = start;
        this.targetEnd = end;

        this.prevColor.copy(color);
        this.prevStart = start;
        this.prevEnd = end;

        this.currentColor.copy(color);
        this.currentStart = start;
        this.currentEnd = end;

        this.remainingTime = 0;
    }
}

class L2Environment {
    protected activeEnv: 0 | 1 | 2 = 0;
    protected env: EnvInfo;
    protected envColors: Readonly<{ [key in 0 | 1 | 2]: EnvColor }>;

    protected time: number = 1 * 60 * 60;
    protected envVersion: number = 0;
    protected timeScale: number = 0;

    public constructor(env: EnvInfo) {
        this.env = env;
        this.envColors = env.setup.timeEnv;
    }

    public getTimeScale() { return this.timeScale; }
    public setTimeScale(scale: number) { this.timeScale = scale; }

    public getTimeOfDay() { return this.time / 3600 % 24; }
    public setTimeOfDay(hours: number) { this.time = (hours % 24) * 3600; }
    public getEnvColor() { return this.envColors[this.activeEnv]; }
    public getTimeSeconds() { return this.time; }
    public getActiveEnv() { return this.activeEnv; }
    public setActiveEnv(index: 0 | 1 | 2) {
        if (this.activeEnv !== index) {
            this.activeEnv = index;
            this.envVersion++;
        }
    }
    public getEnvVersion() { return this.envVersion; }

    public getEnv() { return this.env; }

    public getNormalizedTime() { return this.getTimeOfDay() / 24; }

    public getBaseColorPlaneStaticMeshSunLight(target: ColorByte): ColorByte {
        const timeOfDay = this.getTimeOfDay();
        const envColor = this.getEnvColor();

        return getColorByteFromHSV(timeOfDay, envColor.light.staticMesh, target);
    }

    // mode==2 caller (0x90d3cf) multiplies by flt_AB958C=32.0 before adding
    public getBaseColorPlaneStaticMeshSunLightScaled(target: ColorByte): ColorByte {
        this.getBaseColorPlaneStaticMeshSunLight(target);
        return target.set(target.r * 32 / 255, target.g * 32 / 255, target.b * 32 / 255, target.a);
    }

    public getBrightnessStaticMeshSunLight() {
        return getBrightness(this.getTimeOfDay(), this.getEnvColor().light.staticMesh);
    }

    public getBaseColorPlaneBSPSunLight(target: ColorByte): ColorByte {
        const timeOfDay = this.getTimeOfDay();
        const envColor = this.getEnvColor();

        const bspArray = envColor.light.bsp?.length > 0 ? envColor.light.bsp : envColor.light.staticMesh;
        return getColorByteFromHSV(timeOfDay, bspArray, target);
    }

    public getBaseColorPlaneBSPSunLightScaled(target: ColorByte): ColorByte {
        this.getBaseColorPlaneBSPSunLight(target);
        return target.set(target.r * 32 / 255, target.g * 32 / 255, target.b * 32 / 255, target.a);
    }

    public getBrightnessActorSunLight() {
        return getBrightness(this.getTimeOfDay(), this.getEnvColor().light.actor);
    }

    public getBrightnessTerrainSunLight() {
        return getBrightness(this.getTimeOfDay(), this.getEnvColor().light.terrain);
    }

    public getAmbientPlaneTerrainLight(target: ColorByte): ColorByte {
        return getColorFromTimeColor(this.getTimeOfDay(), this.getEnvColor().ambient.terrain, target);
    }

    public getAmbientPlaneTerrainLightHalved(target: ColorByte): ColorByte {
        getColorFromTimeColor(this.getTimeOfDay(), this.getEnvColor().ambient.terrain, target);
        return target.shr(1);
    }

    public getAmbientPlaneActorLight(target: ColorByte): ColorByte {
        return getColorFromTimeColor(this.getTimeOfDay(), this.getEnvColor().ambient.actor, target);
    }

    public getAmbientPlaneActorLightHalved(target: ColorByte): ColorByte {
        this.getAmbientPlaneActorLight(target);
        return target.shr(1);
    }

    public getAmbientPlaneStaticMeshSunLight(target: ColorByte): ColorByte {
        return getColorFromTimeColor(this.getTimeOfDay(), this.getEnvColor().ambient.staticMesh, target);
    }

    public getAmbientPlaneStaticMeshSunLightHalved(target: ColorByte): ColorByte {
        this.getAmbientPlaneStaticMeshSunLight(target);
        return target.shr(1);
    }

    public getAmbientPlaneBSPLight(target: ColorByte): ColorByte {
        const envColor = this.getEnvColor();
        const bspArray = envColor.ambient.bsp?.length > 0 ? envColor.ambient.bsp : envColor.ambient.staticMesh;
        return getColorFromTimeColor(this.getTimeOfDay(), bspArray, target);
    }

    public getAmbientPlaneBSPLightHalved(target: ColorByte): ColorByte {
        this.getAmbientPlaneBSPLight(target);
        return target.shr(1);
    }

    public getSunColor(target: ColorByte): ColorByte {
        const colors = this.getEnvColor().color.sun;
        if (!colors || colors.length === 0) return target.set(0, 0, 0, 255);
        getColorFromTimeColor(this.getTimeOfDay(), colors, target);
        target.a = 255;
        return target;
    }

    public getSkyColor(target: ColorByte): ColorByte {
        const colors = this.getEnvColor().color.sky;
        if (!colors || colors.length === 0) return target.set(0, 0, 0, 255);
        getColorFromTimeColor(this.getTimeOfDay(), colors, target);
        target.a = 255;
        return target;
    }

    // never used in the game as far as i can tell, instructions never called, would make the moon red
    public getMoonColor(target: ColorByte): ColorByte {
        const colors = this.getEnvColor().color.moon;
        if (!colors || colors.length === 0) return target.set(0, 0, 0, 255);
        return getColorFromTimeColor(this.getTimeOfDay(), colors, target);
    }

    public getHazeColor(target: ColorByte): ColorByte {
        const colors = this.getEnvColor().color.haze;
        if (!colors || colors.length === 0) return target.set(0, 0, 0, 255);
        getColorFromTimeColor(this.getTimeOfDay(), colors, target);
        target.a = 255;
        return target;
    }

    public getFogColor(target: ColorByte): ColorByte {
        return this.getHazeColor(target);
    }

    public getHazeGradient(): ColorByte[] {
        const envColor = this.getEnvColor();
        const indexHaze = envColor.color.indexHaze;
        const hazeColors = envColor.color.haze;
        const timeOfDay = this.getTimeOfDay();

        if (!indexHaze || indexHaze.length === 0) {
            const single = this.getHazeColor(new ColorByte());
            return [single];
        }

        const result: ColorByte[] = [];
        for (let i = 0; i < indexHaze.length; i++) {
            const hazeIdx = indexHaze[i];
            const target = new ColorByte();

            if (hazeColors && hazeIdx >= 0 && hazeIdx < hazeColors.length) {
                const color = hazeColors[hazeIdx];
                if (color) {
                    target.set(color.r, color.g, color.b, 255);
                } else {
                    target.set(128, 128, 128, 255);
                }
            } else if (hazeColors && hazeColors.length > 0) {
                getColorFromTimeColor(timeOfDay, hazeColors, target);
                target.a = 255;
            } else {
                target.set(128, 128, 128, 255);
            }
            result.push(target);
        }
        return result;
    }

    public getTerrainLightColor(target: ColorByte): ColorByte {
        return getColorByteFromHSV(this.getTimeOfDay(), this.getEnvColor().light.terrain, target);
    }


    public getCloudColor(index: number, target: ColorByte): ColorByte {
        let cloudColors: any[];
        switch (index) {
            case 0: cloudColors = this.getEnvColor().color.cloud1; break;
            case 1: cloudColors = this.getEnvColor().color.cloud2; break;
            case 2: cloudColors = this.getEnvColor().color.cloud3; break;
            default: return target.set(0, 0, 0, 255);
        }

        if (!cloudColors || cloudColors.length === 0) return target.set(0, 0, 0, 255);
        getColorFromTimeColor(this.getTimeOfDay(), cloudColors, target);
        target.a = 255;
        return target;
    }


    public selectEnvironmentLightIndices(totalElements: number): [number, number, number] {
        const timeOfDay = this.getTimeOfDay();

        if (totalElements === 0) return [0, 0, 0];
        if (totalElements === 1) return [0, 0, 1];

        const timePerElement = 24.0 / totalElements;
        const currEnvIndex = Math.floor(timeOfDay / timePerElement) % totalElements;
        const nextEnvIndex = (currEnvIndex + 1) % totalElements;

        let currEnvTime = currEnvIndex * timePerElement;
        let nextEnvTime = nextEnvIndex * timePerElement;

        while (nextEnvTime < currEnvTime) nextEnvTime += 24.0;

        let offset = timeOfDay;
        while (offset < currEnvTime) offset += 24.0;

        const lerp = (offset - currEnvTime) / (nextEnvTime - currEnvTime);

        return [currEnvIndex, nextEnvIndex, lerp];
    }

    public getSunScale(): number {
        return getScaleValue(this.getTimeOfDay(), this.getEnvColor().scale.sun);
    }

    public getMoonScale(): number {
        return getScaleValue(this.getTimeOfDay(), this.getEnvColor().scale.moon);
    }
}

function pickArrayIndices<T extends { time: number }>(timeOfDay: number, array: T[]): [T, T, number] {
    const nElements = array.length;
    if (nElements === 0) return [null as any, null as any, 0];
    if (nElements === 1) return [array[0], array[0], 0];

    const nElementsMinusOne = nElements - 1;
    let idxCurr = 0, idxNext = 1;

    while (idxCurr < nElementsMinusOne) {
        if (timeOfDay >= array[idxCurr].time && timeOfDay < array[idxNext].time) {
            break;
        }

        if (array[idxNext].time > timeOfDay && array[idxCurr].time <= timeOfDay) break;

        idxCurr++;
        idxNext++;
        if (idxNext >= nElements) {
            return [array[nElementsMinusOne], array[nElementsMinusOne], 0];
        }
    }

    idxCurr = 0, idxNext = 1;
    if (nElementsMinusOne > 0) {
        while (array[idxCurr].time > timeOfDay || array[idxNext].time <= timeOfDay) {
            if (idxCurr >= nElementsMinusOne) {
                return [array[nElementsMinusOne], array[nElementsMinusOne], 0];
            }
            idxCurr++, idxNext++;
        }
    }

    const elemCurr = array[idxCurr];
    const elemNext = array[idxNext];
    const timeCurr = elemCurr.time;
    const timeNext = elemNext.time;

    if (timeNext === timeCurr) return [elemCurr, elemNext, 0];

    const frac = (timeOfDay - timeCurr) / (timeNext - timeCurr);
    return [elemCurr, elemNext, frac];
}

function getBrightness(timeOfDay: number, array: TimeHSV[]) {
    const [hsvCurr, hsvNext, lFrac] = pickArrayIndices(timeOfDay, array);
    if (!hsvCurr) return 1.0;

    return lFrac * (hsvNext.value - hsvCurr.value) + hsvCurr.value;
}

function getScaleValue(timeOfDay: number, array: TimeScale[]): number {
    if (!array || array.length === 0) return 1.0;

    const [curr, next, lFrac] = pickArrayIndices(timeOfDay, array);
    if (!curr) return 1.0;
    return curr.scale + (next.scale - curr.scale) * lFrac;
}

function getColorByteFromHSV(timeOfDay: number, array: TimeHSV[], target: ColorByte): ColorByte {
    const [hsvCurr, hsvNext, lFrac] = pickArrayIndices(timeOfDay, array);
    if (!hsvCurr) return target.set(255, 255, 255, 255);

    const v = hsvCurr.value + (hsvNext.value - hsvCurr.value) * lFrac;

    // UL2NTimeLight::GetColorPlane (0x7b8120): lerp(FGetHSV(h1,s1,255), FGetHSV(h2,s2,255)) * (lerp(v1,v2) * flt_A62CF4=1/255)
    target.setFromHSV(hsvCurr.hue, hsvCurr.saturation, 255);
    tmpColorByte_2.setFromHSV(hsvNext.hue, hsvNext.saturation, 255);

    return target.lerp(tmpColorByte_2, lFrac).multiplyScalar(v / 255);
}

function getColorFromTimeColor(timeOfDay: number, array: TimeColor[], target: ColorByte): ColorByte {
    const [cCurr, cNext, lFrac] = pickArrayIndices(timeOfDay, array);
    if (!cCurr) return target.set(255, 255, 255, 255);

    const vCurr = tmpColorByte.set(cCurr.r, cCurr.g, cCurr.b, cCurr.a ?? 255);
    const vNext = tmpColorByte_2.set(cNext.r, cNext.g, cNext.b, cNext.a ?? 255);

    return target.copy(vCurr).lerp(vNext, lFrac);
}

function interpolateFogInfoColor(
    timeOfDay: number,
    colors: { time: number; fogColor: number[] }[],
    target: ColorByte
): ColorByte {
    if (!colors || colors.length === 0) {
        return target.set(128, 128, 128, 255);
    }

    if (colors.length === 1) {
        const c = colors[0].fogColor;
        return target.set(c[0], c[1], c[2], c[3] ?? 255);
    }

    let prevIdx = 0;
    for (let i = 0; i < colors.length; i++) {
        if (colors[i].time <= timeOfDay) prevIdx = i;
    }

    let nextIdx = (prevIdx + 1) % colors.length;
    const prev = colors[prevIdx];
    const next = colors[nextIdx];

    let t = 0;
    if (prev.time !== next.time) {
        let prevTime = prev.time, nextTime = next.time;
        if (nextTime < prevTime) nextTime += 24;
        let currentTime = timeOfDay;
        if (currentTime < prevTime) currentTime += 24;
        t = Math.max(0, Math.min(1, (currentTime - prevTime) / (nextTime - prevTime)));
    }

    const pC = prev.fogColor;
    const nC = next.fogColor;

    return target.set(
        pC[0] + (nC[0] - pC[0]) * t,
        pC[1] + (nC[1] - pC[1]) * t,
        pC[2] + (nC[2] - pC[2]) * t,
        (pC[3] ?? 255) + ((nC[3] ?? 255) - (pC[3] ?? 255)) * t
    );
}

function interpolateFogInfoSkyColor(
    timeOfDay: number,
    colors: { time: number; skyColor: number[] }[],
    target: ColorByte
): ColorByte {
    if (!colors || colors.length === 0) {
        return target.set(128, 128, 128, 255);
    }

    if (colors.length === 1) {
        const c = colors[0].skyColor;
        return target.set(c[0], c[1], c[2], 255);
    }

    let prevIdx = 0;
    for (let i = 0; i < colors.length; i++) {
        if (colors[i].time <= timeOfDay) prevIdx = i;
    }

    let nextIdx = (prevIdx + 1) % colors.length;
    const prev = colors[prevIdx];
    const next = colors[nextIdx];

    let t = 0;
    if (prev.time !== next.time) {
        let prevTime = prev.time, nextTime = next.time;
        if (nextTime < prevTime) nextTime += 24;
        let currentTime = timeOfDay;
        if (currentTime < prevTime) currentTime += 24;
        t = Math.max(0, Math.min(1, (currentTime - prevTime) / (nextTime - prevTime)));
    }

    const pC = prev.skyColor;
    const nC = next.skyColor;

    return target.set(
        pC[0] + (nC[0] - pC[0]) * t,
        pC[1] + (nC[1] - pC[1]) * t,
        pC[2] + (nC[2] - pC[2]) * t,
        255
    );
}

function interpolateFogInfoHazeColor(
    timeOfDay: number,
    colors: { time: number; hazeringColor: number[][] }[],
    target: ColorByte
): ColorByte {
    if (!colors || colors.length === 0) {
        return target.set(128, 128, 128, 255);
    }

    if (colors.length === 1) {
        const c = colors[0].hazeringColor?.[0];
        if (!c) return target.set(128, 128, 128, 255);
        return target.set(c[0], c[1], c[2], 255);
    }

    let prevIdx = 0;
    for (let i = 0; i < colors.length; i++) {
        if (colors[i].time <= timeOfDay) prevIdx = i;
    }

    let nextIdx = (prevIdx + 1) % colors.length;
    const prev = colors[prevIdx];
    const next = colors[nextIdx];

    let t = 0;
    if (prev.time !== next.time) {
        let prevTime = prev.time, nextTime = next.time;
        if (nextTime < prevTime) nextTime += 24;
        let currentTime = timeOfDay;
        if (currentTime < prevTime) currentTime += 24;
        t = Math.max(0, Math.min(1, (currentTime - prevTime) / (nextTime - prevTime)));
    }

    const pC = prev.hazeringColor?.[0] || [128, 128, 128];
    const nC = next.hazeringColor?.[0] || [128, 128, 128];

    return target.set(
        pC[0] + (nC[0] - pC[0]) * t,
        pC[1] + (nC[1] - pC[1]) * t,
        pC[2] + (nC[2] - pC[2]) * t,
        255
    );
}

export function interpolateFogInfoHazeColors(
    timeOfDay: number,
    colors: { time: number; hazeringColor: number[][] }[]
): ColorByte[] {
    if (!colors || colors.length === 0) return [];

    const sample = colors.find(c => c.hazeringColor && c.hazeringColor.length > 0)?.hazeringColor;
    if (!sample) return [];

    const count = sample.length;
    const result: ColorByte[] = new Array(count).fill(null).map(() => new ColorByte());

    let prevIdx = 0;
    for (let i = 0; i < colors.length; i++) {
        if (colors[i].time <= timeOfDay) prevIdx = i;
    }

    let nextIdx = (prevIdx + 1) % colors.length;
    const prev = colors[prevIdx];
    const next = colors[nextIdx];

    let t = 0;
    if (prev.time !== next.time) {
        let prevTime = prev.time, nextTime = next.time;
        if (nextTime < prevTime) nextTime += 24;
        let currentTime = timeOfDay;
        if (currentTime < prevTime) currentTime += 24;
        t = Math.max(0, Math.min(1, (currentTime - prevTime) / (nextTime - prevTime)));
    }

    const pArr = prev.hazeringColor || [];
    const nArr = next.hazeringColor || [];

    for (let i = 0; i < count; i++) {
        const pC = pArr[i] || [128, 128, 128];
        const nC = nArr[i] || [128, 128, 128];

        result[i].set(
            pC[0] + (nC[0] - pC[0]) * t,
            pC[1] + (nC[1] - pC[1]) * t,
            pC[2] + (nC[2] - pC[2]) * t,
            255
        );
    }

    return result;
}

function interpolateFogInfoCloudColor(
    timeOfDay: number,
    colors: { time: number; cloudColor: number[][] }[],
    target: ColorByte,
    index: number = 0
): ColorByte {
    if (!colors || colors.length === 0) return target.set(128, 128, 128, 255);

    let prevIdx = 0;
    for (let i = 0; i < colors.length; i++) {
        if (colors[i].time <= timeOfDay) prevIdx = i;
    }

    let nextIdx = (prevIdx + 1) % colors.length;
    const prev = colors[prevIdx];
    const next = colors[nextIdx];

    let t = 0;
    if (prev.time !== next.time) {
        let prevTime = prev.time, nextTime = next.time;
        if (nextTime < prevTime) nextTime += 24;
        let currentTime = timeOfDay;
        if (currentTime < prevTime) currentTime += 24;
        t = Math.max(0, Math.min(1, (currentTime - prevTime) / (nextTime - prevTime)));
    }

    const pC = prev.cloudColor?.[index];
    const nC = next.cloudColor?.[index];

    if (!pC || !nC) return null as any;

    return target.set(
        pC[0] + (nC[0] - pC[0]) * t,
        pC[1] + (nC[1] - pC[1]) * t,
        pC[2] + (nC[2] - pC[2]) * t,
        255
    );
}

export default L2Environment;
export { L2Environment, FogBlendState, interpolateFogInfoColor, interpolateFogInfoSkyColor, interpolateFogInfoHazeColor, interpolateFogInfoCloudColor };
