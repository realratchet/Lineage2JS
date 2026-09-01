import { EEnvCycle } from "./env-consts";
import FPlane from "./un-plane";
import hsvToRgb from "./utils/hsv-to-rgb";
import GMath from "./un-gmath";
import { APackage, UExport, type ANativePackage, type EnginePackage_T, type FPrimitiveArray, type PropertyTag, type UStruct, FArray } from "@l2js/core";
import UObject from "./un-object";
import type { ColorArr } from "./library-types";

type INTimeColorDecodeInfo = [number, number, number, number];

type INTimeHSVDecodeInfo = [number, number, number, number];

type INTimeScaleDecodeInfo = [number, number];

type IL2NTimeLightDecodeInfo = {
    terrain: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
    actor: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
    staticMesh: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
    bsp: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] }
};

type IL2NEnvLightDecodeInfo = {
    type: EEnvCycle,
    light: IL2NTimeLightDecodeInfo,
    color: {
        sky: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
        indexHaze: { type: "TypedArray", array: Int32Array },
        haze: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
        indexCloud: { type: "TypedArray", array: Int32Array },
        cloud1: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
        cloud2: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
        cloud3: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
        star: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
        sun: { type: "TimeColor", array: INTimeColorDecodeInfo[] },
        moon: { type: "TimeColor", array: INTimeColorDecodeInfo[] }
    },
    ambient: {
        terrain: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
        actor: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
        staticMesh: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
        bsp: { type: "TimeHSV", array: INTimeHSVDecodeInfo[] },
    },
    scale: {
        sun: { type: "TimeScale", array: INTimeScaleDecodeInfo[] },
        moon: { type: "TimeScale", array: INTimeScaleDecodeInfo[] }
    }
};


interface IEnvTime { time: number; }

abstract class FNTimeHSV extends UObject implements IEnvTime {
    declare public readonly time: number;
    declare public readonly hue: number;
    declare public readonly sat: number;
    declare public readonly bri: number;

    public constructor(time = 0, hue = 0, sat = 0, bri = 0) {
        super();

        this.time = time;
        this.hue = hue;
        this.sat = sat;
        this.bri = bri;
    }

    public toString(): string {
        return `NTimeHSV(T=${this.time}, Hue=${this.hue}, Sat=${this.sat}, Bri=${this.bri})`;
    }

    public getColor(): ColorArr { return [...hsvToRgb(this.hue, this.sat, 255), 1]; }
    public toColorPlane() { return FPlane.make(...this.getColor()); }

    public getDecodeInfo(): INTimeHSVDecodeInfo {
        return [this.time, this.hue, this.sat, this.bri];
    }
}

abstract class FNTimeColor extends UObject implements IEnvTime {
    declare public readonly time: number;
    declare public readonly r: number;
    declare public readonly g: number;
    declare public readonly b: number;
    declare public readonly a: number;

    public constructor(time = 0, r = 0, g = 0, b = 0, a = 255) {
        super();

        this.time = time;
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }

    public toString(): string {
        return `NTimeColor(T=${this.time}, R=${this.r}, G=${this.g}, B=${this.b}, A=${this.a})`;
    }

    public getDecodeInfo() {
        return [this.time, this.r, this.g, this.b, this.a];
    }
}

abstract class FNTimeScale extends UObject implements IEnvTime {
    declare public readonly time: number;
    declare public readonly s: number;

    public constructor(time = 0, s = 0) {
        super();

        this.time = time;
        this.s = s;
    }

    public toString(): string {
        return `NTimeScale(T=${this.time}, S=${this.s})`;
    }

    public getDecodeInfo(): INTimeScaleDecodeInfo {
        return [this.time, this.s];
    }
}

abstract class UL2NTimeLight extends UObject {
    declare public lightTerrain: FArray<FNTimeHSV>;
    declare public lightActor: FArray<FNTimeHSV>;
    declare public lightStaticMesh: FArray<FNTimeHSV>;
    declare public lightBSP: FArray<FNTimeHSV>;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "TerrainLight": "lightTerrain",
            "ActorLight": "lightActor",
            "StaticMeshLight": "lightStaticMesh",
            "BSPLight": "lightBSP"
        });
    }

    public load(pkg: APackage): this;
    public load(pkg: APackage, info: UExport<UObject>): this;
    public load(pkg: APackage, info: PropertyTag): this;
    public load(pkg: APackage): this;
    public load(pkg: APackage, info: UExport<UObject>): this;
    public load(pkg: APackage, info: PropertyTag): this;
    public load(pkg: APackage, info?: any): this;
    public load(fileContents: string, pkgNative: ANativePackage, pkgEngine: EnginePackage_T): this;

    public load(fileContents: any, pkgNative?: any, pkgEngine?: any): this {
        if (typeof fileContents === "string")
            return this.loadFromText(fileContents, pkgNative, pkgEngine);
        else return super.load(fileContents, pkgNative);
    }

    protected loadFromText(fileContents: string, pkgNative: ANativePackage, pkgEngine: EnginePackage_T): this {
        this.lightActor = loadHSV(fileContents, "HSVActorLight", pkgNative, pkgEngine);
        this.lightStaticMesh = loadHSV(fileContents, "HSVStaticMeshLight", pkgNative, pkgEngine);
        this.lightTerrain = loadHSV(fileContents, "HSVTerrainLight", pkgNative, pkgEngine);
        this.lightBSP = loadHSV(fileContents, "HSVBSPLight", pkgNative, pkgEngine);

        return this;
    }

    public getDecodeInfo(): IL2NTimeLightDecodeInfo | unknown {
        return {
            terrain: { type: "TimeHSV", array: this.lightTerrain?.map(c => c.getDecodeInfo()) ?? [] },
            actor: { type: "TimeHSV", array: this.lightActor?.map(c => c.getDecodeInfo()) ?? [] },
            staticMesh: { type: "TimeHSV", array: this.lightStaticMesh?.map(c => c.getDecodeInfo()) ?? [] },
            bsp: { type: "TimeHSV", array: this.lightBSP?.map(c => c.getDecodeInfo()) ?? [] }
        } as IL2NTimeLightDecodeInfo;
    }
}

abstract class UL2NEnvLight extends UL2NTimeLight {
    declare public colorSky: FArray<FNTimeColor>;
    declare public colorIndexHaze: FPrimitiveArray<"int32">;
    declare public colorHaze: FArray<FNTimeColor>;
    declare public colorIndexCloud: FPrimitiveArray<"int32">;
    declare public colorCloud1: FArray<FNTimeColor>;
    declare public colorCloud2: FArray<FNTimeColor>;
    declare public colorCloud3: FArray<FNTimeColor>;
    declare public colorSun: FArray<FNTimeColor>;
    declare public colorMoon: FArray<FNTimeColor>;

    declare public ambientTerrain: FArray<FNTimeColor>;
    declare public ambientActor: FArray<FNTimeColor>;
    declare public ambientStaticMesh: FArray<FNTimeColor>;
    declare public ambientBSP: FArray<FNTimeColor>;

    declare public scaleSun: FArray<FNTimeScale>;
    declare public scaleMoon: FArray<FNTimeScale>;

    declare public envType: EEnvCycle;

    protected loadFromText(fileContents: string, pkgNative: ANativePackage, pkgEngine: EnginePackage_T): this {
        super.loadFromText(fileContents, pkgNative, pkgEngine);

        this.envType = getEnvType(fileContents);

        this.ambientActor = loadRGB(fileContents, "ActorAmbient", pkgNative, pkgEngine);
        this.ambientStaticMesh = loadRGB(fileContents, "StaticMeshAmbient", pkgNative, pkgEngine);
        this.ambientTerrain = loadRGB(fileContents, "TerrainAmbient", pkgNative, pkgEngine);
        this.ambientBSP = loadRGB(fileContents, "BSPAmbient", pkgNative, pkgEngine);

        this.colorSun = loadRGB(fileContents, "SunColor", pkgNative, pkgEngine);
        this.scaleSun = loadScale(fileContents, "SunScale", pkgNative, pkgEngine);

        this.colorMoon = loadRGB(fileContents, "MoonColor", pkgNative, pkgEngine);
        this.scaleMoon = loadScale(fileContents, "MoonScale", pkgNative, pkgEngine);

        this.colorSky = loadRGB(fileContents, "SkyBoxColor", pkgNative, pkgEngine);
        this.colorHaze = loadRGB(fileContents, "HazeringColor", pkgNative, pkgEngine);

        this.colorCloud1 = loadRGB(fileContents, "CloudColor1", pkgNative, pkgEngine);
        this.colorCloud2 = loadRGB(fileContents, "CloudColor2", pkgNative, pkgEngine);
        this.colorCloud3 = loadRGB(fileContents, "CloudColor3", pkgNative, pkgEngine);

        return this;
    }

    public toString(): string {
        let envName: "Normal" | "[SS]Dusk" | "[SS]Dawn";

        switch (this.envType) {
            case EEnvCycle.Normal: envName = "Normal"; break;
            case EEnvCycle.Dusk: envName = "[SS]Dusk"; break;
            case EEnvCycle.Dawn: envName = "[SS]Dawn"; break;
            default: throw new Error(`Unknown sky type: ${this.envType}`);
        }

        return `UL2NEnvLight(EnvType=${envName})`;
    }

    public getDecodeInfo(): IL2NEnvLightDecodeInfo {
        return {
            type: this.envType,
            light: super.getDecodeInfo() as IL2NTimeLightDecodeInfo,
            color: {
                sky: { type: "TimeColor", array: this.colorSky?.map(c => c.getDecodeInfo()) ?? [] },
                /* .slice(): the decode info must not alias the package buffer (see collect-transferables.ts) */
                indexHaze: { type: "TypedArray", array: (this.colorIndexHaze?.getTypedArray() as Int32Array)?.slice() ?? new Int32Array(0) },
                haze: { type: "TimeColor", array: this.colorHaze?.map(c => c.getDecodeInfo()) ?? [] },
                indexCloud: { type: "TypedArray", array: (this.colorIndexCloud?.getTypedArray() as Int32Array)?.slice() ?? new Int32Array(0) },
                cloud1: { type: "TimeColor", array: this.colorCloud1?.map(c => c.getDecodeInfo()) ?? [] },
                cloud2: { type: "TimeColor", array: this.colorCloud2?.map(c => c.getDecodeInfo()) ?? [] },
                cloud3: { type: "TimeColor", array: this.colorCloud3?.map(c => c.getDecodeInfo()) ?? [] },
                sun: { type: "TimeColor", array: this.colorSun?.map(c => c.getDecodeInfo()) ?? [] },
                moon: { type: "TimeColor", array: this.colorMoon?.map(c => c.getDecodeInfo()) ?? [] }
            } as any,
            ambient: {
                terrain: { type: "TimeColor", array: this.ambientTerrain?.map(c => c.getDecodeInfo()) ?? [] },
                actor: { type: "TimeColor", array: this.ambientActor?.map(c => c.getDecodeInfo()) ?? [] },
                staticMesh: { type: "TimeColor", array: this.ambientStaticMesh?.map(c => c.getDecodeInfo()) ?? [] },
                bsp: { type: "TimeColor", array: this.ambientBSP?.map(c => c.getDecodeInfo()) ?? [] }
            } as any,
            scale: {
                sun: { type: "TimeScale", array: this.scaleSun?.map(c => c.getDecodeInfo()) ?? [] },
                moon: { type: "TimeScale", array: this.scaleMoon?.map(c => c.getDecodeInfo()) ?? [] }
            }
        }
    }
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
    r /= 255, g /= 255, b /= 255;
    let v = Math.max(r, g, b);
    let diff = v - Math.min(r, g, b);
    let h = 0, s = 0;

    if (diff === 0) {
        h = s = 0;
    } else {
        s = diff / v;
        if (r === v) h = (g - b) / diff + (g < b ? 6 : 0);
        else if (g === v) h = (b - r) / diff + 2;
        else h = (r - g) / diff + 4;
        h /= 6;
    }


    // Value correction: hsvToRgb applies a brightening curve (~sqrt). We square V to compensate and preserve linear intensity.
    return [Math.round(h * 255), Math.round((1 - s) * 255), Math.round(v * v * 255)];
}


import {
    findSection,
    consumeNextValue,
    consumeHSV,
    consumeRGB,
    consumeScale
} from "./conf-files/conf-parser";

export { UL2NEnvLight, UL2NTimeLight, EEnvCycle, FNTimeHSV, FNTimeColor, FNTimeScale };

function getEnvType(fileContents: string): EEnvCycle {
    let readOffset = findSection(fileContents, "EnvType");
    let [nameMax, nameVal, _] = consumeNextValue(fileContents, readOffset);

    if (nameMax.toLowerCase() !== "envtype") throw new Error(`Invalid variable found '${nameMax}' expected 'NUM'`);

    return parseInt(nameVal) as EEnvCycle;
}

function loadHSV(fileContents: string, sectionName: string, pkgNative: ANativePackage, pkgEngine: EnginePackage_T): FArray<FNTimeHSV> {
    let readOffset = findSection(fileContents, sectionName);
    let [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

    if (nameMax.toLowerCase() !== "num") throw new Error(`Invalid variable found '${nameMax}' expected 'NUM'`);

    readOffset = readOffset + readContent;

    const numLights = parseInt(nameVal);

    const uStruct = pkgEngine.fetchObjectByType<UStruct<FNTimeHSV>>("Struct", "NTimeHSV").loadSelf();
    const FNTimeHSV = uStruct.buildClass(pkgNative);

    const array = new FArray(FNTimeHSV, numLights);

    for (let i = 1; i <= numLights; i++) {
        const [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

        if (nameMax.toLowerCase() !== `light${i}`)
            throw new Error(`Invalid variable found '${nameMax}' expected 'Light${i}'`);

        const [t, h, s, b] = consumeHSV(nameVal);

        readOffset = readOffset + readContent;

        array[i - 1] = new FNTimeHSV(t, h, s, b);
    }

    return array;
}

function loadScale(fileContents: string, sectionName: string, pkgNative: ANativePackage, pkgEngine: EnginePackage_T): FArray<FNTimeScale> {
    let readOffset = findSection(fileContents, sectionName);
    let [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

    if (nameMax.toLowerCase() !== "num") throw new Error(`Invalid variable found '${nameMax}' expected 'NUM'`);

    readOffset = readOffset + readContent;

    const numScales = parseInt(nameVal);

    const uStruct = pkgEngine.fetchObjectByType<UStruct<FNTimeScale>>("Struct", "NTimeScale").loadSelf();
    const FNTimeScale = uStruct.buildClass(pkgNative);

    const array = new FArray(FNTimeScale, numScales);

    for (let i = 1; i <= numScales; i++) {
        const [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

        if (nameMax.toLowerCase() !== `scale${i}`)
            throw new Error(`Invalid variable found '${nameMax}' expected 'Light${i}'`);

        const [t, s] = consumeScale(nameVal);

        readOffset = readOffset + readContent;

        array[i - 1] = new FNTimeScale(t, s);
    }

    return array;
}

function loadRGB(fileContents: string, sectionName: string, pkgNative: ANativePackage, pkgEngine: EnginePackage_T): FArray<FNTimeColor> {
    let readOffset = findSection(fileContents, sectionName);
    let [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

    if (nameMax.toLowerCase() !== "num") throw new Error(`Invalid variable found '${nameMax}' expected 'NUM'`);

    readOffset = readOffset + readContent;

    const numLights = parseInt(nameVal);

    const uStruct = pkgEngine.fetchObjectByType<UStruct<FNTimeColor>>("Struct", "NTimeColor").loadSelf();
    const FNTimeColor = uStruct.buildClass(pkgNative);

    const array = new FArray(FNTimeColor, numLights);

    for (let i = 1; i <= numLights; i++) {
        const [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

        if (nameMax.toLowerCase() !== `color${i}`)
            throw new Error(`Invalid variable found '${nameMax}' expected 'Light${i}'`);

        const [t, r, g, b, a] = consumeRGB(nameVal);

        readOffset = readOffset + readContent;

        array[i - 1] = new FNTimeColor(t, r, g, b, a);
    }

    return array;
}
export type { INTimeColorDecodeInfo, INTimeHSVDecodeInfo, INTimeScaleDecodeInfo, IL2NTimeLightDecodeInfo, IL2NEnvLightDecodeInfo };
