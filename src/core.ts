// import RenderManager from "./rendering/render-manager";
import AssetLoader from "./assets/asset-loader";
import assetList from "./assets/asset-list";
import UTerrainInfo from "./assets/unreal/un-terrain-info";
import UTerrainSector from "./assets/unreal/un-terrain-sector";
import UTexture from "./assets/unreal/un-texture";

async function loadTexture() {
    const assetLoader = new AssetLoader(assetList);
    const pkg = assetLoader.getPackage("T_Dion");

    await assetLoader.load(pkg);

    const texData = pkg.exports.find(exp => exp.objectName === "DI_C5");
    const texture = await pkg.createObject(pkg, texData, "Texture") as UTexture;

    const data = texture.decodeMipmap(0);

    debugger;
}

export default loadTexture;
export { loadTexture as startCore }

async function startCore() {
    const assetLoader = new AssetLoader(assetList);
    const pkg = assetLoader.getPackage("20_21");

    await assetLoader.load(pkg);

    const expTerrainInfo = pkg.exports.find(e => e.objectName.includes("TerrainInfo"));
    const expTerrainSector = pkg.exports
        .filter(e => e.objectName.includes("TerrainSector"))
        .sort(({ objectName: na }, { objectName: nb }) => {
            const a = parseInt(na.replace("TerrainSector", ""));
            const b = parseInt(nb.replace("TerrainSector", ""));
            return a - b;
        })
        .slice(0, 2);
    const terrain = await new UTerrainInfo().load(pkg, expTerrainInfo);

    const leftoverBytes = (expTerrainInfo.size.value as number) + (expTerrainInfo.offset.value as number) - pkg.tell()

    console.log("leftover:", leftoverBytes);

    debugger;

    for (let exp of expTerrainSector) {
        const t = await new UTerrainSector().load(pkg, exp);
        debugger;
    }

    // const sectors = await Promise.all(expTerrainSector.map(async exp => await new UTerrainSector().load(pkg, exp)));

    console.log("terrain loading done");

    // const viewport = document.querySelector("viewport") as HTMLViewportElement;
    // const renderManager = new RenderManager(viewport);
}

// export default startCore;
// export { startCore };