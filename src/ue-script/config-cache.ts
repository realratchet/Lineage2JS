type ConfigFile_T = { sections: Map<string, [string, string][]>; isDirty: boolean; };

export class ConfigCache {
    protected readonly files = new Map<string, ConfigFile_T>();
    protected readonly savedFiles = new Map<string, Map<string, [string, string][]>>();
    protected readonly systemFile: string;
    protected readonly userFile: string;
    protected readonly storage: Storage;
    protected readonly storageKey: string;

    public constructor(files: Map<string, Map<string, [string, string][]>>, systemFile: string = "l2.ini", userFile: string = "user.ini", storage: Storage = null, storageKey: string = null) {
        this.systemFile = systemFile;
        this.userFile = userFile;
        this.storage = storage;
        this.storageKey = storageKey;

        for (const [name, sections] of files)
            this.files.set(name.toLowerCase(), { sections: new Map(Array.from(sections, ([section, entries]) => [section.toLowerCase(), entries.map(([key, value]) => [key, value])])), isDirty: false });

        const saved = storage && storageKey ? storage.getItem(storageKey) : null;

        if (saved === null) return;
        const entries = JSON.parse(saved);

        if (!Array.isArray(entries)) throw new Error(`Invalid saved UnrealScript configuration.`);
        for (const file of entries) {
            if (!Array.isArray(file) || file.length !== 2 || typeof file[0] !== "string" || !Array.isArray(file[1])) throw new Error(`Invalid saved UnrealScript configuration file.`);
            const sections = new Map<string, [string, string][]>();

            for (const section of file[1]) {
                if (!Array.isArray(section) || section.length !== 2 || typeof section[0] !== "string" || !Array.isArray(section[1])) throw new Error(`Invalid saved UnrealScript configuration section.`);
                for (const pair of section[1])
                    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== "string")) throw new Error(`Invalid saved UnrealScript configuration entry.`);
                sections.set(section[0].toLowerCase(), section[1]);
            }
            const name = file[0].toLowerCase();

            this.savedFiles.set(name, sections);
            this.files.set(name, { sections, isDirty: false });
        }
    }

    public resolveFilename(filename: string = null): string {
        filename = (filename === null ? this.systemFile : filename).split("\0", 1)[0];
        const length = filename.length;

        // L2.exe FConfigCacheIni::Find 0x10910740 tests both three- and four-letter extensions.
        if (length < 5 || filename[length - 4] !== "." && filename[length - 5] !== ".") filename += ".ini";
        switch (filename.toLowerCase()) {
            case "system.ini": return this.systemFile.toLowerCase();
            case "user.ini": return this.userFile.toLowerCase();
            default: return filename.toLowerCase();
        }
    }

    public getString(section: string, key: string, filename: string = null, capacity: number = 0): string | null {
        const entries = this.getSection(section, filename);

        if (!entries) return null;
        key = key.split("\0", 1)[0].toLowerCase();
        for (let index = entries.length - 1; index >= 0; index--) {
            if (entries[index][0].toLowerCase() !== key) continue;
            const value = entries[index][1].split("\0", 1)[0];

            return capacity > 0 ? value.slice(0, capacity - 1) : value;
        }
        return null;
    }

    public getSection(section: string, filename: string = null, force: boolean = false, isConst: boolean = true): [string, string][] | null {
        const name = this.resolveFilename(filename);
        let file = this.files.get(name);

        if (!file && force) this.files.set(name, file = { sections: new Map(), isDirty: false });
        if (!file) return null;
        section = section.split("\0", 1)[0].toLowerCase();
        let entries = file.sections.get(section);

        if (!entries && force) file.sections.set(section, entries = []);
        if (!entries) return null;
        if (force || !isConst) file.isDirty = true;
        return entries;
    }

    public getSectionText(section: string, filename: string, capacity: number): string[] | null {
        const entries = this.getSection(section, filename);

        if (!entries) return null;
        const result: string[] = [];
        let offset = 0;

        for (const [name, text] of entries) {
            const key = name.split("\0", 1)[0], value = text.split("\0", 1)[0];

            // L2.exe GetSection 0x10911b20 checks key length, not the formatted entry length.
            if (offset + key.length + 1 >= capacity) break;
            const entry = `${key}=${value}`;

            result.push(entry);
            offset += entry.length + 1;
        }
        return result;
    }

    public setString(section: string, key: string, value: string, filename: string = null): void {
        const name = this.resolveFilename(filename);
        let file = this.files.get(name);

        if (!file) this.files.set(name, file = { sections: new Map(), isDirty: false });
        section = section.split("\0", 1)[0].toLowerCase();
        key = key.split("\0", 1)[0];
        value = value.split("\0", 1)[0];
        let entries = file.sections.get(section);

        if (!entries) file.sections.set(section, entries = []);
        for (let index = entries.length - 1; index >= 0; index--) {
            const entry = entries[index];

            if (entry[0].toLowerCase() !== key.toLowerCase()) continue;
            // L2.exe SetString 0x10911e90 retains the old value for case-only changes.
            if (entry[1].toLowerCase() === value.toLowerCase()) return;
            entry[1] = value;
            file.isDirty = true;
            return;
        }
        entries.push([key, value]);
        file.isDirty = true;
    }

    public flush(): void {
        const dirty = Array.from(this.files).filter(([, file]) => file.isDirty);

        if (!dirty.length) return;
        if (!this.storage || !this.storageKey) throw new Error(`UnrealScript configuration storage is not initialized.`);
        for (const [name, file] of dirty) this.savedFiles.set(name, file.sections);
        this.storage.setItem(this.storageKey, JSON.stringify(Array.from(this.savedFiles, ([name, sections]) => [name, Array.from(sections)])));
        for (const [, file] of dirty) file.isDirty = false;
    }
}

export default ConfigCache;
