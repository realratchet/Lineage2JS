import UAActor from "./un-aactor";
import type { USound } from "./un-sound";
import type { DecodeLibraryBuilder } from "./decode-library-builder";
import type { Vector3Arr } from "./library-types";
import type { IAudioDecodeInfo } from "./decode-library";

type AmbientSoundTypes_T = "always" | "day" | "night" | "water";

type IAmbientSoundObjectDecodeInfo = IAudioDecodeInfo & {
    type: "AmbientSoundObject",
    position: Vector3Arr,
    refDistance: number,
    maxDistance: number,
    volume: number,
    pitch: number,
    soundName: string, // resolved against the sector's soundBlobCache, see SectorObject.getSoundUri
    looping: boolean,
    soundType: AmbientSoundTypes_T,
    randomChance: number,
};

abstract class UAmbientSoundObject extends UAActor {
    declare public readonly sound: USound;
    declare public readonly radius: number;
    declare public readonly volume: number;
    declare public readonly pitch: number;
    declare public readonly randomAmbient: number;
    declare public readonly isHiddenEdGroup: boolean;
    declare public readonly isHiddenEd: boolean;
    declare public readonly startTime: number;
    declare public readonly soundType: ASType1_T;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "AmbientSound": "sound",
            "SoundRadius": "radius",
            "SoundVolume": "volume",
            "bHiddenEdGroup": "isHiddenEdGroup",
            "SoundPitch": "pitch",
            "AmbientRandom": "randomAmbient",
            "AmbientSoundStartTime": "startTime",
            "bHiddenEd": "isHiddenEd",
            "AmbientSoundType": "soundType"
        });
    }

    public getDecodeInfo(builder: DecodeLibraryBuilder) {
        if (!this.sound) return null;

        const snd = this.sound.loadSelf();
        if (!snd) return null;

        console.assert(isFinite(this.radius));
        console.assert(isFinite(this.volume));
        console.assert(isFinite(this.pitch));
        console.assert(isFinite(this.soundType));
        console.assert(isFinite(this.randomAmbient));

        const soundKey = snd.objectName ?? snd.uuid;

        if (!builder.pullSound(snd)) return null;

        const position = this.location.getElements();
        const refDistance = this.radius;
        const maxDistance = this.radius * 100; // GAudioMaxRadiusMultiplier = 100 in UE2
        const volume = this.volume / 255;
        const pitch = this.pitch / 64;
        const randomChance = this.randomAmbient;

        const decodeInfo: IAmbientSoundObjectDecodeInfo = {
            uuid: this.uuid,
            name: this.objectName,
            type: "AmbientSoundObject",
            position,
            refDistance,
            maxDistance,
            volume,
            pitch,
            soundName: soundKey,
            looping: randomChance <= 0 || randomChance >= 100,
            soundType: AS_TYPE_NAMES[(this.soundType?.valueOf() as ASType1_T) ?? ASType1_T.AST1_Always],
            randomChance,
        };

        return decodeInfo;
    }
}

enum ASType1_T {
    AST1_Always,
    AST1_Day,
    AST1_Night,
    AST1_Water
}

const AS_TYPE_NAMES: Record<ASType1_T, AmbientSoundTypes_T> = {
    [ASType1_T.AST1_Always]: "always",
    [ASType1_T.AST1_Day]: "day",
    [ASType1_T.AST1_Night]: "night",
    [ASType1_T.AST1_Water]: "water"
};

export default UAmbientSoundObject;
export { UAmbientSoundObject, ASType1_T };
export type { AmbientSoundTypes_T, IAmbientSoundObjectDecodeInfo };
