import BufferValue from "../buffer-value";
import UAActor from "./un-aactor";
import FArray from "./un-array";
import FNumber from "./un-number";

class UNSun extends UAActor {
    protected radius: number;
    protected limitMaxRadius: number;
    protected isDirectional: boolean;
    protected skinIndices: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);
    protected skins: UTexture[];

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Radius": "radius",
            "LimitMaxRadius": "limitMaxRadius",
            "Skins": "skinIndices",
            "bDirectional": "isDirectional"
        });
    }

    public doLoad(pkg: UPackage, exp: UExport) {
        super.doLoad(pkg, exp);

        this.promisesLoading.push(new Promise<void>(async resolve => {

            this.skins = await Promise.all(
                this.skinIndices.map(async (index: FNumber) => {
                    return await pkg.fetchObject<UTexture>(index.value);
                })
            );

            resolve();
        }));
    }

    async getDecodeInfo(library: any): Promise<any> {
        await this.onLoaded();

        const sprites = await Promise.all(this.skins.map(skin => skin.getDecodeInfo(library)));

        return {
            type: "Sun",
            sprites
        };
    }
}

export default UNSun;
export { UNSun };