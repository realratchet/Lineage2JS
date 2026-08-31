import { BufferValue, type UEncodedFile, type ValidTypes_T, type ValueTypeNames_T } from "@l2js/core";

const decoderASCF = new TextDecoder("windows-1252");
const decoderUTF16 = new TextDecoder("utf-16");

function readUTF16(pkg: UEncodedFile): string {
    return pkg.read(new BufferValue(BufferValue.utf16)).value as string;
}

class ASCFType implements IDatContainerType {
    public isContainerType = true;

    public read(pkg: UEncodedFile): string {
        const count = pkg.read("compat32");

        if (count === 0) return "";

        const isUnicode = count < 0;
        const terminatorSize = isUnicode ? 2 : 1;
        const byteLength = (Math.abs(count) - 1) * terminatorSize;
        const view = pkg.read(byteLength);
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);

        pkg.seek(terminatorSize);

        return (isUnicode ? decoderUTF16 : decoderASCF).decode(bytes);
    }
}

class UTF16ContainerType implements IDatContainerType {
    public isContainerType = true;

    public read(pkg: UEncodedFile): string[] {
        const count = pkg.read("uint32");
        const elements = new Array<string>(count);

        for (let i = 0; i < count; i++)
            elements[i] = readUTF16(pkg);

        return elements;
    }
}

class UTF16SizedContainerType implements IDatContainerType {
    public isContainerType = true;

    protected size: number | string;

    public constructor(size: number | string) {
        this.size = size;
    }

    public read(pkg: UEncodedFile, values: Record<string, any>): string[] {
        const count = typeof this.size === "number" ? this.size : values[this.size] as number;
        const elements = new Array<string>(count);

        for (let i = 0; i < count; i++)
            elements[i] = readUTF16(pkg);

        return elements;
    }
}

class NumberContainerType implements IDatContainerType {
    public isContainerType = true;

    protected dtype: BufferValue<any>;

    public constructor(dtype: ValidTypes_T<any>) {
        this.dtype = new BufferValue(dtype);
    }

    public read(pkg: UEncodedFile): number[] {
        const count = pkg.read("compat32");

        if (count === 0) return [];

        const elements = new Array<number>(count);

        for (let i = 0; i < count; i++)
            elements[i] = pkg.read(this.dtype).value as number;

        return elements;
    }
}

class SizedContainerType implements IDatContainerType {
    public isContainerType = true;

    protected dtype: ValueTypeNames_T;
    protected size: number | string;

    public constructor(dtype: ValueTypeNames_T, size: number | string) {
        this.dtype = dtype;
        this.size = size;
    }

    public read(pkg: UEncodedFile, values: Record<string, any>): any[] {
        const count = typeof this.size === "number" ? this.size : values[this.size] as number;
        const elements = new Array<any>(count);

        for (let i = 0; i < count; i++)
            elements[i] = this.dtype === "utf16" ? readUTF16(pkg) : pkg.read(this.dtype as any);

        return elements;
    }
}

class UTF16PairContainerType implements IDatContainerType {
    public isContainerType = true;

    public read(pkg: UEncodedFile): [string[], string[]] {
        const meshCount = pkg.read("int32");
        const meshes = new Array<string>(meshCount);

        for (let i = 0; i < meshCount; i++)
            meshes[i] = readUTF16(pkg);

        const textureCount = pkg.read("int32");
        const textures = new Array<string>(textureCount);

        for (let i = 0; i < textureCount; i++)
            textures[i] = readUTF16(pkg);

        return [meshes, textures];
    }
}

class MaterialContainerType implements IDatContainerType {
    public isContainerType = true;

    public read(pkg: UEncodedFile): [number, number][] {
        const count = pkg.read("int32");
        const materials = new Array<[number, number]>(count);

        for (let i = 0; i < count; i++)
            materials[i] = [pkg.read("int32"), pkg.read("int32")];

        return materials;
    }
}

class ConditionalType implements IDatContainerType {
    public isContainerType = true;

    protected type: ValueTypeNames_T | IDatContainerType;
    protected field: string;
    protected value: number;

    public constructor(type: ValueTypeNames_T | IDatContainerType, field: string, value: number) {
        this.type = type;
        this.field = field;
        this.value = value;
    }

    public read(pkg: UEncodedFile, values: Record<string, any>): any {
        if (values[this.field] !== this.value) return undefined;

        if (this.type === "utf16") return readUTF16(pkg);
        if (typeof this.type === "string") return pkg.read(this.type as any);
        else return this.type.read(pkg, values);
    }
}

export { ASCFType, ConditionalType, MaterialContainerType, NumberContainerType, SizedContainerType, UTF16ContainerType, UTF16PairContainerType, UTF16SizedContainerType };
