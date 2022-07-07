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
    const geoHelperDirecional = new BoxBufferGeometry();
    const geoHelperPoint = new SphereBufferGeometry();

    const objectGroup = new Object3D();
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);
    const assetLoader = new AssetLoader(assetList);
    const pkg_16_24 = assetLoader.getPackage("16_24", "Level"); // talking island top, no lights / works
    const pkg_16_25 = assetLoader.getPackage("16_25", "Level"); // elven ruins entrance /works
    // const pkg_17_25 = assetLoader.getPackage("17_25", "Level"); // crashes on terrain
    // const pkg_17_22 = assetLoader.getPackage("17_22", "Level"); // gludio /crashes
    // const pkg_19_21 = assetLoader.getPackage("19_21", "Level"); // crashes
    const pkg_20_19 = assetLoader.getPackage("20_19", "Level"); // <-- works
    const pkg_20_20 = assetLoader.getPackage("20_20", "Level"); // <-- elven fortress/ works
    const pkg_20_21 = assetLoader.getPackage("20_21", "Level"); // cruma tower
    // const pkg_21_19 = assetLoader.getPackage("21_19", "Level"); // elven village /crashes
    // const pkg_20_22 = assetLoader.getPackage("20_22", "Level"); // /crashes
    // const pkg_21_22 = assetLoader.getPackage("22_22", "Level"); // execution grounds /crashes
    // const pkg_22_22 = assetLoader.getPackage("22_22", "Level"); // giran /crashes
    // const pkg_shader = assetLoader.getPackage("T_SHADER");
    // const pkg_engine = assetLoader.getPackage("Engine");
    // const pkg_core = assetLoader.getPackage("Core");
    // const pkg_entry = assetLoader.getPackage("Entry", "Level"); // login screen?
    // const pkg_skylevel = assetLoader.getPackage("SkyLevel");
    // const pkg_meffects = assetLoader.getPackage("LineageEffectMeshes");

    // debugger;

    // const engineData = await new UEncodedFile("assets/system/l2.ini").decode();

    // debugger;

    const pkgLoadPromise = pkg_16_25;

    // for (let ass of assetList) {
    //     const pkgPromise = assetLoader.getPackageByPath(ass);
    //     const pkg = (await assetLoader.load(pkgPromise)).asReadable();

    //     const _pattern0 = [
    //         /*0000000*/ 0x59, 0x3c, 0x31, 0xff, 0x6f, 0x4a, 0x3d, 0xff, 0x6f, 0x4e, 0x3e, 0xff, 0x51, 0x36, 0x2c, 0xff,
    //         /*0000010*/ 0x00, 0x00, 0x00, 0xff, 0x67, 0x45, 0x39, 0xff, 0x72, 0x4e, 0x3e, 0xff, 0x00, 0x00, 0x00, 0xff,
    //         /*0000020*/ 0x12, 0x0c, 0x0a, 0xff, 0x10, 0x0a, 0x08, 0xff, 0x12, 0x0c, 0x0a, 0xff, 0x16, 0x0f, 0x0c, 0xff,
    //         /*0000030*/ 0x00, 0x00, 0x00, 0xff, 0x0c, 0x08, 0x06, 0xff, 0x10, 0x0a, 0x08, 0xff, 0x00, 0x00, 0x00, 0xff,
    //         /*0000040*/ 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x43, 0x2c, 0x24, 0xff, 0x00, 0x00, 0x00, 0xff,
    //         /*0000050*/ 0x00, 0x00, 0x00, 0xff, 0x42, 0x2c, 0x23, 0xff, 0x3a, 0x27, 0x20, 0xff, 0x43, 0x2c, 0x24, 0xff,
    //         /*0000060*/ 0x1b, 0x12, 0x0f, 0xff, 0x2b, 0x1e, 0x18, 0xff, 0x47, 0x3a, 0x29, 0xff, 0x0c, 0x08, 0x06, 0xff,
    //         /*0000070*/ 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff,
    //         /*0000080*/ 0x64, 0x44, 0x37, 0xff, 0x5c, 0x41, 0x33, 0xff, 0x71, 0x52, 0x40, 0xff, 0x6b, 0x48, 0x3b, 0xff,
    //         /*0000090*/ 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x15, 0x0e, 0x0b, 0xff, 0x0e, 0x09, 0x08, 0xff,
    //         /*00000a0*/ 0x00, 0x00, 0x00, 0xff, 0x40, 0x2b, 0x23, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff,
    //         /*00000b0*/ 0x00, 0x00, 0x00, 0xff, 0x6f, 0x4e, 0x3e, 0xff, 0x6f, 0x4a, 0x3d, 0xff, 0x00, 0x00, 0x00, 0xff,
    //         /*00000c0*/ 0x00, 0x00, 0x00, 0xff, 0x16, 0x0f, 0x0c, 0xff, 0x12, 0x0c, 0x0a, 0xff, 0x00, 0x00, 0x00, 0xff,
    //         /*00000d0*/ 0x00, 0x00, 0x00, 0xff, 0x43, 0x2c, 0x24, 0xff, 0x43, 0x2c, 0x24, 0xff
    //     ];

    //     const _pattern1 = [
    //         /*0000000*/ 0x3c, 0x59, 0xff, 0x31, 0x4a, 0x6f, 0xff, 0x3d, 0x4e, 0x6f, 0xff, 0x3e, 0x36, 0x51, 0xff, 0x2c,
    //         /*0000010*/ 0x00, 0x00, 0xff, 0x00, 0x45, 0x67, 0xff, 0x39, 0x4e, 0x72, 0xff, 0x3e, 0x00, 0x00, 0xff, 0x00,
    //         /*0000020*/ 0x0c, 0x12, 0xff, 0x0a, 0x0a, 0x10, 0xff, 0x08, 0x0c, 0x12, 0xff, 0x0a, 0x0f, 0x16, 0xff, 0x0c,
    //         /*0000030*/ 0x00, 0x00, 0xff, 0x00, 0x08, 0x0c, 0xff, 0x06, 0x0a, 0x10, 0xff, 0x08, 0x00, 0x00, 0xff, 0x00,
    //         /*0000040*/ 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x2c, 0x43, 0xff, 0x24, 0x00, 0x00, 0xff, 0x00,
    //         /*0000050*/ 0x00, 0x00, 0xff, 0x00, 0x2c, 0x42, 0xff, 0x23, 0x27, 0x3a, 0xff, 0x20, 0x2c, 0x43, 0xff, 0x24,
    //         /*0000060*/ 0x12, 0x1b, 0xff, 0x0f, 0x1e, 0x2b, 0xff, 0x18, 0x3a, 0x47, 0xff, 0x29, 0x08, 0x0c, 0xff, 0x06,
    //         /*0000070*/ 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00,
    //         /*0000080*/ 0x44, 0x64, 0xff, 0x37, 0x41, 0x5c, 0xff, 0x33, 0x52, 0x71, 0xff, 0x40, 0x48, 0x6b, 0xff, 0x3b,
    //         /*0000090*/ 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00, 0x0e, 0x15, 0xff, 0x0b, 0x09, 0x0e, 0xff, 0x08,
    //         /*00000a0*/ 0x00, 0x00, 0xff, 0x00, 0x2b, 0x40, 0xff, 0x23, 0x00, 0x00, 0xff, 0x00, 0x00, 0x00, 0xff, 0x00,
    //         /*00000b0*/ 0x00, 0x00, 0xff, 0x00, 0x4e, 0x6f, 0xff, 0x3e, 0x4a, 0x6f, 0xff, 0x3d, 0x00, 0x00, 0xff, 0x00,
    //         /*00000c0*/ 0x00, 0x00, 0xff, 0x00, 0x0f, 0x16, 0xff, 0x0c, 0x0c, 0x12, 0xff, 0x0a, 0x00, 0x00, 0xff, 0x00,
    //         /*00000d0*/ 0x00, 0x00, 0xff, 0x00, 0x2c, 0x43, 0xff, 0x24, 0x2c, 0x43, 0xff, 0x24
    //     ];

    //     const pattern0 = findPattern(pkg, _pattern0);
    //     const pattern1 = findPattern(pkg, _pattern1);

    //     console.info(`Searching for pattern not in '${ass}'`);

    //     if (pattern0.index >= 0 || pattern1.index >= 0) debugger;
    //     else console.warn(`Pattern not in '${ass} (max: ${pattern0.maxPattern}/${pattern1.maxPattern})'`);

    // }

    // debugger;

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

    const decodeLibrary: IDecodeLibrary = { loadMipmaps: true, geometries: {}, materials: {}, materialModifiers: {}, geometryInstances: {} };

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

    // const uLevelInfo = await pkgLoad.fetchObject<UNMovableSunLight>(2);
    // await uLevelInfo.onLoaded();

    // const uLevelInfo = await pkgLoad.fetchObject<ULevelInfo>(1);

    // debugger;

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

    // const uModel = await pkgLoad.fetchObject<UModel>(uLevel.baseModelId); // base model
    // const iModel = await uModel.getDecodeInfo(decodeLibrary);
    // const mModel = decodeObject3D(decodeLibrary, iModel);
    // objectGroup.add(mModel);

    // const zones = await Promise.all(uModel.zones.slice(1).map(x => pkgLoad.fetchObject<UZoneInfo>(x.index)));

    // zones.forEach(zoneInfo => {
    //     const mesh = new Mesh(new SphereBufferGeometry(100), new MeshBasicMaterial({ color: 0xff00ff, depthTest: false, depthWrite: true }));
    //     mesh.position.set(zoneInfo.location.x, zoneInfo.location.z, zoneInfo.location.y);

    //     objectGroup.add(mesh);
    // });

    // debugger;


    (await Promise.all([
        // 1441,
        // 1770,
        // 1802,
        // 1804,
        // 4284,
        // 10253, // scluptures
        // 10254, // scluptures
        // 8028,
        // 1370, // wall object
        // 5680, // floor near wall objectrs
        // ...[6157, 6101, 6099, 6096, 6095, 6128, 8386, 7270, 9861, 1759, 7273, 9046, 1370, 1195, 10242, 9628, 5665, 5668, 9034, 10294, 9219, 7312, 5662, 5663] // wall objects
        // 555,// elven ruins colon
        610, // light fixture with 2 lights near elven ruins
        // ...[608, 610, 1755, 1781] // elven ruins light fixtures
    ].map(async id => {
        const uMesh = await pkgLoad.fetchObject(id) as UStaticMeshActor;
        const iMesh = await uMesh.getDecodeInfo(decodeLibrary);

        return iMesh;
    }))).forEach(async iMesh => {
        const mModel = decodeObject3D(decodeLibrary, iMesh);

        // debugger;

        objectGroup.add(mModel);

        await uLevel.onLoaded();

        // debugger;

        {
            for (let decodeInfo of (iMesh.siblings.filter(x => x.type === "Light") as ILightDecodeInfo[])) {
                const color = new Color().fromArray(decodeInfo.color);
                const light = decodeInfo.directional ? new DirectionalLight(color) : new PointLight(color, undefined, decodeInfo.radius);
                const helper = decodeInfo.directional ? new DirectionalLightHelper(light as DirectionalLight, 100) : new PointLightHelper(light as PointLight, decodeInfo.radius);

                light.position.fromArray(decodeInfo.position);
                // if (decodeInfo.rotation) light.rotation.fromArray(decodeInfo.rotation);

                objectGroup.add(light, helper);


                // debugger;

                if (decodeInfo.directional) {
                    const target = (light as DirectionalLight).target;

                    light.updateMatrixWorld();
                    target.position
                        .set(0, 0, 1)
                        .applyEuler(new Euler().fromArray(decodeInfo.rotation || [0, 0, 0, "XYZ"]))
                        .normalize()
                        .multiplyScalar(200)
                        .add(light.position);

                    target.updateMatrixWorld();

                    (helper as DirectionalLightHelper).update();
                }

                light.add(...decodeInfo.children.map(nfo => decodeObject3D(decodeLibrary, nfo)));

                // {
                //     const geo = decodeInfo.directional ? geoHelperDirecional : geoHelperPoint;

                //     const matHelper = new MeshBasicMaterial({ wireframe: true, color: new Color().fromArray(decodeInfo.color) });
                //     const helper = new Mesh(geo, matHelper);

                //     helper.add(new AxesHelper(2));
                //     helper.position.fromArray(decodeInfo.position);
                //     helper.rotation.fromArray(decodeInfo.rotation);

                //     if (decodeInfo.radius !== undefined) helper.scale.set(decodeInfo.radius, decodeInfo.radius, decodeInfo.radius);
                //     else matHelper.color.setHex(0xff00ff);

                //     objectGroup.add(helper);
                // }
            }
        }
    });


    // const uStaticMeshActors = await (await Promise.all((expGroups["StaticMeshActor"] || []).map(exp => pkgLoad.fetchObject<UStaticMeshActor>(exp.index + 1))))//.filter(x => x.isSunAffected);
    // const iStaticMeshActors = await (await Promise.all(uStaticMeshActors.map(actor => actor.getDecodeInfo(decodeLibrary))))//.filter(x => x.children[0]?.name === "Exp_obj49");
    //     // debugger

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