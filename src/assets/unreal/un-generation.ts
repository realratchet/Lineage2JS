import BufferValue from "../buffer-value";

class UGeneration {
    public exportCount = new BufferValue(BufferValue.uint32);
    public nameCount = new BufferValue(BufferValue.uint32);
}

export default UGeneration;
export { UGeneration };