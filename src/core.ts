import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";
// import UTerrainInfo from "./assets/unreal/un-terrain-info";
// import UTerrainSector from "./assets/unreal/un-terrain-sector";
// import UTexture from "./assets/unreal/un-texture";
// import UStaticMesh from "./assets/unreal/static-mesh/un-static-mesh";
import { Box3, Vector3, Object3D, BoxHelper, PlaneBufferGeometry, Mesh, SphereBufferGeometry, MeshBasicMaterial, Box3Helper, Color, BoxBufferGeometry, AxesHelper, DirectionalLight, PointLight, DirectionalLightHelper, PointLightHelper, Euler, SpotLight, SpotLightHelper, AmbientLight, SkeletonHelper } from "three";
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
import decodeObject3D, { decodePackage } from "./assets/decoders/object3d-decoder";
import ULight from "./assets/unreal/un-light";
import findPattern from "./utils/pattern-finder";
import DecodeLibrary from "./assets/unreal/decode-library";
import UEncodedFile from "@unreal/un-encoded-file";

async function _decodePackage(renderManager: RenderManager, assetLoader: AssetLoader, pkg: string | UPackage | Promise<UPackage>, settings: LoadSettings_T) {

    if (typeof (pkg) === "string") pkg = assetLoader.getPackage(pkg, "Level");

    const decodeLibrary = await DecodeLibrary.fromPackage(await assetLoader.load(pkg), settings);

    decodeLibrary.anisotropy = renderManager.renderer.capabilities.getMaxAnisotropy();

    return decodePackage(decodeLibrary);
}

async function _decodeCharacter(renderManager: RenderManager, assetLoader: AssetLoader, pkg: string | UPackage | Promise<UPackage>) {

    if (typeof (pkg) === "string") pkg = await assetLoader.getPackage(pkg, "Effects");

    pkg = await assetLoader.load(pkg);

    // debugger;

    const antaras = pkg.exportGroups.SkeletalMesh.find(x => x.export.objectName.toLowerCase().includes("baium"));
    // const antaras = pkg.exportGroups.SkeletalMesh.find(x => x.export.objectName.toLowerCase().includes("antaras"));

    const meshIndex = antaras.index + 1;

    const mesh = await pkg.fetchObject<USkeletalMesh>(meshIndex);

    const decodeLibrary = new DecodeLibrary();

    decodeLibrary.anisotropy = renderManager.renderer.capabilities.getMaxAnisotropy();

    const info = await mesh.getDecodeInfo(decodeLibrary);

    const char = decodeObject3D(decodeLibrary, info) as THREE.SkinnedMesh;

    char.position.set(-87063.33997244012, -3700, 239964.66910649382);

    renderManager.scene.add(char);

    renderManager.scene.updateMatrixWorld(true);

    // const helper = new SkeletonHelper(char);

    // renderManager.scene.add(helper);

    // debugger;

    const clip = char.userData.animations["Wait"];
    const action = renderManager.mixer.clipAction(clip);

    // debugger;

    action.play();
}

async function _decodeDatFile(path: string) {
    // const ini = await (new UEncodedFile("assets/system/l2.ini").asReadable()).decode();

    const file = await (new UEncodedFile(path).asReadable()).decode();

    debugger;
}

async function startCore() {
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);

    (global as any).renderManager = renderManager;

    const assetList = await (await fetch("asset-list.json")).json();
    const assetLoader = new AssetLoader(assetList.supported);
    const objectGroup = renderManager.objectGroup;

    // await _decodeCharacter(renderManager, assetLoader, "LineageMonsters");
    await _decodeDatFile("assets/system/Npcgrp.dat");

    const loadSettings = {
        helpersZoneBounds: false,
        loadTerrain: true,
        loadBaseModel: true,
        loadStaticModels: true,
        _loadStaticModelList: [
            // 1441,
            // 1770,
            // 1802,
            // 1804,
            // 4284,
            // 10253, // scluptures
            // 10254, // scluptures
            // 8028,
            // 1370, // wall object
            // 9742, // some ground from cruma loaded first, fails lighting
            // ...[9742, 9646, 10157, 9675], // some ground from cruma loaded first, fails lighting
            // 5680, // floor near wall objects
            // ...[6157, 6101, 6099, 6096, 6095, 6128, 8386, 7270, 9861, 1759, 7273, 9046, 1370, 1195, 10242, 9628, 5665, 5668, 9034, 10294, 9219, 7312, 5662, 5663] // wall objects
            // 555,// elven ruins colon
            // 47, // rock with ambient light
            // 2369,
            // 2011, // ceiling fixture that's too red
            // 2774, // necropolis entrance
            // 4718, // cruma base
            // 4609, // transparency issue
            // ...[2011, /*6100, 6130*/], // ceiling fixture that's too red with 0xe lights
            // ...[1463, 1500, 2011, 2012, 6100, 6127, 6129, 6130, 7290, 7334, 1380, 1386,], // all ceiling fixture that's too red
            // 610, // light fixture with 2 lights near elven ruins
            // 1755, // light fixture with 3 lights near elven ruins
            // ...[608, 610, 1755, 1781] // elven ruins light fixtures

            ...[/*2092,*/ /*3052*/, 2517], // talking island collision
        ]
    } as LoadSettings_T;

    // working (or mostly working)
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "20_21", loadSettings));  // cruma tower
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "20_20", loadSettings));  // elven fortress
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "20_19", loadSettings));  // elven forest
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "20_22", loadSettings));  // dion
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "21_22", loadSettings));  // execution grounds
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "19_21", loadSettings));  // gludio
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "22_22", loadSettings));  // giran
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "19_22", loadSettings));  // ruins of despair
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "19_23", loadSettings));  // ants nest
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "22_21", loadSettings));  // death pass
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "23_22", loadSettings));  // giran castle
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "21_20", loadSettings));  // iris lake
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "23_18", loadSettings));  // tower of insolence
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "23_21", loadSettings));  // dragon valley


    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "15_24", loadSettings));  // TI
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "16_24", loadSettings));  // TI - north of talking island
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "17_24", loadSettings));  // TI

    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "15_25", loadSettings));  // TI
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "16_25", loadSettings));  // TI - elven ruins
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "17_25", loadSettings));  // TI - talking island village

    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "15_26", loadSettings));  // TI
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "16_26", loadSettings));  // TI
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "17_26", loadSettings));  // TI

    // crashing
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "17_22", loadSettings));  // gludin

    console.info("System has loaded!");

    // debugger;

    // renderManager.enableZoneCulling = false;
    renderManager.scene.add(objectGroup);
    renderManager.scene.add(new BoxHelper(objectGroup));
    renderManager.startRendering();
}

export default startCore;
export { startCore };
