type UPackage = import("./un-package").UPackage;
type PropertyTag = import("./un-property").PropertyTag;

abstract class FConstructable implements IConstructable {
    /**
     * @obsolete this is no longer user, was used to guide parsing
     */
    public static readonly typeSize: number;
    public abstract async load(pkg: UPackage, tag?: PropertyTag): Promise<this>;
}

export default FConstructable;
export { FConstructable };