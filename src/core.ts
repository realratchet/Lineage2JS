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
import decodeObject3D, { decodePackage } from "./assets/decoders/object3d-decoder";
import ULight from "./assets/unreal/un-light";
import findPattern from "./utils/pattern-finder";
import DecodeLibrary from "./assets/unreal/decode-library";

async function _decodePackage(renderManager: RenderManager, assetLoader: AssetLoader, pkg: string | UPackage | Promise<UPackage>, settings: LoadSettings_T) {

    if (typeof (pkg) === "string") pkg = assetLoader.getPackage(pkg, "Level");

    const decodeLibrary = await DecodeLibrary.fromPackage(await assetLoader.load(pkg), settings);

    decodeLibrary.anisotropy = renderManager.renderer.capabilities.getMaxAnisotropy();

    return decodePackage(decodeLibrary);
}

async function startCore() {
    const objectGroup = new Object3D();
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);
    const assetLoader = new AssetLoader(assetList);

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
            2774, // necropolis entrance
            // 4718, // cruma base
            // 4609, // transparency issue
            // ...[2011, /*6100, 6130*/], // ceiling fixture that's too red with 0xe lights
            // ...[1463, 1500, 2011, 2012, 6100, 6127, 6129, 6130, 7290, 7334, 1380, 1386,], // all ceiling fixture that's too red
            // 610, // light fixture with 2 lights near elven ruins
            // 1755, // light fixture with 3 lights near elven ruins
            // ...[608, 610, 1755, 1781] // elven ruins light fixtures
        ]
    } as LoadSettings_T;

    // working (or mostly working)
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "20_21", loadSettings));  // cruma tower
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "20_20", loadSettings));  // elven fortress
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "20_19", loadSettings));  // elven forest
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "20_22", loadSettings));  // dion
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "21_22", loadSettings));  // execution grounds
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "16_25", loadSettings));  // elven ruins
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "22_22", loadSettings));  // giran
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "19_21", loadSettings));  // gludio
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "19_22", loadSettings));  // ruins of despair
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "19_23", loadSettings));  // ants nest
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "22_21", loadSettings));  // death pass
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "23_22", loadSettings));  // giran castle
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "21_20", loadSettings));  // iris lake

    // crashing
    objectGroup.add(await _decodePackage(renderManager, assetLoader, "17_25", loadSettings));  // talking island village
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "17_22", loadSettings));  // gludin
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "23_21", loadSettings));  // dragon valley
    // objectGroup.add(await _decodePackage(renderManager, assetLoader, "23_18", loadSettings));  // tower of insolence

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
