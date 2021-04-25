type UPackage = import("./un-package").UPackage;

abstract class FConstructable {
    public static readonly typeSize: number;
    public abstract async load(pkg: UPackage): Promise<this>;
}

export { FConstructable };