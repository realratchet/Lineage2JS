import BufferValue from "../buffer-value";

enum UNP_PropertyTypes {
    UNP_ByteProperty /*      */ = 0x1,
    UNP_IntProperty /*       */ = 0x2,
    UNP_BoolProperty /*      */ = 0x3,
    UNP_FloatProperty /*     */ = 0x4,
    UNP_ObjectProperty /*    */ = 0x5,
    UNP_NameProperty /*      */ = 0x6,
    UNP_StringProperty /*    */ = 0x7,
    UNP_ClassProperty /*     */ = 0x8,
    UNP_ArrayProperty /*     */ = 0x9,
    UNP_StructProperty /*    */ = 0xA,
    UNP_VectorProperty /*    */ = 0xB,
    UNP_RotatorProperty /*   */ = 0xC,
    UNP_StrProperty /*       */ = 0xD,
    UNP_MapProperty /*       */ = 0xE,
    UNP_FixedArrayProperty /**/ = 0xF
};

enum UNP_PropertyMasks {
    PROPERTY_TYPE_MASK /* */ = 0x0F,
    PROPERTY_SIZE_MASK /* */ = 0x70,
    PROPERTY_ARRAY_MASK /**/ = 0x80
};

class PropertyTag {
    protected constructor() { }

    public name: string;
    public type: UNP_PropertyTypes;
    public structName: string;
    public arrayIndex: number;
    public dataSize: number;
    public boolValue: boolean;
    public enumName: string;
    public index: number;

    static from(pkg: UPackage, offset: number): PropertyTag {
        return new PropertyTag().load(pkg, offset);
    }

    public isValid() { return !this.name || this.name !== "None"; }

    protected load(pkg: UPackage, offset: number) {
        pkg.seek(offset, "set");

        const index = pkg.read(new BufferValue(BufferValue.compat32));

        this.index = index.value as number;

        // if (!pkg.nameTable[index.value as number])
        //     debugger;
        const propName = index.value as number >= 0 && index.value < pkg.nameTable.length
            ? pkg.nameTable[index.value as number].name
            : "None";

        this.name = propName;

        if (propName === "None") return this;

        const info = pkg.read(new BufferValue(BufferValue.int8)).value as number;
        const isArray = (info & UNP_PropertyMasks.PROPERTY_ARRAY_MASK) !== 0;
        this.type = info & UNP_PropertyMasks.PROPERTY_TYPE_MASK;

        if (this.type === UNP_PropertyTypes.UNP_StructProperty) {
            pkg.read(index);
            this.structName = pkg.nameTable[index.value as number].name;
        }

        // debugger;

        switch (info & UNP_PropertyMasks.PROPERTY_SIZE_MASK) {
            case 0x00: this.dataSize = 1; break;
            case 0x10: this.dataSize = 2; break;
            case 0x20: this.dataSize = 4; break;
            case 0x30: this.dataSize = 12; break;
            case 0x40: this.dataSize = 16; break;
            case 0x50:
                this.dataSize = pkg
                    .read(new BufferValue(BufferValue.uint8))
                    .value as number;
                break;
            case 0x60:
                this.dataSize = pkg
                    .read(new BufferValue(BufferValue.uint16))
                    .value as number;
                break;
            case 0x70:
                this.dataSize = pkg
                    .read(new BufferValue(BufferValue.uint32))
                    .value as number;
                break;
        }

        this.arrayIndex = 0;
        if (isArray && this.type !== UNP_PropertyTypes.UNP_BoolProperty) {
            const b = pkg.read(new BufferValue(BufferValue.int8));

            if (b.value as number < 128) {
                this.arrayIndex = b.value as number;
            } else {
                const b2 = pkg.read(new BufferValue(BufferValue.int8));

                if (b.value as number & 0x40) { // really, (b & 0xC0) == 0xC0
                    const b3 = pkg.read(new BufferValue(BufferValue.int8));
                    const b4 = pkg.read(new BufferValue(BufferValue.int8));
                    this.arrayIndex = (
                        (b.value as number << 24) |
                        (b2.value as number << 16) |
                        (b3.value as number << 8) |
                        b4.value as number
                    ) & 0x3FFFFF;
                } else this.arrayIndex = ((b.value as number << 8) | b2.value as number) & 0x3FFF;
            }
        }

        this.boolValue = false;
        if (this.type === UNP_PropertyTypes.UNP_BoolProperty)
            this.boolValue = isArray;

        return this;
    }
}

export { PropertyTag, UNP_PropertyTypes, UNP_PropertyMasks };