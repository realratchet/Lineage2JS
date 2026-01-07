import UObject from "@l2js/core";

enum TextureMapAxis_T {
    TEXMAPAXIS_XY = 0,
    TEXMAPAXIS_XZ = 1,
    TEXMAPAXIS_YZ = 2,
    TEXMAPAXIS_MAX = 3,
};

abstract class UTerrainLayer extends UObject {
    declare public readonly map: GA.UTexture;
    declare public readonly alphaMap: GA.UTexture;
    declare public readonly scaleW: number;
    declare public readonly scaleH: number;
    declare public readonly panW: number;
    declare public readonly panH: number;
    declare public readonly mapAxis: TextureMapAxis_T;
    declare public readonly mapRotation: number;
    declare public readonly layerRotation: GA.FRotator;
    declare public readonly terrainMatrix: GA.FMatrix;
    declare public readonly level: number[];
    declare public readonly friction: number;
    declare public readonly restitution: number;
    declare public readonly weightMap: GA.UTexture;
    declare public readonly scale: GA.FVector;
    declare public readonly toWorld: any;
    declare public readonly toMaskmap: any;
    declare public readonly useAlpha: boolean;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "Texture": "map",
            "AlphaMap": "alphaMap",
            "UScale": "scaleW",
            "VScale": "scaleH",
            "Scale": "scale",
            "UPan": "panW",
            "VPan": "panH",
            "TextureMapAxis": "mapAxis",
            "TextureRotation": "mapRotation",
            "LayerRotation": "layerRotation",
            "TerrainMatrix": "terrainMatrix",
            "KFriction": "friction",
            "KRestitution": "restitution",
            "LayerWeightMap": "weightMap",
            "ToWorld": "toWorld",
            "ToMaskmap": "toMaskmap",
            "bUseAlpha": "useAlpha"
        });
    }
}

export default UTerrainLayer;
export { UTerrainLayer, TextureMapAxis_T };