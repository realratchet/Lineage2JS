import UTexture from "./un-texture";

abstract class UCubemap extends UTexture {
    declare protected faces: [UTexture, UTexture, UTexture, UTexture, UTexture, UTexture];

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Faces": "faces"
        });
    }
}

export default UCubemap;
export { UCubemap };