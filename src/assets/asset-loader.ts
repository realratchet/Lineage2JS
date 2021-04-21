import UPackage from "./unreal/un-package";
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

    public async load(pkg: UPackage) {
        return await pkg.decode();
    }
}

export default AssetLoader;
export { AssetLoader };

function pathToPkgName(path: string) { return _path.basename(path, _path.extname(path)) };