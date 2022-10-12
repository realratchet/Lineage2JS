import BufferValue from "../buffer-value";
import UExport from "./un-export";
import UField from "./un-field";
import UObject from "./un-object";
import UPackage from "./un-package";
import UTextBuffer from "./un-text-buffer";

class UStruct extends UField {
    protected textBufferId: number;
    protected textBuffer: UTextBuffer;

    protected childrenId: number;
    protected children: UField;

    protected friendlyName: string;
    protected line: number;
    protected textPos: number;
    unkNum0: number;

    protected doLoad(pkg: UPackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const compat32 = new BufferValue(BufferValue.compat32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const int32 = new BufferValue(BufferValue.int32);

        debugger;

        this.textBufferId = pkg.read(compat32).value as number;

        // this.textBuffer.load(pkg, exp);
        this.childrenId = pkg.read(compat32).value as number;

        const nameId = pkg.read(compat32).value as number;
        this.friendlyName = pkg.nameTable[nameId].name.value as string;

        if (verLicense >= 0x19)
            this.unkNum0 = pkg.read(int32).value as number;

        debugger;

        this.line = pkg.read(uint32).value as number;
        this.textPos = pkg.read(uint32).value as number;

        let scriptSize = pkg.read(uint32).value as number;

        // debugger;

        while (scriptSize > 0) {
            const scriptBytes = pkg.read(BufferValue.allocBytes(scriptSize)).string;

            debugger;
        }

        // debugger;

        this.promisesLoading.push(new Promise<void>(async resolve => {

            if (this.textBufferId !== 0)
                this.textBuffer = await pkg.fetchObject<UTextBuffer>(this.textBufferId);

            if (this.childrenId !== 0) {
                let children = await pkg.fetchObject<UField>(this.childrenId);

                // while (children) {
                //     debugger;
                // }
            }

            resolve();
        }));
    }
}

export default UStruct;
export { UStruct };