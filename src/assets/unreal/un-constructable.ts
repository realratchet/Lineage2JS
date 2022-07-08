abstract class FConstructable implements IConstructable {
    public promisesLoading: Promise<any>[] = [];
    public abstract load(pkg: UPackage, tag?: PropertyTag): this;
}

export default FConstructable;
export { FConstructable };