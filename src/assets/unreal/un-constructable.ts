abstract class FConstructable implements IConstructable {
    /**
     * @obsolete this is no longer user, was used to guide parsing
     */
    public static readonly typeSize: number;
    public abstract load(pkg: UPackage, tag?: PropertyTag): this;
}

export default FConstructable;
export { FConstructable };