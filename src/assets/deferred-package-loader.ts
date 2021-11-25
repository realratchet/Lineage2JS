class DeferredPackageLoader {
    public readonly loader: AssetLoader;
    public readonly path: string;
    public readonly isDeferred = true;

    constructor(loader: AssetLoader, path: string) {
        this.loader = loader;
        this.path = path;
    }
}

export default DeferredPackageLoader;
export { DeferredPackageLoader };