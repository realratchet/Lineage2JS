import FZoneInfo, { type IInfo, type IBaseZoneDecodeInfo } from "./un-zone-info";
import type { ULevel } from "./un-level";
import type { DecodeLibrary } from "./decode-library";
import FColor from "./un-color";

export enum ENetMode_T { NM_Standalone = 0, NM_DedicatedServer = 1, NM_ListenServer = 2, NM_Client = 3 };

export abstract class ULevelInfo extends FZoneInfo implements IInfo {
    declare protected level: ULevel;

    public setLevel(level: ULevel) { this.level = level; }
    public getLevel() { return this.level; }

    public setSkyZoneInfo(skyZone: any) { this.skyZone = skyZone; }
    public getSkyZoneInfo() { return this.skyZone; }

    public getDecodeInfo(_library: DecodeLibrary): IBaseZoneDecodeInfo {
        return {
            type: "Sector",
            uuid: this.uuid,
            hasTerrain: this.hasTerrain,
            terrains: Array.from(this.terrains ?? [], terrain => terrain ? terrain.loadSelf().uuid : null),
            name: this.objectName,
            bounds: {
                isValid: false,
                min: [Infinity, Infinity, Infinity],
                max: [-Infinity, -Infinity, -Infinity]
            },
            children: [],
            ambient: this.ambientVector ? FColor.fromFloating(this.ambientVector.x, this.ambientVector.y, this.ambientVector.z).toArray() as number[] : undefined, // AActor::UpdateRenderData 0x7d00ac..0x7d011f: a zone without a ZoneActor takes Actors(0)'s AmbientVector
            fog: null
        };
    }
}

export default ULevelInfo;
