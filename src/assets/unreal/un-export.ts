import BufferValue from "../buffer-value";

type UObject = import("./un-object").UObject;

class UExport {
    public idClass = new BufferValue(BufferValue.compat32);
    public idSuper = new BufferValue(BufferValue.compat32);
    public idPackage = new BufferValue(BufferValue.uint32);
    public objectName: string = null;
    public flags = new BufferValue(BufferValue.uint32);
    public size = new BufferValue(BufferValue.compat32);
    public offset = new BufferValue(BufferValue.compat32);

    public object: UObject = null;
}

export default UExport;
export { UExport };