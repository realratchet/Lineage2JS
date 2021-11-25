import UObject from "./un-object";

class UAmbientSoundObject extends UObject {
    protected sound: USound;
    protected radius: number;
    protected volume: number;
    protected pitch: number;
    protected randomAmbient: number;
    protected isHiddenEdGroup: boolean;
    protected isHiddenEd: boolean;
    protected group: string;
    protected location: FVector;
    protected region: UPointRegion;
    protected startTime: number;
    protected soundType: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "AmbientSound": "sound",
            "SoundRadius": "radius",
            "SoundVolume": "volume",
            "bHiddenEdGroup": "isHiddenEdGroup",
            "Group": "group",
            "Location": "location",
            "Region": "region",
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