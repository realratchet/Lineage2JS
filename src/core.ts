import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";
import assetList from "./assets/asset-list";
import UTerrainInfo from "./assets/unreal/un-terrain-info";
import UTerrainSector from "./assets/unreal/un-terrain-sector";
import UTexture from "./assets/unreal/un-texture";
import UStaticMesh from "./assets/unreal/static-mesh/un-static-mesh";
import { Box3, Vector3, Object3D } from "three";
import BufferValue from "./assets/buffer-value";
import UStaticMeshIsntance from "./assets/unreal/static-mesh/un-static-mesh-instance";
import UModel from "./assets/unreal/model/un-model";
import UExport from "./assets/unreal/un-export";
import UBrush from "./assets/unreal/un-brush";

async function loadMesh() {
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);
    const assetLoader = new AssetLoader(assetList);
    const pkg = assetLoader.getPackage("field_deco_S");

    await assetLoader.load(pkg);

    // const meshData = pkg.exports.find(exp => exp.objectName === "talking_island_rock01");
    const exp = pkg.exports.find(exp => exp.objectName === "talking_island_rock02_LOD");
    // const exp = pkg.exports.find(exp => exp.objectName === "inna_underwater_star");
    // debugger;
    // for (let exp of pkg.exports) {
    // if (exp.idClass.value !== -2) continue;

    const umesh = await pkg.createObject(pkg, exp, "StaticMesh") as UStaticMesh;
    const mesh = await umesh.decodeMesh();

    renderManager.scene.add(mesh);
    // }


    renderManager.startRendering();
}

// export default loadMesh;

async function loadTexture() {
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const assetLoader = new AssetLoader(assetList);
    const pkg = assetLoader.getPackage("T_Dion");

    await assetLoader.load(pkg);

    const texData = pkg.exports.find(exp => exp.objectName === "DI_C5");
    const utexture = await pkg.createObject(pkg, texData, "Texture") as UTexture;
    const texture = await utexture.decodeMipmap(0);

    const canvas = document.createElement("canvas");
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;

    const ctx2d = canvas.getContext("2d");
    const imdata = ctx2d.createImageData(texture.image.width, texture.image.height);
    imdata.data.set(texture.image.data);
    ctx2d.putImageData(imdata, 0, 0);

    viewport.appendChild(canvas);
}

// export default loadTexture;

async function startCore() {
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);
    const assetLoader = new AssetLoader(assetList);
    // const pkg_20_19 = assetLoader.getPackage("20_19");
    // const pkg_20_20 = assetLoader.getPackage("20_20");
    const pkg_20_21 = assetLoader.getPackage("20_21");
    const pkg_20_22 = assetLoader.getPackage("20_22");

    const pkgLoad = pkg_20_21;

    await assetLoader.load(pkgLoad);

    // await assetLoader.load(pkg_20_19);
    // await assetLoader.load(pkg_20_20);
    // await assetLoader.load(pkg_20_21);

    const expGroups = pkgLoad.exports.reduce((accum, exp) => {

        const expType = pkgLoad.getPackageName(exp.idClass.value as number);
        const list = accum[expType] = accum[expType] || [];

        list.push(exp);

        return accum;
    }, {} as { [key: string]: UExport[] });

    const expTerrainInfo = expGroups.TerrainInfo[0];
    const expTerrainSectors = expGroups.TerrainSector
        .sort(({ objectName: na }, { objectName: nb }) => {
            const a = parseInt(na.replace("TerrainSector", ""));
            const b = parseInt(nb.replace("TerrainSector", ""));
            return a - b;
        });

    const filteredSectors = expTerrainSectors
    const objectGroup = new Object3D();

    // expGroups.Brush
    //     .sort(({ objectName: na }, { objectName: nb }) => {
    //         const a = parseInt(na.replace("Brush", ""));
    //         const b = parseInt(nb.replace("Brush", ""));
    //         return a - b;
    //     })
    //     .slice(0, 3).forEach(exp => {
    //         console.log(exp.objectName);
    //         pkgLoad.seek(exp.offset.value as number + 10, "set");
    //         pkgLoad.dump(1, true, false)
    //     });

    // debugger;

    for (let exp of expGroups.Brush) {
        const uBrush = await new UBrush().load(pkgLoad, exp);

        debugger;
    }

    for (let exp of expMeshes) {
        const uMesh = await new UStaticMesh().load(pkgLoad, exp);
        const mesh = await uMesh.decodeMesh();

        objectGroup.add(mesh);

        debugger;
    }

    const uTerrain = await new UTerrainInfo(filteredSectors).load(pkgLoad, expTerrainInfo);
    const terrain = await uTerrain.decodeMesh();
    objectGroup.add(terrain);


    const boundingBox = new Box3().setFromObject(boundingBox);
    const boxSize = boundingBox.getSize(new Vector3());
    // terrain.scale.set(0.001, 0.001, 0.001);
    terrain.position.y = -boundingBox.min.y;

    // console.log(boxSize.toArray().join(", "));

    renderManager.scene.add(objectGroup);
    renderManager.startRendering();

    (global as any).renderManager = renderManager;

    // for (let exp of expTerrainSector.slice(0, 2)) {
    //     const t = await new UTerrainSector().load(pkg, exp);
    //     debugger;
    // }

    // // const sectors = await Promise.all(expTerrainSector.map(async exp => await new UTerrainSector().load(pkg, exp)));

    // console.log("terrain loading done");

    // const renderManager = new RenderManager(viewport);
}

export default startCore;
export { startCore };