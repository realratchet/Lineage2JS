import UNativeRegistry from "./native-registry";
import { CastToken_T, ExprToken_T, EStateFlags_T, ObjectFlags_T } from "@l2js/core";
import { EClassFlags_T } from "@l2js/core/unreal/un-class";
import { ENetRole_T } from "../assets/unreal/un-aactor";
import type { DecodeLibrary } from "@l2js/engine";
import type { ScriptPropertyValue_T, IScriptBytecodeOffsetDecodeInfo, IScriptFunctionDecodeInfo, ScriptBytecodeValue_T, IScriptBytecodeEntryDecodeInfo, IScriptClassDecodeInfo, IScriptStateDecodeInfo } from "@l2js/engine/contracts/script";

export type ScriptValue_T = ScriptPropertyValue_T | IScriptBytecodeOffsetDecodeInfo | ScriptHost_T | undefined;
export type ScriptProperties_T = Map<string, ScriptValue_T> | Record<string, ScriptValue_T>;

export type ScriptNativeCall_T = {
    index: number,
    name: string,
    args: ScriptArgument_T[],
    self: ScriptHost_T,
    context: ScriptHost_T
};

export type ScriptHost_T = {
    scriptClassId: string,
    isLevelActor?: boolean,
    isClassDefaultObject?: boolean,
    scriptProperties?: ScriptProperties_T,
    getUnrealScriptProperty?(id: string): ScriptValue_T,
    setUnrealScriptProperty?(id: string, value: ScriptValue_T): void,
    handlesUnrealScriptFunction?(fn: IScriptFunctionDecodeInfo): boolean,
    handlesUnrealNative?(index: number, name: string): boolean,
    callUnrealNative?(call: ScriptNativeCall_T): ScriptValue_T
};

export type ScriptSlot_T = {
    arrayElementDefault?: ScriptValue_T,
    get(): ScriptValue_T,
    set(value: ScriptValue_T): void
};

export type ScriptArgument_T = ScriptValue_T | ScriptSlot_T;

export type ScriptFrame_T = {
    fn: IScriptFunctionDecodeInfo | IScriptStateDecodeInfo,
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
const NAME_SIZE = 64;
const assignmentNatives = new Set([133, 134, 135, 136, 137, 138, 139, 140, 159, 160, 161, 162, 163, 164, 165, 166, 182, 183, 184, 185, 221, 222, 223, 224, 290, 291, 297, 318, 319]);
const postAssignmentNatives = new Set([139, 140, 165, 166]);

enum EPollSlowFuncs {
    EPOLL_Sleep = 384
}

type StateFrame_T = { node: IScriptStateDecodeInfo, cls: IScriptClassDecodeInfo, vm: UnScriptVM, probeMask: bigint, execution: ScriptExecutor | null, latentAction: number, isEndingState: boolean, stateChanged: boolean, hasTick: boolean };
type ObjectName_T = { names: Map<string, WeakRef<ScriptHost_T>>, name: string, object: WeakRef<ScriptHost_T> };

export type ScriptLevelActors_T = { getFirstDynamicActor(): number, getLevelActorCount(): number, getLevelActor(index: number): ScriptHost_T | null, addLevelActor(actor: ScriptHost_T): void, removeLevelActor(actor: ScriptHost_T): void };

const cacheLevelActors = new WeakMap<ScriptHost_T, ScriptLevelActors_T>();
const cacheActorLevels = new WeakMap<ScriptHost_T, ScriptLevelActors_T | null>();
const cacheObjectNames = new WeakMap<IScriptClassDecodeInfo, number>();
const cacheOuterObjects = new WeakMap<ScriptHost_T, Map<string, WeakRef<ScriptHost_T>>>();
const objectNames = new FinalizationRegistry<ObjectName_T>(entry => {
    if (entry.names.get(entry.name) === entry.object) entry.names.delete(entry.name);
});
const transientPackage: ScriptHost_T = { scriptClassId: "core.Package", isLevelActor: false, scriptProperties: { Name: "Transient", Outer: null, Class: "core.Package", ObjectFlags: 0 } };

export function setLevelActors(level: ScriptHost_T, actors: ScriptLevelActors_T): void { cacheLevelActors.set(level, actors); }
export function deleteLevelActors(level: ScriptHost_T): void { cacheLevelActors.delete(level); }
export function getLevelActors(actor: ScriptHost_T): ScriptLevelActors_T {
    const level = getProperty(actor, "Level") as ScriptHost_T, actors = level && typeof level === "object" ? cacheLevelActors.get(level) : null;

    if (!actors) throw new Error(`UnrealScript actor '${actor.scriptClassId}' has no registered level actor list`);
    return actors;
}

export function registerLevelActor(actor: ScriptHost_T): void {
    if (actor.isLevelActor === false || cacheActorLevels.get(actor) || !getProperty(actor, "Level")) return;
    const actors = getLevelActors(actor);

    actors.addLevelActor(actor);
    cacheActorLevels.set(actor, actors);
}

export function updateLevelActor(actor: ScriptHost_T): void {
    if (actor.isLevelActor === false) return;
    if (!cacheActorLevels.has(actor)) { registerLevelActor(actor); return; }
    const previous = cacheActorLevels.get(actor), next = getProperty(actor, "Level") ? getLevelActors(actor) : null;

    if (next === previous) return;
    if (previous) previous.removeLevelActor(actor);
    if (next) next.addLevelActor(actor);
    cacheActorLevels.set(actor, next);
}

export function unregisterLevelActor(actor: ScriptHost_T): void {
    const actors = cacheActorLevels.get(actor);

    if (actors) actors.removeLevelActor(actor);
    cacheActorLevels.delete(actor);
}

const cacheStateFrames = new WeakMap<ScriptHost_T, StateFrame_T>();
// Core.dll FName indices 300..363; execEnable 0x101412f0, execDisable 0x10141420.
const arrProbeNames = ["Spawned", "Destroyed", "GainedChild", "LostChild", "Probe4", "Probe5", "Trigger", "UnTrigger", "Timer", "HitWall", "Falling", "Landed", "PhysicsVolumeChange", "Touch", "UnTouch", "Bump", "BeginState", "EndState", "BaseChange", "Attach", "Detach", "ActorEntered", "ActorLeaving", "ZoneChange", "AnimEnd", "EndedRotation", "InterpolateEnd", "EncroachingOn", "EncroachedBy", "NotifyTurningInPlace", "HeadVolumeChange", "PostTouch", "PawnEnteredVolume", "MayFall", "CheckDirectionChange", "PawnLeavingVolume", "Tick", "PlayerTick", "ModifyVelocity", "CheckMovementTransition", "SeePlayer", "EnemyNotVisible", "HearNoise", "UpdateEyeHeight", "SeeMonster", "SeeFriend", "SpecialHandling", "BotDesireability", "NotifyBump", "NotifyPhysicsVolumeChange", "AIHearSound", "NotifyHeadVolumeChange", "NotifyLanded", "NotifyHitWall", "PostNetReceive", "PreBeginPlay", "BeginPlay", "PostBeginPlay", "Probe58", "PhysicsChangedFor", "ActorEnteredVolume", "ActorLeavingVolume", "PrepareForMove", "All"];
const cacheProbeMasks = new Map(arrProbeNames.map((name, index) => [name.toLowerCase(), 1n << BigInt(index)]));

function getFieldName(id: string): string {
    const index = id.lastIndexOf(".");

    return index < 0 ? id : id.slice(index + 1);
}

const cacheClassFields = new WeakMap<IScriptClassDecodeInfo, Map<string, IScriptClassDecodeInfo["fields"][number]>>();

function getClassField(cls: IScriptClassDecodeInfo, fieldName: string) {
    let fields = cacheClassFields.get(cls);

    if (!fields) {
        fields = new Map();

        for (const field of cls.fields) {
            const name = getFieldName(field.name).toLowerCase();

            if (!fields.has(name)) fields.set(name, field);
        }

        cacheClassFields.set(cls, fields);
    }

    return fields.get(fieldName);
}

type ClassDefault_T = { name: string, lowerName: string, fieldName: string, value: ScriptValue_T, isStructOrArray: boolean, isArray: boolean };

const cacheClassDefaults = new WeakMap<IScriptClassDecodeInfo, ClassDefault_T[]>();
const cacheDefaultObjects = new WeakMap<IScriptClassDecodeInfo, ScriptHost_T>();

type HostDefault_T = { key: string, value: ScriptValue_T, isEmptyArray: boolean };

const cacheHostDefaults = new WeakMap<IScriptClassDecodeInfo, Map<string, HostDefault_T[]>>();

function getClassDefaults(cls: IScriptClassDecodeInfo): ClassDefault_T[] {
    let defaults = cacheClassDefaults.get(cls);

    if (defaults) return defaults;
    if (!cls.defaults) throw new Error(`UnrealScript class '${cls.id}' has no decoded defaults`);

    defaults = Object.entries(cls.defaults).map(([name, value]) => {
        const fieldName = getFieldName(name).toLowerCase();
        const type = getClassField(cls, fieldName)?.type as any;

        return { name, lowerName: name.toLowerCase(), fieldName, value, isStructOrArray: type === "Struct" || type === "Array", isArray: type === "Array" };
    });
    cacheClassDefaults.set(cls, defaults);

    return defaults;
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
    if ("scriptClassId" in value) return value;
    if (Array.isArray(value)) return value.map(cloneScriptValue) as ScriptPropertyValue_T[];

    const clone: Record<string, ScriptPropertyValue_T> = {};

    for (const [key, entry] of Object.entries(value)) clone[key] = cloneScriptValue(entry) as ScriptPropertyValue_T;

    return clone;
}

export function getProperty(host: ScriptHost_T, id: string): ScriptValue_T {
    if (host.getUnrealScriptProperty) return host.getUnrealScriptProperty(id);

    const properties = getProperties(host);
    const key = findPropertyKey(properties, id);

    if (key === null) return null;

    return properties instanceof Map ? properties.get(key) : properties[key];
}

export function setProperty(host: ScriptHost_T, id: string, value: ScriptValue_T): void {
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

function isOffset(value: ScriptBytecodeValue_T): value is IScriptBytecodeOffsetDecodeInfo {
    return value !== null && typeof value === "object" && !Array.isArray(value) && "entryIndex" in value;
}

function asHost(value: ScriptValue_T): ScriptHost_T {
    if (value === null || value === undefined || typeof value !== "object" || !("scriptClassId" in value))
        throw new Error("UnrealScript context is not a script host");

    return value as ScriptHost_T;
}

export function isScriptSlot(value: ScriptArgument_T): value is ScriptSlot_T {
    return value !== null && typeof value === "object" && "get" in value && "set" in value;
}

class ScriptExecutor {
    protected readonly vm: UnScriptVM;
    protected readonly frame: ScriptFrame_T;
    protected readonly entries: IScriptBytecodeEntryDecodeInfo[];
    protected pc: number = 0;
    protected steps: number = 0;

    public constructor(vm: UnScriptVM, frame: ScriptFrame_T, entryIndex: number = 0) {
        this.vm = vm;
        this.frame = frame;
        this.entries = frame.fn.program.entries;
        this.pc = entryIndex;
    }

    protected next(): IScriptBytecodeEntryDecodeInfo {
        const entry = this.entries[this.pc++];

        if (!entry) throw new Error(`UnrealScript '${this.frame.fn.id}' read past its program`);

        return entry;
    }

    protected readOffset(): IScriptBytecodeOffsetDecodeInfo {
        const entry = this.next();

        if (!isOffset(entry.value)) throw new Error(`UnrealScript '${this.frame.fn.id}' expected an offset at '${entry.virtualOffset}'`);

        return entry.value;
    }

    protected evalLValue(): ScriptSlot_T {
        const entry = this.next();
        const opcode = entry.value as number;

        switch (opcode) {
            case ExprToken_T.LocalVariable: {
                const field = this.next(), id = field.value as string;
                const name = getFieldName(id);

                return {
                    arrayElementDefault: field.arrayElementDefault,
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
                const field = this.next(), id = field.value as string;
                const context = opcode === ExprToken_T.DefaultVariable && !this.frame.context.isClassDefaultObject ? (cacheStateFrames.get(this.frame.context)?.vm || this.vm).getDefaultObject(this.frame.context.scriptClassId) : this.frame.context;

                return {
                    arrayElementDefault: field.arrayElementDefault,
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

                this.frame.context = opcode === ExprToken_T.ClassContext ? (cacheStateFrames.get(previous)?.vm || this.vm).getDefaultObject(contextValue as string) : asHost(contextValue);

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
                    arrayElementDefault: parent.arrayElementDefault,
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
            case ExprToken_T.DynArrayLength: {
                const parent = this.evalLValue();

                return {
                    get: () => (parent.get() as ScriptValue_T[]).length,
                    set: value => {
                        const array = parent.get(), length = value as number;

                        if (!Array.isArray(array)) throw new Error(`UnrealScript '${this.frame.fn.id}' array length target is not an array`);
                        if (!Number.isInteger(length) || length < 0 || length > 0x7fffffff) throw new Error(`UnrealScript '${this.frame.fn.id}' invalid array length '${length}'`);
                        if (length === array.length) return;
                        if (length > array.length && parent.arrayElementDefault === undefined) throw new Error(`UnrealScript '${this.frame.fn.id}' array element default is missing`);

                        const copy = array.slice(0, length);

                        while (copy.length < length) copy.push(cloneScriptValue(parent.arrayElementDefault) as any);
                        parent.set(copy);
                    }
                };
            }
            case ExprToken_T.StructMember: {
                const field = this.next(), id = field.value as string;
                const parent = this.evalLValue();

                return {
                    arrayElementDefault: field.arrayElementDefault,
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

    protected evalContext(opcode: number): ScriptValue_T {
        const contextValue = this.evalToken();
        const target = this.readOffset();

        this.next();

        if (contextValue === null || contextValue === undefined) {
            this.pc = target.entryIndex;
            return null;
        }

        const previous = this.frame.context;

        this.frame.context = opcode === ExprToken_T.ClassContext ? (cacheStateFrames.get(previous)?.vm || this.vm).getDefaultObject(contextValue as string) : asHost(contextValue);

        try {
            return this.evalToken();
        } finally {
            this.frame.context = previous;
        }
    }

    protected evalCall(opcode: number): ScriptValue_T {
        let fn: IScriptFunctionDecodeInfo;
        const context = this.frame.context;
        const script = opcode === ExprToken_T.VirtualFunction && context !== this.frame.self && typeof (context as any).findComponent === "function" ? (context as any).findComponent("script") : null;
        const runtime = opcode === ExprToken_T.FinalFunction ? null : cacheStateFrames.get(opcode === ExprToken_T.GlobalFunction ? this.frame.self : context)?.vm;
        const vm = runtime || (script ? script.getVM() as UnScriptVM : this.vm);
        const name = this.next().value as string;

        if (opcode === ExprToken_T.FinalFunction) fn = this.vm.getFunction(name);
        else fn = vm.findFunction(opcode === ExprToken_T.GlobalFunction ? this.frame.self.scriptClassId : context, name);

        let args: ScriptArgument_T[];

        if (script || fn.nativeIndex === 278) {
            this.frame.context = this.frame.self;

            try {
                args = this.readArguments(fn, context);
            } finally {
                this.frame.context = context;
            }
        } else args = this.readArguments(fn, context);

        return vm.invoke(context, fn, args, script ? context : this.frame.self);
    }

    protected evalNative(entry: IScriptBytecodeEntryDecodeInfo): ScriptValue_T {
        const index = entry.value as number;

        if (index === 304 || index === 307 || index === 313) return this.evalActorIterator(index);

        if (assignmentNatives.has(index)) {
            const slot = this.evalLValue();
            const previous = slot.get();
            const args = this.readArguments();
            const value = this.vm.invokeNative(this.frame.self, this.frame.context, index, entry.tokenName || `Native${index}`, [previous, ...args]);

            slot.set(value);
            return postAssignmentNatives.has(index) ? previous : value;
        }

        let args: ScriptArgument_T[];

        if (index === 278) {
            const context = this.frame.context;

            this.frame.context = this.frame.self;
            try {
                args = this.readArguments(null, context, index);
            } finally {
                this.frame.context = context;
            }
        } else args = this.readArguments();

        return this.vm.invokeNative(this.frame.self, this.frame.context, index, entry.tokenName || `Native${index}`, args);
    }

    protected evalActorIterator(nativeIndex: number): ScriptValue_T {
        const context = this.frame.context;

        this.frame.context = this.frame.self;

        try {
            const baseClass = this.evalToken() as string || "engine.Actor", slot = this.evalLValue();
            const matchTag = nativeIndex !== 307 && this.entries[this.pc].value !== ExprToken_T.EndFunctionParms ? this.evalToken() as string : null, end = this.next();

            if (end.type !== "token" || end.value !== ExprToken_T.EndFunctionParms) throw new Error(`UnrealScript '${this.frame.fn.id}' expected actor iterator parameters to end`);
            if (this.entries[this.pc].value === ExprToken_T.DebugInfo) this.evalToken();

            const target = this.readOffset(), start = this.pc, pop = this.entries[target.entryIndex];

            if (!pop || pop.type !== "token" || pop.value !== ExprToken_T.IteratorPop) throw new Error(`UnrealScript '${this.frame.fn.id}' has no IteratorPop at '${target.virtualOffset}'`);
            if (!this.vm.getLibrary().scriptClasses[baseClass]) throw new Error(`UnrealScript iterator class '${baseClass}' is not in the decode library`);

            let index = nativeIndex === 313 ? getLevelActors(context).getFirstDynamicActor() : 0;

            while (true) {
                slot.set(null);

                while (true) {
                    let actor: ScriptHost_T;

                    if (nativeIndex !== 307) {
                        const level = getLevelActors(context);

                        if (index >= level.getLevelActorCount()) break;
                        actor = level.getLevelActor(index++);
                    } else {
                        const touching = getProperty(context, "Touching") as ScriptHost_T[];

                        if (!Array.isArray(touching)) throw new Error(`UnrealScript TouchingActors requires a Touching array for '${context.scriptClassId}'`);
                        if (index >= touching.length) break;
                        actor = touching[index++];
                    }

                    if (!actor) continue;

                    const script = typeof (actor as any).findComponent === "function" ? (actor as any).findComponent("script") : null;
                    const vm = cacheStateFrames.get(actor)?.vm || (script ? script.getVM() as UnScriptVM : this.vm);
                    let classId = actor.scriptClassId;

                    while (classId && classId !== baseClass) {
                        const cls = vm.getLibrary().scriptClasses[classId];

                        if (!cls) throw new Error(`UnrealScript class '${classId}' is not in the decode library`);
                        classId = cls.superClassId;
                    }

                    if (classId && (!matchTag || matchTag.toLowerCase() === "none" || (getProperty(actor, "Tag") as string || "None").toLowerCase() === matchTag.toLowerCase())) { slot.set(actor); break; }
                }

                if (slot.get() === null) { this.pc = target.entryIndex + 1; return undefined; }

                while (true) {
                    const entry = this.entries[this.pc];

                    if (!entry) throw new Error(`UnrealScript '${this.frame.fn.id}' read past its iterator body`);
                    if (entry.type === "token" && entry.value === ExprToken_T.IteratorPop) { this.pc++; return undefined; }
                    if (entry.type === "token" && entry.value === ExprToken_T.IteratorNext) { this.pc = start; break; }
                    this.evalToken();
                }
            }
        } finally {
            this.frame.context = context;
        }
    }

    protected readArguments(fn: IScriptFunctionDecodeInfo = null, context: ScriptHost_T = this.frame.context, nativeIndex: number = fn ? fn.nativeIndex : 0): ScriptArgument_T[] {
        const args = new Array<ScriptArgument_T>();
        const fields = fn ? fn.fields.filter(field => field.flags & CPF_Parm && !(field.flags & CPF_ReturnParm)) : null;
        const isSpawn = nativeIndex === 278;

        while (true) {
            const entry = this.entries[this.pc];

            if (!entry) throw new Error(`UnrealScript '${this.frame.fn.id}' has an unterminated call`);

            if (entry.type === "token" && entry.value === ExprToken_T.EndFunctionParms) {
                this.pc++;
                if (isSpawn) {
                    if (args.length < 4) args[3] = cloneScriptValue(getProperty(context, "Location"));
                    if (args.length < 5) args[4] = cloneScriptValue(getProperty(context, "Rotation"));
                }
                return args;
            }

            const field = fields && fields[args.length];

            const isTransform = isSpawn && (args.length === 3 || args.length === 4);
            const fallback = isTransform ? cloneScriptValue(getProperty(context, args.length === 3 ? "Location" : "Rotation")) : undefined;
            const value = field && field.flags & CPF_OutParm ? this.evalLValue() : this.evalToken();

            args.push(value === undefined ? fallback : isTransform ? cloneScriptValue(value) : value);
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
            case CastToken_T.VectorToRotator: return UNativeRegistry.getNativeFunc("Vector2Rotator")(value);
            case CastToken_T.FloatToInt: return Math.fround(Number(value)) | 0;
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
            case ExprToken_T.DefaultVariable: return this.evalLValueFromEntry(entry).get();
            case ExprToken_T.StructMember: {
                const id = this.next().value as string;
                const value = this.evalToken() ?? createDefaultArrayStruct(id);

                return (value as any)[getStructMemberKey(value, id)] as ScriptValue_T;
            }
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
            case ExprToken_T.Iterator:
            case ExprToken_T.Nothing: return undefined;
            case ExprToken_T.GotoLabel: {
                const label = this.evalToken() as string;

                if (!this.vm.gotoLabel(this.frame.context, label)) throw new Error(`UnrealScript '${this.frame.fn.id}' has no label '${label}'`);
                return undefined;
            }
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
            case ExprToken_T.Context: return this.evalContext(opcode);
            case ExprToken_T.New: {
                const outer = this.evalToken(), name = this.evalToken(), flags = this.evalToken(), cls = this.evalToken();

                return this.vm.constructObject(cls as string, outer === undefined ? this.frame.context : outer as ScriptHost_T, name === undefined ? "" : name as string, flags === undefined ? 0 : flags as number);
            }
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
            case ExprToken_T.DynArrayInsert: {
                const slot = this.evalLValue(), index = this.evalToken() as number, count = this.evalToken() as number;
                const array = slot.get();

                if (!Array.isArray(array)) throw new Error(`UnrealScript '${this.frame.fn.id}' array insertion is not an array`);
                if (count < 0) throw new Error(`UnrealScript '${this.frame.fn.id}' cannot insert a negative array count '${count}'`);
                if (count === 0) return undefined;
                if (slot.arrayElementDefault === undefined) throw new Error(`UnrealScript '${this.frame.fn.id}' array element default is missing`);

                const start = Math.max(0, Math.min(index, array.length)), copy = array.slice(0, start);

                for (let i = 0; i < count; i++) copy.push(cloneScriptValue(slot.arrayElementDefault) as any);
                for (let i = start; i < array.length; i++) copy.push(array[i]);
                slot.set(copy);
                return undefined;
            }
            case ExprToken_T.DynArrayRemove: {
                const slot = this.evalLValue(), index = this.evalToken() as number, count = this.evalToken() as number;
                const array = slot.get();

                if (!Array.isArray(array)) throw new Error(`UnrealScript '${this.frame.fn.id}' array removal is not an array`);
                if (count < 0) throw new Error(`UnrealScript '${this.frame.fn.id}' cannot remove a negative array count '${count}'`);
                if (count === 0) return undefined;

                const start = Math.max(0, Math.min(index, array.length)), copy = array.slice();

                copy.splice(start, Math.min(count, array.length - start));
                slot.set(copy);
                return undefined;
            }
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

    protected evalLValueFromEntry(entry: IScriptBytecodeEntryDecodeInfo): ScriptSlot_T {
        this.pc--;

        return this.evalLValue();
    }

    public run(): ScriptValue_T {
        while (this.pc < this.entries.length && !this.frame.didReturn && !this.frame.stopped)
            this.evalToken();

        return this.frame.returnValue;
    }

    public step(): void { this.steps = 0; this.evalToken(); }
    public hasFinished(): boolean { return this.frame.didReturn || this.frame.stopped || this.pc >= this.entries.length; }

    public rebind(vm: UnScriptVM): ScriptExecutor {
        if (this.hasFinished()) return null;

        const library = vm.getLibrary(), node = library.scriptStates[this.frame.fn.id] || library.scriptClasses[this.frame.fn.id];

        if (!node) throw new Error(`UnrealScript state '${this.frame.fn.id}' is not in the replacement decode library`);
        const offset = this.entries[this.pc].virtualOffset, index = node.program.entries.findIndex(entry => entry.virtualOffset === offset);

        if (index < 0) throw new Error(`UnrealScript state '${node.id}' has no replacement cursor at '${offset}'`);
        return new ScriptExecutor(vm, { ...this.frame, fn: node }, index);
    }
}

export class UnScriptVM {
    protected readonly library: DecodeLibrary;
    protected levelInfo: ScriptHost_T = null;
    protected readonly functionsById = new Map<string, IScriptFunctionDecodeInfo>();
    protected readonly functionsByClass = new Map<string, Map<string, IScriptFunctionDecodeInfo>>();

    public constructor(library: DecodeLibrary) {
        this.library = library;
        this.loadFunctions();
    }

    public getLibrary(): DecodeLibrary { return this.library; }
    public getLevelInfo(): ScriptHost_T { return this.levelInfo; }
    public setLevelInfo(level: ScriptHost_T): void { this.levelInfo = level; }

    public constructObject(classId: string, outer: ScriptHost_T, name: string, flags: number): ScriptHost_T {
        // Core.dll execNew 0x101454d0; StaticAllocateObject 0x101687f0; MakeUniqueObjectName 0x1015ef10.
        if (typeof classId !== "string" || !this.library.scriptClasses[classId]) throw new Error(`UnrealScript class '${classId}' is not in the decode library`);
        if (outer !== null && (!outer || typeof outer !== "object" || !outer.scriptClassId)) throw new Error(`Invalid UnrealScript object outer.`);
        if (typeof name !== "string" || !Number.isInteger(flags) || flags < -0x80000000 || flags > 0x7fffffff || flags & ~ObjectFlags_T.RF_ScriptMask) throw new Error(`Invalid UnrealScript object name or flags.`);
        // shortcut: unnamed script objects; native replacement and derived native constructors remain unsupported.
        if (name) throw new Error(`UnrealScript construction of named objects is not implemented.`);

        const cls = this.library.scriptClasses[classId];

        if (cls.classFlags & EClassFlags_T.CLASS_Abstract) throw new Error(`Cannot construct abstract UnrealScript class '${classId}'.`);
        for (let parent = cls; parent; parent = this.library.scriptClasses[parent.superClassId])
            if (parent.isNative && parent.superClassId) throw new Error(`UnrealScript native constructor '${parent.id}' is not implemented.`);

        const object: ScriptHost_T = { scriptClassId: classId, isLevelActor: false, scriptProperties: new Map() };

        this.initializeHost(object);
        // StaticAllocateObject 0x10168c4c leaves UObject.StateFrame null.
        cacheStateFrames.delete(object);
        outer = outer || transientPackage;
        let names = cacheOuterObjects.get(outer), index = cacheObjectNames.get(cls) ?? 0;

        if (!names) cacheOuterObjects.set(outer, names = new Map());
        do {
            const suffix = String(index++);

            name = cls.name.replace(/[0-9]+$/, "").slice(0, NAME_SIZE - suffix.length - 2) + suffix;
        } while (names.get(name.toLowerCase())?.deref());
        cacheObjectNames.set(cls, index);
        const reference = new WeakRef(object), lowerName = name.toLowerCase();

        names.set(lowerName, reference);
        objectNames.register(object, { names, name: lowerName, object: reference });
        setProperty(object, "Outer", outer);
        setProperty(object, "Name", name);
        setProperty(object, "Class", classId);
        setProperty(object, "ObjectFlags", flags | (cls.classFlags & EClassFlags_T.CLASS_Transient ? ObjectFlags_T.RF_Transient : 0));
        return object;
    }

    public loadFunctions(): void {
        for (const fn of Object.values(this.library.scriptFunctions)) {
            this.functionsById.set(fn.id.toLowerCase(), fn);

            let functions = this.functionsByClass.get(fn.owner);

            if (!functions) this.functionsByClass.set(fn.owner, functions = new Map());

            functions.set(fn.name.toLowerCase(), fn);
        }
    }

    public getFunction(id: string): IScriptFunctionDecodeInfo {
        const fn = this.library.scriptFunctions[id] || this.functionsById.get(id.toLowerCase());

        if (!fn) throw new Error(`UnrealScript function '${id}' is not in the decode library`);

        return fn;
    }

    public getDefaultObject(classId: string): ScriptHost_T {
        if (typeof classId !== "string") throw new Error(`Invalid UnrealScript class '${classId}'.`);

        const cls = this.library.scriptClasses[classId] || Object.values(this.library.scriptClasses).find(cls => cls.id.toLowerCase() === classId.toLowerCase());

        if (!cls) throw new Error(`UnrealScript class '${classId}' is not in the decode library`);
        let object = cacheDefaultObjects.get(cls);

        if (!object) {
            object = { scriptClassId: cls.id, isLevelActor: false, isClassDefaultObject: true, scriptProperties: new Map() };
            this.initializeHost(object);
            cacheStateFrames.delete(object);
            setProperty(object, "Class", cls.id);
            cacheDefaultObjects.set(cls, object);
        }

        return object;
    }

    public initializeHost(host: ScriptHost_T): void {
        const classes = new Array<IScriptClassDecodeInfo>();
        let cls = this.library.scriptClasses[host.scriptClassId];

        if (!cls) throw new Error(`UnrealScript class '${host.scriptClassId}' is not in the decode library`);

        cacheStateFrames.set(host, { node: cls, cls, vm: this, probeMask: 0xffffffffffffffffn, execution: null, latentAction: 0, isEndingState: false, stateChanged: false, hasTick: false });
        this.updateStateTick(host);

        while (cls) {
            classes.push(cls);
            if (!cls.superClassId) break;

            cls = this.library.scriptClasses[cls.superClassId];
        }

        const properties = getProperties(host);
        const defaultObject = cacheDefaultObjects.get(classes[0]);
        let layout = "";

        if (properties instanceof Map) for (const [key, value] of properties) layout += value === null ? `${key}\0!` : `${key}\0`;
        else for (const key of Object.keys(properties)) layout += properties[key] === null ? `${key}\0!` : `${key}\0`;

        let cacheLayouts = cacheHostDefaults.get(classes[0]);
        if (!cacheLayouts) cacheHostDefaults.set(classes[0], cacheLayouts = new Map());

        const replay = defaultObject ? null : cacheLayouts.get(layout); // the defaults pass only depends on the class chain and the initial keys and nulls

        if (replay) {
            for (let i = 0, len = replay.length; i < len; i++) {
                const { key, value, isEmptyArray } = replay[i];
                const initialized = isEmptyArray ? [] : cloneScriptValue(value);

                if (properties instanceof Map) properties.set(key, initialized);
                else properties[key] = initialized;
            }
            return;
        }

        const recorded: HostDefault_T[] = [];
        const initialProperties = new Map<string, ScriptValue_T>();
        const keysByLower = new Map<string, string>();

        for (const key of properties instanceof Map ? properties.keys() : Object.keys(properties))
            if (!keysByLower.has(key.toLowerCase())) keysByLower.set(key.toLowerCase(), key);

        if (properties instanceof Map) {
            for (const [name, value] of properties)
                initialProperties.set(getFieldName(name).toLowerCase(), value);
        } else {
            for (const [name, value] of Object.entries(properties))
                initialProperties.set(getFieldName(name).toLowerCase(), value);
        }

        if (defaultObject) {
            for (const [name, value] of defaultObject.scriptProperties as Map<string, ScriptValue_T>) {
                const fieldName = getFieldName(name).toLowerCase();
                const key = keysByLower.get(name.toLowerCase()) ?? keysByLower.get(fieldName) ?? name;
                const fieldClass = classes.find(cls => getClassField(cls, fieldName));
                const type = fieldClass ? getClassField(fieldClass, fieldName).type as any : null;

                if (initialProperties.has(fieldName) && !(initialProperties.get(fieldName) === null && (type === "Struct" || type === "Array"))) continue;
                const initialized = cloneScriptValue(value);

                if (properties instanceof Map) properties.set(key, initialized);
                else properties[key] = initialized;
            }
            return;
        }

        for (let i = classes.length - 1; i >= 0; i--) {
            const defaults = getClassDefaults(classes[i]);

            for (let j = 0, len = defaults.length; j < len; j++) {
                const { name, lowerName, fieldName, value, isStructOrArray, isArray } = defaults[j];
                const key = keysByLower.get(lowerName) ?? keysByLower.get(fieldName) ?? null;
                const initial = initialProperties.get(fieldName);

                if (initialProperties.has(fieldName) && !(initial === null && isStructOrArray)) continue;
                const initialized = value === null && isArray ? [] : cloneScriptValue(value);

                if (properties instanceof Map) properties.set(key ?? name, initialized);
                else properties[key ?? name] = initialized;
                recorded.push({ key: key ?? name, value, isEmptyArray: value === null && isArray });

                if (key === null) keysByLower.set(lowerName, name);
            }
        }

        cacheLayouts.set(layout, recorded);
    }

    protected findFunctionOptional(classId: string | ScriptHost_T, name: string): IScriptFunctionDecodeInfo | null {
        const lowerName = name.toLowerCase();
        if (typeof classId !== "string") {
            const frame = cacheStateFrames.get(classId);

            if (!frame) return this.findFunctionOptional(classId.scriptClassId, name);
            if (frame.node !== frame.cls) {
                let node = frame.node;

                while (node) {
                    const fn = frame.vm.functionsByClass.get(node.id)?.get(lowerName);

                    if (fn) return fn;
                    node = this.getStateParent(frame, node);
                }
            }

            return frame.vm.findFunctionOptional(frame.cls.id, name);
        }

        let cls = this.library.scriptClasses[classId];

        while (cls) {
            const fn = this.functionsByClass.get(cls.id)?.get(lowerName);

            if (fn) return fn;
            if (!cls.superClassId) break;

            cls = this.library.scriptClasses[cls.superClassId];
        }

        return null;
    }

    public findFunction(classId: string | ScriptHost_T, name: string): IScriptFunctionDecodeInfo {
        const fn = this.findFunctionOptional(classId, name);

        if (!fn)
            throw new Error(`UnrealScript function '${typeof classId === "string" ? classId : classId.scriptClassId}.${name}' is not in the decode library`);

        return fn;
    }

    public hasScriptFunction(classId: string | ScriptHost_T, name: string): boolean {
        const fn = this.findFunctionOptional(classId, name);

        return !!fn && fn.nativeIndex === 0 && !(fn.flags & FUNC_Native);
    }

    public resolveObject(context: ScriptHost_T, id: string): ScriptValue_T {
        const resolver = (context as any).resolveUnrealObject;

        return typeof resolver === "function" ? resolver.call(context, id) : id;
    }

    protected getStateParent(frame: StateFrame_T, node: IScriptStateDecodeInfo): IScriptStateDecodeInfo {
        if (!node.superStateId) return null;

        const parent = frame.vm.library.scriptStates[node.superStateId] || frame.vm.library.scriptClasses[node.superStateId];

        if (!parent) throw new Error(`UnrealScript state '${node.superStateId}' is not in the decode library`);
        return parent;
    }

    protected updateStateTick(context: ScriptHost_T): void {
        const frame = cacheStateFrames.get(context), fn = frame.vm.findFunctionOptional(context, "Tick");

        frame.hasTick = !!fn && fn.nativeIndex === 0 && !(fn.flags & FUNC_Native) && fn.program.entries.length > 2;
    }

    public hasTickFunction(context: ScriptHost_T): boolean { return cacheStateFrames.get(context)?.hasTick ?? false; }

    public bindHost(context: ScriptHost_T): void {
        const frame = cacheStateFrames.get(context), cls = this.library.scriptClasses[context.scriptClassId];

        if (!frame || !cls) throw new Error(`UnrealScript runtime replacement requires an initialized class '${context.scriptClassId}'`);
        const node = frame.node === frame.cls ? cls : this.library.scriptStates[frame.node.id] || this.library.scriptClasses[frame.node.id];

        if (!node) throw new Error(`UnrealScript state '${frame.node.id}' is not in the replacement decode library`);
        const execution = frame.execution ? frame.execution.rebind(this) : null;

        frame.vm = this;
        frame.cls = cls;
        frame.node = node;
        frame.execution = execution;
        this.updateStateTick(context);
    }

    public gotoState(context: ScriptHost_T, name: string): number {
        const frame = cacheStateFrames.get(context);

        if (!frame) return 0;

        const previous = frame.node !== frame.cls ? frame.node.name.toLowerCase() : "none", requested = name.toLowerCase();
        let node: IScriptStateDecodeInfo = null, cls = frame.cls;

        frame.latentAction = 0;
        while (cls && !node && requested !== "none") {
            for (const id of cls.stateIds) {
                const state = frame.vm.library.scriptStates[id];

                if (!state) throw new Error(`UnrealScript state '${id}' is not in the decode library`);
                if (requested === "auto" ? state.flags & EStateFlags_T.STATE_Auto : state.name.toLowerCase() === requested) { node = state; break; }
            }
            cls = cls.superClassId ? frame.vm.library.scriptClasses[cls.superClassId] : null;
        }

        const target = node ? node.name.toLowerCase() : "none";

        if (previous !== "none" && previous !== target && !frame.isEndingState && this.isProbing(context, "EndState")) {
            frame.stateChanged = false;
            frame.isEndingState = true;
            frame.vm.call(context, "EndState");
            frame.isEndingState = false;
            if (frame.stateChanged) return 2;
        }

        frame.node = node || frame.cls;
        frame.execution = null;
        frame.probeMask = (frame.node.probeMask | frame.cls.probeMask) & frame.node.ignoreMask;
        this.updateStateTick(context);
        if (target === "none") return 0;

        if (previous !== target && this.isProbing(context, "BeginState")) {
            frame.stateChanged = false;
            frame.vm.call(context, "BeginState");
            if (frame.stateChanged) return 2;
        }

        frame.stateChanged = true;
        return 1;
    }

    public gotoLabel(context: ScriptHost_T, name: string): boolean {
        const frame = cacheStateFrames.get(context);

        if (!frame) return false;

        frame.latentAction = 0;
        frame.execution = null;
        if (name.toLowerCase() === "none") return false;

        let node = frame.node;

        while (node) {
            if (node.labelTableVirtualOffset !== 65535) {
                const entries = node.program.entries;
                let index = entries.findIndex(entry => entry.virtualOffset === node.labelTableVirtualOffset && entry.type === "label");

                if (index < 0) throw new Error(`UnrealScript state '${node.id}' has no label table at '${node.labelTableVirtualOffset}'`);
                for (; index < entries.length; index++) {
                    const label = entries[index].value as any;

                    if (entries[index].type !== "label") throw new Error(`Invalid label table in UnrealScript state '${node.id}'`);
                    if (label.name.toLowerCase() === "none") break;
                    if (label.name.toLowerCase() !== name.toLowerCase()) continue;
                    if (label.entryIndex < 0 || entries[label.entryIndex]?.virtualOffset !== label.virtualOffset) throw new Error(`Invalid label '${label.name}' in UnrealScript state '${node.id}'`);

                    frame.execution = new ScriptExecutor(frame.vm, { fn: node, self: context, context, locals: new Map(), returnValue: undefined, didReturn: false, stopped: false }, label.entryIndex);
                    return true;
                }
            }
            node = this.getStateParent(frame, node);
        }

        return false;
    }

    public processState(context: ScriptHost_T, deltaTime: number): void {
        const frame = cacheStateFrames.get(context), role = getProperty(context, "Role") as number;

        if (!frame || role == null || role < ENetRole_T.ROLE_Authority && !(frame.node.flags & EStateFlags_T.STATE_Simulated) || getProperty(context, "bDeleteMe")) return;

        if (frame.latentAction) {
            if (frame.latentAction !== EPollSlowFuncs.EPOLL_Sleep) { debugger; throw new Error(`Unimplemented latent action '${frame.latentAction}' for '${context.scriptClassId}'`); }
            const delta = Math.fround(deltaTime), remaining = Math.fround(getProperty(context, "LatentFloat") as number) - delta;

            setProperty(context, "LatentFloat", Math.fround(remaining));
            if (remaining < delta * 0.5) frame.latentAction = 0;
        }

        let node = frame.node, changes = 0, steps = 0;

        while (frame.execution && !frame.latentAction && !getProperty(context, "bDeleteMe")) {
            if (++steps > 1000000) throw new Error(`UnrealScript state '${frame.node.id}' exceeded its runaway limit`);
            const execution = frame.execution;

            execution.step();
            if (frame.execution === execution && execution.hasFinished()) frame.execution = null;
            if (frame.node.id !== node.id) {
                node = frame.node;
                if (++changes > 4) break;
            }
        }
    }

    public invokeNative(self: ScriptHost_T, context: ScriptHost_T, index: number, name: string, args: ScriptArgument_T[]): ScriptValue_T {
        if (context.handlesUnrealNative && context.handlesUnrealNative(index, name))
            return context.callUnrealNative!({ index, name, args, self, context });

        if (name.toLowerCase() === "onlyaffectpawns") {
            const value = !!args[0];

            if (!getProperty(context, "bCollideActors") || value === !!getProperty(context, "bOnlyAffectPawns")) return;

            this.invokeNative(self, context, 262, "SetCollision", [false, getProperty(context, "bBlockActors"), getProperty(context, "bBlockPlayers")]);
            setProperty(context, "bOnlyAffectPawns", value);
            this.invokeNative(self, context, 262, "SetCollision", [true, getProperty(context, "bBlockActors"), getProperty(context, "bBlockPlayers")]);
            return;
        }

        if (index === 113) {
            const frame = cacheStateFrames.get(context), previous = frame && frame.node !== frame.cls ? frame.node.name : "None", requested = args[0] == null ? previous : args[0] as string, label = args[1] == null || (args[1] as string).toLowerCase() === "none" ? "Begin" : args[1] as string;
            const result = requested.toLowerCase() === previous.toLowerCase() ? 1 : this.gotoState(context, requested);

            if (result === 1) {
                if (!this.gotoLabel(context, label) && args[1] != null && (args[1] as string).toLowerCase() !== "none") throw new Error(`UnrealScript state '${requested}' has no label '${label}'`);
            } else if (result === 0 && requested.toLowerCase() !== "none" && requested.toLowerCase() !== "auto") throw new Error(`UnrealScript state '${requested}' does not exist for '${context.scriptClassId}'`);
            return undefined;
        }

        if (index === 256) {
            const frame = cacheStateFrames.get(context);

            if (!frame) throw new Error(`UnrealScript Sleep requires an initialized state frame for '${context.scriptClassId}'`);
            frame.latentAction = EPollSlowFuncs.EPOLL_Sleep;
            setProperty(context, "LatentFloat", Math.fround(args[0] as number));
            return undefined;
        }

        if (index === 117 || index === 118) {
            const probe = args[0] as string, mask = typeof probe === "string" ? cacheProbeMasks.get(probe.toLowerCase()) : undefined;
            const frame = cacheStateFrames.get(context);

            if (mask === undefined || !frame) throw new Error(`UnrealScript '${name}' requires a probe function and an initialized state frame for '${context.scriptClassId}'.`);

            if (index === 117) frame.probeMask |= (frame.node.probeMask | frame.cls.probeMask) & frame.node.ignoreMask & mask;
            else frame.probeMask &= ~mask;
            return undefined;
        }

        if (index === 281) {
            const frame = cacheStateFrames.get(context), name = (args[0] as string).toLowerCase();
            let node = frame ? frame.node : null;

            while (node) {
                if (node.name.toLowerCase() === name) return true;

                node = this.getStateParent(frame, node);
            }

            return false;
        }

        if (index === 284) {
            const frame = cacheStateFrames.get(context);

            return frame && frame.node ? frame.node.name : "None";
        }

        if (name.toLowerCase() === "dynamicloadobject" && typeof args[1] === "string" && args[1].toLowerCase() === "engine.sound") {
            const path = args[0] as string;

            if (!(path in this.library.sounds)) throw new Error(`Script sound '${path}' has not been decoded.`);
            return this.library.sounds[path] === null ? null : path;
        }

        if (index === 280) {
            const rate = Math.fround(args[0] as number);

            if (!Number.isFinite(rate)) throw new Error(`Invalid timer rate for '${context.scriptClassId}'.`);

            setProperty(context, "TimerRate", rate);
            setProperty(context, "TimerCounter", 0);
            setProperty(context, "bTimerLoop", !!args[1]);
            return undefined;
        }

        if (index === 258) {
            let classId = args[0] as string;
            const parentId = args[1] as string;

            if (!parentId) return false;
            if (!this.library.scriptClasses[parentId]) throw new Error(`UnrealScript class '${parentId}' is not in the decode library`);

            while (classId) {
                const cls = this.library.scriptClasses[classId];

                if (!cls) throw new Error(`UnrealScript class '${classId}' is not in the decode library`);
                if (classId === parentId) return true;
                classId = cls.superClassId;
            }

            return false;
        }

        if (index === 303) {
            const className = (args[0] as string).toLowerCase();
            const script = typeof (context as any).findComponent === "function" ? (context as any).findComponent("script") : null;
            const vm = cacheStateFrames.get(context)?.vm || (script ? script.getVM() as UnScriptVM : this);
            let classId = context.scriptClassId;

            // UObject::execIsA (Core.dll 0x10137eb9..0x10137edd) compares class names up the superclass chain.
            while (classId) {
                const cls = vm.library.scriptClasses[classId];

                if (!cls) throw new Error(`UnrealScript class '${classId}' is not in the decode library`);
                if (cls.name.toLowerCase() === className) return true;
                classId = cls.superClassId;
            }

            return false;
        }

        if (index === 278) {
            if (args[0] === null || args[0] === undefined) return null;
            const location = args[3] === undefined ? getProperty(context, "Location") : args[3];
            const rotation = args[4] === undefined ? getProperty(context, "Rotation") : args[4];

            if (!Array.isArray(location) || location.length !== 3 || !Array.isArray(rotation) || rotation.length !== 3) throw new Error(`Spawn requires actor Location and Rotation vectors.`);
            args = [args[0], args[1] ?? null, args[2] ?? "None", location.map(value => Math.fround(value as number)), rotation.map(value => (value as number) | 0), !!args[5]];
        }

        if (UNativeRegistry.hasNativeFunc(index)) return UNativeRegistry.getNativeFunc(index)(...args) as ScriptValue_T;
        if (UNativeRegistry.hasNativeFunc(name)) return UNativeRegistry.getNativeFunc(name)(...args) as ScriptValue_T;

        const handler = context.callUnrealNative || self.callUnrealNative;

        if (!handler)
            throw new Error(`UnrealScript native '${name}' (${index}) is not registered for '${context.scriptClassId}'`);

        const result = handler.call(handler === context.callUnrealNative ? context : self, { index, name, args, self, context });

        if (index === 278 && result && typeof args[2] === "string" && args[2] && args[2].toLowerCase() !== "none") setProperty(asHost(result), "Tag", args[2]);
        return result;
    }

    public invoke(context: ScriptHost_T, fn: IScriptFunctionDecodeInfo, args: ScriptArgument_T[] = [], self: ScriptHost_T = context): ScriptValue_T {
        if (fn.nativeIndex !== 0 || fn.flags & FUNC_Native) return this.invokeNative(self, context, fn.nativeIndex, fn.name, args);
        if (context.handlesUnrealScriptFunction && context.handlesUnrealScriptFunction(fn)) return undefined;

        const locals = new Map<string, ScriptArgument_T>();
        let argIndex = 0;

        for (const field of fn.fields) {
            if (!(field.flags & CPF_Parm)) {
                if ((field.type as string) === "Array") locals.set(field.name, []);
                continue;
            }
            if (field.flags & CPF_ReturnParm) continue;

            locals.set(field.name, argIndex < args.length ? args[argIndex++] : null);
        }

        const frame: ScriptFrame_T = { fn, self, context, locals, returnValue: undefined, didReturn: false, stopped: false };

        return new ScriptExecutor(this, frame).run();
    }

    public isProbing(context: ScriptHost_T, name: string): boolean {
        const mask = cacheProbeMasks.get(name.toLowerCase()), frame = cacheStateFrames.get(context);

        return mask === undefined || !frame || (frame.probeMask & mask) !== 0n;
    }

    public call(context: ScriptHost_T, name: string, args: ScriptValue_T[] = []): ScriptValue_T {
        const vm = cacheStateFrames.get(context)?.vm || this;
        const fn = vm.findFunction(context, name);

        if (!vm.isProbing(context, name)) return undefined;

        return vm.invoke(context, fn, args);
    }
}

export default UnScriptVM;
