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
import decodeObject3D, { decodeSector } from "./assets/decoders/object3d-decoder";
import ULight from "./assets/unreal/un-light";
import findPattern from "./utils/pattern-finder";

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
    const pkg_20_22 = assetLoader.getPackage("20_22", "Level"); // dion /crashes always
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

    const pkgLoadPromise = pkg_20_22;

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
    }, {} as GenericObjectContainer_T<{ import: UImport, index: number }[]>);

    const expGroups = pkgLoad.exports.reduce((accum, exp, index) => {

        const expType = pkgLoad.getPackageName(exp.idClass.value as number);
        const list = accum[expType] = accum[expType] || [];

        list.push({ index, export: exp });

        return accum;
    }, {} as GenericObjectContainer_T<{ index: number, export: UExport }[]>);

    const decodeLibrary: IDecodeLibrary = {
        loadMipmaps: true,
        sector: null,
        zones: {},
        anisotropy: renderManager.renderer.capabilities.getMaxAnisotropy(),
        geometries: {},
        materials: {},
        materialModifiers: {},
        geometryInstances: {}
    };

    // debugger;


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

    const uModel = await pkgLoad.fetchObject<UModel>(uLevel.baseModelId); // base model
    await uModel.getDecodeInfo(decodeLibrary);

    const uTerrainInfo = await pkgLoad.fetchObject<UZoneInfo>(expGroups.TerrainInfo[0].index + 1);
    await uTerrainInfo.getDecodeInfo(decodeLibrary);

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
    //     // 2011, // ceiling fixture that's too red
    //     4609, // transparency issue
    //     // ...[2011, /*6100, 6130*/], // ceiling fixture that's too red with 0xe lights
    //     // ...[1463, 1500, 2011, 2012, 6100, 6127, 6129, 6130, 7290, 7334, 1380, 1386,], // all ceiling fixture that's too red
    //     // 610, // light fixture with 2 lights near elven ruins
    //     // 1755, // light fixture with 3 lights near elven ruins
    //     // ...[608, 610, 1755, 1781] // elven ruins light fixtures
    // ].map(async id => {
    //     const uMesh = await pkgLoad.fetchObject(id) as UStaticMeshActor;
    //     await uMesh.getDecodeInfo(decodeLibrary);

    // })));


    const uStaticMeshActors = await Promise.all((expGroups["StaticMeshActor"] || []).map(exp => pkgLoad.fetchObject<UStaticMeshActor>(exp.index + 1)))//.filter(x => x.isSunAffected);
    await Promise.all(uStaticMeshActors.map(actor => actor.getDecodeInfo(decodeLibrary)))//.filter(x => x.children[0]?.name === "Exp_obj49");

    objectGroup.add(decodeSector(decodeLibrary));

    // const boundsGroup = new Object3D();
    // objectGroup.add(boundsGroup);
    // objectGroup.name = "Bounds Helpers";
    // Object.values(decodeLibrary.zones).forEach(zone => {
    //     const { min, max } = zone.bounds;
    //     const box = new Box3();
    //     const color = new Color(Math.floor(Math.random() * 0xffffff));

    //     box.min.fromArray(min);
    //     box.max.fromArray(max);

    //     const helper = new Box3Helper(box, color);
    //     if ("name" in zone) helper.name = `Bounds[${zone.name}]`;

    //     boundsGroup.add(helper);
    // });

    console.info("System has loaded!");

    // debugger;

    // renderManager.enableZoneCulling = false;
    renderManager.scene.add(objectGroup);
    renderManager.scene.add(new BoxHelper(objectGroup));
    renderManager.startRendering();

    (global as any).renderManager = renderManager;
}

export default startCore;
export { startCore };
