import UTexture from "./un-texture";

class UCubemap extends UTexture {
    protected faces = new Array<UTexture>(6);
    protected material: UShader;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Faces": "faces",
            "Material": "material"
        });
    }

    public getDecodeInfo(library: DecodeLibrary): Promise<string> {
        throw new Error("Method not implemented.");
    }
}

export default UCubemap;
export { UCubemap };