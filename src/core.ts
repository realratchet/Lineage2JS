import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";
import assetList from "./assets/asset-list";
// import UTerrainInfo from "./assets/unreal/un-terrain-info";
// import UTerrainSector from "./assets/unreal/un-terrain-sector";
// import UTexture from "./assets/unreal/un-texture";
// import UStaticMesh from "./assets/unreal/static-mesh/un-static-mesh";
import { Box3, Vector3, Object3D, BoxHelper, PlaneBufferGeometry, Mesh, SphereBufferGeometry, MeshBasicMaterial, Box3Helper, Color, BoxBufferGeometry, AxesHelper, DirectionalLight, PointLight, DirectionalLightHelper, PointLightHelper, Euler, SpotLight, SpotLightHelper, AmbientLight } from "three";
import BufferValue from "./assets/buffer-value";
// import UStaticMeshInstance from "./assets/unreal/static-mesh/un-static-mesh-instance";
// import UModel from "./assets/unreal/model/un-model";
// import UExport from "./assets/unreal/un-export";
// import UBrush from "./assets/unreal/un-brush";
// import ULevel from "./assets/unreal/un-level";
// import UStaticMeshActor from "./assets/unreal/static-mesh/un-static-mesh-actor";
import decodeTexture from "./assets/decoders/texture-decoder";
import decodeMaterial from "./assets/decoders/material-decoder";
import MeshStaticMaterial from "./materials/mesh-static-material/mesh-static-material";
import decodeObject3D from "./assets/decoders/object3d-decoder";
import ULight from "./assets/unreal/un-light";
import findPattern from "./utils/pattern-finder";

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
    const geoHelperDirecional = new BoxBufferGeometry();
    const geoHelperPoint = new SphereBufferGeometry();

    const objectGroup = new Object3D();
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);
    const assetLoader = new AssetLoader(assetList);
    const pkg_16_24 = assetLoader.getPackage("16_24", "Level"); // talking island top, no lights / works
    const pkg_16_25 = assetLoader.getPackage("16_25", "Level"); // elven ruins entrance /works
    // const pkg_17_25 = assetLoader.getPackage("17_25", "Level"); // /crashes on terrain
    // const pkg_17_22 = assetLoader.getPackage("17_22", "Level"); // gludio /crashes
    // const pkg_19_21 = assetLoader.getPackage("19_21", "Level"); // crashes
    const pkg_20_19 = assetLoader.getPackage("20_19", "Level"); // <-- works
    const pkg_20_20 = assetLoader.getPackage("20_20", "Level"); // <-- elven fortress/ works
    const pkg_20_21 = assetLoader.getPackage("20_21", "Level"); // cruma tower
    // const pkg_21_19 = assetLoader.getPackage("21_19", "Level"); // elven village /crashes
    // const pkg_20_22 = assetLoader.getPackage("20_22", "Level"); // /crashes always
    // const pkg_21_22 = assetLoader.getPackage("21_22", "Level"); // execution grounds /crashes on static meshes
    // const pkg_22_22 = assetLoader.getPackage("22_22", "Level"); // giran /crashes on static meshes
    // const pkg_shader = assetLoader.getPackage("T_SHADER");
    // const pkg_engine = assetLoader.getPackage("Engine");
    // const pkg_core = assetLoader.getPackage("Core");
    // const pkg_entry = assetLoader.getPackage("Entry", "Level"); // login screen?
    // const pkg_skylevel = assetLoader.getPackage("SkyLevel");
    // const pkg_meffects = assetLoader.getPackage("LineageEffectMeshes");

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

    const decodeLibrary: IDecodeLibrary = {
        loadMipmaps: true,
        zones: {},
        anisotropy: renderManager.renderer.capabilities.getMaxAnisotropy(),
        geometries: {},
        materials: {},
        materialModifiers: {},
        geometryInstances: {}
    };

    // debugger;

    // return;


    // for (let { index } of expGroups["Light"]) {
    //     const uLight = await pkgLoad.fetchObject<ULight>(index + 1);
    //     const decodeInfo = await uLight.getDecodeInfo(decodeLibrary);

    //     const geo = decodeInfo.directional ? geoHelperDirecional : geoHelperPoint;

    //     const matHelper = new MeshBasicMaterial({ transparent: true, depthTest: false, wireframe: true, color: new Color().fromArray(decodeInfo.color) });
    //     const helper = new Mesh(geo, matHelper);

    //     helper.position.fromArray(decodeInfo.position);

    //     if (decodeInfo.radius !== undefined) helper.scale.set(decodeInfo.radius, decodeInfo.radius, decodeInfo.radius);
    //     else matHelper.color.setHex(0xff00ff);

    //     objectGroup.add(helper);
    // }

    // const sunlight = await pkgLoad.fetchObject<UNMovableSunLight>(expGroups.NMovableSunLight[0].index + 1);

    // debugger;

    // const nonDirectional = lights.filter(x => !x.isDirectional);

    const uLevel = await pkgLoad.fetchObject<ULevel>(expGroups.Level[0].index + 1);

    expGroups.Model
        .sort(({ export: { objectName: na } }, { export: { objectName: nb } }) => {
            const a = parseInt(na.replace("Model", ""));
            const b = parseInt(nb.replace("Model", ""));
            return a - b;
        });


    // const iLevel = await uLevel.getDecodeInfo(decodeLibrary);
    // const mLevel = decodeObject3D(decodeLibrary, iLevel);
    // objectGroup.add(mLevel);

    // debugger;

    // {
    //     const pkgLoad = await assetLoader.load(pkg_20_21);
    //     const uLevel = await pkgLoad.fetchObject<ULevel>(5);
    //     const iLevel = await uLevel.getDecodeInfo(decodeLibrary);
    //     const mLevel = decodeObject3D(decodeLibrary, iLevel);
    //     objectGroup.add(mLevel);
    // }

    const uLevelInfo = await pkgLoad.fetchObject<ULevelInfo>(expGroups["LevelInfo"][0].index + 1);
    const uZonesInfo = await Promise.all((expGroups["ZoneInfo"] || []).map(exp => pkgLoad.fetchObject<UZoneInfo>(exp.index + 1)));

    await Promise.all((uZonesInfo as IInfo[]).concat(uLevelInfo).map(z => z.getDecodeInfo(decodeLibrary)));

    // debugger;

    const uModel = await pkgLoad.fetchObject<UModel>(uLevel.baseModelId); // base model
    const iModel = await uModel.getDecodeInfo(decodeLibrary);

    debugger;

    const mModel = decodeObject3D(decodeLibrary, iModel);
    objectGroup.add(mModel);

    debugger;

    Object.values(decodeLibrary.zones).forEach(zone => {
        const { min, max } = zone.bounds;
        const box = new Box3();
        const color = new Color(Math.floor(Math.random() * 0xffffff));

        box.min.fromArray(min);
        box.max.fromArray(max);

        const helper = new Box3Helper(box, color);
        if ("name" in zone) helper.name = zone.name;

        objectGroup.add(helper);
    });

    // mModel.children.forEach(c => objectGroup.add(new BoxHelper(c, Math.floor(Math.random() * 0xffffff))));

    // const zones = {};

    // for (let nodeIndex = 0, ncount = uModel.bspNodes.length; nodeIndex < ncount; nodeIndex++) {
    //     const node: FBSPNode = uModel.bspNodes[nodeIndex];
    //     const surf: FBSPSurf = uModel.bspSurfs[node.iSurf];

    //     const zone = surf.actor.getZone();

    //     zones[zone.uuid] = zones[zone.uuid] || zone.location.getVectorElements();
    // }

    // Object.values(zones).forEach(l => {
    //     const mesh = new Mesh(new SphereBufferGeometry(10), new MeshBasicMaterial({ color: 0xff00ff, depthTest: false, transparent: true }));

    //     mesh.position.fromArray(l);

    //     objectGroup.add(mesh);
    // });



    // const zones = await Promise.all(uModel.zones.slice(1).map(x => pkgLoad.fetchObject<UZoneInfo>(x.index)));

    // zones.forEach(zoneInfo => {
    //     const mesh = new Mesh(new SphereBufferGeometry(100), new MeshBasicMaterial({ color: 0xff00ff, depthTest: false, depthWrite: true }));
    //     mesh.position.set(zoneInfo.location.x, zoneInfo.location.z, zoneInfo.location.y);

    //     objectGroup.add(mesh);
    // });

    // debugger;


    // (await Promise.all([
    //     // 1441,
    //     // 1770,
    //     // 1802,
    //     // 1804,
    //     // 4284,
    //     // 10253, // scluptures
    //     // 10254, // scluptures
    //     // 8028,
    //     // 1370, // wall object
    //     // 9742, // some ground from cruma loaded first, fails lighting
    //     // ...[9742, 9646, 10157, 9675], // some ground from cruma loaded first, fails lighting
    //     // 5680, // floor near wall objects
    //     // ...[6157, 6101, 6099, 6096, 6095, 6128, 8386, 7270, 9861, 1759, 7273, 9046, 1370, 1195, 10242, 9628, 5665, 5668, 9034, 10294, 9219, 7312, 5662, 5663] // wall objects
    //     // 555,// elven ruins colon
    //     // 47, // rock with ambient light
    //     // 2369,
    //     610, // light fixture with 2 lights near elven ruins
    //     // 1755, // light fixture with 3 lights near elven ruins
    //     // ...[608, 610, 1755, 1781] // elven ruins light fixtures
    // ].map(async id => {
    //     const uMesh = await pkgLoad.fetchObject(id) as UStaticMeshActor;
    //     const iMesh = await uMesh.getDecodeInfo(decodeLibrary);

    //     return iMesh;
    // }))).forEach(async iMesh => {
    //     // debugger;
    //     const mModel = decodeObject3D(decodeLibrary, iMesh);

    //     // debugger;

    //     objectGroup.add(mModel);

    //     await uLevel.onLoaded();

    //     // debugger;

    //     {
    //         for (let decodeInfo of (iMesh.siblings?.filter(x => x.type === "Light") as ILightDecodeInfo[])) {
    //             const color = new Color().fromArray(decodeInfo.color);
    //             const light = decodeInfo.directional ? new DirectionalLight(color) : new PointLight(color, undefined, decodeInfo.radius);
    //             const helper = decodeInfo.directional ? new DirectionalLightHelper(light as DirectionalLight, 100) : new PointLightHelper(light as PointLight, decodeInfo.radius);

    //             light.position.fromArray(decodeInfo.position);
    //             // if (decodeInfo.rotation) light.rotation.fromArray(decodeInfo.rotation);

    //             objectGroup.add(light, helper);


    //             // debugger;

    //             if (decodeInfo.directional) {
    //                 const target = (light as DirectionalLight).target;

    //                 light.updateMatrixWorld();
    //                 target.position
    //                     .set(0, 0, 1)
    //                     .applyEuler(new Euler().fromArray(decodeInfo.rotation || [0, 0, 0, "XYZ"]))
    //                     .normalize()
    //                     .multiplyScalar(200)
    //                     .add(light.position);

    //                 target.updateMatrixWorld();

    //                 (helper as DirectionalLightHelper).update();
    //             }

    //             light.add(...decodeInfo.children.map(nfo => decodeObject3D(decodeLibrary, nfo)));

    //             // {
    //             //     const geo = decodeInfo.directional ? geoHelperDirecional : geoHelperPoint;

    //             //     const matHelper = new MeshBasicMaterial({ wireframe: true, color: new Color().fromArray(decodeInfo.color) });
    //             //     const helper = new Mesh(geo, matHelper);

    //             //     helper.add(new AxesHelper(2));
    //             //     helper.position.fromArray(decodeInfo.position);
    //             //     helper.rotation.fromArray(decodeInfo.rotation);

    //             //     if (decodeInfo.radius !== undefined) helper.scale.set(decodeInfo.radius, decodeInfo.radius, decodeInfo.radius);
    //             //     else matHelper.color.setHex(0xff00ff);

    //             //     objectGroup.add(helper);
    //             // }
    //         }
    //     }
    // });


    // const uStaticMeshActors = await (await Promise.all((expGroups["StaticMeshActor"] || []).map(exp => pkgLoad.fetchObject<UStaticMeshActor>(exp.index + 1))))//.filter(x => x.isSunAffected);
    // const iStaticMeshActors = await (await Promise.all(uStaticMeshActors.map(actor => actor.getDecodeInfo(decodeLibrary))))//.filter(x => x.children[0]?.name === "Exp_obj49");
    // iStaticMeshActors.forEach(info => {
    //     const mModel = decodeObject3D(decodeLibrary, info);

    //     objectGroup.add(mModel);
    // });

    console.info("System has loaded!");

    renderManager.scene.add(objectGroup);
    renderManager.scene.add(new BoxHelper(objectGroup));
    renderManager.startRendering();

    (global as any).renderManager = renderManager;
}

export default startCore;
export { startCore };