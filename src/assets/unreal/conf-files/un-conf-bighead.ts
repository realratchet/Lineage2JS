import UConfigLocalization from "./un-conf-localization";

export class UConfigBigHead extends UConfigLocalization {
    public readonly scales: Record<string, number> = {};

    public async load(): Promise<this> {
        await super.load();

        for (const [name, properties] of this.sections) {
            const property = properties.find(property => property.name.toLowerCase() === "maxsize");
            const scale = property ? Number(property.value) : 3;

            if (!Number.isFinite(scale) || scale < 1) throw new Error(`Invalid big-head scale '${name}'.`);
            this.scales[name] = Math.fround(scale);
        }

        return this;
    }
}

export default UConfigBigHead;
