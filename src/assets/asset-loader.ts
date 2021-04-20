import UPackage from "./unreal/un-package";
import UTerrainSector from "./unreal/un-terrain";
import UTerrainInfo from "./unreal/un-terrain-info";
import * as _path from "path";

class AssetLoader {
    private packages = new Map<string, UPackage>();

    constructor(assetList: string[] | readonly string[]) {
        assetList.forEach(path => {
            const pkg = new UPackage(this, `assets/${path}`);
            const pkgName = pathToPkgName(pkg.path);

            if (this.packages.has(pkgName))
                throw new Error(`Package already registered: ${pkgName}`);

            this.packages.set(pkgName, pkg);
        });
    }

    public getPackage(pkgName: string) {
        return this.packages.get(pkgName);
    }

    public hasPackage(path: string) {
        return this.packages.has(pathToPkgName(path));
    }

    public async load(pkg: UPackage): Promise<any> {
        const decoded = await pkg.decode();
        const expTerrainSector = decoded.exports.find(e => e.name.includes("TerrainInfo"));
        const terrain = UTerrainInfo.fromAsset(pkg, expTerrainSector);

        debugger;
        return null;
    }
}

export default AssetLoader;
export { AssetLoader };

function pathToPkgName(path: string) { return _path.basename(path, _path.extname(path)) };