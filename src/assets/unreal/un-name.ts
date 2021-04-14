import BufferValue from "../buffer-value";

class UName {
    public name = new BufferValue<"char">(BufferValue.char);
    public flags = new BufferValue<"uint32">(BufferValue.uint32);
}

export default UName;
export { UName };