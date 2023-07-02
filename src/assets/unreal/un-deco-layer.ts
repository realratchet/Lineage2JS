import UObject from "@l2js/core";

abstract class UDecoLayer extends UObject {
    declare protected readonly showOnTerrain: number;
    declare protected readonly scaleMap: GA.UTexture;
    declare protected readonly densityMap: GA.UTexture;
    declare protected readonly colorMap: GA.UTexture;
    declare public readonly staticMesh: GA.UStaticMesh;
    declare protected readonly scaleMultiplier: GA.FRangeVector;
    declare protected readonly ambientSoundType: number[];
    declare protected readonly size: number;
    declare protected readonly fadeoutRadius: GA.FRange;
    declare protected readonly densityMultiplier: GA.FRange;
    declare protected readonly maxPerQuad: number;
    declare protected readonly seed: number;
    declare protected readonly alignToTerrain: number;
    declare protected readonly drawOrder: number;
    declare protected readonly isShowOnInvisibleTerrain: number;
    declare protected readonly dirLighting: number;
    declare protected readonly disregardTerrainLighting: number;
    declare protected readonly randomYaw: number;
    declare protected readonly isForcingRender: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "ShowOnTerrain": "showOnTerrain",
            "ScaleMap": "scaleMap",
            "DensityMap": "densityMap",
            "ColorMap": "colorMap",
            "StaticMesh": "staticMesh",
            "ScaleMultiplier": "scaleMultiplier",
            "Seed": "seed",
            "AlignToTerrain": "alignToTerrain",
            "AmbientSoundType": "ambientSoundType",
            "FadeoutRadius": "fadeoutRadius",
            "DensityMultiplier": "densityMultiplier",
            "MaxPerQuad": "maxPerQuad",
            "DrawOrder": "drawOrder",
            "ShowOnInvisibleTerrain": "isShowOnInvisibleTerrain",
            "LitDirectional": "dirLighting",
            "DisregardTerrainLighting": "disregardTerrainLighting",
            "RandomYaw": "randomYaw",
            "bForceRender": "isForcingRender"
        });
    }
}

export default UDecoLayer;
export { UDecoLayer };