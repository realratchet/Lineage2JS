import * as _path from "path";

class AssetLoader {
    private packages = new Map<string, Promise<UPackage>>();

    constructor(assetList: string[] | readonly string[]) {
        assetList.forEach(path => {
            const pkgName = pathToPkgName(path);

            if (this.packages.has(pkgName))
                throw new Error(`Package already registered: ${pkgName}`);

            this.packages.set(pkgName.toLowerCase(), new Promise(async resolve => {
                const { UPackage } = await import(/* webpackChunkName: "modules/unreal" */ "@unreal/un-package");
                const pkg = new UPackage(this, `assets/${path}`);

                resolve(pkg);
            }));
        });
    }

    public getPackage(pkgName: string): Promise<UPackage> { return this.packages.get(pkgName.toLowerCase()); }
    public getPackageByPath(path: string): Promise<UPackage> { return this.packages.get(pathToPkgName(path).toLowerCase()); }
    public hasPackage(path: string) { return this.packages.has(pathToPkgName(path).toLowerCase()); }
    public async load(pkgOrPromise: Promise<UPackage> | UPackage): Promise<UPackage> {
        return await (await pkgOrPromise).decode();
    }
}

export default AssetLoader;
export { AssetLoader };

function pathToPkgName(path: string) { return _path.basename(path, _path.extname(path)) };