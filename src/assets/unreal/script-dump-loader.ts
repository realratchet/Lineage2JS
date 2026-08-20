function getOwnerId(id: string): string {
    const index = id.lastIndexOf(".");

    if (index < 0) throw new Error(`Script object '${id}' has no owner path`);

    return id.slice(0, index);
}

function getObjectId(object: C.UObject): string {
    if (!object.name) throw new Error(`Script object '${object.objectName}' has no stable package path`);

    return object.name;
}

function dumpPropertyValue(value: any): GD.ScriptPropertyValue_T {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
    if (Array.isArray(value)) return [...value].map(dumpPropertyValue);
    if (typeof value.getElements === "function") return value.getElements().map(dumpPropertyValue);
    if (typeof value.toArray === "function") return value.toArray().map(dumpPropertyValue);
    if (value.constructor?.plainStructFields) {
        const propertyMap = value.constructor._propertyMapCache || value.getPropertyMap();
        const result: Record<string, GD.ScriptPropertyValue_T> = {};

        for (const [name, field] of Object.entries(propertyMap)) result[name] = dumpPropertyValue(value[field as string]);

        return result;
    }
    if (value.isObject) return value.name || value.objectName || null;

    throw new Error(`Cannot transfer UnrealScript default '${value.constructor?.name ?? typeof value}'.`);
}

function dumpObjectScriptProperties(object: C.UObject): Record<string, GD.ScriptPropertyValue_T> {
    const properties: Record<string, GD.ScriptPropertyValue_T> = {};

    for (const name of Map.prototype.keys.call(object.propertyDict))
        properties[name] = dumpPropertyValue(object.propertyDict.get(name));

    return properties;
}

function makeStructDefault(field: C.UStructProperty): GD.ScriptPropertyValue_T {
    const struct = field.value.loadSelf();
    const name = struct.friendlyName.toLowerCase();

    switch (name) {
        case "vector":
        case "rotator": return [0, 0, 0];
        case "color":
        case "plane":
        case "quat":
        case "quaternion": return [0, 0, 0, 0];
    }

    const value: Record<string, GD.ScriptPropertyValue_T> = {};

    for (const child of struct.childPropFields.values()) {
        child.loadSelf();

        const childValue = child.getDefaultValue();

        value[child.propertyName] = childValue === null && child.getTypeName() === "Struct"
            ? makeStructDefault(child as C.UStructProperty)
            : dumpPropertyValue(childValue);
    }

    return value;
}

function dumpClassDefaults(cls: C.UClass): Record<string, GD.ScriptPropertyValue_T> {
    const defaults = dumpObjectScriptProperties(cls);

    for (const field of cls.childPropFields.values()) {
        field.loadSelf();

        const name = field.propertyName;
        if (name in defaults) continue;

        const value = field.getDefaultValue();

        defaults[name] = value === null && field.getTypeName() === "Struct"
            ? makeStructDefault(field as C.UStructProperty)
            : dumpPropertyValue(value);
    }

    return defaults;
}

function resolveEntryIndex(entriesByOffset: Map<number, number>, virtualSize: number, virtualOffset: number): number {
    if (virtualOffset === virtualSize) return entriesByOffset.size;

    const index = entriesByOffset.get(virtualOffset);

    if (index === undefined) throw new Error(`Script target '${virtualOffset}' is not an expression boundary`);

    return index;
}

function dumpBytecodeValue(script: C.UStruct, entry: C.ScriptBytecodeEntry_T, entriesByOffset: Map<number, number>, virtualSize: number): GD.ScriptBytecodeValue_T {
    const value = entry.value;

    switch (entry.type) {
        case "nameRef": return script.getScriptName(value);
        case "propertyRef":
        case "objectRef":
        case "classRef":
        case "structRef":
        case "functionRef": return script.getScriptObjectPath(value);
        case "codeOffset": return value === 0xffff ? value : { virtualOffset: value, entryIndex: resolveEntryIndex(entriesByOffset, virtualSize, value) };
        case "skipOffset": {
            const virtualOffset = entry.offset + 2 + value;

            return { virtualOffset, entryIndex: resolveEntryIndex(entriesByOffset, virtualSize, virtualOffset) };
        }
        case "contextSkipOffset": {
            const virtualOffset = entry.offset + 3 + value;

            return { virtualOffset, entryIndex: resolveEntryIndex(entriesByOffset, virtualSize, virtualOffset) };
        }
        case "label": return value.isNone()
            ? { name: value.name, virtualOffset: value.offset, entryIndex: -1 }
            : { name: value.name, virtualOffset: value.offset, entryIndex: resolveEntryIndex(entriesByOffset, virtualSize, value.offset) };
        case "vector": return [value.x, value.y, value.z];
        case "rotator": return [value.pitch, value.yaw, value.roll];
        default:
            if (typeof value === "number" || typeof value === "string") return value;

            throw new Error(`Script bytecode entry '${entry.type}' contains a non-transferable '${value?.constructor?.name ?? typeof value}' value`);
    }
}

function dumpProgram(script: C.UStruct): GD.IScriptProgramDecodeInfo {
    const entries = script.getScriptBytecode().filter(entry => entry.type !== "nativeIndex");
    const entriesByOffset = new Map<number, number>();
    const virtualSize = script.getScriptSize();

    entries.forEach((entry, index) => entriesByOffset.set(entry.offset, index));

    return {
        virtualSize,
        entries: entries.map(entry => ({
            virtualOffset: entry.offset,
            type: entry.type,
            value: dumpBytecodeValue(script, entry, entriesByOffset, virtualSize),
            tokenName: entry.tokenName
        }))
    };
}

function dumpFields(script: C.UStruct): GD.IScriptFieldDecodeInfo[] {
    return [...script.childPropFields.values()].map(field => {
        field = field.loadSelf();

        return {
            id: getObjectId(field),
            name: field.propertyName,
            type: field.getTypeName(),
            arrayDimensions: field.arrayDimensions,
            flags: field.getPropertyFlags()
        };
    });
}

function dumpFunction(fn: C.UFunction): GD.IScriptFunctionDecodeInfo {
    fn = fn.loadSelf();

    const id = getObjectId(fn);

    return {
        id,
        owner: getOwnerId(id),
        name: fn.objectName,
        nativeIndex: fn.getNativeFuncIndex(),
        operatorPrecedence: fn.getOperatorPrecedence(),
        flags: fn.getFunctionFlags(),
        replicationOffset: fn.getReplicationOffset(),
        fields: dumpFields(fn),
        program: dumpProgram(fn)
    };
}

function dumpState(state: C.UState): GD.IScriptStateDecodeInfo {
    state = state.loadSelf();

    const id = getObjectId(state);

    return {
        id,
        owner: getOwnerId(id),
        name: state.objectName,
        flags: state.getStateFlags(),
        probeMask: state.getProbeMask(),
        ignoreMask: state.getIgnoreMask(),
        labelTableVirtualOffset: state.getLabelTableOffset(),
        fields: dumpFields(state),
        functionIds: state.childFunctions.map(fn => getObjectId(fn)),
        program: dumpProgram(state)
    };
}

function pullScriptClasses(library: GD.DecodeLibrary, classes: Iterable<C.UClass>): void {
    const seenClasses = new Set<string>();

    function pullFunction(fn: C.UFunction) {
        const id = getObjectId(fn);

        if (id in library.scriptFunctions) return;

        library.scriptFunctions[id] = dumpFunction(fn);
    }

    function pullState(state: C.UState) {
        const id = getObjectId(state);

        if (id in library.scriptStates) return;

        state = state.loadSelf();

        for (const fn of state.childFunctions) pullFunction(fn);

        library.scriptStates[id] = dumpState(state);
    }

    function pullClass(cls: C.UClass) {
        cls = cls.loadSelf();

        const id = getObjectId(cls);

        if (seenClasses.has(id)) return;

        seenClasses.add(id);

        const superClass = cls.superField as C.UClass;

        if (superClass && !superClass.exp?.isFake) pullClass(superClass);
        if (cls.exp?.isFake) return;

        for (const fn of cls.childFunctions) pullFunction(fn);
        for (const state of cls.childStates) pullState(state);

        const stateInfo = dumpState(cls);

        library.scriptClasses[id] = {
            ...stateInfo,
            superClassId: superClass ? getObjectId(superClass) : null,
            classFlags: cls.getClassFlags(),
            stateIds: cls.childStates.map(state => getObjectId(state)),
            defaults: dumpClassDefaults(cls)
        };
    }

    for (const cls of classes)
        if (cls) pullClass(cls);
}

function pullScriptDumps(library: GD.DecodeLibrary, ...actorLists: Iterable<C.UObject>[]): void {
    const classes = new Set<C.UClass>();

    for (const actors of actorLists)
        for (const actor of actors) {
            if (!actor) continue;

            const cls = (actor.constructor as any).hostClass as C.UClass;

            if (cls) classes.add(cls);
        }

    pullScriptClasses(library, classes);
}

export default pullScriptDumps;
export { pullScriptDumps, pullScriptClasses, dumpObjectScriptProperties };
