import { BufferValue } from "@l2js/core";

class UTF16ContainerType implements IDatContainerType {
    public isContainerType = true;

    public read(pkg: C.UEncodedFile): string[] {
        const count = pkg.read("uint32");
        const elements = new Array<string>(count);

        for (let i = 0; i < count; i++)
            elements[i] = pkg.read("utf16");

        return elements;
    }
}

class UTF16SizedContainerType implements IDatContainerType {
    public isContainerType = true;

    protected size: number | string;

    public constructor(size: number | string) {
        this.size = size;
    }

    public read(pkg: C.UEncodedFile, values: Record<string, any>): string[] {
        const count = typeof this.size === "number" ? this.size : values[this.size] as number;
        const elements = new Array<string>(count);

        for (let i = 0; i < count; i++)
            elements[i] = pkg.read("utf16");

        return elements;
    }
}

class NumberContainerType implements IDatContainerType {
    public isContainerType = true;

    protected dtype: BufferValue<any>;

    constructor(dtype: C.ValidTypes_T<any>) {
        this.dtype = new BufferValue(dtype);
    }

    public read(pkg: C.UEncodedFile): number[] {
        const count = pkg.read("uint8");

        if (count === 0) return [];

        const elements = new Array<number>(count);

        for (let i = 0; i < count; i++)
            elements[i] = pkg.read(this.dtype).value as number;

        return elements;
    }
}

export { UTF16ContainerType, UTF16SizedContainerType, NumberContainerType };
