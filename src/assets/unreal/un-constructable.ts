abstract class FConstructable implements IConstructable {
    public abstract load(pkg: UPackage, tag?: PropertyTag): this;
}

export default FConstructable;
export { FConstructable };