import UObject from "@l2js/core";

class UDecoLayer extends UObject {
    public readonly careUnread: boolean = false;

    declare protected showOnTerrain: number;
    declare protected scaleMap: GA.UTexture;
    declare protected densityMap: GA.UTexture;
    declare protected colorMap: GA.UTexture;
    declare public staticMesh: GA.UStaticMesh;
    declare protected scaleMultiplier: GA.FRangeVector;
    declare protected ambientSoundType: number[];
    declare protected size: number;
    declare protected fadeoutRadius: GA.FRange;
    declare protected densityMultiplier: GA.FRange;
    declare protected maxPerQuad: number;
    declare protected seed: number;
    declare protected alignToTerrain: number;
    declare protected drawOrder: number;
    declare protected isShowOnInvisibleTerrain: number;
    declare protected dirLighting: number;
    declare protected disregardTerrainLighting: number;
    declare protected randomYaw: number;
    declare protected isForcingRender: number;

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