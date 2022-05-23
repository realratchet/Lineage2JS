import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";
import assetList from "./assets/asset-list";
// import UTerrainInfo from "./assets/unreal/un-terrain-info";
// import UTerrainSector from "./assets/unreal/un-terrain-sector";
// import UTexture from "./assets/unreal/un-texture";
// import UStaticMesh from "./assets/unreal/static-mesh/un-static-mesh";
import { Box3, Vector3, Object3D, BoxHelper, PlaneBufferGeometry, Mesh, SphereBufferGeometry, MeshBasicMaterial, Box3Helper } from "three";
import BufferValue from "./assets/buffer-value";
// import UStaticMeshIsntance from "./assets/unreal/static-mesh/un-static-mesh-instance";
// import UModel from "./assets/unreal/model/un-model";
// import UExport from "./assets/unreal/un-export";
// import UBrush from "./assets/unreal/un-brush";
// import ULevel from "./assets/unreal/un-level";
// import UStaticMeshActor from "./assets/unreal/static-mesh/un-static-mesh-actor";
import decodeTexture from "./assets/decoders/texture-decoder";
import decodeMaterial from "./assets/decoders/material-decoder";
import MeshStaticMaterial from "./materials/mesh-static-material/mesh-static-material";
import decodeObject3D from "./assets/decoders/object3d-decoder";
// import ULight from "./assets/unreal/un-light";
// import UImport from "./assets/unreal/un-import";
// import { UShader } from "./assets/unreal/un-material";
// import ULevelInfo from "./assets/unreal/un-level-info";
// import UEncodedFile from "./assets/unreal/un-encoded-file";

type ULevel = import("./assets/unreal/un-level").ULevel;

async function addMaterialPreviews(pkgLoad: UPackage, impGroups: {
    [key: string]: {
        import: UImport;
        index: number;
    }[];
}, decodeLibrary: IDecodeLibrary, objectGroup: Object3D) {
    let index = 0;
    const geometry = new PlaneBufferGeometry(1000, 1000);
    const uShaders = await Promise.all(impGroups["Shader"].map(imp => pkgLoad.fetchObject<UShader>(imp.index)));
    const iShaders = await Promise.all(uShaders.map(obj => obj.getDecodeInfo(decodeLibrary)));

    iShaders.forEach(async (iShader, i) => {
        const material = decodeMaterial(decodeLibrary, decodeLibrary.materials[iShader]) as MeshStaticMaterial;
        const mesh = new Mesh(geometry, material);

        mesh.name = uShaders[i].objectName;
        mesh.position.set(16317.62354947573 + 1000 * index++, -11492.261077168214 - 500, 114151.68197851974 - 500);

        objectGroup.add(new BoxHelper(mesh));
        objectGroup.add(mesh);
    });

    const uTextures = await Promise.all(impGroups["Texture"].map(imp => pkgLoad.fetchObject<UTexture>(imp.index)));
    const iTextures = await Promise.all(uTextures.map(obj => obj.getDecodeInfo(decodeLibrary)));

    index = 0;
    iTextures.forEach(async (iTexture, i) => {
        const material = decodeMaterial(decodeLibrary, decodeLibrary.materials[iTexture]) as MeshStaticMaterial;
        const mesh = new Mesh(geometry, material);

        mesh.name = uTextures[i].objectName;
        mesh.position.set(16317.62354947573 + 1000 * index++, -11492.261077168214 - 500 - 1000, 114151.68197851974 - 500);

        objectGroup.add(new BoxHelper(mesh));
        objectGroup.add(mesh);
    });
}

// export default loadTexture;

async function startCore() {
    const objectGroup = new Object3D();
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);
    const assetLoader = new AssetLoader(assetList);
    const pkg_19_21 = assetLoader.getPackage("19_21");
    const pkg_20_19 = assetLoader.getPackage("20_19");
    const pkg_20_20 = assetLoader.getPackage("20_20");
    const pkg_20_21 = assetLoader.getPackage("20_21"); // cruma tower
    const pkg_21_19 = assetLoader.getPackage("21_19"); // elven village
    const pkg_20_22 = assetLoader.getPackage("20_22");
    const pkg_shader = assetLoader.getPackage("T_SHADER");
    const pkg_engine = assetLoader.getPackage("Engine");
    const pkg_core = assetLoader.getPackage("Core");
    const pkg_entry = assetLoader.getPackage("Entry"); // login screen?
    const pkg_skylevel = assetLoader.getPackage("SkyLevel");
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
    // await assetLoader.load(pkg_entry);

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

    const decodeLibrary: IDecodeLibrary = { loadMipmaps: true, geometries: {}, materials: {} };

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


    // await addMaterialPreviews(pkgLoad, impGroups, decodeLibrary, objectGroup);


    // debugger;

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

    const uLevel = await pkgLoad.fetchObject<ULevel>(expGroups.Level[0].index + 1);

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

    // const uTerrain = await pkgLoad.fetchObject<UTerrainInfo>(119);
    // const iTerrain = await uTerrain.getDecodeInfo(decodeLibrary);
    // const mTerrain = decodeObject3D(decodeLibrary, iTerrain);
    // objectGroup.add(mTerrain);

    // const uLevelInfo = await pkgLoad.fetchObject<UNMovableSunLight>(2);
    // await uLevelInfo.onLoaded();

    // debugger;

    // const uLevel = await pkgLoad.fetchObject<ULevel>(expGroups.Level[0].index + 1);
    // const iLevel = await uLevel.getDecodeInfo(decodeLibrary);
    // const mLevel = decodeObject3D(decodeLibrary, iLevel);
    // objectGroup.add(mLevel);

    // {
    //     const pkgLoad = await assetLoader.load(pkg_20_21);
    //     const uLevel = await pkgLoad.fetchObject<ULevel>(5);
    //     const iLevel = await uLevel.getDecodeInfo(decodeLibrary);
    //     const mLevel = decodeObject3D(decodeLibrary, iLevel);
    //     objectGroup.add(mLevel);
    // }

    // const uModels = await Promise.all(expGroups.Model.map(model => pkgLoad.fetchObject(model.index + 1)));

    // debugger;

    const uModel = await pkgLoad.fetchObject<UModel>(uLevel.baseModelId); // base model

    // const multiLightmaps = uModel.multiLightmaps;
    // const size = 512, geometry = new PlaneBufferGeometry(size, size);
    // for (let j = 0, len2 = multiLightmaps.length; j < len2; j++) {
    //     const lightmaps = multiLightmaps[j].textures;

    //     for (let i = 0, len = lightmaps.length; i < len; i++) {
    //         const lightmapUuid = await lightmaps[i].staticLightmap.getDecodeInfo(decodeLibrary);
    //         const lightmapInfo = decodeLibrary.materials[lightmapUuid];

    //         // debugger;

    //         const { texture } = decodeTexture(lightmapInfo);

    //         // debugger;

    //         const material = new MeshBasicMaterial({ map: texture });
    //         const mesh = new Mesh(geometry, material);

    //         mesh.position.set(16317.62354947573 + size * i, -11492.261077168214 - 500 - 100 + size * j, 114151.68197851974 - 500);

    //         const geo2 = new PlaneBufferGeometry(16, 8);
    //         const mat2 = new MeshBasicMaterial({ color: 0xff00ff, wireframe: true, transparent: true, depthTest: false, depthWrite: false });
    //         const msh2 = new Mesh(geo2, mat2);

    //         const ox = 424, oy = 88;

    //         const rx = 16317.62354947573 + size * i - size * 0.5 + 8 + ox;
    //         const ry = -11492.261077168214 - 500 - 100 + size * j - size * 0.5 + 4 + size - oy;
    //         const rz = 114151.68197851974 - 500;

    //         msh2.position.set(rx, ry, rz);

    //         objectGroup.add(mesh, msh2);

    //         // debugger;

    //     }
    // }
    //     return;

    // debugger;
    const iModel = await uModel.getDecodeInfo(decodeLibrary);
    const mModel = decodeObject3D(decodeLibrary, iModel);
    objectGroup.add(mModel);


    uModel.bspNodes.forEach((node: FBSPNode) => {
        if (node.iSurf !== 1771) return;

        const vec = node.surfaceOrigin;
        const helper = new Mesh(new SphereBufferGeometry(100, 100), new MeshBasicMaterial({ color: 0xff00ff, transparent: true, depthTest: false, depthWrite: false }))

        helper.position.set(vec.x, vec.z, vec.y);

        objectGroup.add(helper);
    });

    // debugger;


    // decodeLibrary.objects.forEach(info => {
    //     const mModel = decodeObject3D(decodeLibrary, info);
    //     objectGroup.add(mModel);

    // });

    // debugger;


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
    // // // const uMesh = await pkgLoad.fetchObject<UStaticMeshActor>(4284); // rotating crystal
    // // // const uMesh = await pkgLoad.fetchObject<UStaticMeshActor>(1441); // blinkig roof

    // (await Promise.all([await uMesh.getDecodeInfo(decodeLibrary)])).forEach(info => {
    //     const mModel = decodeObject3D(decodeLibrary, info);
    //     objectGroup.add(mModel);
    // });

    // debugger;

    // const group = decodeObject3D(mesh);

    // // debugger;

    // objectGroup.add(group);

    // const loadedObjects: THREE.Object3D[] = [];

    // expGroups["StaticMeshActor"].forEach(async exp => {
    //     const uStaticMeshActor = await pkgLoad.fetchObject<UStaticMeshActor>(exp.index + 1);;
    //     const iStaticMeshActor = await uStaticMeshActor.getDecodeInfo(decodeLibrary);
    //     const oStaticMeshActor = decodeObject3D(decodeLibrary, iStaticMeshActor);

    //     // objectGroup.add(oStaticMeshActor);
    //     loadedObjects.push(oStaticMeshActor);
    // });

    // setInterval(function () {
    //     loadedObjects.splice(0, 100).forEach(actor => objectGroup.add(actor));
    // }, 1000);

    // const uStaticMeshActors = await Promise.all(expGroups["StaticMeshActor"].map(exp => pkgLoad.fetchObject<UStaticMeshActor>(exp.index + 1)));
    // const iStaticMeshActors = await Promise.all(uStaticMeshActors.map(actor => actor.getDecodeInfo(decodeLibrary)));

    // iStaticMeshActors.forEach(info => {
    //     const mModel = decodeObject3D(decodeLibrary, info);

    //     objectGroup.add(mModel);
    // });

    // const iStaticMeshActors = await Promise.all(uStaticMeshActors.map(actor => actor.getDecodeInfo(decodeLibrary)));

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