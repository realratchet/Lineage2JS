import UTexture from "./un-texture";

class UCubemap extends UTexture {
    protected faces = new Array<UTexture>(6);
    protected material: UShader;

    protected _cubemapRenderInterface: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Faces": "faces",
            "CubemapRenderInterface": "_cubemapRenderInterface",
        });
    }

    public getDecodeInfo(library: DecodeLibrary): string {
        throw new Error("Method not implemented.");
    }
}

export default UCubemap;
export { UCubemap };