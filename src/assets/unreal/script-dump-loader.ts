import { ExprToken_T, ObjectFlags_T, type ScriptBytecodeEntry_T, type UClass, type UFunction, type UObject, type UState, type UStruct, type UProperty, type UStructProperty, type UArrayProperty, type PropertyTypes_T } from "@l2js/core";
import type { DecodeLibrary } from "./decode-library";
import type { Vector3Arr } from "./library-types";

export type ScriptBytecodeValue_T = number | string | null | Vector3Arr | IScriptBytecodeOffsetDecodeInfo | IScriptBytecodeLabelDecodeInfo;
export type IScriptBytecodeOffsetDecodeInfo = { virtualOffset: number, entryIndex: number };
export type IScriptBytecodeLabelDecodeInfo = IScriptBytecodeOffsetDecodeInfo & { name: string };
export type IScriptBytecodeEntryDecodeInfo = { virtualOffset: number, type: string, value: ScriptBytecodeValue_T, tokenName?: string, arrayElementDefault?: ScriptPropertyValue_T };
export type IScriptProgramDecodeInfo = { virtualSize: number, entries: IScriptBytecodeEntryDecodeInfo[] };

export type IScriptFieldDecodeInfo = {
    id: string,
    name: string,
    type: PropertyTypes_T,
    arrayDimensions: number,
    flags: number,
    innerId?: string,
    structFieldIds?: string[]
};

export type IScriptFunctionDecodeInfo = {
    id: string,
    owner: string,
    name: string,
    nativeIndex: number,
    operatorPrecedence: number,
    flags: number,
    replicationOffset: number,
    fields: IScriptFieldDecodeInfo[],
    program: IScriptProgramDecodeInfo
};

export type IScriptStateDecodeInfo = {
    id: string,
    owner: string,
    name: string,
    superStateId: string | null,
    flags: number,
    probeMask: bigint,
    ignoreMask: bigint,
    labelTableVirtualOffset: number,
    fields: IScriptFieldDecodeInfo[],
    functionIds: string[],
    program: IScriptProgramDecodeInfo
};

export type IScriptClassDecodeInfo = IScriptStateDecodeInfo & {
    superClassId: string | null,
    withinClassId: string,
    classFlags: number,
    propertyFields: Record<string, IScriptFieldDecodeInfo>,
    isNative: boolean,
    stateIds: string[],
    defaults: Record<string, ScriptPropertyValue_T>
};

export type ScriptPropertyValue_T = number | boolean | string | null | ScriptPropertyValue_T[] | { [key: string]: ScriptPropertyValue_T };

const cacheFunctions = new WeakMap<UFunction, IScriptFunctionDecodeInfo>();

function getOwnerId(id: string): string {
    const index = id.lastIndexOf(".");

    if (index < 0) throw new Error(`Script object '${id}' has no owner path`);

    return id.slice(0, index);
}

function getObjectId(object: UObject): string {
    if (!object.name) throw new Error(`Script object '${object.objectName}' has no stable package path`);

    return object.name;
}

function dumpPropertyValue(value: any): ScriptPropertyValue_T {
    if (value === null || value === undefined) return null;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
    if (Array.isArray(value)) return [...value].map(dumpPropertyValue);
    if (typeof value.getTypedArray === "function") return Array.from(value.getTypedArray(), dumpPropertyValue);
    if (typeof value.getElements === "function") return value.getElements().map(dumpPropertyValue);
    if (typeof value.toArray === "function") return value.toArray().map(dumpPropertyValue);
    if (value.constructor?.plainStructFields) {
        const propertyMap = value.constructor._propertyMapCache || value.getPropertyMap();
        const result: Record<string, ScriptPropertyValue_T> = {};

        for (const [name, field] of Object.entries(propertyMap)) result[name] = dumpPropertyValue(value[field as string]);

        return result;
    }
    if (value.isObject) return value.name || value.objectName || null;

    throw new Error(`Cannot transfer UnrealScript default '${value.constructor?.name ?? typeof value}'.`);
}

export function dumpObjectScriptProperties(object: UObject): Record<string, ScriptPropertyValue_T> {
    const properties: Record<string, ScriptPropertyValue_T> = {};

    for (const name of object.propertyDict.keys()) {
        const value = object.propertyDict.get(name);

        properties[name] = Array.isArray(value) && (value.includes(null) || value.includes(undefined))
            ? dumpFieldValue((object as any).findValidProperty(name).loadSelf(), value)
            : dumpPropertyValue(value);
    }

    return properties;
}

function makeStructDefault(field: UStructProperty): ScriptPropertyValue_T {
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

    const value: Record<string, ScriptPropertyValue_T> = {};

    for (const child of struct.childPropFields.values()) {
        child.loadSelf();

        value[child.propertyName] = dumpFieldValue(child, child.getDefaultValue());
    }

    return value;
}

function dumpFieldValue(field: UProperty, value: any): ScriptPropertyValue_T {
    if (field.arrayDimensions > 1) {
        const defaults = field.getDefaultValue() as any[];

        return Array.from(value, (element, index) => element === null || element === undefined
            ? field.getTypeName() === "Struct" ? makeStructDefault(field as UStructProperty) : field.getTypeName() === "Array" ? [] : dumpPropertyValue(defaults[index])
            : dumpPropertyValue(element));
    }

    if (value === null && field.getTypeName() === "Array") return [];

    return value === null && field.getTypeName() === "Struct" ? makeStructDefault(field as UStructProperty) : dumpPropertyValue(value);
}

function dumpClassDefaults(cls: UClass): Record<string, ScriptPropertyValue_T> {
    const defaults = dumpObjectScriptProperties(cls);

    for (const field of cls.childPropFields.values()) {
        field.loadSelf();

        const name = field.propertyName;
        if (name in defaults) continue;

        defaults[name] = dumpFieldValue(field, field.getDefaultValue());
    }

    return defaults;
}

function resolveEntryIndex(entriesByOffset: Map<number, number>, virtualSize: number, virtualOffset: number): number {
    if (virtualOffset === virtualSize) return entriesByOffset.size;

    const index = entriesByOffset.get(virtualOffset);

    if (index === undefined) throw new Error(`Script target '${virtualOffset}' is not an expression boundary`);

    return index;
}

function dumpBytecodeValue(script: UStruct, entry: ScriptBytecodeEntry_T, entriesByOffset: Map<number, number>, virtualSize: number): ScriptBytecodeValue_T {
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

            // Retail PlayerInput.ChangeSnapView has an unused null-context target inside a property operand.
            return { virtualOffset, entryIndex: virtualOffset === virtualSize ? entriesByOffset.size : entriesByOffset.get(virtualOffset) ?? -1 };
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

function dumpProgram(script: UStruct): IScriptProgramDecodeInfo {
    const entries = script.getScriptBytecode().filter(entry => entry.type !== "nativeIndex");
    const entriesByOffset = new Map<number, number>();
    const virtualSize = script.getScriptSize();

    entries.forEach((entry, index) => entriesByOffset.set(entry.offset, index));

    return {
        virtualSize,
        entries: entries.map(entry => {
            const value: IScriptBytecodeEntryDecodeInfo = {
                virtualOffset: entry.offset,
                type: entry.type,
                value: dumpBytecodeValue(script, entry, entriesByOffset, virtualSize),
                tokenName: entry.tokenName
            };

            if (entry.type === "propertyRef") {
                const field = (script as any).pkg.fetchObject(entry.value).loadSelf() as UProperty;

                if (field.getTypeName() === "Array") {
                    const inner = (field as UArrayProperty).value.loadSelf();

                    value.arrayElementDefault = dumpFieldValue(inner, inner.getDefaultValue());
                }
            }

            return value;
        })
    };
}

function dumpFields(script: UStruct): IScriptFieldDecodeInfo[] {
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

function getClassWithin(cls: UClass): UClass {
    const index = (cls as any).classWithinId;

    if (!Number.isInteger(index) || !index) throw new Error(`Script class '${cls.name}' has no Within class.`);
    const within = (cls as any).pkg.fetchObject(index).loadSelf() as UClass;

    if (!within.isClass) throw new Error(`Script class '${cls.name}' has invalid Within '${within.name}'.`);
    return within;
}

function dumpPropertyFields(script: UStruct): Record<string, IScriptFieldDecodeInfo> {
    const fields: Record<string, IScriptFieldDecodeInfo> = {};

    function pullField(field: UProperty): string {
        field = field.loadSelf();
        const id = getObjectId(field);

        if (id in fields) return id;

        const info: IScriptFieldDecodeInfo = fields[id] = { id, name: field.propertyName, type: field.getTypeName(), arrayDimensions: field.arrayDimensions, flags: field.getPropertyFlags() };

        if (info.type === "Array") info.innerId = pullField((field as UArrayProperty).value);
        if (info.type === "Struct") {
            info.structFieldIds = [];

            for (let struct = (field as UStructProperty).value.loadSelf(); struct; struct = struct.superField as UStruct)
                for (const child of struct.childPropFields.values()) info.structFieldIds.push(pullField(child));
        }
        return id;
    }

    for (const field of script.childPropFields.values()) pullField(field);

    return fields;
}

function dumpFunction(fn: UFunction): IScriptFunctionDecodeInfo {
    fn = fn.loadSelf();

    if (cacheFunctions.has(fn)) return cacheFunctions.get(fn)!;

    const id = getObjectId(fn);

    const info: IScriptFunctionDecodeInfo = {
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

    cacheFunctions.set(fn, info);
    return info;
}

function dumpState(state: UState): IScriptStateDecodeInfo {
    state = state.loadSelf();

    const id = getObjectId(state), superState = state.superField;

    return {
        id,
        owner: getOwnerId(id),
        name: state.objectName,
        superStateId: superState && !superState.exp?.isFake ? getObjectId(superState) : null,
        flags: state.getStateFlags(),
        probeMask: state.getProbeMask(),
        ignoreMask: state.getIgnoreMask(),
        labelTableVirtualOffset: state.getLabelTableOffset(),
        fields: dumpFields(state),
        functionIds: state.childFunctions.map(fn => getObjectId(fn)),
        program: dumpProgram(state)
    };
}

function getConstructedClasses(script: UStruct): UClass[] {
    const entries = script.getScriptBytecode(), classes: UClass[] = [];

    if (!entries.some(entry => entry.type === "token" && entry.value === ExprToken_T.New)) return classes;

    for (const entry of entries) {
        if (entry.type !== "objectRef" || !entry.value) continue;
        const object = (script as any).pkg.fetchObject(entry.value);

        if (object?.isClass) classes.push(object);
    }

    return classes;
}

export function pullScriptClasses(library: DecodeLibrary, classes: Iterable<UClass>): void {
    const seenClasses = new Set<string>();

    function pullFunction(fn: UFunction) {
        const id = getObjectId(fn);

        if (id in library.scriptFunctions) return;

        library.scriptFunctions[id] = dumpFunction(fn);
        for (const cls of getConstructedClasses(fn)) pullClass(cls);
    }

    function pullState(state: UState) {
        const id = getObjectId(state);

        if (id in library.scriptStates) return;

        state = state.loadSelf();

        for (const fn of state.childFunctions) pullFunction(fn);

        library.scriptStates[id] = dumpState(state);
        for (const cls of getConstructedClasses(state)) pullClass(cls);

        const superState = state.superField;

        if (superState && !superState.exp?.isFake) {
            if ((superState as any).isClass) pullClass(superState as UClass);
            else pullState(superState);
        }
    }

    function pullClass(cls: UClass) {
        cls = cls.loadSelf();

        const id = getObjectId(cls);

        if (seenClasses.has(id)) return;

        seenClasses.add(id);

        const superClass = cls.superField as UClass;

        if (superClass && !superClass.exp?.isFake) pullClass(superClass);
        if (cls.exp?.isFake) return;

        for (const fn of cls.childFunctions) pullFunction(fn);
        for (const state of cls.childStates) pullState(state);

        const stateInfo = dumpState(cls);

        library.scriptClasses[id] = {
            ...stateInfo,
            superClassId: superClass ? getObjectId(superClass) : null,
            withinClassId: getObjectId(getClassWithin(cls)),
            classFlags: cls.getClassFlags(),
            propertyFields: dumpPropertyFields(cls),
            isNative: !!(cls.exp.flags & ObjectFlags_T.RF_Native),
            stateIds: cls.childStates.map(state => getObjectId(state)),
            defaults: dumpClassDefaults(cls)
        };
        pullClass(getClassWithin(cls));
        for (const constructed of getConstructedClasses(cls)) pullClass(constructed);
    }

    for (const cls of classes)
        if (cls) pullClass(cls);
}

export function pullScriptClassFunctions(library: DecodeLibrary, classes: Iterable<UClass>): void {
    const seenClasses = new Set<string>();

    function pullClass(cls: UClass): void {
        cls = cls.loadSelf();

        const id = getObjectId(cls);

        if (seenClasses.has(id)) return;
        if (id in library.scriptClasses) return;

        seenClasses.add(id);

        const superClass = cls.superField as UClass;

        if (superClass && !superClass.exp?.isFake) pullClass(superClass);
        if (cls.exp?.isFake) return;

        const functions = cls.childFunctions;

        for (const fn of functions) {
            const functionId = getObjectId(fn);

            if (!(functionId in library.scriptFunctions)) library.scriptFunctions[functionId] = dumpFunction(fn);
        }

        library.scriptClasses[id] = {
            id,
            owner: getOwnerId(id),
            name: cls.objectName,
            superStateId: superClass && !superClass.exp?.isFake ? getObjectId(superClass) : null,
            flags: cls.getStateFlags(),
            probeMask: cls.getProbeMask(),
            ignoreMask: cls.getIgnoreMask(),
            labelTableVirtualOffset: cls.getLabelTableOffset(),
            fields: dumpFields(cls),
            functionIds: functions.map(fn => getObjectId(fn)),
            program: { virtualSize: 0, entries: [] },
            superClassId: superClass ? getObjectId(superClass) : null,
            withinClassId: getObjectId(getClassWithin(cls)),
            classFlags: cls.getClassFlags(),
            propertyFields: dumpPropertyFields(cls),
            isNative: !!(cls.exp.flags & ObjectFlags_T.RF_Native),
            stateIds: [],
            defaults: dumpClassDefaults(cls)
        };
        pullClass(getClassWithin(cls));
        pullScriptClasses(library, functions.flatMap(getConstructedClasses));
    }

    for (const cls of classes)
        if (cls) pullClass(cls);
}

export function pullScriptDumps(library: DecodeLibrary, ...actorLists: Iterable<UObject>[]): void {
    const classes = new Set<UClass>();

    for (const actors of actorLists)
        for (const actor of actors) {
            if (!actor) continue;

            const cls = (actor.constructor as any).hostClass as UClass;

            if (cls) classes.add(cls);
        }

    pullScriptClasses(library, classes);
}

export default pullScriptDumps;
