import UParticleEmitter from "./un-particle-emitter"

class USpriteEmitter extends UParticleEmitter {
    protected sprite: UTexture;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "Texture": "sprite",
        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        const decodeInfo = super.getDecodeInfo(library);

        return Object.assign(decodeInfo, {
            type: "SpriteEmitter",
            sprite: this.sprite?.loadSelf().getDecodeInfo(library)
        });
    }
}

export default USpriteEmitter;
export { USpriteEmitter };