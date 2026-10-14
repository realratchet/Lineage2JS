import { ObjectComponent } from "../../game/components";
import type AudioManager from "../audio-manager";
import type { SectorObject } from "../../objects/zone-object";
import type { IAmbientSoundObjectDecodeInfo } from "@l2js/engine";

export class AmbientSoundComponent extends ObjectComponent<SectorObject> {
    public readonly componentName = "ambientSound";
    public readonly info: IAmbientSoundObjectDecodeInfo;
    protected readonly audioManager: AudioManager;

    public constructor(audioManager: AudioManager, info: IAmbientSoundObjectDecodeInfo) {
        super();

        this.audioManager = audioManager;
        this.info = info;
    }

    public get dataUri(): string { return this.getParent().getSoundUri(this.info.soundName); }

    public onAttach(): void { this.audioManager.registerAmbientSound(this); }
    public onDetach(): void { this.audioManager.unregisterAmbientSound(this); }
}

export default AmbientSoundComponent;
