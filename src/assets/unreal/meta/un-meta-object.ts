import BufferValue from "../../buffer-value";
import { ObjectFlags_T } from "../un-export";
import { generateUUID } from "three/src/math/MathUtils";

abstract class UMetaObject {
    public readonly uuid = generateUUID();

    public objectName = "Exp_None";
    public exportIndex = 0;
    public exp: UExport = null;

    protected readHead: number = NaN;
    protected readStart: number = NaN;
    protected readTail: number = NaN;

    protected readonly skipRemaining = false;
    protected readonly careUnread = true;

    public get byteCount() { return this.readTail - this.readStart; }
    public get bytesUnread() { return this.readTail - this.readHead; }
    public get byteOffset() { return this.readHead - this.readStart; }

    protected preLoad(pkg: UPackage, exp: UExport): void {
        const flags = exp.flags as number;

        if (flags & ObjectFlags_T.HasStack && exp.size > 0) {
            debugger;
            const compat32 = new BufferValue(BufferValue.compat32);
            const int64 = new BufferValue(BufferValue.int64);
            const int32 = new BufferValue(BufferValue.int32);

            const node = pkg.read(compat32).value as number;
            /*const stateNode =*/ pkg.read(compat32).value as number;
            /*const probeMask =*/ pkg.read(int64).value as number;
            /*const latentAction =*/ pkg.read(int32).value as number;

            if (node !== 0) {
                /*const offset =*/ pkg.read(compat32).value as number;
            }
        }
    }

    protected doLoad(pkg: UPackage, exp: UExport): void {

    }

    protected postLoad(pkg: UPackage, exp: UExport): void {
        this.readHead = pkg.tell();

        if (this.skipRemaining) this.readHead = this.readTail;
        if (this.bytesUnread > 0 && this.careUnread)
            console.warn(`Unread '${this.objectName}' (${this.constructor.name}) ${this.bytesUnread} bytes (${((this.bytesUnread) / 1024).toFixed(2)} kB) in package '${pkg.path}'`);
    }

    protected setReadPointers(exp: UExport) {
        this.readStart = this.readHead = exp.offset as number;
        this.readTail = this.readHead + (exp.size as number);
    }

    public load(pkg: UPackage, exp: UExport): this {

        this.objectName = `Exp_${exp.objectName}`;
        this.exportIndex = exp.index;
        this.exp = exp;

        pkg.seek(exp.offset as number, "set");
        this.setReadPointers(exp);


        if (exp.size > 0) {
            this.preLoad(pkg, exp);
            this.doLoad(pkg, exp);
            this.postLoad(pkg, exp);
        }

        return this;
    }
};

export default UMetaObject;
export { UMetaObject };