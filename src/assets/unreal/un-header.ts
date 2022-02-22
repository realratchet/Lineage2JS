import BufferValue from "../buffer-value";
import UGeneration from "./un-generation";

class UHeader {
    public version = new BufferValue(BufferValue.uint32);
    public packageFlags = new BufferValue(BufferValue.int32);

    public nameCount = new BufferValue(BufferValue.int32);
    public nameOffset = new BufferValue(BufferValue.int32);

    public exportCount = new BufferValue(BufferValue.int32);
    public exportOffset = new BufferValue(BufferValue.int32);
    public importCount = new BufferValue(BufferValue.int32);
    public importOffset = new BufferValue(BufferValue.int32);

    public heritageCount = new BufferValue(BufferValue.uint32);
    public heritageOffset = new BufferValue(BufferValue.uint32);

    //DWORD generation_count;
    public generations: UGeneration[] = [];
    public guid = new BufferValue(BufferValue.guid);

    public getArchiveFileVersion() { return (this.version.value as number) & 0xffff; }
    public getLicenseeVersion() { return (this.version.value as number) >> 16; }
}

export default UHeader;
export { UHeader };