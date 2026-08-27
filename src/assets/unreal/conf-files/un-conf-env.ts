import { EEnvCycle } from "../env-consts";
import BaseConfigFile from "./un-base-config";
import UConfigTimeEnv from "./un-conf-timeenv";
import { consumeNextValue, consumeTuple, findSection } from "./conf-parser";

class EnvSetup {
    public isClock: boolean;
    public startTime: number;
    public timeRatio: number;

    public skyboxName: string;
    public hazeringName: string;
    public cloudNames: string[];

    public skybox: GA.UMaterial;
    public hazering: GA.UMaterial;
    public clouds: GA.UMaterial[];

    public shadowTick: number;
    public staticLightingAdjust: number;
    public slopeSunAngle: number;
    public subLightNum: number;

    public timeEnv: { [key in EEnvCycle]: UConfigTimeEnv };

    public getDecodeInfo(): GD.ILNEnvSetupDecodeInfo {
        return {
            isClock: this.isClock,
            startTime: this.startTime,
            timeRatio: this.timeRatio,
            shadowTick: this.shadowTick,
            staticLightingAdjust: this.staticLightingAdjust,
            slopeSunAngle: this.slopeSunAngle,
            subLightNum: this.subLightNum,
            timeEnv: Object.fromEntries(Object.entries(this.timeEnv).map(([k, v]) => [k, v.getDecodeInfo()])) as any,
            skybox: this.skybox?.uuid,
            hazering: this.hazering?.uuid,
            clouds: this.clouds.map(c => c.uuid)
        };
    }
};

type EnvFog = {
    ranges: GD.Vector2Arr[];
    fogSpeed: number;
};

type EnvWaterVolume = {
    fogColor: GD.ColorArr;
    fogStart: number;
    fogEnd: number;
    cellophaneColor: GD.ColorArr;
};

type EnvGlowEffect = {
    glowType: number;
    luminance: number;
    middleGray: number;
    whiteCutoff: number;
    threshold: number;

    rgbCutoff: number;
    bloomScale: number;

    finalBlendOpacity: number;
    finalBlendBlurType: number;
};

class UConfigEnv extends BaseConfigFile {
    declare protected envSetup: EnvSetup;
    declare protected fog: EnvFog;
    declare protected waterVolume: EnvWaterVolume;
    declare protected glowEffect: EnvGlowEffect;

    public async load(pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage, pkgL2Skies: C.APackage): Promise<this> {
        const fileContents = this.decodeConfig();

        // Parse [EnvSetup]
        this._loadEnvSetup(fileContents);

        // Parse [FOG]
        this._loadFog(fileContents);

        // Parse [WaterVolume]
        this._loadWaterVolume(fileContents);

        // // Parse [GlowEffect]
        // this._loadGlowEffect(fileContents);

        // Parse TimeEnvFileName and load them
        await this._loadTimeEnvs(fileContents, pkgNative, pkgEngine);

        this.envSetup.clouds = new Array(this.envSetup.cloudNames.length);

        for (const exp of pkgL2Skies.exports) {
            let cloudIndex = -1;

            if (exp.objectName === this.envSetup.skyboxName)
                this.envSetup.skybox = pkgL2Skies.fetchObject(exp.index + 1);
            else if (exp.objectName === this.envSetup.hazeringName)
                this.envSetup.hazering = pkgL2Skies.fetchObject(exp.index + 1);
            else if ((cloudIndex = this.envSetup.cloudNames.indexOf(exp.objectName)) >= 0)
                this.envSetup.clouds[cloudIndex] = pkgL2Skies.fetchObject(exp.index + 1);
        }

        return this;
    }

    public getDecodeInfo(): GD.IL2NEnvDecodeInfo {
        return {
            envSetup: this.envSetup.getDecodeInfo(),
            fog: this.fog,
            waterVolume: this.waterVolume,
            // glowEffect: this.glowEffect
        };
    }

    private _loadEnvSetup(fileContents: string): void {
        let readOffset = findSection(fileContents, "EnvSetup");

        const setup = this.envSetup = new EnvSetup();

        setup.cloudNames = [];

        while (true) {
            readOffset = this._skipToNextToken(fileContents, readOffset);
            if (readOffset >= fileContents.length || fileContents[readOffset] === "[") break;

            let nameMax: string, nameVal: string, readContent: number;

            try {
                [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);
            } catch { break; }

            readOffset += readContent;

            switch (nameMax.toLowerCase()) {
                case "isclock": setup.isClock = nameVal.toLowerCase() === "true" ? true : false; break;
                case "starttime": setup.startTime = parseInt(nameVal); break;
                case "timeratio": setup.timeRatio = parseInt(nameVal); break;
                case "skybox": setup.skyboxName = nameVal; break;
                case "hazering": setup.hazeringName = nameVal; break;
                case "shadowtick": setup.shadowTick = parseFloat(nameVal); break;
                case "staticlightingadjust": setup.staticLightingAdjust = parseFloat(nameVal); break;
                case "slopesunangle": setup.slopeSunAngle = parseFloat(nameVal); break;
                case "sublightnum": setup.subLightNum = parseInt(nameVal); break;
                case "numcloudcolor": /* handled implicitly by accumulation */ break;
                default:
                    if (nameMax.toLowerCase().startsWith("cloud")) {
                        setup.cloudNames.push(nameVal);
                    }
                    break;
            }
        }
    }

    private _loadFog(fileContents: string): void {
        let readOffset = findSection(fileContents, "FOG");
        const fog: Partial<EnvFog> = {
            ranges: []
        };

        const starts: number[] = [];
        const ends: number[] = [];

        while (true) {
            readOffset = this._skipToNextToken(fileContents, readOffset);
            if (readOffset >= fileContents.length || fileContents[readOffset] === "[") break;

            let nameMax: string, nameVal: string, readContent: number;

            try {
                [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);
            } catch { break; }

            readOffset += readContent;

            const lowerName = nameMax.toLowerCase();

            if (lowerName === "fogspeed") {
                fog.fogSpeed = parseFloat(nameVal);
            } else {
                const startMatch = lowerName.match(/^startrange(\d+)$/);
                if (startMatch) {
                    starts[parseInt(startMatch[1]) - 1] = parseFloat(nameVal);
                } else {
                    const endMatch = lowerName.match(/^endrange(\d+)$/);
                    if (endMatch) {
                        ends[parseInt(endMatch[1]) - 1] = parseFloat(nameVal);
                    }
                }
            }
        }

        for (let i = 0; i < Math.max(starts.length, ends.length); i++) {
            fog.ranges[i] = [starts[i] ?? 0, ends[i] ?? 0];
        }

        this.fog = fog as EnvFog;
    }

    private _loadWaterVolume(fileContents: string): void {
        let readOffset = findSection(fileContents, "WaterVolume");
        const water: Partial<EnvWaterVolume> = {};

        while (true) {
            readOffset = this._skipToNextToken(fileContents, readOffset);
            if (readOffset >= fileContents.length || fileContents[readOffset] === "[") break;

            let nameMax: string, nameVal: string, readContent: number;

            try {
                [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);
            } catch { break; }

            readOffset += readContent;

            switch (nameMax.toLowerCase()) {
                case "watervolumefogcolor": {
                    const rgb = consumeTuple(nameVal);
                    water.fogColor = [parseInt(rgb.r), parseInt(rgb.g), parseInt(rgb.b), 255];
                    break;
                }
                case "watervolumefogstart": water.fogStart = parseFloat(nameVal); break;
                case "watervolumefogend": water.fogEnd = parseFloat(nameVal); break;
                case "watervolumecellophanecolor": {
                    const rgb = consumeTuple(nameVal);
                    water.cellophaneColor = [parseInt(rgb.r), parseInt(rgb.g), parseInt(rgb.b), parseInt(rgb.a)];
                    break;
                }
            }
        }

        this.waterVolume = water as EnvWaterVolume;
    }

    private _loadGlowEffect(fileContents: string): void {
        let readOffset = findSection(fileContents, "GlowEffect");
        const glow: Partial<EnvGlowEffect> = {};

        while (true) {
            readOffset = this._skipToNextToken(fileContents, readOffset);
            if (readOffset >= fileContents.length || fileContents[readOffset] === "[") break;

            let nameMax: string, nameVal: string, readContent: number;

            try {
                [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);
            } catch { break; }

            readOffset += readContent;

            switch (nameMax.toLowerCase()) {
                case "glowtype": glow.glowType = parseFloat(nameVal); break;
                case "luminance": glow.luminance = parseFloat(nameVal); break;
                case "middlegray": glow.middleGray = parseFloat(nameVal); break;
                case "whitecutoff": glow.whiteCutoff = parseFloat(nameVal); break;
                case "threshold": glow.threshold = parseFloat(nameVal); break;
                case "rgbcutoff": glow.rgbCutoff = parseFloat(nameVal); break;
                case "bloomscale": glow.bloomScale = parseFloat(nameVal); break;
                case "finalblendopacity": glow.finalBlendOpacity = parseFloat(nameVal); break;
                case "finalblendblurtype": glow.finalBlendBlurType = parseFloat(nameVal); break;
            }
        }

        this.glowEffect = glow as EnvGlowEffect;
    }

    private _skipToNextToken(fileContents: string, offset: number): number {
        while (offset < fileContents.length) {
            if (fileContents[offset] === ';') {
                const eol = fileContents.indexOf('\r\n', offset);
                if (eol === -1) return fileContents.length;
                offset = eol + 2;
                continue;
            }
            if (/\s/.test(fileContents[offset])) {
                offset++;
                continue;
            }
            break;
        }
        return offset;
    }

    private async _loadTimeEnvs(fileContents: string, pkgNative: C.ANativePackage, pkgEngine: C.AEnginePackage): Promise<void> {
        let readOffset = findSection(fileContents, "EnvSetup");

        // Skip till TimeEnvFileNum
        while (true) {
            try {
                const [nameMax, _, readContent] = consumeNextValue(fileContents, readOffset);
                if (nameMax.toLowerCase() === "timeenvfilenum") {
                    readOffset += readContent;
                    break;
                }
                readOffset += readContent;
            } catch {
                break;
            }
        }

        this.envSetup.timeEnv = {} as any;
        const cycles = [EEnvCycle.Normal, EEnvCycle.Dusk, EEnvCycle.Dawn];

        for (const cycle of cycles) {
            const [nameMax, nameVal, readContent] = consumeNextValue(fileContents, readOffset);
            if (nameMax.toLowerCase().startsWith("timeenvfilename")) {
                const env = await (new UConfigTimeEnv(`assets/system/${nameVal.toLowerCase()}`).asReadable()).decode();
                this.envSetup.timeEnv[cycle] = env.load(pkgNative, pkgEngine);
                readOffset += readContent;
            }
        }
    }
}

export default UConfigEnv;
export { UConfigEnv };