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

    // let str = "";
    // [...pkg.exports]
    //     .sort(({ offset: { value: a } }, { offset: { value: b } }) => {
    //         return (a as number) - (b as number);
    //     })
    //     .forEach(exp => {
    //         str = str + `${exp.objectName}:, ${exp.offset.value as number}, ${exp.size.value as number}\n`;
    //     });

    // console.log(str);

    // throw new Error("dicks");

    // debugger;

    const expGroups = pkgLoad.exports.reduce((accum, exp) => {

        const expType = pkgLoad.getPackageName(exp.idClass.value as number);
        const list = accum[expType] = accum[expType] || [];

        list.push(exp);

        return accum;
    }, {});

    debugger;

    const expMeshesInstances = pkgLoad.exports.filter(e => pkgLoad.getPackageName(e.idClass.value as number) === "StaticMeshInstance");
    const expMeshes = pkgLoad.exports.filter(e => pkgLoad.getPackageName(e.idClass.value as number) === "StaticMesh");
    const expTerrainInfo = pkgLoad.exports.find(e => pkgLoad.getPackageName(e.idClass.value as number) === "TerrainInfo");
    const expTerrainSectors = pkgLoad.exports
        .filter(e => pkgLoad.getPackageName(e.idClass.value as number) === "TerrainSector")
        .sort(({ objectName: na }, { objectName: nb }) => {
            const a = parseInt(na.replace("TerrainSector", ""));
            const b = parseInt(nb.replace("TerrainSector", ""));
            return a - b;
        });

    // const expTerrainSectors_20_21 = pkgLoad.exports
    //     .filter(e => e.objectName.includes("TerrainSector"))
    //     .sort(({ objectName: na }, { objectName: nb }) => {
    //         const a = parseInt(na.replace("TerrainSector", ""));
    //         const b = parseInt(nb.replace("TerrainSector", ""));
    //         return a - b;
    //     });
    // const expTerrainSectors_20_19 = pkg_20_19.exports
    //     .filter(e => e.objectName.includes("TerrainSector"))
    //     .sort(({ objectName: na }, { objectName: nb }) => {
    //         const a = parseInt(na.replace("TerrainSector", ""));
    //         const b = parseInt(nb.replace("TerrainSector", ""));
    //         return a - b;
    //     });
    // const expTerrainSectors_20_20 = pkg_20_20.exports
    //     .filter(e => e.objectName.includes("TerrainSector"))
    //     .sort(({ objectName: na }, { objectName: nb }) => {
    //         const a = parseInt(na.replace("TerrainSector", ""));
    //         const b = parseInt(nb.replace("TerrainSector", ""));
    //         return a - b;
    //     });

    // [...expTerrainSectors_20_19]
    //     .sort(({ offset: { value: a } }, { offset: { value: b } }) => {
    //         return (a as number) - (b as number);
    //     })
    //     .forEach(exp => {
    //         console.log(exp.objectName, exp.offset.value as number, exp.size.value as number);
    //     })

    //     debugger

    // expTerrainSectors_20_21.forEach((exp_20_21, i) => {
    //     const exp_20_19 = expTerrainSectors_20_19[i];
    //     const exp_20_20 = expTerrainSectors_20_20[i];

    //     console.log(exp_20_21.objectName, exp_20_19.size.value, exp_20_21.size.value);

    //     pkg_20_21.seek(exp_20_21.offset.value as number, "set");
    //     // pkg_20_21.dump(1, true, false);
    //     pkg_20_21.seek(1);
    //     const compat_20_21 = pkg_20_21.read(new BufferValue(BufferValue.compat32));
    //     const buff_20_21 = pkg_20_21.read(BufferValue.allocBytes(6));
    //     const offset_20_21 = pkg_20_21.tell() - (exp_20_21.offset.value as number);
    //     pkg_20_21.dump(1, true, false);

    //     pkg_20_19.seek(exp_20_19.offset.value as number, "set");
    //     // pkg_20_19.dump(1, true, false);
    //     pkg_20_19.seek(1);
    //     const compat_20_19 = pkg_20_19.read(new BufferValue(BufferValue.compat32));
    //     const buff_20_19 = pkg_20_19.read(BufferValue.allocBytes(6));
    //     const offset_20_19 = pkg_20_19.tell() - (exp_20_19.offset.value as number);
    //     pkg_20_19.dump(1, true, false);

    //     pkg_20_20.seek(exp_20_20.offset.value as number, "set");
    //     // pkg_20_20.dump(1, true, false);
    //     pkg_20_20.seek(1);
    //     const compat_20_20 = pkg_20_20.read(new BufferValue(BufferValue.compat32));
    //     const buff_20_20 = pkg_20_20.read(BufferValue.allocBytes(6));
    //     const offset_20_20 = pkg_20_20.tell() - (exp_20_20.offset.value as number);
    //     pkg_20_20.dump(1, true, false);

    //     debugger;
    // });

    // debugger;

    const filteredSectors = expTerrainSectors
    // .slice(0, 16)
    // .filter(exp =>
    //     exp.objectName === "TerrainSector0" ||
    //     exp.objectName === "TerrainSector10" ||
    //     exp.objectName === "TerrainSector15" ||
    //     exp.objectName === "TerrainSector25"
    // );
    const objectGroup = new Object3D();

    for (let exp of expMeshesInstances) {
        const uMeshInstance = await new UStaticMeshIsntance().load(pkgLoad, exp);

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