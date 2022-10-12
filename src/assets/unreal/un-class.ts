import BufferValue from "../buffer-value";
import UExport from "./un-export";
import UObject from "./un-object";
import UPackage from "./un-package";
import UState from "./un-state";

class UClass extends UState {
    classFlags: number;
    classGuid: DataView;
    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const uint32 = new BufferValue(BufferValue.uint32);
        const compat32 = new BufferValue(BufferValue.compat32);

        if (verArchive <= 61) {
            debugger;
        }

        this.classFlags = pkg.read(uint32).value as number;
        this.classGuid = pkg.read(BufferValue.allocBytes(16)).value as DataView;

        const depCount = pkg.read(compat32).value as number;
        const depList = [];

        for (let i = 0; i < depCount; i++) {
            const depIndex = pkg.read(compat32).value as number;
            const depDeep = pkg.read(uint32).value as number;
            const depScriptTextCRC = pkg.read(uint32).value as number;

            depList.push([depIndex, depDeep, depScriptTextCRC]);
        }

        const impCount = pkg.read(compat32).value as number;
        const impList = [];

        for (let i = 0; i < impCount; i++) {
            const impIndex = pkg.read(compat32).value as number;
            const impNameId = pkg.read(compat32).value as number;
            const impName = pkg.nameTable[impNameId];

            impList.push([impIndex, impNameId, impName?.name.value as string]);
        }

        this.readHead = pkg.tell();

        debugger;


    }
}

export default UClass;
export { UClass };