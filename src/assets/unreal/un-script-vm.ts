import UNativeRegistry from "./scripts/un-native-registry";

type ScriptValue_T = number | boolean | string | GD.Vector3Arr | GD.IScriptBytecodeOffsetDecodeInfo | ScriptHost_T | null | undefined;

type ScriptProperties_T = Map<string, ScriptValue_T> | Record<string, ScriptValue_T>;

type ScriptNativeCall_T = {
    index: number,
    name: string,
    args: ScriptValue_T[],
    self: ScriptHost_T,
    context: ScriptHost_T
};

type ScriptHost_T = {
    scriptClassId: string,
    scriptProperties?: ScriptProperties_T,
    handlesUnrealScriptFunction?(fn: GD.IScriptFunctionDecodeInfo): boolean,
    callUnrealNative?(call: ScriptNativeCall_T): ScriptValue_T
};

type ScriptSlot_T = {
    get(): ScriptValue_T,
    set(value: ScriptValue_T): void
};

type ScriptFrame_T = {
    fn: GD.IScriptFunctionDecodeInfo,
    self: ScriptHost_T,
    context: ScriptHost_T,
    locals: Map<string, ScriptValue_T>,
    returnValue: ScriptValue_T,
    didReturn: boolean,
    stopped: boolean
};

const CPF_Parm = 0x00000080;
const CPF_ReturnParm = 0x00000400;
const FUNC_Native = 0x00000400;

function getFieldName(id: string): string {
    const index = id.lastIndexOf(".");

    return index < 0 ? id : id.slice(index + 1);
}

function getProperties(host: ScriptHost_T): ScriptProperties_T {
    if (host.scriptProperties) return host.scriptProperties;

    return host as Record<string, ScriptValue_T>;
}

function getProperty(host: ScriptHost_T, id: string): ScriptValue_T {
    const properties = getProperties(host);
    const name = getFieldName(id);

    if (properties instanceof Map) {
        if (properties.has(id)) return properties.get(id);
        if (properties.has(name)) return properties.get(name);

        return null;
    }

    if (id in properties) return properties[id];
    if (name in properties) return properties[name];

    return null;
}

function setProperty(host: ScriptHost_T, id: string, value: ScriptValue_T): void {
    const properties = getProperties(host);
    const name = getFieldName(id);

    if (properties instanceof Map) {
        properties.set(properties.has(id) ? id : name, value);
        return;
    }

    properties[name] = value;
}

function isOffset(value: GD.ScriptBytecodeValue_T): value is GD.IScriptBytecodeOffsetDecodeInfo {
    return value !== null && typeof value === "object" && !Array.isArray(value) && "entryIndex" in value;
}

function asHost(value: ScriptValue_T): ScriptHost_T {
    if (value === null || value === undefined || typeof value !== "object" || !("scriptClassId" in value))
        throw new Error("UnrealScript context is not a script host");

    return value as ScriptHost_T;
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
            case 0x00: {
                const id = this.next().value as string;
                const name = getFieldName(id);

                return {
                    get: () => this.frame.locals.has(name) ? this.frame.locals.get(name) : null,
                    set: value => { this.frame.locals.set(name, value); }
                };
            }
            case 0x01:
            case 0x02: {
                const id = this.next().value as string;
                const context = this.frame.context;

                return {
                    get: () => getProperty(context, id),
                    set: value => { setProperty(context, id, value); }
                };
            }
            case 0x2D:
                return this.evalLValue();
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

        if (opcode === 0x1c) fn = this.vm.getFunction(this.next().value as string);
        else fn = this.vm.findFunction(opcode === 0x38 ? this.frame.self.scriptClassId : this.frame.context.scriptClassId, this.next().value as string);

        const args = this.readArguments();

        return this.vm.invoke(this.frame.context, fn, args, this.frame.self);
    }

    protected evalNative(entry: GD.IScriptBytecodeEntryDecodeInfo): ScriptValue_T {
        const index = entry.value as number;
        const args = this.readArguments();

        return this.vm.invokeNative(this.frame.self, this.frame.context, index, entry.tokenName || `Native${index}`, args);
    }

    protected readArguments(): ScriptValue_T[] {
        const args = new Array<ScriptValue_T>();

        while (true) {
            const entry = this.entries[this.pc];

            if (!entry) throw new Error(`UnrealScript '${this.frame.fn.id}' has an unterminated call`);

            if (entry.type === "token" && entry.value === 0x16) {
                this.pc++;
                return args;
            }

            args.push(this.evalToken());
        }
    }

    protected evalPrimitiveCast(): ScriptValue_T {
        const cast = this.next().value as number;
        const value = this.evalToken();

        switch (cast) {
            case 0x3a:
            case 0x3d: return Number(value) | 0;
            case 0x3b:
            case 0x3e:
            case 0x45:
            case 0x47:
            case 0x48:
            case 0x4b:
            case 0x4f:
            case 0x51: return !!value;
            case 0x3c:
            case 0x3f:
            case 0x4c: return Number(value);
            case 0x49:
            case 0x4a: return parseInt(`${value}`, 10) || 0;
            case 0x52:
            case 0x53:
            case 0x54:
            case 0x55:
            case 0x56:
            case 0x57:
            case 0x58:
            case 0x59: return `${value ?? "None"}`;
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
            case 0x00:
            case 0x01:
            case 0x02: return this.evalLValueFromEntry(entry).get();
            case 0x04:
                this.frame.returnValue = this.evalToken();
                this.frame.didReturn = true;
                return this.frame.returnValue;
            case 0x06:
                this.pc = this.readOffset().entryIndex;
                return undefined;
            case 0x07: {
                const target = this.readOffset();

                if (!this.evalToken()) this.pc = target.entryIndex;

                return undefined;
            }
            case 0x08:
                this.frame.stopped = true;
                return undefined;
            case 0x0b: return undefined;
            case 0x0d: return this.vm.gotoLabel(this.frame.context, this.evalToken() as string);
            case 0x0e:
                this.evalToken();
                return undefined;
            case 0x0f:
            case 0x14:
            case 0x45: {
                const slot = this.evalLValue();
                const value = this.evalToken();

                slot.set(value);
                return value;
            }
            case 0x12:
            case 0x19: return this.evalContext();
            case 0x16: return undefined;
            case 0x17: return this.frame.self;
            case 0x18:
                this.readOffset();
                return this.evalToken();
            case 0x1a:
            case 0x10: {
                const index = this.evalToken() as number;
                const array = this.evalToken() as unknown as ScriptValue_T[];

                return array[index];
            }
            case 0x1b:
            case 0x1c:
            case 0x38: return this.evalCall(opcode);
            case 0x1d:
            case 0x1e:
            case 0x1f:
            case 0x21:
            case 0x22:
            case 0x23:
            case 0x24:
            case 0x2c: return this.next().value as ScriptValue_T;
            case 0x20: {
                const id = this.next().value as string | null;

                return id === null ? null : this.vm.resolveObject(this.frame.context, id);
            }
            case 0x25: return 0;
            case 0x26: return 1;
            case 0x27: return true;
            case 0x28: return false;
            case 0x2a: return null;
            case 0x2d: return this.evalToken();
            case 0x34: return this.next().value as string;
            case 0x37: return (this.evalToken() as unknown as ScriptValue_T[]).length;
            case 0x39: return this.evalPrimitiveCast();
            case 0x42:
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

    public findFunction(classId: string, name: string): GD.IScriptFunctionDecodeInfo {
        const lowerName = name.toLowerCase();
        let cls = this.library.scriptClasses[classId];

        while (cls) {
            const fn = this.functionsByClass.get(cls.id)?.get(lowerName);

            if (fn) return fn;
            if (!cls.superClassId) break;

            cls = this.library.scriptClasses[cls.superClassId];
        }

        throw new Error(`UnrealScript function '${classId}.${name}' is not in the decode library`);
    }

    public resolveObject(context: ScriptHost_T, id: string): ScriptValue_T {
        const resolver = (context as any).resolveUnrealObject;

        return typeof resolver === "function" ? resolver.call(context, id) : id;
    }

    public gotoLabel(context: ScriptHost_T, name: string): ScriptValue_T {
        const gotoLabel = (context as any).gotoUnrealLabel;

        if (typeof gotoLabel !== "function") throw new Error(`UnrealScript host '${context.scriptClassId}' cannot goto label '${name}'`);

        return gotoLabel.call(context, name);
    }

    public invokeNative(self: ScriptHost_T, context: ScriptHost_T, index: number, name: string, args: ScriptValue_T[]): ScriptValue_T {
        if (UNativeRegistry.hasNativeFunc(index)) return UNativeRegistry.getNativeFunc(index)(...args) as ScriptValue_T;
        const handler = context.callUnrealNative || self.callUnrealNative;

        if (!handler) throw new Error(`UnrealScript native '${name}' (${index}) is not registered for '${context.scriptClassId}'`);

        return handler.call(handler === context.callUnrealNative ? context : self, { index, name, args, self, context });
    }

    public invoke(context: ScriptHost_T, fn: GD.IScriptFunctionDecodeInfo, args: ScriptValue_T[] = [], self: ScriptHost_T = context): ScriptValue_T {
        if (fn.nativeIndex !== 0 || fn.flags & FUNC_Native) return this.invokeNative(self, context, fn.nativeIndex, fn.name, args);
        if (context.handlesUnrealScriptFunction && context.handlesUnrealScriptFunction(fn)) return undefined;

        const locals = new Map<string, ScriptValue_T>();
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
export { UnScriptVM, ScriptHost_T, ScriptNativeCall_T, ScriptProperties_T, ScriptValue_T };
