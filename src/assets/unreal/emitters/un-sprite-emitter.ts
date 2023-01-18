import UParticleEmitter from "./un-particle-emitter"

class USpriteEmitter extends UParticleEmitter {
    protected sprite: UTexture;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "Texture": "sprite",
        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        return Object.assign(super.getDecodeInfo(library), {
            type: "SpriteEmitter",
            object: this.sprite?.loadSelf().getDecodeInfo(library)
        });
    }
}

export default USpriteEmitter;
export { USpriteEmitter };