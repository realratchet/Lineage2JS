import BaseConfigFile from "./un-base-config";

type LocalizationProperty_T = {
    name: string;
    index: number;
    value: string;
};

class UConfigLocalization extends BaseConfigFile {
    protected readonly sections = new Map<string, LocalizationProperty_T[]>();

    public async load(): Promise<this> {
        const lines = this.decodeConfig().split(/\r?\n/);
        let properties: LocalizationProperty_T[] = null;

        for (const line of lines) {
            const header = /^\s*\[([^\]]+)\]\s*$/.exec(line);

            if (header) {
                properties = [];
                this.sections.set(header[1].trim().toLowerCase(), properties);
                continue;
            }

            if (!properties) continue;

            const entry = /^\s*([^=\[(]+)(?:\[(\d+)\])?\s*=\s*(.*?)\s*$/.exec(line);

            if (!entry) continue;

            properties.push({ name: entry[1].trim(), index: entry[2] === undefined ? -1 : Number(entry[2]), value: entry[3].trim() });
        }

        return this;
    }

    public getProperties(className: string): LocalizationProperty_T[] {
        return this.sections.get(className.toLowerCase()) || [];
    }
}

export default UConfigLocalization;
export { UConfigLocalization, type LocalizationProperty_T };
