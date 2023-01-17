import UParticleEmitter from "./emitters/un-particle-emitter";
import UAActor from "./un-aactor";
import { FObjectArray } from "./un-array";

abstract class UEmitter extends UAActor {
    protected emitters = new FObjectArray<UParticleEmitter>();

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "Emitters": "emitters"
        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        const emittersInfo = this.emitters.loadSelf().map(e => e.getDecodeInfo(library))

        return {
            type: "Emitter",
            emitters: emittersInfo
        };
    }
}

export default UEmitter;
export { UEmitter };