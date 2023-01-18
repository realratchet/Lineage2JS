import UObject from "./un-object";

class UDecoLayer extends UObject {
    public readonly careUnread: boolean = false;

    protected showOnTerrain: number;
    protected scaleMap: UTexture;
    protected densityMap: UTexture;
    protected colorMap: UTexture;
    public staticMesh: UStaticMesh;
    protected scaleMultiplier: URangeVector;
    protected ambientSoundType: number[];
    protected size: number;
    protected fadeoutRadius: URange;
    protected densityMultiplier: URange;
    protected maxPerQuad: number;
    protected seed: number;
    protected alignToTerrain: number;
    protected drawOrder: number;
    protected isShowOnInvisibleTerrain: number;
    protected dirLighting: number;
    protected disregardTerrainLighting: number;
    protected randomYaw: number;
    protected isForcingRender: number;

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