import AInfo from "./un-info";

abstract class FZoneInfo extends AInfo/* implements IInfo*/ {
    declare public readonly isFogZone: boolean;
    declare public readonly hasTerrain: boolean;

    declare public readonly useFogColorClear: boolean;

    declare public readonly ambientBrightness: number;
    declare public readonly ambientVector: GA.FVector;

    declare public readonly killZ: number; // Any actor falling below this height falls out of the world. For Pawns this means they die, other actors usually get destroyed. The LevelInfo's KillZ shows as a red line in side-view orthogonal UnrealEd Viewports.
    declare public readonly killZType: number;
    declare public readonly isSoftKillZ: boolean;

    declare public readonly terrains: C.FArray<C.FNumber<"compat32">>;

    declare public readonly ambientHue: number;
    declare public readonly ambientSaturation: number;

    declare public readonly zoneTag: string;

    declare public readonly lensFlare: any[];
    declare public readonly lensFlareOffset: any[];
    declare public readonly lensFlareScale: any[];

    declare public readonly  panSpeedU: number;
    declare public readonly  panSpeedV: number;

    declare public readonly  skyZone: any;
    declare public readonly  locationName: any;
    declare public readonly  distanceFogBlendTime: any;
    declare public readonly  environmentMap: any;
    declare public readonly  zoneEffect: any;
    declare public readonly  isLonelyZone: boolean;
    declare public readonly  manualExcludes: any;

    declare public readonly  timeSeconds: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bFogZone": "isFogZone",
            "bTerrainZone": "hasTerrain",
            "Terrains": "terrains",
            "AmbientBrightness": "ambientBrightness",
            "AmbientVector": "ambientVector",
            "KillZ": "killZ",
            "KillZType": "killZType",
            "bSoftKillZ": "isSoftKillZ",
            "bClearToFogColor": "useFogColorClear",

            "AmbientHue": "ambientHue",
            "AmbientSaturation": "ambientSaturation",

            "ZoneTag": "zoneTag",

            "LensFlare": "lensFlare",
            "LensFlareOffset": "lensFlareOffset",
            "LensFlareScale": "lensFlareScale",

            "TexUPanSpeed": "panSpeedU",
            "TexVPanSpeed": "panSpeedV",

            "SkyZone": "skyZone",
            "LocationName": "locationName",
            "DistanceFogBlendTime": "distanceFogBlendTime",
            "EnvironmentMap": "environmentMap",
            "ZoneEffect": "zoneEffect",
            "bLonelyZone": "isLonelyZone",
            "ManualExcludes": "manualExcludes",

            "TimeSeconds": "timeSeconds"
        });
    }

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