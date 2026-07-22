import UAActor from "./un-aactor";

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

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder) {
        if (!this.sound) return null;

        const snd = this.sound.loadSelf();
        if (!snd) return null;

        console.assert(isFinite(this.radius));
        console.assert(isFinite(this.volume));
        console.assert(isFinite(this.pitch));
        console.assert(isFinite(this.soundType));
        console.assert(isFinite(this.randomAmbient));

        const soundKey = snd.objectName ?? snd.uuid;
        const soundEntry = builder.pullSound(snd);

        if (!soundEntry) return null;

        const soundDataUri = soundEntry.uri;

        const position = this.location.getElements();
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

        return decodeInfo;
    }
}

export default UAmbientSoundObject;
export { UAmbientSoundObject };
