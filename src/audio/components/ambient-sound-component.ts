import { ObjectComponent } from "../../game/components";
import type AudioManager from "../audio-manager";
import type { SectorObject } from "../../objects/zone-object";

class AmbientSoundComponent extends ObjectComponent<SectorObject> {
    public readonly componentName = "ambientSound";
    public readonly info: GD.IAmbientSoundObjectDecodeInfo;
    public readonly dataUri: string;
    protected readonly audioManager: AudioManager;

    public constructor(audioManager: AudioManager, info: GD.IAmbientSoundObjectDecodeInfo, dataUri: string) {
        super();

        this.audioManager = audioManager;
        this.info = info;
        this.dataUri = dataUri;
    }

    public onAttach(): void { this.audioManager.registerAmbientSound(this); }
    public onDetach(): void { this.audioManager.unregisterAmbientSound(this); }
}

export default AmbientSoundComponent;
export { AmbientSoundComponent };
