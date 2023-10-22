import FPlane from "@client/assets/unreal/un-plane";
import hsvToRgb from "@client/utils/hsv-to-rgb";
import { UObject } from "@l2js/core";
import FArray from "@l2js/core/src/unreal/un-array";

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

    public getColor(): GD.ColorArr { return [this.r / 255, this.g / 255, this.b / 255, 1]; }
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
}

abstract class UL2NTimeLight extends UObject {
    public readonly timeOfDay = 0;

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
    public load(pkg: C.APackage, info: C.UExport<UObject>): this;
    public load(pkg: C.APackage, info: C.PropertyTag): this;
    public load(pkg: GA.UPackage): this;
    public load(pkg: GA.UPackage, info: C.UExport<UObject>): this;
    public load(pkg: GA.UPackage, info: C.PropertyTag): this;
    public load(pkg: GA.UPackage, info?: any): this;
    public load(fileContents: string, pkgNative: GA.UNativePackage, pkgEngine: GA.UEnginePackage): this;

    public load(fileContents: any, pkgNative?: any, pkgEngine?: any): this {
        if (typeof fileContents === "string")
            return this.loadFromText(fileContents, pkgNative, pkgEngine);
        else return super.load(fileContents, pkgNative);
    }

    protected loadFromText(fileContents: string, pkgNative: GA.UNativePackage, pkgEngine: GA.UEnginePackage): this {
        this.lightActor = loadHSV(fileContents, "HSVActorLight", pkgNative, pkgEngine);
        this.lightStaticMesh = loadHSV(fileContents, "HSVStaticMeshLight", pkgNative, pkgEngine);
        this.lightTerrain = loadHSV(fileContents, "HSVTerrainLight", pkgNative, pkgEngine);
        this.lightBSP = loadHSV(fileContents, "HSVBSPLight", pkgNative, pkgEngine);

        return this;
    }

    public selectByTime<T extends IEnvTime>(array: FArray<T>) {
        return selectByTime(this.timeOfDay, array);
    }

    public getColorPlaneStaticMeshSunLight(): FPlane {
        throw new Error("not yet implemented")
    }

    public getBrightnessStaticMeshSunLight(): number {
        return getBrightness(this.timeOfDay, this.lightStaticMesh);
    }

    public getBaseColorPlaneStaticMeshSunLight(): FPlane {
        debugger;
        return getColorPlane(this.timeOfDay, this.lightStaticMesh);
    }
}


function pickArrayIndices<T extends IEnvTime>(timeOfDay: number, array: FArray<T>): [T, T, number] {
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
        debugger;
        throw new Error("shouldn't happen");
    }

    const elemCurr = array[idxCurr], elemNext = array[idxNext];
    const timeCurr = elemCurr.time, timeNext = elemNext.time;
    const frac = (timeOfDay - timeCurr) / (timeNext - timeCurr);

    return [elemCurr, elemNext, frac];
}

function getBrightness(timeOfDay: number, array: FArray<FNTimeHSV>) {
    const [hsvCurr, hsvNext, lFrac] = pickArrayIndices(timeOfDay, array);
    const bri = lFrac * (hsvNext.bri - hsvCurr.bri) + hsvCurr.bri;

    return bri;
}

function getColorPlane(timeOfDay: number, array: FArray<FNTimeHSV>) {
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
    declare public colorCloud: C.FArray<FNTimeColor>;
    declare public colorStar: C.FArray<FNTimeColor>;
    declare public colorSun: C.FArray<FNTimeColor>;
    declare public colorMoon: C.FArray<FNTimeColor>;

    declare public ambientTerrain: C.FArray<FNTimeColor>;
    declare public ambientActor: C.FArray<FNTimeColor>;
    declare public ambientStaticMesh: C.FArray<FNTimeColor>;
    declare public ambientBSP: C.FArray<FNTimeColor>;

    declare public scaleSun: C.FArray<FNTimeScale>;
    declare public scaleMoon: C.FArray<FNTimeScale>;

    declare public envType: 0 | 1 | 2;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "SkyColor": "colorSky",
            "HazeColorIndex": "colorIndexHaze",
            "HazeColor": "colorHaze",
            "CloudColorIndex": "colorIndexCloud",
            "CloudColor": "colorCloud",
            "StarColor": "colorStar",
            "SunColor": "colorSun",
            "MoonColor": "colorMoon",
            "TerrainAmbient": "ambientTerrain",
            "ActorAmbient": "ambientActor",
            "StaticMeshAmbient": "ambientStaticMesh",
            "BSPAmbient": "ambientBSP",
            "SunScale": "scaleSun",
            "MoonScale": "scaleMoon",
            "EnvType": "envType"
        });
    }

    protected loadFromText(fileContents: string, pkgNative: GA.UNativePackage, pkgEngine: GA.UEnginePackage): this {
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

        return this;
    }


    public toString(): string {
        let envName: "Normal" | "[SS]Dusk" | "[SS]Dawn";

        switch (this.envType) {
            case 0: envName = "Normal"; break;
            case 1: envName = "[SS]Dusk"; break;
            case 2: envName = "[SS]Dawn"; break;
            default: throw new Error(`Unknown sky type: ${this.envType}`);
        }

        return `UL2NEnvLight(EnvType=${envName})`;
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
function timeToIndex(timeOfDay: number, totalElements: number): number {
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

export default UL2NEnvLight;
export { UL2NEnvLight, UL2NTimeLight, FNTimeHSV, FNTimeColor, FNTimeScale, selectByTime, indexToTime, timeToIndex, timeToIndicesLerp };

function getEnvType(fileContents: string) {
    let readOffset = findSection(fileContents, "EnvType");
    let [nameMax, nameVal, _] = consumeNextValue(fileContents, readOffset);

    if (nameMax.toLowerCase() !== "envtype") throw new Error(`Invalid variable found '${nameMax}' expected 'NUM'`);

    return parseInt(nameVal) as 0 | 1 | 2;
}

function loadHSV(fileContents: string, sectionName: string, pkgNative: GA.UNativePackage, pkgEngine: GA.UEnginePackage): FArray<FNTimeHSV> {
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

function loadScale(fileContents: string, sectionName: string, pkgNative: GA.UNativePackage, pkgEngine: GA.UEnginePackage): FArray<FNTimeScale> {
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

function loadRGB(fileContents: string, sectionName: string, pkgNative: GA.UNativePackage, pkgEngine: GA.UEnginePackage): FArray<FNTimeColor> {
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