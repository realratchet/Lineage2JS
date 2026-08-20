import BaseConfigFile from "./un-base-config";

type SwimSoundSet_T = {
    sounds: string[];
    volume: number;
    radius: number;
    random: number;
};

type SwimSoundConfig_T = {
    surface: SwimSoundSet_T;
    underwater: SwimSoundSet_T;
};

function getValue(values: Map<string, string>, name: string): string {
    const value = values.get(name.toLowerCase());

    if (value === undefined) throw new Error(`'[SwimSound]' has no '${name}'.`);

    return value;
}

function getNumber(values: Map<string, string>, name: string): number {
    const value = Number(getValue(values, name));

    if (!Number.isFinite(value)) throw new Error(`'[SwimSound].${name}' is not a number.`);

    return value;
}

function getSet(values: Map<string, string>, prefix: string): SwimSoundSet_T {
    return {
        sounds: [1, 2, 3].map(index => getValue(values, `${prefix}Sound${index}`)),
        volume: getNumber(values, `${prefix}SoundVol`),
        radius: getNumber(values, `${prefix}SoundRadius`),
        random: getNumber(values, `${prefix}SoundRandom`)
    };
}

class UConfigAudio extends BaseConfigFile {
    protected swimSound: SwimSoundConfig_T = null;

    public load(): this {
        const match = /\[SwimSound\]\r?\n([\s\S]*?)(?:\r?\n\[|$)/.exec(this.decodeConfig());

        if (!match) throw new Error(`'${this.path}' has no '[SwimSound]' section.`);

        const values = new Map<string, string>();

        for (const line of match[1].split(/\r?\n/)) {
            const index = line.indexOf("=");

            if (index === -1) continue;

            values.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
        }

        this.swimSound = { surface: getSet(values, "WaterSurface"), underwater: getSet(values, "UnderWater") };

        return this;
    }

    public getSwimSound(): SwimSoundConfig_T {
        if (!this.swimSound) throw new Error(`'${this.path}' was not loaded.`);

        return this.swimSound;
    }
}

export default UConfigAudio;
export { UConfigAudio };
export type { SwimSoundConfig_T, SwimSoundSet_T };
