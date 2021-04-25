import BufferValue from "../buffer-value";

type UPackage = import("./un-package").UPackage;
type FConstructable = import("./un-contructable").FConstructable;
type FConstructableConstructor = typeof import("./un-contructable").FConstructable;

class FArray<T extends FConstructable = FConstructable> {
    protected list: T[];
    protected readonly fieldCount: number;
    protected readonly fieldSize: number;
    protected elemCount: number;
    protected Constructor: { new(...any: any): T };

    public getElemCount() { return this.elemCount; }
    public getElem(idx: number) { return this.list[idx]; }

    public constructor(constr: { new(...any: any): T } & FConstructableConstructor) {
        if (!isFinite(constr.fieldCount) || !isFinite(constr.fieldSize))
            throw new Error(`Invalid fields for FConstructable: ${constr.name}`);

        this.fieldCount = constr.fieldCount;
        this.fieldSize = constr.fieldSize;
        this.Constructor = constr;
    }

    public async load(pkg: UPackage): Promise<this> {
        const count = pkg.read(new BufferValue(BufferValue.compat32));
        const elSize = this.fieldCount * this.fieldSize;

        this.elemCount = count.value as number;
        this.list = new Array(count.value as number);

        if (count.value as number === 0) return this;

        const bufferLen = count.value as number * elSize;
        const buffer = BufferValue.allocBytes(bufferLen);
        pkg.read(buffer);

        for (let i = 0, len = this.elemCount; i < len; i++) {
            const slice = buffer.slice(i * elSize, (i + 1) * elSize);
            this.list[i] = new this.Constructor(slice);
        }

        return this;
    }
}

export default FArray;
export { FArray };