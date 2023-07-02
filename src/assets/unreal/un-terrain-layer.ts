import UObject from "@l2js/core";

abstract class UTerrainLayer extends UObject {
    declare public readonly map: GA.UTexture;
    declare public readonly alphaMap: GA.UTexture;
    declare public readonly scaleW: number;
    declare public readonly scaleH: number;
    declare protected readonly panW: number;
    declare protected readonly panH: number;
    declare protected readonly mapAxis: number;
    declare protected readonly mapRotation: number;
    declare protected readonly layerRotation: GA.FRotator;
    declare protected readonly terrainMatrix: GA.FMatrix;
    declare protected readonly zPlane: GA.FPlane;
    declare protected readonly wPlane: GA.FPlane;
    declare protected readonly level: number[];
    declare protected readonly friction: number;
    declare protected readonly restitution: number;
    declare protected readonly weightMap: GA.UTexture;
    declare public readonly scale: GA.FVector;
    declare protected readonly toWorld: any;
    declare protected readonly toMaskmap: any;
    declare protected readonly useAlpha: boolean;
    declare protected readonly unkNum0: number;
    declare protected readonly z: number;

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