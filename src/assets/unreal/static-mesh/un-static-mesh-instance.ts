import UObject from "../un-object";
import BufferValue from "../../buffer-value";
import FConstructable from "../un-constructable";
import FRawColorStream from "../un-raw-color-stream";
import FArray, { FPrimitiveArray } from "../un-array";

class FAssignedLight extends FConstructable {
    public lightIndex: number; // seems to be light index
    public unkArray0 = new FPrimitiveArray(BufferValue.uint8);
    public unkInt0: number;

    public light: ULight;

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const int32 = new BufferValue(BufferValue.int32);

        this.lightIndex = pkg.read(compat32).value as number;
        this.unkArray0 = this.unkArray0.load(pkg).getTypedArray() as any;
        this.unkInt0 = pkg.read(int32).value as number;

        this.promisesLoading.push(new Promise<void>(async resolve => {

            this.light = await pkg.fetchObject<ULight>(this.lightIndex);

            resolve();
        }));

        // debugger;

        return this;
    }
}

class UStaticMeshInstance extends UObject {
    protected colorStream = new FRawColorStream();

    protected sceneLights: FArray<FAssignedLight> = new FArray(FAssignedLight as any);
    protected unkLights1: FArray<FAssignedLight> = new FArray(FAssignedLight as any);

    protected unkArrIndex: number[];

    protected actor: UStaticMeshActor;

    public setActor(actor: UStaticMeshActor) { this.actor = actor; }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<any> {
        await this.onLoaded();

        const allLights = [...this.sceneLights/*, ...this.unkLights1*/];
        const filteredMapsDict = Object.assign({}, ...allLights.map(x => ({ [x.lightIndex]: x.light })));
        const filteredMaps = (Object.values(filteredMapsDict) as ULight[]);//.filter(l => l.getZone() === this.actor.getZone());

        return await Promise.all(filteredMaps.map((l: ULight) => l.getDecodeInfo(library)));
    }

    protected doLoad(pkg: UPackage, exp: UExport): this {
        // basemodel id 7364 -> export 7363
        // level id 5 -> export 4
        // umodel has 1888 lightmap sufraces with 9 textures
        // 1888 x 9
        // vertices 238
        // faces 390
        // material 18


        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();
        const compat32 = new BufferValue(BufferValue.compat32);

        super.doLoad(pkg, exp);

        if (verArchive < 0x70) {
            console.warn("Unsupported yet");
            debugger;
        } else this.colorStream.load(pkg);  // this is not always 0! need to add this

        this.readHead = pkg.tell();

        if (0x6D < verArchive) this.sceneLights.load(pkg);
        if (0x03 < verLicense) this.unkLights1.load(pkg);
        if (0x0B < verLicense) this.unkArrIndex = new Array(2).fill(1).map(_ => pkg.read(compat32).value as number);

        this.readHead = pkg.tell();

        console.assert(this.readHead === this.readTail, "Should be zero");

        // debugger;

        return this;
    }
}

export default UStaticMeshInstance;
export { UStaticMeshInstance };