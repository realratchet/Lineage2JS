import type { FObjectArray } from "@l2js/core";
import AInfo from "./un-info";
import FColor from "./un-color";
import type { FVector } from "./un-vector";
import type { ATerrainInfo } from "./un-terrain-info";
import type { DecodeLibrary, IBaseObjectOrInstanceDecodeInfo } from "./decode-library";
import type { ColorArr, Vector2Arr, Vector3Arr } from "./library-types";
import type { IBoxDecodeInfo } from "./un-box";

type IInfo = { getDecodeInfo(library: DecodeLibrary): IBaseZoneDecodeInfo; };

type IZoneDecodeInfo = IBaseZoneDecodeInfo & { type: "Zone" };

type ISkyZoneDecodeInfo = IBaseZoneDecodeInfo & { type: "Sky" };

type ISectorDecodeInfo = IBaseZoneDecodeInfo & { type: "Sector" };

type IZoneFogInfo = {
    start: number,
    end: number,
    color: ColorArr
};

type IBaseZoneDecodeInfo = {
    type: "Sector" | "Zone" | "Sky",
    uuid: string,
    name?: string,
    bounds: IBoxDecodeInfo,
    children: IBaseObjectOrInstanceDecodeInfo[],
    fog?: IZoneFogInfo,
    isFogZone?: boolean,
    isSunAffected?: boolean,
    position?: Vector3Arr,
    affectRange?: Vector2Arr,
    fogRange1?: Vector2Arr,
    fogRange2?: Vector2Arr,
    fogRange3?: Vector2Arr,
    fogRange4?: Vector2Arr,
    fogRange5?: Vector2Arr,
    ambient?: number[],
    colors?: any[]
};

abstract class FZoneInfo extends AInfo implements IInfo {
    declare public readonly isFogZone: boolean;
    declare public readonly hasTerrain: boolean;

    declare public readonly useFogColorClear: boolean;

    declare public readonly brightness: number;
    declare public readonly ambientBrightness: number;
    declare public readonly ambientVector: FVector;

    declare public readonly killZ: number; // Any actor falling below this height falls out of the world. For Pawns this means they die, other actors usually get destroyed. The LevelInfo's KillZ shows as a red line in side-view orthogonal UnrealEd Viewports.
    declare public readonly killZType: number;
    declare public readonly isSoftKillZ: boolean;

    declare public readonly terrains: FObjectArray<ATerrainInfo>;

    declare public readonly ambientHue: number;
    declare public readonly ambientSaturation: number;

    declare public readonly zoneTag: string;

    declare public readonly lensFlare: any[];
    declare public readonly lensFlareOffset: any[];
    declare public readonly lensFlareScale: any[];

    declare public readonly panSpeedU: number;
    declare public readonly panSpeedV: number;

    declare public skyZone: any;
    declare public readonly locationName: any;
    declare public readonly distanceFogBlendTime: any;
    declare public readonly environmentMap: any;
    declare public readonly zoneEffect: any;
    declare public readonly isLonelyZone: boolean;
    declare public readonly manualExcludes: any;

    declare public readonly timeSeconds: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "bFogZone": "isFogZone",
            "bTerrainZone": "hasTerrain",
            "Terrains": "terrains",
            "Brightness": "brightness",
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

    public getDecodeInfo(library: DecodeLibrary): IBaseZoneDecodeInfo {
        return {
            uuid: this.uuid,
            type: "Zone",
            name: this.objectName,
            bounds: { isValid: false, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
            children: [],
            position: this.location ? [this.location.x, this.location.y, this.location.z] : [0, 0, 0],
            isFogZone: this.isFogZone,
            isSunAffected: this.isSunAffected,
            ambient: this.ambientVector ? FColor.fromFloating(this.ambientVector.x, this.ambientVector.y, this.ambientVector.z).toArray() as number[] : undefined,
            fog: !this.hasDistanceFog || !this.distanceFogColor ? null : {
                start: this.distanceFogStart,
                end: this.distanceFogEnd,
                color: (this.distanceFogColor.toArray() as number[]).map(v => v / 255) as ColorArr
            }
        };
    }
}

export default FZoneInfo;
export { FZoneInfo };
export type { IInfo, IZoneDecodeInfo, ISkyZoneDecodeInfo, ISectorDecodeInfo, IZoneFogInfo, IBaseZoneDecodeInfo };
