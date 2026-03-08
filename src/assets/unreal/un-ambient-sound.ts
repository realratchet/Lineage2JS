import UAActor from "./un-aactor";
import { generateUUID } from "three/src/math/MathUtils";

abstract class UAmbientSoundObject extends UAActor {
    declare public readonly sound: GA.USound;
    declare public readonly radius: number;
    declare public readonly volume: number;
    declare public readonly pitch: number;
    declare public readonly randomAmbient: number;
    declare public readonly isHiddenEdGroup: boolean;
    declare public readonly isHiddenEd: boolean;
    declare public readonly startTime: number;
    declare public readonly soundType: number;

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

    public getDecodeInfo(library: GD.DecodeLibrary) {
        if (!this.sound) return null;

        const snd = (this.sound as any).loadSelf();
        if (!snd) return null;

        console.assert(isFinite(this.radius));
        console.assert(isFinite(this.volume));
        console.assert(isFinite(this.pitch));
        console.assert(isFinite(this.soundType));
        console.assert(isFinite(this.randomAmbient));

        const soundKey = snd.objectName ?? snd.uuid;
        let soundDataUri = library.soundBlobCache.get(soundKey);

        if (!soundDataUri) {
            const audioData = snd.getAudioData();
            if (!audioData || audioData.length === 0) return null;

            const fileType = snd.getFileType()?.toLowerCase() ?? "wav";
            const mimeType = fileType === "ogg" ? "audio/ogg" : "audio/wav";
            const blob = new Blob([audioData.buffer], { type: mimeType });
            soundDataUri = URL.createObjectURL(blob);
            library.soundBlobCache.set(soundKey, soundDataUri);
        }

        const position = this.location.getVectorElements();
        const refDistance = this.radius;
        const maxDistance = this.radius * 100; // GAudioMaxRadiusMultiplier = 100 in UE2
        const volume = this.volume / 255;
        const pitch = this.pitch / 64;
        const randomDelay = this.randomAmbient; // L2 AmbientRandom=100 → max 100s delay

        const decodeInfo: GD.IAmbientSoundObjectDecodeInfo = {
            uuid: this.uuid,
            name: this.objectName,
            type: "AmbientSoundObject",
            position,
            refDistance,
            maxDistance,
            volume,
            pitch,
            soundDataUri,
            soundName: soundKey,
            looping: randomDelay === 0, // seamless loop only when no random delay
            soundType: this.soundType, // 0=Always, 1=Day, 2=Night, 3=Water
            randomDelay,
        };

        library.ambientSounds.push(decodeInfo);

        return decodeInfo;
    }
}

export default UAmbientSoundObject;
export { UAmbientSoundObject };