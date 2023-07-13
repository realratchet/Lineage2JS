import { FNTimeColor, FNTimeHSV, FNTimeScale } from "@client/assets/unreal/un-time-light";
import { UObject } from "@l2js/core";

abstract class UL2NTimeLight extends UObject {
    declare public readonly bLoaded: boolean;
    declare public readonly lightTerrain: C.FArray<FNTimeHSV>;
    declare public readonly lightActor: C.FArray<FNTimeHSV>;
    declare public readonly lightStaticMesh: C.FArray<FNTimeHSV>;
    declare public readonly lightBSP: C.FArray<FNTimeHSV>;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "bLoaded": "isLoaded",
            "TerrainLight": "lightTerrain",
            "ActorLight": "lightActor",
            "StaticMeshLight": "lightStaticMesh",
            "BSPLight": "lightBSP"
        });
    }
}

abstract class UL2EnvLight extends UL2NTimeLight {
    declare public readonly colorSky: C.FArray<FNTimeColor>;
    declare public readonly colorIndexHaze: C.FPrimitiveArray<"int32">;
    declare public readonly colorHaze: C.FArray<FNTimeColor>;
    declare public readonly colorIndexCloud: C.FPrimitiveArray<"int32">;
    declare public readonly colorCloud: C.FArray<FNTimeColor>;
    declare public readonly colorStar: C.FArray<FNTimeColor>;
    declare public readonly colorSun: C.FArray<FNTimeColor>;
    declare public readonly colorMoon: C.FArray<FNTimeColor>;

    declare public readonly ambientTerrain: C.FArray<FNTimeColor>;
    declare public readonly ambientActor: C.FArray<FNTimeColor>;
    declare public readonly ambientStaticMesh: C.FArray<FNTimeColor>;
    declare public readonly ambientBSP: C.FArray<FNTimeColor>;

    declare public readonly scaleSun: C.FArray<FNTimeScale>;
    declare public readonly scaleMoon: C.FArray<FNTimeScale>;

    declare public readonly envType: number;

    protected getPropertyMap(): Record<string, string> {
        return Object.assign({}, super.getPropertyMap(), {
            "SkyColor": "colorSky",
            "HazeColorIndex": "colorIndexHaze",
            "HazeColor": "colorHaze",
            "CloudColorIndex": "colorIndexCloud",
            "CloudColor": "colorCloud",
            "StarColor": "colorStar",
            "SunColor": "colorSun",
            "MoonColor": "colorMoon",
            "TerrainAmbient": "ambientTerrain",
            "ActorAmbient": "ambientActor",
            "StaticMeshAmbient": "ambientStaticMesh",
            "BSPAmbient": "ambientBSP",
            "SunScale": "scaleSun",
            "MoonScale": "scaleMoon",
            "EnvType": "envType"
        });
    }
}

export default UL2EnvLight;
export { UL2EnvLight, UL2NTimeLight };