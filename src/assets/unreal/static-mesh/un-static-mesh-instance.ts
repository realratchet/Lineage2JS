import UObject from "../un-object";
import BufferValue from "../../buffer-value";
import FConstructable from "../un-constructable";
import FRawColorStream from "../un-raw-color-stream";
import FArray, { FPrimitiveArray } from "../un-array";
import { selectByTime, staticMeshLight } from "../un-time-list";

class FAssignedLight extends FConstructable {
    public lightIndex: number; // seems to be light index
    public vertexFlags = new FPrimitiveArray(BufferValue.uint8);
    public unkInt0: number;

    public light: ULight;

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const int32 = new BufferValue(BufferValue.int32);

        this.lightIndex = pkg.read(compat32).value as number;
        this.vertexFlags.load(pkg);
        this.unkInt0 = pkg.read(int32).value as number;

        this.promisesLoading.push(new Promise<void>(async resolve => {

            this.light = await pkg.fetchObject<ULight>(this.lightIndex);

            resolve();
        }));

        // debugger;

        return this;
    }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<any> {

        await Promise.all(this.promisesLoading);

        return {
            vertexFlags: this.vertexFlags.getTypedArray(),
            ...(await this.light.getDecodeInfo(library))
        };
    }
}

class UStaticMeshInstance extends UObject {
    protected colorStream = new FRawColorStream();

    protected sceneLights: FArray<FAssignedLight> = new FArray(FAssignedLight as any);
    protected environmentLights: FArray<FAssignedLight> = new FArray(FAssignedLight as any);

    protected unkArrIndex: number[];

    protected actor: UStaticMeshActor;

    public setActor(actor: UStaticMeshActor) { this.actor = actor; }

    public async getDecodeInfo(library: IDecodeLibrary): Promise<any> {
        await this.onLoaded();

        const color = new Float32Array(this.colorStream.color.length * 3);

        for (let i = 0, len = this.colorStream.color.length; i < len; i++) {
            const { r, g, b } = this.colorStream.color[i] as FColor;
            const offset = i * 3;

            color[offset + 0] = r / 255;
            color[offset + 1] = g / 255;
            color[offset + 2] = b / 255;
        }

        const timeOfDay = 12;

        let validEnvironment: FAssignedLight = null;
        let startIndex: number, finishIndex: number;
        let startTime: number, finishTime: number;

        let lightingColor: [number, number, number];

        for (let i = 0, len = this.environmentLights.length; i < len; i++) {
            const timeForIndex = indexToTime(i, len);

            if ((Number(timeForIndex < timeOfDay) << 0x8 | Number(timeForIndex === timeOfDay) << 0xe) === 0x0) {
                validEnvironment = this.environmentLights[i];
                startIndex = i;
                finishIndex = i + 1;
                startTime = timeForIndex;
                finishTime = indexToTime(finishIndex, len);
                lightingColor = selectByTime(timeOfDay, staticMeshLight).getColor();

                break;
            }
        }

        return {
            color,
            lights: {
                scene: await Promise.all(this.sceneLights.map(l => l.getDecodeInfo(library))),
                environment: validEnvironment ? {
                    color: lightingColor,
                    ...await validEnvironment.getDecodeInfo(library)
                } : null
            }
        };

        // const allLights = [...this.sceneLights/*, ...this.unkLights1*/];
        // const filteredMapsDict = Object.assign({}, ...allLights.map(x => ({ [x.lightIndex]: x.light })));
        // const filteredMaps = (Object.values(filteredMapsDict) as ULight[]);//.filter(l => l.getZone() === this.actor.getZone());

        // return await Promise.all(filteredMaps.map((l: ULight) => l.getDecodeInfo(library)));
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
        if (0x03 < verLicense) this.environmentLights.load(pkg);
        if (0x0B < verLicense) this.unkArrIndex = new Array(2).fill(1).map(_ => pkg.read(compat32).value as number);

        this.readHead = pkg.tell();

        console.assert(this.readHead === this.readTail, "Should be zero");

        return this;
    }
}

export default UStaticMeshInstance;
export { UStaticMeshInstance };


function indexToTime(index: number, totalElements: number) {
    return (24.0 / totalElements) * 0.5 + (index * 24.0) / totalElements;
}

