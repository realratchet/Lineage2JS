import UObject, { APackage, UExport } from "@l2js/core";
import AInfo from "./un-info";

abstract class UL2FogInfo extends AInfo {
    declare protected readonly affectRange: GA.FRange;
    declare protected readonly fogRange1: GA.FRange;
    declare protected readonly fogRange2: GA.FRange;
    declare protected readonly fogRange3: GA.FRange;
    declare protected readonly fogRange4: GA.FRange;
    declare protected readonly fogRange5: GA.FRange;
    declare protected readonly colors: C.FArray<UL2EnvironmentColorInfo>;
    declare protected readonly cloudTexture: GA.UMaterial;

    public getDecodeInfo(library: GD.DecodeLibrary) {
        return {
            type: "L2FogInfo",
            position: this.location ? this.location.getVectorElements() : [0, 0, 0],
            affectRange: this.affectRange.getDecodeInfo(library),
            fogRange1: this.fogRange1.getDecodeInfo(library),
            fogRange2: this.fogRange2.getDecodeInfo(library),
            fogRange3: this.fogRange3.getDecodeInfo(library),
            fogRange4: this.fogRange4.getDecodeInfo(library),
            fogRange5: this.fogRange5.getDecodeInfo(library),
            colors: this.colors.map(c => c.getDecodeInfo()),
            cloudTexture: this.cloudTexture?.getDecodeInfo(library) ?? null
        };
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "AffectRange": "affectRange",
            "FogRange1": "fogRange1",
            "FogRange2": "fogRange2",
            "FogRange3": "fogRange3",
            "FogRange4": "fogRange4",
            "FogRange5": "fogRange5",
            "Colors": "colors",
            "CloudTexture": "cloudTexture"
        });
    }
}

abstract class UL2EnvironmentColorInfo extends UObject {
    declare protected time: number;
    declare protected fogColor: GA.FColor;
    declare protected skyColor: GA.FColor;
    declare protected cloudColor: C.FArray<GA.FColor>;
    declare protected hazeringColor: C.FArray<GA.FColor>;

    public getDecodeInfo() {
        return {
            time: this.time,
            fogColor: this.fogColor.toArray(),
            skyColor: this.skyColor.toArray(),
            cloudColor: this.cloudColor?.map(c => c.toArray()) ?? [],
            hazeringColor: this.hazeringColor?.map(x => x.toArray()) ?? []
        };
    }

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Time": "time",
            "FogColor": "fogColor",
            "SkyColor": "skyColor",
            "CloudColor": "cloudColor",
            "HazeRingColor": "hazeringColor"
        });
    }
}

export default UL2FogInfo;
export { UL2FogInfo, UL2EnvironmentColorInfo };