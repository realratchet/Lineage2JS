import UAActor from "./un-aactor";

abstract class UAmbientSoundObject extends UAActor {
    protected sound: GA.USound;
    protected radius: number;
    protected volume: number;
    protected pitch: number;
    protected randomAmbient: number;
    protected isHiddenEdGroup: boolean;
    protected isHiddenEd: boolean;
    protected startTime: number;
    protected soundType: number;

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