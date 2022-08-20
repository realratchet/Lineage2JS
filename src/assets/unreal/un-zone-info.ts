import UAActor from "./un-aactor";
import FArray from "./un-array";
import FNumber from "./un-number";
import BufferValue from "../buffer-value";

class UZoneInfo extends UAActor implements IInfo {
    protected isFogZone: boolean;
    protected hasTerrain: boolean;

    protected useFogColorClear: boolean;

    public ambientBrightness: number;
    public ambientVector: FVector;

    protected killZ: number; // Any actor falling below this height falls out of the world. For Pawns this means they die, other actors usually get destroyed. The LevelInfo's KillZ shows as a red line in side-view orthogonal UnrealEd Viewports.

    protected terrains: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);

    protected ambientHue: number;
    protected ambientSaturation: number;

    protected zoneTag: string;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bFogZone": "isFogZone",
            "bTerrainZone": "hasTerrain",
            "Terrains": "terrains",
            "AmbientBrightness": "ambientBrightness",
            "AmbientVector": "ambientVector",
            "KillZ": "killZ",
            "bClearToFogColor": "useFogColorClear",

            "AmbientHue": "ambientHue",
            "AmbientSaturation": "ambientSaturation",

            "ZoneTag": "zoneTag"
        });
    }

    // protected readNamedProps(pkg: UPackage) {
    //     pkg.seek(this.readHead, "set");
    //     do {
    //         const tag = PropertyTag.from(pkg, this.readHead);

    //         if (!tag.isValid()) break;

    //         this.promisesLoading.push(this.loadProperty(pkg, tag));
    //         this.readHead = pkg.tell();

    //         console.log(tag.name, this.bytesUnread);

    //     } while (this.readHead < this.readTail);

    //     // debugger;

    //     this.readHead = pkg.tell();

    //     // debugger;
    // }

    // protected preLoad(pkg: UPackage, exp: UExport): void {
    //     super.preLoad(pkg, exp);

    //     pkg.seek(exp.offset.value as number, "set");

    //     this.readStart = this.readHead = exp.offset.value as number;
    //     this.readTail = this.readHead + (exp.size.value as number);

    //     // debugger;

    //     const compat32 = new BufferValue(BufferValue.compat32);

    //     const a = new Array(17).fill(1).map(() => {
    //         const b = pkg.read(compat32).value;
    //         const offset = pkg.tell() - (exp.offset.value as number);

    //         return [b, offset];
    //     });

    //     debugger;
    // }

    public doLoad(pkg: UPackage, exp: UExport<UZoneInfo>) {
        pkg.seek(this.readHead, "set");

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const leftoverBytes = new Uint8Array(pkg.read(BufferValue.allocBytes(this.bytesUnread)).bytes.buffer);


    }

    async getDecodeInfo(library: DecodeLibrary): Promise<IZoneDecodeInfo> {
        await this.onLoaded();

        return {
            uuid: this.uuid,
            type: "Zone",
            name: this.objectName,
            bounds: { isValid: false, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
            children: [],
            fog: !this.hasDistanceFog || !this.distanceFogColor ? null : {
                start: this.distanceFogStart,
                end: this.distanceFogEnd,
                color: (this.distanceFogColor.toArray() as number[]).map(v => v / 255) as ColorArr
            }
        };
    }
}

export default UZoneInfo;
export { UZoneInfo };