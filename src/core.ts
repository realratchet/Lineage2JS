import * as dat from "dat.gui";
import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";
import { Box3, Vector3, Object3D, BoxHelper, PlaneBufferGeometry, Mesh, SphereBufferGeometry, MeshBasicMaterial, Box3Helper, Color, BoxBufferGeometry, AxesHelper, DirectionalLight, PointLight, DirectionalLightHelper, PointLightHelper, Euler, SpotLight, SpotLightHelper, AmbientLight, SkeletonHelper } from "three";
import decodeObject3D, { decodePackage } from "./assets/decoders/object3d-decoder";
import DecodeLibrary from "./assets/unreal/decode-library";
import UDataFile from "./assets/unreal/datafile/un-datafile";
import UConfigEnv from "@client/assets/unreal/conf-files/un-conf-env";
import UConfigTimeEnv from "@client/assets/unreal/conf-files/un-conf-timeenv";

async function _decodePackage(renderManager: RenderManager, assetLoader: AssetLoader, pkg: string | GA.UPackage, settings: GD.LoadSettings_T) {
    if (typeof (pkg) === "string") pkg = assetLoader.getPackage(pkg, "Level");

    pkg = await assetLoader.load(pkg);

    const decodeLibrary = await DecodeLibrary.fromPackage(pkg, settings);

    // debugger;

    decodeLibrary.anisotropy = renderManager.renderer.capabilities.getMaxAnisotropy();

    console.log(`Decode library '${decodeLibrary.name}' created, building scene.`)

    return decodePackage(decodeLibrary);
}

async function _decodeCharacter(renderManager: RenderManager, assetLoader: AssetLoader, pkg: string | UPackage, pkgTex: string | UPackage) {

    if (typeof (pkg) === "string") pkg = await assetLoader.getPackage(pkg, "Animation");

    pkg = await assetLoader.load(pkg);


    async function getTextures(pkg: string | GA.UPackage, decodeLibrary: DecodeLibrary, texNames: string[]) {
        if (typeof (pkg) === "string") pkg = await assetLoader.getPackage(pkg, "Texture");

        pkg = await assetLoader.load(pkg);

        // debugger;

        const texExps = texNames.map(v => (pkg as GA.UPackage).exports.find(x => x.objectName === v));

        const textures = await Promise.all(texExps.map(exp => (pkg as GA.UPackage).fetchObject<GA.UShader>(exp.index + 1)));

        const infos = await Promise.all(textures.map(mesh => mesh.getDecodeInfo(decodeLibrary)));

        return infos;
    }

    const hairMesh = "FFighter_m000_m00_bh", hairTex = "FFighter_m000_t00_m00_bh";
    const faceMesh = "FFighter_m000_f", faceTex = "FFighter_m000_t00_f";
    const torsoMesh = "FFighter_m001_u", torsoTex = "FFighter_m001_t01_u";
    const legMesh = "FFighter_m001_l", legTex = "FFighter_m001_t01_l";
    const gloveMesh = "FFighter_m001_g", gloveTex = "FFighter_m001_t01_g";
    const bootMesh = "FFighter_m001_b", bootTex = "FFighter_m001_t01_b";

    // debugger;

    const bodypartMeshNames = [
        faceMesh,
        hairMesh,
        torsoMesh,
        legMesh,
        gloveMesh,
        bootMesh
    ];

    const bodypartTexNames = [
        faceTex,
        hairTex,
        torsoTex,
        legTex,
        gloveTex,
        bootTex
    ];


    const bodyPartExps = bodypartMeshNames.map(v => (pkg as GA.UPackage).exportGroups.SkeletalMesh.find(x => x.export.objectName === v));

    const bodypartMeshes = await Promise.all(bodyPartExps.map(exp => (pkg as GA.UPackage).fetchObject<GA.USkeletalMesh>(exp.index + 1)));

    const decodeLibrary = new DecodeLibrary();

    decodeLibrary.anisotropy = renderManager.renderer.capabilities.getMaxAnisotropy();

    const textures = await getTextures(pkgTex, decodeLibrary, bodypartTexNames);

    const bodypartInfos = await Promise.all(bodypartMeshes.map(mesh => mesh.getDecodeInfo(decodeLibrary)));

    bodypartMeshes.forEach(({ uuid }, index) => {
        const material = decodeLibrary.materials[uuid] as GD.IMaterialGroupDecodeInfo;

        material.materials = [textures[index]];
    });

    const bodypartObjects = bodypartInfos.map(info => decodeObject3D(decodeLibrary, info) as THREE.SkinnedMesh);

    const player = renderManager.player;

    const animations = bodypartObjects[0].userData.animations;

    player.setAnimations(animations);
    player.setIdleAnimation("Wait_Hand_FFighter");
    player.setWalkingAnimation("Walk_Hand_FFighter");
    player.setRunningAnimation("Run_Hand_FFighter");
    player.setDeathAnimation("Death_FFighter");
    player.setFallingAnimation("Falling_FFighter");
    player.setMeshes(bodypartObjects);
    player.initAnimations();

    // const gui = new dat.GUI();

    // const state = { activeAnimation: "Wait_Hand_FFighter" };
    // const actions = [] as THREE.AnimationAction[];

    // gui.add(state, "activeAnimation", Object.keys(animations))
    //     .name("Animation")
    //     .onFinishChange(animName => {
    //         actions.forEach(act => act.stop());

    //         while (actions.pop()) { }

    //         const clip = animations[animName];

    //         bodypartObjects.forEach(char => {
    //             const action = renderManager.mixer.clipAction(clip, char);

    //             actions.push(action);

    //             action.play();
    //         });
    //     });
}

async function _decodeMonster(renderManager: RenderManager, assetLoader: AssetLoader, pkg: string | UPackage) {

    if (typeof (pkg) === "string") pkg = await assetLoader.getPackage(pkg, "Animation");

    pkg = await assetLoader.load(pkg);

    // debugger;

    // const antaras = pkg.exportGroups.SkeletalMesh.find(x => x.export.objectName.toLowerCase().includes("stone_golem"));
    // const antaras = pkg.exportGroups.SkeletalMesh.find(x => x.export.objectName.toLowerCase().includes("baium"));
    const antaras = pkg.exportGroups.SkeletalMesh.find(x => x.export.objectName.toLowerCase().includes("antaras"));

    const meshIndex = antaras.index + 1;

    const mesh = await pkg.fetchObject<GA.USkeletalMesh>(meshIndex);

    const decodeLibrary = new DecodeLibrary();

    decodeLibrary.anisotropy = renderManager.renderer.capabilities.getMaxAnisotropy();

    const info = await mesh.getDecodeInfo(decodeLibrary);

    const char = decodeObject3D(decodeLibrary, info) as THREE.SkinnedMesh;

    char.position.set(-87063.33997244012, -3700, 239964.66910649382);

    renderManager.scene.add(char);

    renderManager.scene.updateMatrixWorld(true);

    const helper = new SkeletonHelper(char);

    renderManager.scene.add(helper);

    // debugger;

    const clip = char.userData.animations["Wait"];
    const action = renderManager.mixer.clipAction(clip);

    // debugger;

    action.play();
}

async function _decodeDatFile(path: string) {
    // const ini = await (new UEncodedFile("assets/system/l2.ini").asReadable()).decode();

    const file = await (new UDataFile(path).asReadable()).decode();

    debugger;
}

async function _decodTimeEnvFile(path: string, pkgNative: GA.UNativePackage, pkgEngine: GA.UEnginePackage): Promise<any> {
    const envFile = await (new UConfigTimeEnv(path).asReadable()).decode();

    return envFile.load(pkgNative, pkgEngine);
}

async function startCore() {
    // debugger;
    const viewport = document.querySelector("viewport") as HTMLViewportElement;
    const renderManager = new RenderManager(viewport);

    (global as any).renderManager = renderManager;

    const assetList = await (await fetch("asset-list.json")).json();
    const assetLoader = await AssetLoader.Instantiate(assetList.supported);
    const objectGroup = renderManager.objectGroup;

    // await _decodeDatFile("assets/system/Npcgrp.dat");

    // await _decodeCharacter(renderManager, assetLoader, "Fighter", "FFighter");
    // await _decodeMonster(renderManager, assetLoader, "LineageMonsters");


    const pkgCore = await assetLoader.load(assetLoader.getCorePackage());

    // debugger;

    // const classess = [];

    // for (const { index } of pkgCore.exportGroups["Class"]) {

    //     const _UClass = await pkgCore.fetchObject<UClass>(index + 1);

    //     await _UClass.onDecodeReady();

    //     // debugger;

    //     // await _UClass.constructClass();

    //     classess.push(_UClass);

    //     // debugger;
    // }

    // debugger;

    // const structs = [];

    // for (const { index } of pkgCore.exportGroups["Struct"]) {

    //     const _UStruct = await pkgCore.fetchObject<UStruct>(index + 1);

    //     // debugger;

    //     await _UStruct.onDecodeReady();

    //     console.log(_UStruct.friendlyName);

    //     structs.push(_UStruct);
    // }


    // debugger;


    const pkgNative = assetLoader.getNativePackage();
    const pkgEngine = await assetLoader.load(assetLoader.getEnginePackage());

    pkgCore.loadNativeClasses();
    // pkgEngine.loadNativeClasses();


    const env = await _decodTimeEnvFile("assets/system/timeenv0.int", pkgNative, pkgEngine);


    // // const fnObjectMain = await pkgCore.fetchObject(741);
    // // await fnObjectMain.onDecodeReady();

    // // const fltObjectMin = await pkgCore.fetchObject(13);
    // // await fltObjectMin.onDecodeReady();


    // // const fnObjectRandRng = await pkgCore.fetchObject(716);


    // // await fnObjectRandRng.onDecodeReady();

    // // debugger;

    // // const textBuffers = [];

    // // for (const { index } of pkgCore.exportGroups.TextBuffer) {
    // //     const object = await pkgCore.fetchObject<UTextBuffer>(index + 1);

    // //     await object.onDecodeReady();

    // //     textBuffers.push(object);
    // // }

    // debugger;

    // for (const { index } of pkgCore.exportGroups.Class) {
    //     const object = await pkgCore.fetchObject<UClass>(index + 1);

    //     await object.onDecodeReady();

    //     debugger;
    // }

    // debugger;

    // for (const { index } of pkgCore.exportGroups.Struct) {
    //     const object = await pkgCore.fetchObject<UStruct>(index + 1);

    //     // debugger;

    //     await object.onDecodeReady();

    //     // debugger;

    //     // UClassRegistry.register(object);
    // }

    // const registered = UClassRegistry.structs;

    // debugger;

    // for (const { index } of pkgEngine.exportGroups.Struct) {
    //     debugger;

    //     const object = await pkgEngine.fetchObject<UStruct>(index + 1);

    //     await object.onDecodeReady();

    //     debugger;

    //     UClassRegistry.register(object);

    //     debugger;
    // }

    // const structs = UClassRegistry.structs;

    // debugger;



    // debugger;

    // const UWeaponId = pkgEngine.exports.find(e => e.objectName === "Weapon").index + 1;
    // const UWeapon = await pkgEngine.fetchObject(UWeaponId);

    // await UWeapon.onDecodeReady();

    // debugger;

    // const fn1 = await pkgCore.fetchObject<UFunction>(721); // first function read when starting the game
    // const fn3 = await pkgCore.fetchObject<UFunction>(716); // third function read when starting the game

    // debugger;

    // const objs = [] as UFunction[];
    // const _pkg = pkgEngine;

    // const groups = [
    //     ..._pkg.exportGroups.Function,
    //     ..._pkg.exportGroups.Class,
    //     ..._pkg.exportGroups.Struct
    // ]

    // debugger;

    // for(let {index} of groups.filter(x=>![/*674, 739, 991, 994, 1305, 1308, 1376, 1407, 1417, 1857, 1859, 1905*/].includes(x.index))) {
    //     const a = await _pkg.fetchObject<UFunction>(index+1);
    //     objs.push(a);

    //     // debugger;
    // };

    // console.log(objs)

    // debugger;

    // const pkgEffects = await assetLoader.load(assetLoader.getPackage("lineageeffect", "Script"));

    // const uMortalBlow = pkgEffects.fetchObject<UClass>(21);
    // const MortalBlow = uMortalBlow.buildClass<UEmitter>(assetLoader.getPackage("native", "Script") as UNativePackage);
    // const mortalBlow = new MortalBlow();
    // const decodedMortalBlow = mortalBlow.getDecodeInfo(new DecodeLibrary());

    // const uRapidShot = pkgEffects.fetchObject<UClass>(657);
    // const RapidShot = uRapidShot.buildClass<UEmitter>(assetLoader.getPackage("native", "Script") as UNativePackage);
    // const rapidShot = new RapidShot();
    // const decodedRapidshot = rapidShot.getDecodeInfo(new DecodeLibrary());

    // debugger;

    const loadSettings = {
        env: env,
        helpersZoneBounds: false,
        loadTerrain: true,
        loadBaseModel: true,
        loadStaticModels: false,
        loadEmitters: false,
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
            // 2011, // cruma: ceiling fixture that's too red
            // "StaticMeshActor2028", "StaticMeshActor2030", "StaticMeshActor2119", "StaticMeshActor1792", // cruma: why is this black
            // 2774, // necropolis entrance
            //4718, // cruma base
            // 4609, // transparency issue
            // ...[2011, /*6100, 6130*/], // ceiling fixture that's too red with 0xe lights
            // ...[1463, 1500, 2011, 2012, 6100, 6127, 6129, 6130, 7290, 7334, 1380, 1386,], // all ceiling fixture that's too red
            // 610, // light fixture with 2 lights near elven ruins
            // 591,
            // 602 // 0x42
            "StaticMeshActor613",
            // "StaticMeshActor6", // talking island church (3705 vertices)
            // 470,    // first object with scene lights near elven ruins
            // 1755, // light fixture with 3 lights near elven ruins
            // ...[608, 610, 1755, 1781] // elven ruins light fixtures

            // ...[/*2092,*/ /*3052,*/ 2517], // talking island collision
            // ...["StaticMeshActor475"] // talking island village broken rock
            // ...["StaticMeshActor684"] // cruma light
        ]
    } as GD.LoadSettings_T;

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
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "21_19", loadSettings));  // elven village
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "25_21", loadSettings));  // antharas lair
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "24_17", loadSettings));  // blazing swamp
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "20_18", loadSettings));  // dark elf village
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "24_18", loadSettings));  // aden castle town
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "23_20", loadSettings));  // hunters village
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "23_18", loadSettings));  // tower of insolence
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "23_21", loadSettings));  // dragon valley


    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "15_24", loadSettings));  // TI
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "16_24", loadSettings));  // TI - north of talking island
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "17_24", loadSettings));  // TI

    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "15_25", loadSettings));  // TI
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "16_25", loadSettings));  // TI - elven ruins
    renderManager.addSector(await _decodePackage(renderManager, assetLoader, "17_25", loadSettings));  // TI - talking island village

    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "15_26", loadSettings));  // TI
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "16_26", loadSettings));  // TI
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "17_26", loadSettings));  // TI

    // crashing
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "17_22", loadSettings));  // gludin

    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "lobby", loadSettings));  // lobby
    // renderManager.addSector(await _decodePackage(renderManager, assetLoader, "skylevel", loadSettings));  // skylevel

    console.info("System has loaded!");

    // debugger;

    // renderManager.enableZoneCulling = false;
    renderManager.scene.add(objectGroup);
    renderManager.scene.add(new BoxHelper(objectGroup));
    renderManager.startRendering();
}

export default startCore;
export { startCore };