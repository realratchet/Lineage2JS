import UObject from "./un-object";
import { PropertyTag } from "./un-property";
import { Euler } from "three";

type UPackage = import("./un-package").UPackage;
type UExport = import("./un-export").UExport;
type UTexture = import("./un-texture").UTexture;
type UStaticMesh = import("./static-mesh/un-static-mesh").UStaticMesh;
type URangeVector = import("./un-range").URangeVector;
type URange = import("./un-range").URange;

class UDecoLayer extends UObject {
    public static readonly typeSize: number = 128;
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

    public async load(pkg: UPackage, exp: UExport): Promise<this> {
        this.readHead = pkg.tell();
        this.readTail = this.readHead + this.size;

        await this.readNamedProps(pkg);

        pkg.seek(this.readTail, "set");

        return this;
    }
}

export default UDecoLayer;
export { UDecoLayer };