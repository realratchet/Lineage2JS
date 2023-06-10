import UObject from "@l2js/core";

class UTerrainLayer extends UObject {
    public map: UTexture = null;
    public alphaMap: UTexture = null;
    public scaleW: number;
    public scaleH: number;
    protected panW: number;
    protected panH: number;
    protected mapAxis: number;
    protected mapRotation: number;
    protected layerRotation: FRotator;
    protected terrainMatrix: UMatrix;
    protected zPlane: FPlane;
    protected wPlane: FPlane;
    protected level: number[];
    protected friction: number;
    protected restitution: number;
    protected weightMap: UTexture;
    public scale: FVector;
    protected toWorld = new Set();
    protected toMaskmap = new Set();
    protected useAlpha: boolean;
    protected unkNum0: number;
    protected z: number;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Texture": "map",
            "AlphaMap": "alphaMap",
            "UScale": "scaleW",
            "VScale": "scaleH",
            "UPan": "panW",
            "VPan": "panH",
            "ZPlane": "zPlane",
            "WPlane": "wPlane",
            "TextureMapAxis": "mapAxis",
            "TextureRotation": "mapRotation",
            "LayerRotation": "layerRotation",
            "TerrainMatrix": "terrainMatrix",
            "Level": "level",
            "KFriction": "friction",
            "KRestitution": "restitution",
            "LayerWeightMap": "weightMap",
            "Scale": "scale",
            "ToWorld": "toWorld",
            "ToMaskmap": "toMaskmap",
            "bUseAlpha": "useAlpha"
        });
    }
}

export default UTerrainLayer;
export { UTerrainLayer };