import { BufferValue } from "@l2js/core";

const uint32 = new BufferValue(BufferValue.uint32);
const uint8 = new BufferValue(BufferValue.uint8)
const utf16 = new BufferValue(BufferValue.utf16);

class UTF16ContainerType implements IDatContainerType {
    public isContainerType = true;

    read(pkg: C.UEncodedFile): string[] {
        const count = pkg.read(uint32).value as number;
        const elements = new Array<string>(count);

        for (let i = 0; i < count; i++)
            elements[i] = pkg.read(utf16).value as string;

        return elements;
    }
}

class NumberContainerType implements IDatContainerType {
    public isContainerType = true;

    protected dtype: BufferValue<any>;

    constructor(dtype: C.ValidTypes_T<any>) {
        this.dtype = new BufferValue(dtype);
    }

    read(pkg: C.UEncodedFile): number[] {
        const count = pkg.read(uint8).value as number;

        if (count === 0) return [];

        const elements = new Array<number>(count);

        for (let i = 0; i < count; i++) {
            elements[i] = pkg.read(this.dtype).value as number;
        }

        return elements;
    }
}

export { UTF16ContainerType, NumberContainerType };