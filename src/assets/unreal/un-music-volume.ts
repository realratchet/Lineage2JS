import UVolume from "@client/assets/unreal/un-volume";

abstract class UMusicVolume extends UVolume {
    declare protected musicId: number;
    declare protected isMusicForced: boolean;
    declare protected isMusicLooped: boolean;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "nMusicID": "musicId",
            "bForcePlayMusic": "isMusicForced",
            "bLoopMusic": "isMusicLooped",
        })
    }

    public getDecodeInfo(library: GD.DecodeLibrary) {
        const region = this.getRegion()?.loadSelf();

        const decodeInfo: GD.IMusicVolumeDecodeInfo = {
            ...super.getDecodeInfo(),
            type: "MusicVolume",
            musicId: this.musicId,
            isMusicForced: this.isMusicForced,
            isMusicLooped: this.isMusicLooped,
            zoneNumber: region.getZoneNumber(),
            priority: this.locationPriority,
            bsp: this.getWorldBspInfo()
        };

        return decodeInfo;
    }
}

export default UMusicVolume;
export { UMusicVolume };
