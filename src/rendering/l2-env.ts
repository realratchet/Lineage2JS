import EnvColor, { TimeHSV } from "@client/rendering/env-color";
import { Color } from "three";
import hsvToRgb from "@client/utils/hsv-to-rgb";

const tmpColor_1 = new Color();
const tmpColor_2 = new Color();

class L2Environment {
    protected activeEnv: 0 | 1 | 2 = 0;
    protected envColors: Readonly<{ [key in 0 | 1 | 2]: EnvColor }>;
    protected time: number = 0; // in seconds

    public constructor(envColors: { [key in 0 | 1 | 2]: EnvColor }) {
        this.envColors = envColors;
    }

    public getTimeOfDay() { return this.time / 3600 % 24; }
    public setTimeOfDay(hours: number) { this.time = (hours % 24) * 3600; }
    public getEnvColor() { return this.envColors[this.activeEnv]; }
    public getTimeSeconds() { return this.time; }
    public getActiveEnv() { return this.activeEnv; }
    public setActiveEnv(index: 0 | 1 | 2) { this.activeEnv = index; }

    public getBaseColorPlaneStaticMeshSunLight(target: Color): Color {
        const timeOfDay = this.getTimeOfDay();
        const envColor = this.getEnvColor();

        // light.staticMesh is TimeHSV[]
        return getColorFromHSV(timeOfDay, envColor.light.staticMesh, target);
    }

    public getBrightnessStaticMeshSunLight() {
        const timeOfDay = this.getTimeOfDay();
        const envColor = this.getEnvColor();
        return getBrightness(timeOfDay, envColor.light.staticMesh);
    }

    public getAmbientPlaneTerrainLight(target: Color): Color {
        return getColorFromHSV(this.getTimeOfDay(), this.getEnvColor().ambient.terrain, target);
    }

    public getAmbientPlaneActorLight(target: Color): Color {
        return getColorFromHSV(this.getTimeOfDay(), this.getEnvColor().ambient.actor, target);
    }

    public getAmbientPlaneStaticMeshSunLight(target: Color): Color {
        return getColorFromHSV(this.getTimeOfDay(), this.getEnvColor().ambient.staticMesh, target);
    }

    public getAmbientPlaneBSPLight(target: Color): Color {
        return getColorFromHSV(this.getTimeOfDay(), this.getEnvColor().ambient.bsp, target);
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
}

function pickArrayIndices<T extends { time: number }>(timeOfDay: number, array: T[]): [T, T, number] {
    const nElements = array.length;
    if (nElements === 0) throw new Error("Empty array"); // Should ideally not happen
    if (nElements === 1) return [array[0], array[0], 0];

    const nElementsMinusOne = nElements - 1;
    let idxCurr = 0, idxNext = 1;

    // Find the current time slot
    // Note: This logic assumes sorted array by time, consistent with UE2 logic
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

    return lFrac * (hsvNext.value - hsvCurr.value) + hsvCurr.value;
}

function getColorFromHSV(timeOfDay: number, array: TimeHSV[], target: Color): Color {
    const [hsvCurr, hsvNext, lFrac] = pickArrayIndices(timeOfDay, array);

    const rgbCurr = hsvToRgb(hsvCurr.hue, hsvCurr.saturation, 255);
    const rgbNext = hsvToRgb(hsvNext.hue, hsvNext.saturation, 255);

    const vCurr = tmpColor_1.setRGB(rgbCurr[0], rgbCurr[1], rgbCurr[2]);
    const vNext = tmpColor_2.setRGB(rgbNext[0], rgbNext[1], rgbNext[2]);

    // Interpolate: target = vCurr + (vNext - vCurr) * lFrac
    return target.copy(vCurr).lerp(vNext, lFrac);
}

export default L2Environment;
export { L2Environment };