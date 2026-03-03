import UPhysicsVolume from "./un-physics-volume";

abstract class UMusicVolume extends UPhysicsVolume {
    // public readonly careUnread = false;

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
        // debugger;
    }
}

export default UMusicVolume;
export { UMusicVolume };