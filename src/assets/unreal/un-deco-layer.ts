import UObject from "./un-object";

class UDecoLayer extends UObject {
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
    protected dirLightning: number;
    protected disregardTerrainLighting: number;
    protected randomYaw: number;
    protected isForcingRender: number;

    public constructor(size: number) {
        super();

        this.size = size;
    }

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
            "LitDirectional": "dirLightning",
            "DisregardTerrainLighting": "disregardTerrainLighting",
            "RandomYaw": "randomYaw",
            "bForceRender": "isForcingRender"
        });
    }

    public preLoad(pkg: UPackage, exp: UExport) { 
        this.readHead = pkg.tell();
        this.readTail = this.readHead + this.size;
    }

    public doLoad(pkg: UPackage, exp: UExport): this {

        this.readNamedProps(pkg);

        pkg.seek(this.readTail, "set");

        return this;
    }
}

export default UDecoLayer;
export { UDecoLayer };