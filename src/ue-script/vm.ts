import UNativeRegistry from "./native-registry";
import { CastToken_T, ExprToken_T } from "@l2js/core";

type ScriptValue_T = GD.ScriptPropertyValue_T | GD.IScriptBytecodeOffsetDecodeInfo | ScriptHost_T | undefined;

type ScriptProperties_T = Map<string, ScriptValue_T> | Record<string, ScriptValue_T>;

type ScriptNativeCall_T = {
    index: number,
    name: string,
    args: ScriptArgument_T[],
    self: ScriptHost_T,
    context: ScriptHost_T
};

type ScriptHost_T = {
    scriptClassId: string,
    scriptProperties?: ScriptProperties_T,
    getUnrealScriptProperty?(id: string): ScriptValue_T,
    setUnrealScriptProperty?(id: string, value: ScriptValue_T): void,
    handlesUnrealScriptFunction?(fn: GD.IScriptFunctionDecodeInfo): boolean,
    handlesUnrealNative?(index: number, name: string): boolean,
    callUnrealNative?(call: ScriptNativeCall_T): ScriptValue_T
};

type ScriptSlot_T = {
    get(): ScriptValue_T,
    set(value: ScriptValue_T): void
};

type ScriptArgument_T = ScriptValue_T | ScriptSlot_T;

type ScriptFrame_T = {
    fn: GD.IScriptFunctionDecodeInfo,
    self: ScriptHost_T,
    context: ScriptHost_T,
    locals: Map<string, ScriptArgument_T>,
    returnValue: ScriptValue_T,
    didReturn: boolean,
    stopped: boolean
};

const CPF_Parm = 0x00000080;
const CPF_OutParm = 0x00000100;
const CPF_ReturnParm = 0x00000400;
const FUNC_Native = 0x00000400;
const assignmentNatives = new Set([133, 134, 135, 136, 137, 138, 139, 140, 159, 160, 161, 162, 163, 164, 165, 166, 182, 183, 184, 185, 221, 222, 223, 224, 290, 291, 297, 318, 319]);
const postAssignmentNatives = new Set([139, 140, 165, 166]);

function getFieldName(id: string): string {
    const index = id.lastIndexOf(".");

    return index < 0 ? id : id.slice(index + 1);
}

function getProperties(host: ScriptHost_T): ScriptProperties_T {
    if (host.scriptProperties) return host.scriptProperties;

    return host as unknown as Record<string, ScriptValue_T>;
}

function findPropertyKey(properties: ScriptProperties_T, id: string): string | null {
    const name = getFieldName(id);

    if (properties instanceof Map) {
        if (properties.has(id)) return id;
        if (properties.has(name)) return name;

        const lowerId = id.toLowerCase(), lowerName = name.toLowerCase();

        for (const key of properties.keys())
            if (key.toLowerCase() === lowerId || key.toLowerCase() === lowerName) return key;
    } else {
        if (id in properties) return id;
        if (name in properties) return name;

        const lowerId = id.toLowerCase(), lowerName = name.toLowerCase();

        for (const key of Object.keys(properties))
            if (key.toLowerCase() === lowerId || key.toLowerCase() === lowerName) return key;
    }

    return null;
}

function cloneScriptValue(value: ScriptValue_T): ScriptValue_T {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(cloneScriptValue) as GD.ScriptPropertyValue_T[];

    const clone: Record<string, GD.ScriptPropertyValue_T> = {};

    for (const [key, entry] of Object.entries(value)) clone[key] = cloneScriptValue(entry) as GD.ScriptPropertyValue_T;

    return clone;
}

function getProperty(host: ScriptHost_T, id: string): ScriptValue_T {
    if (host.getUnrealScriptProperty) return host.getUnrealScriptProperty(id);

    const properties = getProperties(host);
    const key = findPropertyKey(properties, id);

    if (key === null) return null;

    return properties instanceof Map ? properties.get(key) : properties[key];
}

function setProperty(host: ScriptHost_T, id: string, value: ScriptValue_T): void {
    if (host.setUnrealScriptProperty) {
        host.setUnrealScriptProperty(id, value);
        return;
    }

    const properties = getProperties(host);
    const name = getFieldName(id);
    const key = findPropertyKey(properties, id);

    if (properties instanceof Map) {
        properties.set(key ?? name, value);
        return;
    }

    properties[key ?? name] = value;
}

function getArrayStructMemberIndex(id: string): number {
    const path = id.split(".");
    const struct = path[path.length - 2].toLowerCase();
    const member = path[path.length - 1].toLowerCase();

    switch (struct) {
        case "vector":
        case "vector2d":
        case "plane":
        case "quat":
        case "quaternion": return ["x", "y", "z", "w"].indexOf(member);
        case "rotator": return ["pitch", "yaw", "roll"].indexOf(member);
        case "color": return ["r", "g", "b", "a"].indexOf(member);
        default: return -1;
    }
}

function createDefaultArrayStruct(id: string): ScriptValue_T {
    const path = id.split(".");
    const struct = path[path.length - 2].toLowerCase();

    switch (struct) {
        case "vector": return [0, 0, 0];
        case "vector2d": return [0, 0];
        case "plane":
        case "quat":
        case "quaternion":
        case "color": return [0, 0, 0, 0];
        case "rotator": return [0, 0, 0];
        default: throw new Error(`UnrealScript struct '${id}' has no value`);
    }
}

function getStructMemberKey(value: ScriptValue_T, id: string): string | number {
    if (!value || typeof value !== "object") throw new Error(`UnrealScript struct '${id}' has no value`);

    const member = getFieldName(id);

    if (Array.isArray(value)) {
        const index = getArrayStructMemberIndex(id);

        if (index < 0 || index >= value.length) throw new Error(`UnrealScript struct member '${id}' is not mapped`);

        return index;
    }

    if (member in value) return member;

    const lowerMember = member.toLowerCase();

    for (const key of Object.keys(value))
        if (key.toLowerCase() === lowerMember) return key;

    throw new Error(`UnrealScript struct member '${id}' is not in its value`);
}

function isOffset(value: GD.ScriptBytecodeValue_T): value is GD.IScriptBytecodeOffsetDecodeInfo {
    return value !== null && typeof value === "object" && !Array.isArray(value) && "entryIndex" in value;
}

function asHost(value: ScriptValue_T): ScriptHost_T {
    if (value === null || value === undefined || typeof value !== "object" || !("scriptClassId" in value))
        throw new Error("UnrealScript context is not a script host");

    return value as ScriptHost_T;
}

function isScriptSlot(value: ScriptArgument_T): value is ScriptSlot_T {
    return value !== null && typeof value === "object" && "get" in value && "set" in value;
}

class ScriptExecutor {
    protected readonly vm: UnScriptVM;
    protected readonly frame: ScriptFrame_T;
    protected readonly entries: GD.IScriptBytecodeEntryDecodeInfo[];
    protected pc: number = 0;
    protected steps: number = 0;

    public constructor(vm: UnScriptVM, frame: ScriptFrame_T) {
        this.vm = vm;
        this.frame = frame;
        this.entries = frame.fn.program.entries;
    }

    protected next(): GD.IScriptBytecodeEntryDecodeInfo {
        const entry = this.entries[this.pc++];

        if (!entry) throw new Error(`UnrealScript '${this.frame.fn.id}' read past its program`);

        return entry;
    }

    protected readOffset(): GD.IScriptBytecodeOffsetDecodeInfo {
        const entry = this.next();

        if (!isOffset(entry.value)) throw new Error(`UnrealScript '${this.frame.fn.id}' expected an offset at '${entry.virtualOffset}'`);

        return entry.value;
    }

    protected evalLValue(): ScriptSlot_T {
        const entry = this.next();
        const opcode = entry.value as number;

        switch (opcode) {
            case ExprToken_T.LocalVariable: {
                const id = this.next().value as string;
                const name = getFieldName(id);

                return {
                    get: () => {
                        const value = this.frame.locals.has(name) ? this.frame.locals.get(name) : null;

                        return isScriptSlot(value) ? value.get() : value;
                    },
                    set: value => {
                        const current = this.frame.locals.get(name);

                        if (isScriptSlot(current)) current.set(value);
                        else this.frame.locals.set(name, value);
                    }
                };
            }
            case ExprToken_T.InstanceVariable:
            case ExprToken_T.DefaultVariable: {
                const id = this.next().value as string;
                const context = this.frame.context;

                return {
                    get: () => getProperty(context, id),
                    set: value => { setProperty(context, id, value); }
                };
            }
            case ExprToken_T.BoolVariable:
                return this.evalLValue();
            case ExprToken_T.ClassContext:
            case ExprToken_T.Context: {
                const contextValue = this.evalToken();

                this.readOffset();
                this.next();

                if (contextValue === null || contextValue === undefined)
                    throw new Error(`UnrealScript '${this.frame.fn.id}' cannot write through a null context at '${entry.virtualOffset}'`);

                const previous = this.frame.context;

                this.frame.context = asHost(contextValue);

                try {
                    return this.evalLValue();
                } finally {
                    this.frame.context = previous;
                }
            }
            case ExprToken_T.ArrayElement:
            case ExprToken_T.DynArrayElement: {
                const index = Number(this.evalToken());
                const parent = this.evalLValue();

                return {
                    get: () => {
                        const value = parent.get();

                        if (!Array.isArray(value)) throw new Error(`UnrealScript '${this.frame.fn.id}' array lvalue is not an array`);

                        return value[index];
                    },
                    set: value => {
                        const array = parent.get();

                        if (!Array.isArray(array)) throw new Error(`UnrealScript '${this.frame.fn.id}' array lvalue is not an array`);

                        const copy = array.slice();

                        copy[index] = value as any;
                        parent.set(copy);
                    }
                };
            }
            case ExprToken_T.StructMember: {
                const id = this.next().value as string;
                const parent = this.evalLValue();

                return {
                    get: () => {
                        const value = parent.get() ?? createDefaultArrayStruct(id);

                        return (value as any)[getStructMemberKey(value, id)] as ScriptValue_T;
                    },
                    set: value => {
                        const struct = parent.get() ?? createDefaultArrayStruct(id);
                        const key = getStructMemberKey(struct, id);
                        const copy = Array.isArray(struct) ? struct.slice() : { ...struct as any };

                        copy[key as any] = value;
                        parent.set(copy as ScriptValue_T);
                    }
                };
            }
            default:
                throw new Error(`UnrealScript '${this.frame.fn.id}' cannot write opcode '0x${opcode.toString(16)}' at '${entry.virtualOffset}'`);
        }
    }

    protected evalContext(): ScriptValue_T {
        const contextValue = this.evalToken();
        const target = this.readOffset();

        this.next();

        if (contextValue === null || contextValue === undefined) {
            this.pc = target.entryIndex;
            return null;
        }

        const previous = this.frame.context;

        this.frame.context = asHost(contextValue);

        try {
            return this.evalToken();
        } finally {
            this.frame.context = previous;
        }
    }

    protected evalCall(opcode: number): ScriptValue_T {
        let fn: GD.IScriptFunctionDecodeInfo;

        if (opcode === ExprToken_T.FinalFunction) fn = this.vm.getFunction(this.next().value as string);
        else fn = this.vm.findFunction(opcode === ExprToken_T.GlobalFunction ? this.frame.self.scriptClassId : this.frame.context.scriptClassId, this.next().value as string);

        const args = this.readArguments(fn);

        return this.vm.invoke(this.frame.context, fn, args, this.frame.self);
    }

    protected evalNative(entry: GD.IScriptBytecodeEntryDecodeInfo): ScriptValue_T {
        const index = entry.value as number;

        if (assignmentNatives.has(index)) {
            const slot = this.evalLValue();
            const previous = slot.get();
            const args = this.readArguments();
            const value = this.vm.invokeNative(this.frame.self, this.frame.context, index, entry.tokenName || `Native${index}`, [previous, ...args]);

            slot.set(value);
            return postAssignmentNatives.has(index) ? previous : value;
        }

        const args = this.readArguments();

        return this.vm.invokeNative(this.frame.self, this.frame.context, index, entry.tokenName || `Native${index}`, args);
    }

    protected readArguments(fn: GD.IScriptFunctionDecodeInfo = null): ScriptArgument_T[] {
        const args = new Array<ScriptArgument_T>();
        const fields = fn ? fn.fields.filter(field => field.flags & CPF_Parm && !(field.flags & CPF_ReturnParm)) : null;

        while (true) {
            const entry = this.entries[this.pc];

            if (!entry) throw new Error(`UnrealScript '${this.frame.fn.id}' has an unterminated call`);

            if (entry.type === "token" && entry.value === ExprToken_T.EndFunctionParms) {
                this.pc++;
                return args;
            }

            const field = fields && fields[args.length];

            args.push(field && field.flags & CPF_OutParm ? this.evalLValue() : this.evalToken());
        }
    }

    protected evalSwitch(): ScriptValue_T {
        const size = this.next().value as number;

        if (size !== 1) throw new Error(`UnrealScript '${this.frame.fn.id}' does not implement ${size}-byte Switch values`);

        const value = this.evalToken();

        while (true) {
            const entry = this.next();

            if (entry.type !== "token" || entry.value !== ExprToken_T.Case)
                throw new Error(`UnrealScript '${this.frame.fn.id}' expected Case at '${entry.virtualOffset}'`);

            const target = this.next();

            if (target.value === 0xffff) return undefined;
            if (!isOffset(target.value)) throw new Error(`UnrealScript '${this.frame.fn.id}' expected a case offset at '${target.virtualOffset}'`);
            if (this.evalToken() === value) return undefined;

            this.pc = target.value.entryIndex;
        }
    }

    protected evalPrimitiveCast(): ScriptValue_T {
        const cast = this.next().value as number;
        const value = this.evalToken();

        switch (cast) {
            case CastToken_T.ByteToInt:
            case CastToken_T.IntToByte: return Number(value) | 0;
            case CastToken_T.ByteToBool:
            case CastToken_T.IntToBool:
            case CastToken_T.FloatToBool:
            case CastToken_T.ObjectToBool:
            case CastToken_T.NameToBool:
            case CastToken_T.StringToBool:
            case CastToken_T.VectorToBool:
            case CastToken_T.RotatorToBool: return !!value;
            case CastToken_T.ByteToFloat:
            case CastToken_T.IntToFloat:
            case CastToken_T.StringToFloat: return Number(value);
            case CastToken_T.StringToByte:
            case CastToken_T.StringToInt: return parseInt(`${value}`, 10) || 0;
            case CastToken_T.ByteToString:
            case CastToken_T.IntToString:
            case CastToken_T.BoolToString:
            case CastToken_T.FloatToString:
            case CastToken_T.ObjectToString:
            case CastToken_T.NameToString:
            case CastToken_T.VectorToString:
            case CastToken_T.RotatorToString: return `${value ?? "None"}`;
            default: throw new Error(`UnrealScript '${this.frame.fn.id}' does not implement cast '0x${cast.toString(16)}'`);
        }
    }

    protected evalToken(): ScriptValue_T {
        const entry = this.next();

        if (++this.steps > 1000000) throw new Error(`UnrealScript '${this.frame.fn.id}' exceeded its runaway limit`);
        if (entry.type === "nativeCall") return this.evalNative(entry);
        if (entry.type !== "token") throw new Error(`UnrealScript '${this.frame.fn.id}' expected an opcode at '${entry.virtualOffset}'`);

        const opcode = entry.value as number;

        switch (opcode) {
            case ExprToken_T.LocalVariable:
            case ExprToken_T.InstanceVariable:
            case ExprToken_T.DefaultVariable:
            case ExprToken_T.StructMember: return this.evalLValueFromEntry(entry).get();
            case ExprToken_T.Return:
                this.frame.returnValue = this.evalToken();
                this.frame.didReturn = true;
                return this.frame.returnValue;
            case ExprToken_T.Jump:
                this.pc = this.readOffset().entryIndex;
                return undefined;
            case ExprToken_T.JumpIfNot: {
                const target = this.readOffset();

                if (!this.evalToken()) this.pc = target.entryIndex;

                return undefined;
            }
            case ExprToken_T.Switch: return this.evalSwitch();
            case ExprToken_T.Stop:
                this.frame.stopped = true;
                return undefined;
            case ExprToken_T.Nothing: return undefined;
            case ExprToken_T.GotoLabel: return this.vm.gotoLabel(this.frame.context, this.evalToken() as string);
            case ExprToken_T.EatString:
                this.evalToken();
                return undefined;
            case ExprToken_T.Let:
            case ExprToken_T.LetBool:
            case ExprToken_T.LetDelegate: {
                const slot = this.evalLValue();
                const value = this.evalToken();

                slot.set(value);
                return value;
            }
            case ExprToken_T.ClassContext:
            case ExprToken_T.Context: return this.evalContext();
            case ExprToken_T.MetaCast:
            case ExprToken_T.DynamicCast:
                this.next();
                return this.evalToken();
            case ExprToken_T.EndFunctionParms: return undefined;
            case ExprToken_T.Self: return this.frame.self;
            case ExprToken_T.Skip:
                this.readOffset();
                return this.evalToken();
            case ExprToken_T.ArrayElement:
            case ExprToken_T.DynArrayElement: {
                const index = this.evalToken() as number;
                const array = this.evalToken() as unknown as ScriptValue_T[];

                return array[index];
            }
            case ExprToken_T.VirtualFunction:
            case ExprToken_T.FinalFunction:
            case ExprToken_T.GlobalFunction: return this.evalCall(opcode);
            case ExprToken_T.IntConst:
            case ExprToken_T.FloatConst:
            case ExprToken_T.StringConst:
            case ExprToken_T.NameConst:
            case ExprToken_T.RotationConst:
            case ExprToken_T.VectorConst:
            case ExprToken_T.ByteConst:
            case ExprToken_T.IntConstByte: return this.next().value as ScriptValue_T;
            case ExprToken_T.ObjectConst: {
                const id = this.next().value as string | null;

                return id === null ? null : this.vm.resolveObject(this.frame.context, id);
            }
            case ExprToken_T.IntZero: return 0;
            case ExprToken_T.IntOne: return 1;
            case ExprToken_T.True: return true;
            case ExprToken_T.False: return false;
            case ExprToken_T.NoObject: return null;
            case ExprToken_T.BoolVariable: return this.evalToken();
            case ExprToken_T.UnicodeStringConst: return this.next().value as string;
            case ExprToken_T.DynArrayLength: return (this.evalToken() as unknown as ScriptValue_T[]).length;
            case ExprToken_T.PrimitiveCast: return this.evalPrimitiveCast();
            case ExprToken_T.DebugInfo:
                this.next();
                this.next();
                this.next();
                this.next();
                return undefined;
            default: throw new Error(`UnrealScript '${this.frame.fn.id}' does not implement opcode '0x${opcode.toString(16)}' at '${entry.virtualOffset}'`);
        }
    }

    protected evalLValueFromEntry(entry: GD.IScriptBytecodeEntryDecodeInfo): ScriptSlot_T {
        this.pc--;

        return this.evalLValue();
    }

    public run(): ScriptValue_T {
        while (this.pc < this.entries.length && !this.frame.didReturn && !this.frame.stopped)
            this.evalToken();

        return this.frame.returnValue;
    }
}

class UnScriptVM {
    protected readonly library: GD.DecodeLibrary;
    protected readonly functionsById = new Map<string, GD.IScriptFunctionDecodeInfo>();
    protected readonly functionsByClass = new Map<string, Map<string, GD.IScriptFunctionDecodeInfo>>();

    public constructor(library: GD.DecodeLibrary) {
        this.library = library;

        for (const fn of Object.values(library.scriptFunctions)) {
            this.functionsById.set(fn.id.toLowerCase(), fn);

            let functions = this.functionsByClass.get(fn.owner);

            if (!functions) this.functionsByClass.set(fn.owner, functions = new Map());

            functions.set(fn.name.toLowerCase(), fn);
        }
    }

    public getFunction(id: string): GD.IScriptFunctionDecodeInfo {
        const fn = this.library.scriptFunctions[id] || this.functionsById.get(id.toLowerCase());

        if (!fn) throw new Error(`UnrealScript function '${id}' is not in the decode library`);

        return fn;
    }

    public initializeHost(host: ScriptHost_T): void {
        const classes = new Array<GD.IScriptClassDecodeInfo>();
        let cls = this.library.scriptClasses[host.scriptClassId];

        if (!cls) throw new Error(`UnrealScript class '${host.scriptClassId}' is not in the decode library`);

        while (cls) {
            classes.push(cls);
            if (!cls.superClassId) break;

            cls = this.library.scriptClasses[cls.superClassId];
        }

        const properties = getProperties(host);
        const initialProperties = new Map<string, ScriptValue_T>();

        if (properties instanceof Map) {
            for (const [name, value] of properties)
                initialProperties.set(getFieldName(name).toLowerCase(), value);
        } else {
            for (const [name, value] of Object.entries(properties))
                initialProperties.set(getFieldName(name).toLowerCase(), value);
        }

        for (let i = classes.length - 1; i >= 0; i--) {
            const defaults = classes[i].defaults;

            if (!defaults) throw new Error(`UnrealScript class '${classes[i].id}' has no decoded defaults`);

            for (const [name, value] of Object.entries(defaults)) {
                const key = findPropertyKey(properties, name);
                const fieldName = getFieldName(name).toLowerCase();
                const field = classes[i].fields.find(field => getFieldName(field.name).toLowerCase() === fieldName);
                const initial = initialProperties.get(fieldName);

                if (initialProperties.has(fieldName) && !(initial === null && field && (field.type as any) === "Struct")) continue;
                if (properties instanceof Map) properties.set(key ?? name, cloneScriptValue(value));
                else properties[key ?? name] = cloneScriptValue(value);
            }
        }
    }

    protected findFunctionOptional(classId: string, name: string): GD.IScriptFunctionDecodeInfo | null {
        const lowerName = name.toLowerCase();
        let cls = this.library.scriptClasses[classId];

        while (cls) {
            const fn = this.functionsByClass.get(cls.id)?.get(lowerName);

            if (fn) return fn;
            if (!cls.superClassId) break;

            cls = this.library.scriptClasses[cls.superClassId];
        }

        return null;
    }

    public findFunction(classId: string, name: string): GD.IScriptFunctionDecodeInfo {
        const fn = this.findFunctionOptional(classId, name);

        if (!fn)
            throw new Error(`UnrealScript function '${classId}.${name}' is not in the decode library`);

        return fn;
    }

    public hasScriptFunction(classId: string, name: string): boolean {
        const fn = this.findFunctionOptional(classId, name);

        return !!fn && fn.nativeIndex === 0 && !(fn.flags & FUNC_Native);
    }

    public resolveObject(context: ScriptHost_T, id: string): ScriptValue_T {
        const resolver = (context as any).resolveUnrealObject;

        return typeof resolver === "function" ? resolver.call(context, id) : id;
    }

    public gotoLabel(context: ScriptHost_T, name: string): ScriptValue_T {
        const gotoLabel = (context as any).gotoUnrealLabel;

        if (typeof gotoLabel !== "function")
            throw new Error(`UnrealScript host '${context.scriptClassId}' cannot goto label '${name}'`);

        return gotoLabel.call(context, name);
    }

    public invokeNative(self: ScriptHost_T, context: ScriptHost_T, index: number, name: string, args: ScriptArgument_T[]): ScriptValue_T {
        if (context.handlesUnrealNative && context.handlesUnrealNative(index, name))
            return context.callUnrealNative!({ index, name, args, self, context });

        if (UNativeRegistry.hasNativeFunc(index)) return UNativeRegistry.getNativeFunc(index)(...args) as ScriptValue_T;
        if (UNativeRegistry.hasNativeFunc(name)) return UNativeRegistry.getNativeFunc(name)(...args) as ScriptValue_T;

        const handler = context.callUnrealNative || self.callUnrealNative;

        if (!handler)
            throw new Error(`UnrealScript native '${name}' (${index}) is not registered for '${context.scriptClassId}'`);

        return handler.call(handler === context.callUnrealNative ? context : self, { index, name, args, self, context });
    }

    public invoke(context: ScriptHost_T, fn: GD.IScriptFunctionDecodeInfo, args: ScriptArgument_T[] = [], self: ScriptHost_T = context): ScriptValue_T {
        if (fn.nativeIndex !== 0 || fn.flags & FUNC_Native) return this.invokeNative(self, context, fn.nativeIndex, fn.name, args);
        if (context.handlesUnrealScriptFunction && context.handlesUnrealScriptFunction(fn)) return undefined;

        const locals = new Map<string, ScriptArgument_T>();
        let argIndex = 0;

        for (const field of fn.fields) {
            if (!(field.flags & CPF_Parm) || field.flags & CPF_ReturnParm) continue;

            locals.set(field.name, argIndex < args.length ? args[argIndex++] : null);
        }

        const frame: ScriptFrame_T = { fn, self, context, locals, returnValue: undefined, didReturn: false, stopped: false };

        return new ScriptExecutor(this, frame).run();
    }

    public call(context: ScriptHost_T, name: string, args: ScriptValue_T[] = []): ScriptValue_T {
        return this.invoke(context, this.findFunction(context.scriptClassId, name), args);
    }
}

export default UnScriptVM;
export { UnScriptVM, isScriptSlot }
export type { ScriptArgument_T, ScriptHost_T, ScriptNativeCall_T, ScriptProperties_T, ScriptSlot_T, ScriptValue_T };
