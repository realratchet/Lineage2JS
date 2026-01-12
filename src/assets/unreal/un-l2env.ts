import FPlane from "@client/assets/unreal/un-plane";
import hsvToRgb from "@client/utils/hsv-to-rgb";
import GMath from "@client/assets/unreal/un-gmath";
import { UObject } from "@l2js/core";
import FArray from "@l2js/core/src/unreal/un-array";

// Environmental preset types for Seven Signs events
const enum EEnvCycle {
    Normal = 0,  // Standard day/night cycle (timeenv0.int)
    Dusk = 1,    // Special dusk cycle ([SS]Dusk - timeenv1.int)
    Dawn = 2     // Special dawn cycle ([SS]Dawn - timeenv2.int)
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

    public getColor(): GD.ColorArr { return [...hsvToRgb(this.hue, this.sat, 255), 1]; }
    public toColorPlane() { return FPlane.make(...this.getColor()); }

    public getDecodeInfo(): GD.INTimeHSVDecodeInfo {
        return [this.time, this.hue, this.sat, this.bri];
    }
}

abstract class FNTimeColor extends UObject implements IEnvTime {
    declare public readonly time: number;
    declare public readonly r: number;
    declare public readonly g: number;
    declare public readonly b: number;

    public constructor(time = 0, r = 0, g = 0, b = 0) {
        super();

        this.time = time;
        this.r = r;
        this.g = g;
        this.b = b;
    }

    public toString(): string {
        return `NTimeHSV(T=${this.time}, R=${this.r}, G=${this.g}, B=${this.b})`;
    }

    public toColorPlane() { return FPlane.make(...this.getColor()); }
    public getColor(): GD.ColorArr { return [this.r / 255, this.g / 255, this.b / 255, 1]; }

    public getDecodeInfo(): GD.INTimeColorDecodeInfo {
        return [this.time, this.r, this.g, this.b];
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

    public getDecodeInfo(): GD.INTimeScaleDecodeInfo {
        return [this.time, this.s];
    }
}

abstract class UL2NTimeLight extends UObject {
    declare public lightTerrain: C.FArray<FNTimeHSV>;
    declare public lightActor: C.FArray<FNTimeHSV>;
    declare public lightStaticMesh: C.FArray<FNTimeHSV>;
    declare public lightBSP: C.FArray<FNTimeHSV>;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "TerrainLight": "lightTerrain",
            "ActorLight": "lightActor",
            "StaticMeshLight": "lightStaticMesh",
            "BSPLight": "lightBSP"
        });
    }

    public load(pkg: C.APackage): this;
    public load(pkg: C.APackage, info: C.UExport<C.UObject>): this;
    public load(pkg: C.APackage, info: C.PropertyTag): this;
    public load(pkg: C.APackage): this;
    public load(pkg: C.APackage, info: C.UExport<C.UObject>): this;
    public load(pkg: C.APackage, info: C.PropertyTag): this;
    public load(pkg: C.APackage, info?: any): this;
    public load(fileContents: string, pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage): this;

    public load(fileContents: any, pkgNative?: any, pkgEngine?: any): this {
        if (typeof fileContents === "string")
            return this.loadFromText(fileContents, pkgNative, pkgEngine);
        else return super.load(fileContents, pkgNative);
    }

    protected loadFromText(fileContents: string, pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage): this {
        this.lightActor = loadHSV(fileContents, "HSVActorLight", pkgNative, pkgEngine);
        this.lightStaticMesh = loadHSV(fileContents, "HSVStaticMeshLight", pkgNative, pkgEngine);
        this.lightTerrain = loadHSV(fileContents, "HSVTerrainLight", pkgNative, pkgEngine);
        this.lightBSP = loadHSV(fileContents, "HSVBSPLight", pkgNative, pkgEngine);

        return this;
    }

    public getDecodeInfo(): GD.IL2NTimeLightDecodeInfo | unknown {
        return {
            terrain: { type: "TimeHSV", array: this.lightTerrain?.map(c => c.getDecodeInfo()) ?? [] },
            actor: { type: "TimeHSV", array: this.lightActor?.map(c => c.getDecodeInfo()) ?? [] },
            staticMesh: { type: "TimeHSV", array: this.lightStaticMesh?.map(c => c.getDecodeInfo()) ?? [] },
            bsp: { type: "TimeHSV", array: this.lightBSP?.map(c => c.getDecodeInfo()) ?? [] }
        } as GD.IL2NTimeLightDecodeInfo;
    }
}


// Generic array index picking that works with explicit times or evenly distributed slots
function pickArrayIndices<T extends IEnvTime>(timeOfDay: number, array: FArray<T>): [T, T, number];
function pickArrayIndices(timeOfDay: number, totalElements: number): [number, number, number];
function pickArrayIndices<T extends IEnvTime>(timeOfDay: number, arrayOrCount: FArray<T> | number): [T | number, T | number, number] {
    // Handle arrays with explicit time values
    if (typeof arrayOrCount !== 'number') {
        const array = arrayOrCount;
        const nElements = array.length;
        const nElementsMinusOne = nElements - 1;

        let idxCurr = 0, idxNext = 1;

        if (nElementsMinusOne > 0) {
            while (array[idxCurr].time > timeOfDay || array[idxNext].time <= timeOfDay) {
                if (idxCurr >= nElementsMinusOne)
                    break;

                idxCurr = idxCurr + 1;
                idxNext = idxNext + 1;
            }
        } else {
            throw new Error("Array must have at least 2 elements for interpolation");
        }

        const elemCurr = array[idxCurr], elemNext = array[idxNext];
        const timeCurr = elemCurr.time, timeNext = elemNext.time;
        const frac = (timeOfDay - timeCurr) / (timeNext - timeCurr);

        return [elemCurr, elemNext, frac];
    }

    // Handle evenly distributed time slots
    const totalElements = arrayOrCount;
    const [currIdx, nextIdx, frac] = timeToIndicesLerp(timeOfDay, totalElements);
    return [currIdx, nextIdx, frac];
}

function getBrightness(timeOfDay: number, array: FArray<FNTimeHSV>) {
    const [hsvCurr, hsvNext, lFrac] = pickArrayIndices(timeOfDay, array);
    const bri = lFrac * (hsvNext.bri - hsvCurr.bri) + hsvCurr.bri;

    return bri;
}

function getColorPlane(timeOfDay: number, array: FArray<FNTimeHSV | FNTimeColor>) {
    const [hsvCurr, hsvNext, lFrac] = pickArrayIndices(timeOfDay, array);
    const colorCurr = hsvCurr.toColorPlane(), colorNext = hsvNext.toColorPlane();

    const delta = colorNext.sub(colorCurr).multiplyScalar(lFrac)
    const final = colorCurr.add(delta);

    return final;
}

abstract class UL2NEnvLight extends UL2NTimeLight {
    declare public colorSky: C.FArray<FNTimeColor>;
    declare public colorIndexHaze: C.FPrimitiveArray<"int32">;
    declare public colorHaze: C.FArray<FNTimeColor>;
    declare public colorIndexCloud: C.FPrimitiveArray<"int32">;
    declare public colorCloud1: C.FArray<FNTimeColor>;
    declare public colorCloud2: C.FArray<FNTimeColor>;
    declare public colorCloud3: C.FArray<FNTimeColor>;
    declare public colorStar: C.FArray<FNTimeColor>;
    declare public colorSun: C.FArray<FNTimeColor>;
    declare public colorMoon: C.FArray<FNTimeColor>;

    declare public ambientTerrain: C.FArray<FNTimeColor>;
    declare public ambientActor: C.FArray<FNTimeColor>;
    declare public ambientStaticMesh: C.FArray<FNTimeColor>;
    declare public ambientBSP: C.FArray<FNTimeColor>;

    declare public scaleSun: C.FArray<FNTimeScale>;
    declare public scaleMoon: C.FArray<FNTimeScale>;

    declare public envType: EEnvCycle;

    protected loadFromText(fileContents: string, pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage): this {
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

    public getDecodeInfo(): GD.IL2NEnvLightDecodeInfo {
        return {
            type: this.envType,
            light: super.getDecodeInfo() as GD.IL2NTimeLightDecodeInfo,
            color: {
                sky: { type: "TimeColor", array: this.colorSky?.map(c => c.getDecodeInfo()) ?? [] },
                indexHaze: { type: "TypedArray", array: this.colorIndexHaze?.getTypedArray() ?? new Int32Array(0) },
                haze: { type: "TimeColor", array: this.colorHaze?.map(c => c.getDecodeInfo()) ?? [] },
                indexCloud: { type: "TypedArray", array: this.colorIndexCloud?.getTypedArray() ?? new Int32Array(0) },
                cloud1: { type: "TimeColor", array: this.colorCloud1?.map(c => c.getDecodeInfo()) ?? [] },
                cloud2: { type: "TimeColor", array: this.colorCloud2?.map(c => c.getDecodeInfo()) ?? [] },
                cloud3: { type: "TimeColor", array: this.colorCloud3?.map(c => c.getDecodeInfo()) ?? [] },
                star: { type: "TimeColor", array: this.colorStar?.map(c => c.getDecodeInfo()) ?? [] },
                sun: { type: "TimeColor", array: this.colorSun?.map(c => c.getDecodeInfo()) ?? [] },
                moon: { type: "TimeColor", array: this.colorMoon?.map(c => c.getDecodeInfo()) ?? [] }
            },
            ambient: {
                terrain: { type: "TimeHSV", array: this.ambientTerrain?.map(c => c.getDecodeInfo()) ?? [] },
                actor: { type: "TimeHSV", array: this.ambientActor?.map(c => c.getDecodeInfo()) ?? [] },
                staticMesh: { type: "TimeHSV", array: this.ambientStaticMesh?.map(c => c.getDecodeInfo()) ?? [] },
                bsp: { type: "TimeHSV", array: this.ambientBSP?.map(c => c.getDecodeInfo()) ?? [] }
            },
            scale: {
                sun: { type: "TimeScale", array: this.scaleSun?.map(c => c.getDecodeInfo()) ?? [] },
                moon: { type: "TimeScale", array: this.scaleMoon?.map(c => c.getDecodeInfo()) ?? [] }
            }
        }
    }
}

//------------------------------------------------------------------------------
// UL2NEnvManager - Singleton Environmental Manager
//------------------------------------------------------------------------------

/**
 * UL2NEnvManager - Singleton environmental coordinator
 * Manages environmental lighting, sky colors, and time-based effects
 * Created as native C++ singleton during engine initialization
 */
class UL2NEnvManager {
    // Environmental data (loaded from .int files)
    declare protected currentEnvLight: UL2NEnvLight;

    // Time management
    declare protected timeOfDay: number;           // [0;24) hours (0 = midnight, 24 = next midnight)
    declare protected currentEnvType: EEnvCycle;   // Normal, Dusk, or Dawn

    // Performance settings
    declare protected cacheIndex: number;          // Time acceleration (default: 1.0)

    // Constructor (called during engine init or config loading)
    public constructor(envLight: UL2NEnvLight, envType: EEnvCycle) {
        // Initialize defaults
        this.timeOfDay = 0.33;          // ~20 minutes after midnight
        this.currentEnvType = envType;  // Normal cycle by default
        this.cacheIndex = 1.0;          // Normal time progression

        this.currentEnvLight = envLight;

        this.timeOfDay = this.timeOfDay % 24.0;
    }


    public getTimeOfDay(): number {
        return this.timeOfDay;
    }

    // Core environmental calculations
    public getSkyBoxColor(): GD.ColorArr {
        if (!this.currentEnvLight) {
            return [0.5, 0.7, 1.0, 1.0]; // Default sky blue
        }

        // Get interpolated color from current environmental data
        const colorPlane = this.getAmbientPlaneTerrainLight();
        return colorPlane.getElements() as GD.ColorArr;
    }

    public getSunModifierInfo(): { brightness: number, color: GD.ColorArr } {
        if (!this.currentEnvLight) {
            return {
                brightness: 1.0,
                color: [1.0, 1.0, 0.9, 1.0] // Warm sunlight
            };
        }

        return {
            brightness: this.getBrightnessStaticMeshSunLight(),
            color: this.getBaseColorPlaneStaticMeshSunLight().getElements() as GD.ColorArr
        };
    }

    protected interpolateColors(colorA: GD.ColorArr, colorB: GD.ColorArr, factor: number): GD.ColorArr {
        const result: GD.ColorArr = [0, 0, 0, 1];
        for (let i = 0; i < 3; i++) {
            result[i] = colorA[i] + (colorB[i] - colorA[i]) * factor;
        }
        return result;
    }

    // Sun/Moon positioning calculations (would use GMath in native engine)
    // Note: Currently unused but provided for future rendering integration
    public getSunPosition(): { azimuth: number, elevation: number } {
        // Convert time of day to sun position using spherical coordinates
        // In native engine, this would use GMath.sin/cos for performance
        const gmath = GMath();

        // Time of day = [0;24) hours, convert to GMath angle units
        // 24 hours = 65536 GMath units (full circle)
        // 1 hour = 65536/24 = 2730.666 GMath units
        const timeAngle = Math.floor(this.timeOfDay * (65536 / 24));

        // Sun elevation: higher at noon (timeOfDay = 0.5), lower at dawn/dusk
        // Use GMath.sin for the elevation curve (performance optimization)
        const elevationGMath = Math.floor(gmath.sin(timeAngle) * 16384); // ±90° range

        // Azimuth: sun moves from east to west
        // Start from east, move westward based on time
        const azimuthGMath = (16384 - timeAngle) % 65536; // Wrap around full circle

        return {
            azimuth: azimuthGMath,
            elevation: elevationGMath
        };
    }

    public getMoonPosition(): { azimuth: number, elevation: number } {
        // Moon is opposite to sun (simplified)
        const sunPos = this.getSunPosition();

        // Moon is roughly opposite to sun
        const moonAzimuth = (sunPos.azimuth + 32768) % 65536; // +180 degrees
        const moonElevation = -sunPos.elevation; // Below horizon when sun is up

        return {
            azimuth: moonAzimuth,
            elevation: Math.max(moonElevation, -16384) // Don't go too far below horizon
        };
    }

    // Get current environmental lighting data
    public getCurrentEnvLight(): UL2NEnvLight {
        if (!this.currentEnvLight) {
            throw new Error("No environmental light set");
        }

        return this.currentEnvLight;
    }

    public selectByTime<T extends IEnvTime>(array: FArray<T>) {
        return selectByTime(this.timeOfDay, array);
    }

    public getColorPlaneStaticMeshSunLight(): FPlane {
        throw new Error("not yet implemented")
    }

    public getBrightnessStaticMeshSunLight(): number {
        return getBrightness(this.timeOfDay, this.currentEnvLight.lightStaticMesh);
    }

    public getBaseColorPlaneStaticMeshSunLight(): FPlane {
        return getColorPlane(this.timeOfDay, this.currentEnvLight.lightStaticMesh);
    }

    public getAmbientPlaneTerrainLight(): FPlane {
        return getColorPlane(this.timeOfDay, this.currentEnvLight.ambientTerrain);
    }

    public getAmbientPlaneStaticMeshSunLight(): FPlane {
        return getColorPlane(this.timeOfDay, this.currentEnvLight.ambientStaticMesh);
    }

    // Debug information
    public toString(): string {
        return `UL2NEnvManager(time=${this.timeOfDay.toFixed(1)}h, envType=${this.currentEnvType})`;
    }
}

function selectByTime<T extends IEnvTime>(timeOfDay: number, array: FArray<T>): T {
    for (let i = 0, len = array.length; i < len; i++) {
        const elem = array[i];

        if (timeOfDay <= elem.time)
            return elem;
    }

    return null;
}

function indexToTime(index: number, totalElements: number) { return (24.0 / totalElements) * 0.5 + (index * 24.0) / totalElements; }
// Generic time index picking that works with arrays that have explicit times or evenly distributed slots
function timeToIndex(timeOfDay: number, totalElements: number): number;
function timeToIndex<T extends IEnvTime>(timeOfDay: number, array: FArray<T>): number;
function timeToIndex(timeOfDay: number, array: number[]): number;
function timeToIndex<T extends IEnvTime>(timeOfDay: number, arrayOrCount: FArray<T> | number[] | number): number {
    // Handle arrays with explicit time values (FArray<IEnvTime>)
    if (typeof arrayOrCount !== 'number' && !Array.isArray(arrayOrCount)) {
        const array = arrayOrCount;
        for (let i = 0; i < array.length; i++) {
            if (timeOfDay <= array[i].time) {
                return i;
            }
        }
        return array.length - 1; // Default to last element if time exceeds all entries
    }

    // Handle plain number arrays (like shadowMapTimes)
    if (Array.isArray(arrayOrCount)) {
        const times = arrayOrCount;
        for (let i = 0; i < times.length; i++) {
            if (timeOfDay <= times[i]) {
                return i;
            }
        }
        return times.length - 1; // Default to last element if time exceeds all entries
    }

    // Handle evenly distributed time slots (legacy behavior)
    const totalElements = arrayOrCount;
    let index = totalElements - 1;
    let time: number;

    for (let i = 0; i < totalElements; i++) {
        time = indexToTime(i, totalElements);

        if (timeOfDay <= time)
            break;

        index = i;
    }

    return index;
}

function timeToIndicesLerp(timeOfDay: number, totalElements: number) {
    const currEnvIndex = timeToIndex(timeOfDay, totalElements);
    const nextEnvIndex = (currEnvIndex + 1) % totalElements;

    let currEnvTime = indexToTime(currEnvIndex, totalElements), nextEnvTime = indexToTime(nextEnvIndex, totalElements);

    while (nextEnvTime < currEnvTime) nextEnvTime = nextEnvTime + 24.0;

    let offset = timeOfDay;

    while (offset < currEnvTime) offset = offset + 24.0;

    const lerp = (offset - currEnvTime) / (nextEnvTime - currEnvTime);

    return [currEnvIndex, nextEnvIndex, lerp];
}

export default UL2NEnvManager;
export { UL2NEnvManager, UL2NEnvLight, UL2NTimeLight, EEnvCycle, FNTimeHSV, FNTimeColor, FNTimeScale, selectByTime, indexToTime, timeToIndex, timeToIndicesLerp, pickArrayIndices };

function getEnvType(fileContents: string): EEnvCycle {
    let readOffset = findSection(fileContents, "EnvType");
    let [nameMax, nameVal, _] = consumeNextValue(fileContents, readOffset);

    if (nameMax.toLowerCase() !== "envtype") throw new Error(`Invalid variable found '${nameMax}' expected 'NUM'`);

    return parseInt(nameVal) as EEnvCycle;
}

function loadHSV(fileContents: string, sectionName: string, pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage): FArray<FNTimeHSV> {
    let readOffset = findSection(fileContents, sectionName);
    let [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

    if (nameMax.toLowerCase() !== "num") throw new Error(`Invalid variable found '${nameMax}' expected 'NUM'`);

    readOffset = readOffset + readContent;

    const numLights = parseInt(nameVal);

    const uStruct = pkgEngine.fetchObjectByType<C.UStruct<FNTimeHSV>>("Struct", "NTimeHSV").loadSelf();
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

function loadScale(fileContents: string, sectionName: string, pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage): FArray<FNTimeScale> {
    let readOffset = findSection(fileContents, sectionName);
    let [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

    if (nameMax.toLowerCase() !== "num") throw new Error(`Invalid variable found '${nameMax}' expected 'NUM'`);

    readOffset = readOffset + readContent;

    const numScales = parseInt(nameVal);

    const uStruct = pkgEngine.fetchObjectByType<C.UStruct<FNTimeScale>>("Struct", "NTimeScale").loadSelf();
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

function loadRGB(fileContents: string, sectionName: string, pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage): FArray<FNTimeColor> {
    let readOffset = findSection(fileContents, sectionName);
    let [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

    if (nameMax.toLowerCase() !== "num") throw new Error(`Invalid variable found '${nameMax}' expected 'NUM'`);

    readOffset = readOffset + readContent;

    const numLights = parseInt(nameVal);

    const uStruct = pkgEngine.fetchObjectByType<C.UStruct<FNTimeColor>>("Struct", "NTimeColor").loadSelf();
    const FNTimeColor = uStruct.buildClass(pkgNative);

    const array = new FArray(FNTimeColor, numLights);

    for (let i = 1; i <= numLights; i++) {
        const [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);

        if (nameMax.toLowerCase() !== `color${i}`)
            throw new Error(`Invalid variable found '${nameMax}' expected 'Light${i}'`);

        const [t, h, s, b] = consumeRGB(nameVal);

        readOffset = readOffset + readContent;

        array[i - 1] = new FNTimeColor(t, h, s, b);
    }

    return array;
}

function findSection(fileContents: string, sectionName: string): number {
    const sectionHeader = `[${sectionName}]\r\n`;
    const indexOf = fileContents.indexOf(sectionHeader);

    if (indexOf === -1)
        throw new Error(`Section '${sectionName}' was not found in file contents!`);

    return indexOf + sectionHeader.length;
}

function consumeNextValue(fileContents: string, startOffset: number): [string, string, number] {
    let offset = startOffset;

    while (fileContents[offset] === ";")
        offset = fileContents.indexOf("\r\n", offset) + 2;

    const eqSign = fileContents.indexOf("=", offset);

    if (eqSign === -1)
        throw new Error(`Could not find assignment: ${fileContents.slice(offset)}`);

    const lineEnd = fileContents.indexOf("\r\n", eqSign + 1);

    if (lineEnd === -1)
        throw new Error(`Could not find eol: ${fileContents.slice(eqSign + 1)}`);

    const varName = fileContents.slice(offset, eqSign).trim();
    const varValue = fileContents.slice(eqSign + 1, lineEnd).trim();

    return [varName, varValue, lineEnd - startOffset + 2];
}

function consumeHSV(line: string): [number, number, number, number] {
    const offsetLeft = line.indexOf("(");

    if (offsetLeft === -1)
        throw new Error(`Could not find '(': ${line}`);

    const offsetRight = line.indexOf(")", offsetLeft);

    if (offsetRight === -1)
        throw new Error(`Could not find ')': ${line}`);

    let t = 0, h = 0, s = 0, b = 0;

    for (const param of line.slice(offsetLeft + 1, offsetRight).split(",")) {
        const [k, v] = param.split("=").map(v => v.trim());

        switch (k.toLowerCase()) {
            case "t": t = parseInt(v); break;
            case "hue": h = parseInt(v); break;
            case "sat": s = parseInt(v); break;
            case "bri": b = parseInt(v); break;
            default: throw new Error(`Unknown light parameter: ${k}`);
        }
    }

    return [t, h, s, b];
}

function consumeRGB(line: string): [number, number, number, number] {
    const offsetLeft = line.indexOf("(");

    if (offsetLeft === -1)
        throw new Error(`Could not find '(': ${line}`);

    const offsetRight = line.indexOf(")", offsetLeft);

    if (offsetRight === -1)
        throw new Error(`Could not find ')': ${line}`);

    let t = 0, r = 0, g = 0, b = 0;

    for (const param of line.slice(offsetLeft + 1, offsetRight).split(",")) {
        const [k, v] = param.split("=").map(v => v.trim());

        switch (k.toLowerCase()) {
            case "t": t = parseInt(v); break;
            case "r": r = parseInt(v); break;
            case "g": g = parseInt(v); break;
            case "b": b = parseInt(v); break;
            default: throw new Error(`Unknown light parameter: ${k}`);
        }
    }

    return [t, r, g, b];
}

function consumeScale(line: string): [number, number] {
    const offsetLeft = line.indexOf("(");

    if (offsetLeft === -1)
        throw new Error(`Could not find '(': ${line}`);

    const offsetRight = line.indexOf(")", offsetLeft);

    if (offsetRight === -1)
        throw new Error(`Could not find ')': ${line}`);

    let t = 0, s = 0;

    for (const param of line.slice(offsetLeft + 1, offsetRight).split(",")) {
        const [k, v] = param.split("=").map(v => v.trim());

        switch (k.toLowerCase()) {
            case "t": t = parseInt(v); break;
            case "s": s = parseInt(v); break;
            default: throw new Error(`Unknown light parameter: ${k}`);
        }
    }

    return [t, s];
}