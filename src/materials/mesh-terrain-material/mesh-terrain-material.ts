import { ShaderMaterial, Uniform, Color, Matrix3 } from "three";

class MeshTerrainMaterial extends ShaderMaterial {
    // @ts-ignore
    constructor(info: MeshTerrainMaterialParameters) {
        const defines: { [key: string]: any } = {};
        const uniforms: { [key: string]: Uniform } = {
            alphaTest: new Uniform(1e-3),
            diffuse: new Uniform(new Color(1, 1, 1)),
            opacity: new Uniform(1),
            uvTransform: new Uniform(new Matrix3()),
            transformSpecular: new Uniform(null),
        };

        info.layers.forEach((layer, i) => {
            if (!layer) return;

            defines[`USE_UV${i === 0 ? "" : i + 1}`] = "";
            defines[`USE_MAP${i === 0 ? "" : `_${i + 1}`}`] = "";
            Object.assign(uniforms[`map${i === 0 ? "" : i + 1}`].value = {}, layer.uniforms);

            debugger;
        });

        super();
    }
}

export default MeshTerrainMaterial;
export { MeshTerrainMaterial };

type MeshTerrainMaterialParameters = {
    layers: IDecodedParameter[]
};