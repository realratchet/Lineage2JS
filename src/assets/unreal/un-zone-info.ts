import UAActor from "./un-aactor";
import FArray from "./un-array";
import FNumber from "./un-number";
import BufferValue from "../buffer-value";

class UZoneInfo extends UAActor {
    protected isFogZone: boolean;
    protected hasTerrain: boolean;
    
    protected useFogColorClear: boolean;
    
    protected ambientBrightness: number;
    protected ambientVector: FVector;

    protected killZ: number; // Any actor falling below this height falls out of the world. For Pawns this means they die, other actors usually get destroyed. The LevelInfo's KillZ shows as a red line in side-view orthogonal UnrealEd Viewports.

    protected readHeadOffset: number = 15;
    protected terrains: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bFogZone": "isFogZone",
            "bTerrainZone": "hasTerrain",
            "Terrains": "terrains",
            "AmbientBrightness": "ambientBrightness",
            "AmbientVector": "ambientVector",
            "KillZ": "killZ",
            "bClearToFogColor": "useFogColorClear"
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

    public doLoad(pkg: UPackage, exp: UExport<UZoneInfo>) {
        pkg.seek(this.readHead, "set");

    //     // for (let i = 0; i < (exp.size.value as number); i++) {
    //     //     const tag = PropertyTag.from(pkg, this.readHead + i);

    //     //     if (tag.name === "None") continue;

    //     //     console.log(`${this.readHeadOffset + i} => ${tag.index} '${tag.name}' (${tag.structName}) of size ${tag.dataSize}`);
    //     // }

    //     debugger;


        super.doLoad(pkg, exp);

        // debugger;

    //     console.log(this.bytesUnread);

    //     debugger;
    }
}

export default UZoneInfo;
export { UZoneInfo };