import BufferValue from "../buffer-value";
import UEncodedFile from "./un-encoded-file";

const CNTR = BufferValue.uint8;

interface IContainerType {
    isContainerType: boolean;
    read(pkg: UEncodedFile): any[];
}

class UTF16ContainerType implements IContainerType {
    public isContainerType = true;

    protected maxSlots: number;

    constructor(maxSlots: number) {
        this.maxSlots = maxSlots;
    }

    read(pkg: UEncodedFile): string[] {
        const count = pkg.read(new BufferValue(BufferValue.uint32)).value as number;

        if (count === 0) return [];

        const utf16 = new BufferValue(BufferValue.utf16);
        const elements = new Array<string>(count);

        for (let i = 0; i < this.maxSlots; i++) {
            const str = pkg.read(utf16).value as string;

            if (i < count)
                elements[i] = str;
        }

        return elements;
    }
}

class NumberContainerType implements IContainerType {
    public isContainerType = true;

    protected dtype: BufferValue<any>;

    constructor(dtype: ValidTypes_T<any>) {
        this.dtype = new BufferValue(dtype);
    }

    read(pkg: UEncodedFile): number[] {
        const count = pkg.read(new BufferValue(BufferValue.uint8)).value as number;

        if (count === 0) return [];

        const elements = new Array<number>(count);

        for (let i = 0; i < count; i++) {
            elements[i] = pkg.read(this.dtype).value as number;
        }

        return elements;
    }
}

const schema = [
    { type: BufferValue.uint32, name: "tag" },
    { type: BufferValue.utf16, name: "class" },
    { type: BufferValue.utf16, name: "mesh" },

    { type: new UTF16ContainerType(5), name: "tex1" },
    { type: new UTF16ContainerType(2), name: "tex2" },
    { type: new NumberContainerType(BufferValue.uint32), name: "dtab" },

    { type: BufferValue.float, name: "npc_speed" },
    { type: BufferValue.uint32, name: "UNK0" },

    { type: new UTF16ContainerType(3), name: "sound1" },
    // { type: new UTF16ContainerType(5), name: "sound2" },

    // { type: BufferValue.utf16, name: "tex2[0]" },
    // { type: BufferValue.utf16, name: "tex2[1]" },


    // // { type: BufferValue.utf16, name: "tex1[cnt_tex2]" },
    // { type: CNTR, name: "cnt_dtab1" },
    // { type: BufferValue.uint32, name: "dtab1[cnt_dtab1]" },
    // { type: BufferValue.float, name: "npc_speed" },
    // { type: BufferValue.uint32, name: "UNK_0" },
    // { type: BufferValue.uint32, name: "cnt_snd1" },
    // { type: BufferValue.utf16, name: "snd1[cnt_snd1]" },
    // { type: BufferValue.uint32, name: "cnt_snd2" },
    // { type: BufferValue.utf16, name: "snd2[cnt_snd2]" },
    // { type: BufferValue.uint32, name: "cnt_snd3" },
    // { type: BufferValue.utf16, name: "snd3[cnt_snd3]" },
    // { type: BufferValue.uint32, name: "UNK_0a" },
    // { type: CNTR, name: "unk1_cnt" },
    // { type: BufferValue.uint32, name: "unk1_tab[unk1_cnt]" },
    // { type: BufferValue.uint32, name: "level_lim_dn" },
    // { type: BufferValue.uint32, name: "level_lim_up" },
    // { type: BufferValue.utf16, name: "effect" },
    // { type: BufferValue.uint32, name: "UNK_2" },
    // { type: BufferValue.float, name: "sound_rad" },
    // { type: BufferValue.float, name: "sound_vol" },
    // { type: BufferValue.float, name: "sound_rnd" },
    // { type: BufferValue.uint32, name: "quest_be" },
    // { type: BufferValue.uint32, name: "class_lim" },
]

class UDataFile extends UEncodedFile {
    public async decode(): Promise<this> {
        if (this.buffer) return this;
        if (this.promiseDecoding) {
            await this.promiseDecoding;
            return this;
        }

        const readable = this.asReadable();
        const signature = await this._doDecode();

        const uint16 = new BufferValue(BufferValue.uint32);

        const header = this.read(uint16).value as number;

        console.assert(header === 6334, "Probably header");

        // debugger;

        const values = {};

        for (let { type, name } of schema) {
            if (name === "tex2[0]")
                debugger;

            if (!(type as IContainerType).isContainerType) {
                const schemaValue = this.read(new BufferValue(type as ValidTypes_T<any>));
                const value = schemaValue.value;

                values[name] = value as any;

                console.log(name, "->", `'${value}'`);
            } else {
                values[name] = type.read(this);

                console.log(name, "->", `[${values[name].join(", ")}]`);
            }



            // debugger;

        }

        debugger;

        return this;
    }
}

export default UDataFile;
export { UDataFile };