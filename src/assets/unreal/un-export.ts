import BufferValue from "../buffer-value";

class UExport {
    public idClass = new BufferValue(BufferValue.compat32);
    public idSuper = new BufferValue(BufferValue.compat32);
    public idPackage = new BufferValue(BufferValue.uint32);
    public name: string = null;
    public flags = new BufferValue(BufferValue.uint32);
    public size = new BufferValue(BufferValue.compat32);
    public offset = new BufferValue(BufferValue.compat32);
}

export default UExport;
export { UExport };