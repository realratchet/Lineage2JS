import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";
import assetList from "./assets/asset-list";
// import UTerrainInfo from "./assets/unreal/un-terrain-info";
// import UTerrainSector from "./assets/unreal/un-terrain-sector";
// import UTexture from "./assets/unreal/un-texture";
// import UStaticMesh from "./assets/unreal/static-mesh/un-static-mesh";
import { Box3, Vector3, Object3D, BoxHelper, PlaneBufferGeometry, Mesh, SphereBufferGeometry, MeshBasicMaterial } from "three";
import BufferValue from "./assets/buffer-value";
// import UStaticMeshIsntance from "./assets/unreal/static-mesh/un-static-mesh-instance";
// import UModel from "./assets/unreal/model/un-model";
// import UExport from "./assets/unreal/un-export";
// import UBrush from "./assets/unreal/un-brush";
// import ULevel from "./assets/unreal/un-level";
import UStaticMeshActor from "./assets/unreal/static-mesh/un-static-mesh-actor";
import decodeTexture from "./assets/decoders/texture-decoder";
import decodeMaterial from "./assets/decoders/material-decoder";
import MeshStaticMaterial from "./materials/mesh-static-material/mesh-static-material";
import decodeObject3D from "./assets/decoders/object3d-decoder";
// import ULight from "./assets/unreal/un-light";
// import UImport from "./assets/unreal/un-import";
// import { UShader } from "./assets/unreal/un-material";
// import ULevelInfo from "./assets/unreal/un-level-info";
// import UEncodedFile from "./assets/unreal/un-encoded-file";

async function loadMesh() {
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);
    const assetLoader = new AssetLoader(assetList);
    const pkg = assetLoader.getPackage("field_deco_S");

    await assetLoader.load(pkg);

    // const exp = pkg.exports.find(exp => exp.objectName === "Skeleton01");
    // const exp = pkg.exports.find(exp => exp.objectName === "talking_island_rock02");
    // const exp = pkg.exports.find(exp => exp.objectName === "talking_island_rock02_LOD");
    const exp = pkg.exports.find(exp => exp.objectName === "inna_underwater_star");
    debugger;
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
    const objectGroup = new Object3D();
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);
    const assetLoader = new AssetLoader(assetList);
    const pkg_20_19 = assetLoader.getPackage("20_19");
    const pkg_20_20 = assetLoader.getPackage("20_20");
    const pkg_20_21 = assetLoader.getPackage("20_21"); // cruma tower
    const pkg_20_22 = assetLoader.getPackage("20_22");
    const pkg_shader = assetLoader.getPackage("T_SHADER");
    const pkg_engine = assetLoader.getPackage("Engine");
    const pkg_core = assetLoader.getPackage("Core");
    const pkg_entry = assetLoader.getPackage("Entry"); // login screen?
    const pkg_meffects = assetLoader.getPackage("LineageEffectMeshes");

    // debugger;

    // const engineData = await new UEncodedFile("assets/system/l2.ini").decode();

    // debugger;

    const pkgLoadPromise = pkg_20_21;


    // await assetLoader.load(pkg_meffects);

    // const d = await pkg_meffects.fetchObject(4);

    // debugger;

    const pkgLoad = await assetLoader.load(pkgLoadPromise);
    // // await assetLoader.load(pkg_engine);
    // // await assetLoader.load(pkg_core);
    // // await assetLoader.load(pkg_entry);

    // await pkg_engine.fetchObject(-41)

    // debugger;

    // await assetLoader.load(pkg_20_19);
    // await assetLoader.load(pkg_20_20);
    // await assetLoader.load(pkg_20_21);

    const impGroups = pkgLoad.imports.reduce((accum, imp, index) => {
        const impType = imp.className;
        const list = accum[impType] = accum[impType] || [];

        list.push({ import: imp, index: -index - 1 });

        return accum;
    }, {} as { [key: string]: { import: UImport, index: number }[] });

    const expGroups = pkgLoad.exports.reduce((accum, exp, index) => {

        const expType = pkgLoad.getPackageName(exp.idClass.value as number);
        const list = accum[expType] = accum[expType] || [];

        list.push({ index, export: exp });

        return accum;
    }, {} as { [key: string]: { index: number, export: UExport }[] });

    // debugger;

    // return;


    // const lights = [];
    // const geoHelper = new SphereBufferGeometry();

    // for (let expLight of expGroups["Light"]) {
    //     const uLight = await new ULight().load(pkgLoad, expLight);

    //     lights.push(uLight);

    //     const color = uLight.getColor();
    //     const matHelper = new MeshBasicMaterial({ wireframe: true, color });
    //     const helper = new Mesh(geoHelper, matHelper);

    //     helper.position.set(uLight.location.vector.x, uLight.location.vector.z, uLight.location.vector.y);
    //     // debugger;



    //     if (uLight.radius !== undefined) helper.scale.set(uLight.radius, uLight.radius, uLight.radius);
    //     else matHelper.color.setHex(0xff00ff);

    //     objectGroup.add(helper);
    // }

    // debugger;

    // const nonDirectional = lights.filter(x => !x.isDirectional);

    // debugger;


    // let index = 0;
    // const geometry = new PlaneBufferGeometry(100, 100);
    // for (let impShader of impGroups["Shader"]) {
    //     const uMaterial = await pkgLoad.fetchObject(impShader.index) as UShader;
    //     const material = await uMaterial.decodeMaterial();

    //     const mesh = new Mesh(geometry, material);

    //     mesh.position.set(16317.62354947573 + 100 * index++, -11492.261077168214 - 500, 114151.68197851974 - 500);

    //     objectGroup.add(mesh);

    //     break;
    // }

    // debugger;

    // index = 0;

    // const shaders = await Promise.all(impGroups["Shader"].map(imp => pkgLoad.fetchObject<UShader>(imp.index)));

    // shaders.forEach(async shader => {
    //     const shaderInfo = await shader.getDecodeInfo(true);
    //     // const texture = decodeTexture(shaderInfo.diffuse);
    //     // const material = new MeshBasicMaterial({ map: texture });
    //     const material = decodeMaterial(shaderInfo) as MeshStaticMaterial;
    //     const mesh = new Mesh(geometry, material);

    //     // debugger;

    //     mesh.position.set(16317.62354947573 + 100 * index++, -11492.261077168214 - 500 - 100, 114151.68197851974 - 500);

    //     objectGroup.add(mesh);
    // });

    // const textures = await Promise.all(impGroups["Texture"].slice(0, 1).map(imp => pkgLoad.fetchObject<UTexture>(imp.index)));
    // const textureInfo = await textures[0].getDecodeInfo(true);
    // const texture = decodeTexture(textureInfo);

    // const material = new MeshBasicMaterial({ map: texture });
    // const mesh = new Mesh(geometry, material);

    // mesh.position.set(16317.62354947573 + 100 * index++, -11492.261077168214 - 500 - 100, 114151.68197851974 - 500);

    // objectGroup.add(mesh);

    // return;

    // debugger;

    // debugger;

    // for (let impShader of impGroups["Texture"]) {
    //     try {
    //         const uMaterial = await pkgLoad.fetchObject<UTexture>(impShader.index);

    //         debugger;

    //         const material = await uMaterial.decodeMaterial();

    //         const mesh = new Mesh(geometry, material);

    //         mesh.position.set(16317.62354947573 + 100 * index++, -11492.261077168214 - 500 - 100, 114151.68197851974 - 500);

    //         objectGroup.add(mesh);

    //         break;
    //     } catch (e) { }
    // }

    // debugger;
    // return;


    // const expTerrainInfo = expGroups.TerrainInfo[0];
    // const expTerrainSectors = expGroups.TerrainSector
    //     .sort(({ objectName: na }, { objectName: nb }) => {
    //         const a = parseInt(na.replace("TerrainSector", ""));
    //         const b = parseInt(nb.replace("TerrainSector", ""));
    //         return a - b;
    //     });

    // const filteredSectors = expTerrainSectors

    // debugger;

    expGroups.Model
        .sort(({ export: { objectName: na } }, { export: { objectName: nb } }) => {
            const a = parseInt(na.replace("Model", ""));
            const b = parseInt(nb.replace("Model", ""));
            return a - b;
        });
    // .slice(0, 10).forEach(exp => {
    //     console.log(exp.objectName);
    //     pkgLoad.seek(exp.offset.value as number + 0, "set");
    //     pkgLoad.dump(5, true, false)
    // });

    // debugger;

    // const uLevel = await new ULevel().load(pkgLoad, expGroups.Level[0]);
    // const level = await uLevel.decodeLevel();
    // objectGroup.add(level);

    // const uModel = await pkgLoad.fetchObject(7364) as UModel; // base model
    // const model = await uModel.decodeModel();
    // objectGroup.add(model);

    // debugger;

    // debugger;

    // Exp_oren_curumadungeon17
    // Exp_oren_curumadungeon20

    // debugger;

    // for (let id of [/*1441, 1770, 1802, 1804,*/ 4284]) {
    //     const uMesh = await pkgLoad.fetchObject(id) as UStaticMeshActor;
    //     const mesh = await uMesh.decodeMesh();
    //     objectGroup.add(mesh);
    // }

    // for (let exp of expGroups.StaticMeshActor) {
    //     const uMesh = await new UStaticMeshActor().load(pkgLoad, exp);
    //     const mesh = await uMesh.decodeMesh();
    //     objectGroup.add(mesh);
    // }

    // const uMesh = await pkgLoad.fetchObject<UStaticMeshActor>(1804); // tower plane
    // const uMesh = await pkgLoad.fetchObject<UStaticMeshActor>(4284); // rotating crystal
    const uMesh = await pkgLoad.fetchObject<UStaticMeshActor>(1441); // blinkig roof
    const mesh = await uMesh.getDecodeInfo();

    const group = decodeObject3D(mesh);

    // debugger;

    objectGroup.add(group);

    // expGroups["StaticMeshActor"].forEach(async exp => {
    //     const uStaticMeshActor = await pkgLoad.fetchObject<UStaticMeshActor>(exp.index + 1);;
    //     const iStaticMeshActor = await uStaticMeshActor.getDecodeInfo();
    //     const oStaticMeshActor = decodeObject3D(iStaticMeshActor);

    //     objectGroup.add(oStaticMeshActor);
    // });

    // const uStaticMeshActors = await Promise.all(expGroups["StaticMeshActor"].map(exp => pkgLoad.fetchObject<UStaticMeshActor>(exp.index + 1)));
    // const iStaticMeshActors = await Promise.all(uStaticMeshActors.map(actor => actor.getDecodeInfo()));

    // iStaticMeshActors.forEach(info => objectGroup.add(decodeObject3D(info)));

    // const towerIndex = 2301;

    // for (let exp of expGroups.StaticMeshActor/*.slice(towerIndex, towerIndex + 1)*/) {
    //     const uActor = await new UStaticMeshActor().load(pkgLoad, exp);
    //     const actor = await uActor.decodeMesh();

    //     objectGroup.add(actor);
    // }

    // debugger;

    // for (let exp of expGroups.Brush/*.filter(exp=>exp.size.value > 73)*/) {
    //     // console.assert(exp.offset.value as number !== 72);

    //     // pkgLoad.seek(exp.offset.value as number, "set");

    //     // pkgLoad.dump()

    //     const uBrush = await new UBrush().load(pkgLoad, exp);

    //     // debugger;

    //     const mesh = await uBrush.decodeMesh();

    //     objectGroup.add(mesh);

    //     // debugger;
    // }

    // for (let exp of expGroups.Model/*.filter(exp=>exp.size.value > 73)*/) {
    //     // console.assert(exp.offset.value as number !== 72);

    //     // pkgLoad.seek(exp.offset.value as number, "set");

    //     // pkgLoad.dump()

    //     const uBrush = await new UModel().load(pkgLoad, exp);

    //     const mesh = await uBrush.decodeMesh();

    //     objectGroup.add(mesh);

    //     // debugger;
    // }

    // debugger;

    // for (let exp of expMeshes) {
    //     const uMesh = await new UStaticMesh().load(pkgLoad, exp);
    //     const mesh = await uMesh.decodeMesh();

    //     objectGroup.add(mesh);

    //     debugger;
    // }

    // const uTerrain = await new UTerrainInfo(filteredSectors).load(pkgLoad, expTerrainInfo);
    // const terrain = await uTerrain.decodeMesh();
    // objectGroup.add(terrain);


    // objectGroup.scale.set(0.001, 0.001, 0.001);

    // const boundingBox = new Box3().setFromObject(objectGroup);
    // const boxSize = boundingBox.getSize(new Vector3());

    console.info("System has loaded!");



    // terrain.scale.set(0.001, 0.001, 0.001);
    // terrain.position.y = -boundingBox.min.y;

    // console.log(boxSize.toArray().join(", "));

    renderManager.scene.add(objectGroup);
    renderManager.scene.add(new BoxHelper(objectGroup));
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