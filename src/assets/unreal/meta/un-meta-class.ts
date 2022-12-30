import FArray from "../un-array";
import FNumber from "../un-number";
import UMetaState from "./un-meta-state";
import BufferValue from "../../buffer-value";
import FConstructable from "../un-constructable";
import UPackage from "../un-package";
import { PropertyTag } from "../un-property-tag";

class FDependencies extends FConstructable {
    protected classId: number;

    public scriptTextCRC: number;
    public depth: number;
    public class: UClass;

    public load(pkg: UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const int32 = new BufferValue(BufferValue.int32);

        this.classId = pkg.read(compat32).value as number;
        this.depth = pkg.read(uint32).value as number;
        this.scriptTextCRC = pkg.read(int32).value as number;

        return this;
    }
}

class UMetaClass extends UMetaState {
    protected classFlags: number;
    protected classGuid: DataView;
    protected dependencies = new FArray(FDependencies);
    protected pkgImportIds: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);
    protected pkgImportIds2: FArray<FNumber> = new FArray(FNumber.forType(BufferValue.compat32) as any);
    protected pkgImports: UObject[];
    protected pkgImports2: UObject[];
    protected classWithinId: number;
    protected classConfigName: string;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const verArchive = pkg.header.getArchiveFileVersion();
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);

        if (verArchive <= 61) {
            debugger;
        }

        this.classFlags = pkg.read(uint32).value as number;
        this.classGuid = pkg.read(BufferValue.allocBytes(16)).value as DataView;

        this.dependencies.load(pkg);
        this.pkgImportIds.load(pkg);

        if (verArchive >= 0x3e) {
            this.classWithinId = pkg.read(compat32).value as number;

            const nameId = pkg.read(compat32).value as number;

            this.classConfigName = pkg.nameTable[nameId].name as string;
        }

        if (verArchive >= 0x63)
            this.pkgImportIds2.load(pkg);

        this.readNamedProps(pkg);
    }

    protected readNamedProps(pkg: UPackage) {
        this.readHead = pkg.tell();

        if (this.readHead < this.readTail) {
            do {
                const tag = PropertyTag.from(pkg, this.readHead);

                if (!tag.isValid()) break;

                debugger;

                this.loadProperty(pkg, tag);

                this.readHead = pkg.tell();

            } while (this.readHead < this.readTail);
        }
    }
}

export default UMetaClass;
export { UMetaClass };