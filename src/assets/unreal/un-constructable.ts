type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property").PropertyTag;

abstract class FConstructable {
    public static readonly typeSize: number;
    public abstract async load(pkg: UPackage, tag: PropertyTag): Promise<this>;
}

export default FConstructable;
export { FConstructable };