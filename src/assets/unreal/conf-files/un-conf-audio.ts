import BaseConfigFile from "./un-base-config";

export type SwimSoundSet_T = { sounds: string[]; volume: number; radius: number; random: number; };
export type SwimSoundConfig_T = { surface: SwimSoundSet_T; underwater: SwimSoundSet_T; };
type PawnSoundSection_T = "CharSound" | "ItemSound";
type SoundConfigSection_T = PawnSoundSection_T | "EtcSound";
type PawnSound_T = { volume: number; radius: number; random?: number; };
type CriticalSound_T = { sound: string; volume: number; radius: number; };

function getSectionValues(contents: string, section: string): Map<string, string> | null {
    const match = new RegExp(`\\[${section}\\]\\r?\\n([\\s\\S]*?)(?:\\r?\\n\\[|$)`).exec(contents);

    if (!match) return null;

    const values = new Map<string, string>();

    for (const line of match[1].split(/\r?\n/)) {
        const index = line.indexOf("=");

        if (index === -1) continue;

        values.set(line.slice(0, index).trim().toLowerCase(), line.slice(index + 1).trim());
    }

    return values;
}

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

function getPawnNumber(values: Map<string, string> | null, section: SoundConfigSection_T, name: string, fallback: number): number {
    const value = values?.get(name.toLowerCase());

    if (value === undefined) return fallback;

    const number = Number(value);

    if (!value || !Number.isFinite(number)) throw new Error(`'[${section}].${name}' is not a number.`);

    return number;
}

export class UConfigAudio extends BaseConfigFile {
    protected swimSound: SwimSoundConfig_T = null;
    protected pawnSounds: Record<PawnSoundSection_T, PawnSound_T> = null;
    protected criticalSound: CriticalSound_T = null;
    protected soulshotSound: CriticalSound_T = null;

    public load(): this {
        const contents = this.decodeConfig();
        const values = getSectionValues(contents, "SwimSound");

        if (!values) throw new Error(`'${this.path}' has no '[SwimSound]' section.`);

        this.swimSound = { surface: getSet(values, "WaterSurface"), underwater: getSet(values, "UnderWater") };
        const charSound = getSectionValues(contents, "CharSound");
        const itemSound = getSectionValues(contents, "ItemSound");
        const etcSound = getSectionValues(contents, "EtcSound");

        // Engine.dll GetDamageSound 0x8b7235..0x8b7316 / GetDefenseItemSound 0x8b691f..0x8b6960: missing config defaults.
        this.pawnSounds = {
            CharSound: { volume: getPawnNumber(charSound, "CharSound", "Vol", 255), radius: getPawnNumber(charSound, "CharSound", "Radius", 50), random: getPawnNumber(charSound, "CharSound", "Random", 100) },
            ItemSound: { volume: getPawnNumber(itemSound, "ItemSound", "Vol", 255), radius: getPawnNumber(itemSound, "ItemSound", "Radius", 50) }
        };
        // Engine.dll Action_Attack 0x8bdb69..0x8bdbfe reads EtcSound CriticalSound, Vol and Radius.
        this.criticalSound = {
            sound: etcSound?.get("criticalsound") ?? "SkillSound.Critical_Hit.Critical_Hit",
            volume: getPawnNumber(etcSound, "EtcSound", "CriticalSound_Vol", 255),
            radius: getPawnNumber(etcSound, "EtcSound", "CriticalSound_Radius", 50)
        };
        // Engine.dll Action_Attack 0x8bdc62 / 0x8bdc79 / 0x8bdc9b / 0x8bdcc5.
        this.soulshotSound = {
            sound: etcSound?.get("soulshotsound") ?? "skillsound.soul_shot_shot",
            volume: getPawnNumber(etcSound, "EtcSound", "SoulShotSound_Vol", 255),
            radius: getPawnNumber(etcSound, "EtcSound", "SoulShotSound_Radius", 50)
        };

        return this;
    }

    public getSwimSound(): SwimSoundConfig_T {
        if (!this.swimSound) throw new Error(`'${this.path}' was not loaded.`);

        return this.swimSound;
    }

    public getPawnSound(section: PawnSoundSection_T): PawnSound_T {
        if (!this.pawnSounds) throw new Error(`'${this.path}' was not loaded.`);

        return this.pawnSounds[section];
    }

    public getCriticalSound(): CriticalSound_T {
        if (!this.criticalSound) throw new Error(`'${this.path}' was not loaded.`);

        return this.criticalSound;
    }

    public getSoulshotSound(): CriticalSound_T {
        if (!this.soulshotSound) throw new Error(`'${this.path}' was not loaded.`);

        return this.soulshotSound;
    }
}

export default UConfigAudio;
