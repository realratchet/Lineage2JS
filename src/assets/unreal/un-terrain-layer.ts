import UObject from "@l2js/core";

class UTerrainLayer extends UObject {
    declare public map: GA.UTexture;
    declare public alphaMap: GA.UTexture;
    declare public scaleW: number;
    declare public scaleH: number;
    declare protected panW: number;
    declare protected panH: number;
    declare protected mapAxis: number;
    declare protected mapRotation: number;
    declare protected layerRotation: GA.FRotator;
    declare protected terrainMatrix: GA.FMatrix;
    declare protected zPlane: GA.FPlane;
    declare protected wPlane: GA.FPlane;
    declare protected level: number[];
    declare protected friction: number;
    declare protected restitution: number;
    declare protected weightMap: GA.UTexture;
    declare public scale: GA.FVector;
    declare protected toWorld: any;
    declare protected toMaskmap: any;
    declare protected useAlpha: boolean;
    declare protected unkNum0: number;
    declare protected z: number;

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