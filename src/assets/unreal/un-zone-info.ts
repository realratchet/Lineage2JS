import AInfo from "./un-info";
import { BufferValue } from "@l2js/core";

class FZoneInfo extends AInfo/* implements IInfo*/ {
    // protected isFogZone: boolean;
    // protected hasTerrain: boolean;

    // protected useFogColorClear: boolean;

    // public ambientBrightness: number;
    // public ambientVector: FVector;

    // protected killZ: number; // Any actor falling below this height falls out of the world. For Pawns this means they die, other actors usually get destroyed. The LevelInfo's KillZ shows as a red line in side-view orthogonal UnrealEd Viewports.
    // protected killZType: number;
    // protected isSoftKillZ: boolean;

    // protected terrains: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);

    // protected ambientHue: number;
    // protected ambientSaturation: number;

    // protected zoneTag: string;

    // protected lensFlare = new Set();
    // protected lensFlareOffset = new Set();
    // protected lensFlareScale = new Set();

    // protected panSpeedU: number;
    // protected panSpeedV: number;

    // protected skyZone: any;
    // protected locationName: any;
    // protected distanceFogBlendTime: any;
    // protected environmentMap: any;
    // protected zoneEffect: any;
    // protected isLonelyZone: boolean;
    // protected manualExcludes: any;

    // protected getPropertyMap() {
    //     return Object.assign({}, super.getPropertyMap(), {
    //         "bFogZone": "isFogZone",
    //         "bTerrainZone": "hasTerrain",
    //         "Terrains": "terrains",
    //         "AmbientBrightness": "ambientBrightness",
    //         "AmbientVector": "ambientVector",
    //         "KillZ": "killZ",
    //         "KillZType": "killZType",
    //         "bSoftKillZ": "isSoftKillZ",
    //         "bClearToFogColor": "useFogColorClear",

    //         "AmbientHue": "ambientHue",
    //         "AmbientSaturation": "ambientSaturation",

    //         "ZoneTag": "zoneTag",

    //         "LensFlare": "lensFlare",
    //         "LensFlareOffset": "lensFlareOffset",
    //         "LensFlareScale": "lensFlareScale",

    //         "TexUPanSpeed": "panSpeedU",
    //         "TexVPanSpeed": "panSpeedV",

    //         "SkyZone": "skyZone",
    //         "LocationName": "locationName",
    //         "DistanceFogBlendTime": "distanceFogBlendTime",
    //         "EnvironmentMap": "environmentMap",
    //         "ZoneEffect": "zoneEffect",
    //         "bLonelyZone": "isLonelyZone",
    //         "ManualExcludes": "manualExcludes",
    //     });
    // }

    // public doLoad(pkg: UPackage, exp: UExport<FZoneInfo>) {
    //     pkg.seek(this.readHead, "set");

    //     const verArchive = pkg.header.getArchiveFileVersion();
    //     const verLicense = pkg.header.getLicenseeVersion();

    //     super.doLoad(pkg, exp);

    //     this.readHead = pkg.tell();

    //     const leftoverBytes = new Uint8Array(pkg.read(BufferValue.allocBytes(this.bytesUnread)).bytes.buffer);

    // }

    public getDecodeInfo(library: GD.DecodeLibrary): GD.IZoneDecodeInfo {
        return {
            uuid: this.uuid,
            type: "Zone",
            name: this.objectName,
            bounds: { isValid: false, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
            children: [],
            fog: !this.hasDistanceFog || !this.distanceFogColor ? null : {
                start: this.distanceFogStart,
                end: this.distanceFogEnd,
                color: (this.distanceFogColor.toArray() as number[]).map(v => v / 255) as GD.ColorArr
            }
        };
    }
}

export default FZoneInfo;
export { FZoneInfo };