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
}

export default UAmbientSoundObject;
export { UAmbientSoundObject };