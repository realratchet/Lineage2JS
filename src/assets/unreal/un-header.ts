import BufferValue from "../buffer-value";
import UGeneration from "./un-generation";

class UHeader {
    public version: number;
    public packageFlags: number;

    public nameCount: number;
    public nameOffset: number;

    public exportCount: number;
    public exportOffset: number;
    public importCount: number;
    public importOffset: number;

    public heritageCount: number;
    public heritageOffset: number;

    //DWORD generation_count;
    public generations: UGeneration[] = [];
    public guid = new BufferValue(BufferValue.guid);

    public getArchiveFileVersion() { return this.version & 0xffff; }
    public getLicenseeVersion() { return this.version >> 16; }
}

export default UHeader;
export { UHeader };