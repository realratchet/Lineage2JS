import UVolume from "@client/assets/unreal/un-volume";

abstract class UMusicVolume extends UVolume {
    protected musicId: number;
    protected isMusicForced: boolean;
    protected isMusicLooped: boolean;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "nMusicID": "musicId",
            "bForcePlayMusic": "isMusicForced",
            "bLoopMusic": "isMusicLooped",
        })
    }

    public getDecodeInfo(library: GD.DecodeLibrary) {
        return {
            ...super.getDecodeInfo(),
            type: "MusicVolume",
            musicId: this.musicId,
            isMusicForced: this.isMusicForced ?? false,
            isMusicLooped: this.isMusicLooped ?? false
        };
    }
}

export default UMusicVolume;
export { UMusicVolume };