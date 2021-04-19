import BufferValue from "../buffer-value";

class UImport {
    public className: string = null;
    public packageIndex = new BufferValue(BufferValue.int32);
    public objectName: string = null;
    public classPackage: string = null;
}

export default UImport;
export { UImport };