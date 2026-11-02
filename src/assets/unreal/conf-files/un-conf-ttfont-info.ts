import UConfigLocalization from "./un-conf-localization";

export type TrueFont_T = { name: string; file: string; weight: number; size: number; italic: boolean; };

export class UConfigTTFontInfo extends UConfigLocalization {
    public readonly fonts: Record<string, TrueFont_T> = {};

    public async load(): Promise<this> {
        await super.load();

        for (let i = 1; i <= 4; i++) {
            const key = `font${i}`;
            const usage = this.getProperties("FontUsage").find(property => property.name.toLowerCase() === key);
            const name = this.getProperties("FontName").find(property => property.name.toLowerCase() === key);
            const weight = this.getProperties("FontWeight").find(property => property.name.toLowerCase() === key);
            const size = this.getProperties("FontSize").find(property => property.name.toLowerCase() === key);
            const italic = this.getProperties("Italic").find(property => property.name.toLowerCase() === key);
            const file = this.getProperties("FontFile").find(property => property.name.toLowerCase() === key);

            if (!usage || !name || !weight || !size || !italic) continue;

            const font = { name: name.value, file: file ? file.value : "", weight: Number(weight.value), size: Number(size.value), italic: italic.value.toLowerCase() === "true" };

            if (!font.name || !Number.isInteger(font.weight) || font.weight < 0 || font.weight > 1000 || !Number.isInteger(font.size) || font.size <= 0)
                throw new Error(`Invalid TrueFont configuration '${usage.value}'.`);

            this.fonts[usage.value.toLowerCase()] = font;
        }

        return this;
    }
}

export default UConfigTTFontInfo;
