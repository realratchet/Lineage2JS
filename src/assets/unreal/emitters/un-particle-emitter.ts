import UObject from "../un-object";

class UParticleEmitter extends UObject {
    protected name: string;

    public getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "Name": "name",
        });
    }

    public getDecodeInfo(library: DecodeLibrary) {
        // debugger;

        return {
            name: this.name
        };
    }
}

export default UParticleEmitter;
export { UParticleEmitter };