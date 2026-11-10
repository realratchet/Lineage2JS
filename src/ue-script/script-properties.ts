const cachePropertyNames = new Map<string, string>();

export function getScriptPropertyName(id: string): string {
    let name = cachePropertyNames.get(id);

    if (name === undefined) cachePropertyNames.set(id, name = id.slice(id.lastIndexOf(".") + 1).toLowerCase());

    return name;
}

const cachePropertyKeys = new WeakMap<Map<string, unknown>, { size: number, keys: Map<string, string> }>();

export function findScriptPropertyKey(properties: Map<string, unknown>, name: string): string | undefined {
    let cache = cachePropertyKeys.get(properties);

    if (!cache || cache.size !== properties.size) { // property keys are only ever added, so size tracks the key set
        const keys = new Map<string, string>();

        for (const key of properties.keys()) {
            const short = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
            if (!keys.has(short)) keys.set(short, key);
        }

        cache = { size: properties.size, keys };
        cachePropertyKeys.set(properties, cache);
    }

    return cache.keys.get(name);
}
