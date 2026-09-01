import UVolume, { type IVolumeBspDecodeInfo } from "./un-volume";
import type { DecodeLibrary, IAudioDecodeInfo } from "./decode-library";
import type { IBoundsDecodeInfo } from "./un-primitive";

type IMusicVolumeDecodeInfo = IAudioDecodeInfo & {
    type: "MusicVolume",
    musicId: number,
    isMusicForced: boolean,
    isMusicLooped: boolean,
    zoneNumber: number,
    priority: number,
    bounds: IBoundsDecodeInfo,
    bsp: IVolumeBspDecodeInfo
};

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

    public getDecodeInfo(library: DecodeLibrary) {
        const region = this.getRegion()?.loadSelf();
        const decodeInfo: IMusicVolumeDecodeInfo = {
            ...super.getDecodeInfo(),
            type: "MusicVolume",
            musicId: this.musicId,
            isMusicForced: this.isMusicForced,
            isMusicLooped: this.isMusicLooped,
            zoneNumber: region.getZoneNumber(),
            leafIndex: region.getLeaf(),
            priority: this.locationPriority,
            bsp: this.getWorldBspInfo()
        };

        return decodeInfo;
    }
}

export default UMusicVolume;
export { UMusicVolume };
export type { IMusicVolumeDecodeInfo };
