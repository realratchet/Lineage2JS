import { ExprToken_T } from "@l2js/core";
import type { IScriptBytecodeEntryDecodeInfo, IScriptProgramDecodeInfo, IScriptBytecodeOffsetDecodeInfo, ScriptBytecodeValue_T } from "../contracts/script";

type NativeCall_T = { kind: "call", name: string, args: SkillExpression_T[] };
type Property_T = { kind: "property", name: string, isDefault: boolean };
type Local_T = { kind: "local", name: string };
type ArrayElement_T = { kind: "arrayElement", array: SkillExpression_T, index: SkillExpression_T };
type Name_T = { kind: "name", value: string };
type If_T = { kind: "if", condition: SkillExpression_T, then: SkillStatement_T[], otherwise: SkillStatement_T[] };
type While_T = { kind: "while", condition: SkillExpression_T, body: SkillStatement_T[] };
type Return_T = { kind: "return", value?: SkillExpression_T };
type Set_T = { kind: "set", target: SkillExpression_T, value: SkillExpression_T };
type SkillExpression_T = string | number | boolean | null | NativeCall_T | Property_T | Local_T | ArrayElement_T | Name_T;
type SkillStatement_T = SkillExpression_T | If_T | While_T | Return_T | Set_T;

export function call(name: string, ...args: SkillExpression_T[]): NativeCall_T {
    return { kind: "call", name, args };
}

export function property(name: string, isDefault: boolean = false): Property_T {
    return { kind: "property", name, isDefault };
}

export function local(name: string): Local_T {
    return { kind: "local", name };
}

export function name(value: string): Name_T {
    return { kind: "name", value };
}

export function arrayElement(array: SkillExpression_T, index: SkillExpression_T): ArrayElement_T {
    return { kind: "arrayElement", array, index };
}

export function set_(target: SkillExpression_T, value: SkillExpression_T): Set_T {
    return { kind: "set", target, value };
}

export function if_(condition: SkillExpression_T, then: SkillStatement_T[], otherwise: SkillStatement_T[] = []): If_T {
    return { kind: "if", condition, then, otherwise };
}

export function while_(condition: SkillExpression_T, body: SkillStatement_T[]): While_T {
    return { kind: "while", condition, body };
}

export function return_(value?: SkillExpression_T): Return_T {
    return { kind: "return", value };
}

export function compile(statements: SkillStatement_T[]): IScriptProgramDecodeInfo {
    const entries: IScriptBytecodeEntryDecodeInfo[] = [];
    let virtualOffset = 0;

    // Generated programs use virtual offsets for VM jumps, not on-disk bytecode offsets.
    function emit(type: string, value: ScriptBytecodeValue_T, size: number = 1, tokenName?: string): number {
        const index = entries.length;

        entries.push({ virtualOffset, type, value, tokenName });
        virtualOffset += size;

        return index;
    }

    function token(value: ExprToken_T): number {
        return emit("token", value);
    }

    function patchOffset(index: number, targetIndex: number): void {
        const target = entries[targetIndex];
        const offset: IScriptBytecodeOffsetDecodeInfo = { entryIndex: targetIndex, virtualOffset: target ? target.virtualOffset : virtualOffset };

        entries[index].value = offset;
    }

    function emitOffset(targetIndex: number): number {
        return emit("codeOffset", { entryIndex: targetIndex, virtualOffset: -1 }, 2);
    }

    function emitLValue(value: SkillExpression_T): void {
        if (typeof value !== "object" || value === null) throw new Error("Skill program assignment target is not an lvalue.");

        switch (value.kind) {
            case "property":
                token(value.isDefault ? ExprToken_T.DefaultVariable : ExprToken_T.InstanceVariable);
                emit("propertyRef", value.name, 4);
                return;
            case "local":
                token(ExprToken_T.LocalVariable);
                emit("propertyRef", value.name, 4);
                return;
            case "arrayElement":
                token(ExprToken_T.ArrayElement);
                emitExpression(value.index);
                emitLValue(value.array);
                return;
            default: throw new Error("Skill program assignment target is not an lvalue.");
        }
    }

    function emitExpression(value: SkillExpression_T): void {
        if (value === null) {
            token(ExprToken_T.NoObject);
            return;
        }
        if (typeof value === "boolean") {
            token(value ? ExprToken_T.True : ExprToken_T.False);
            return;
        }
        if (typeof value === "number") {
            if (Number.isInteger(value)) {
                token(ExprToken_T.IntConst);
                emit("uint32", value, 4);
            } else {
                token(ExprToken_T.FloatConst);
                emit("float", value, 4);
            }
            return;
        }
        if (typeof value === "string") {
            token(ExprToken_T.UnicodeStringConst);
            emit("string", value, (value.length + 1) * 2);
            return;
        }

        switch (value.kind) {
            case "name":
                token(ExprToken_T.NameConst);
                emit("nameRef", value.value, 4);
                return;
            case "property":
            case "local":
                emitLValue(value);
                return;
            case "arrayElement":
                token(ExprToken_T.ArrayElement);
                emitExpression(value.index);
                emitExpression(value.array);
                return;
            case "call":
                emit("nativeCall", 0, 1, value.name);
                for (const arg of value.args) emitExpression(arg);
                token(ExprToken_T.EndFunctionParms);
                return;
            default: throw new Error(`Invalid skill expression '${(value as any).kind}'.`);
        }
    }

    function emitStatements(items: SkillStatement_T[]): void {
        for (const item of items) emitStatement(item);
    }

    function emitStatement(statement: SkillStatement_T): void {
        if (statement === null || typeof statement !== "object" || !("kind" in statement)) {
            emitExpression(statement as SkillExpression_T);
            return;
        }

        switch (statement.kind) {
            case "if": {
                token(ExprToken_T.JumpIfNot);
                const falseOffset = emitOffset(-1);
                emitExpression(statement.condition);
                emitStatements(statement.then);

                if (statement.otherwise.length) {
                    token(ExprToken_T.Jump);
                    const endOffset = emitOffset(-1);
                    patchOffset(falseOffset, entries.length);
                    emitStatements(statement.otherwise);
                    patchOffset(endOffset, entries.length);
                } else patchOffset(falseOffset, entries.length);
                return;
            }
            case "while": {
                const loopStart = entries.length;
                token(ExprToken_T.JumpIfNot);
                const exitOffset = emitOffset(-1);
                emitExpression(statement.condition);
                emitStatements(statement.body);
                token(ExprToken_T.Jump);
                const loopOffset = emitOffset(-1);
                patchOffset(loopOffset, loopStart);
                patchOffset(exitOffset, entries.length);
                return;
            }
            case "return":
                token(ExprToken_T.Return);
                if (statement.value === undefined) token(ExprToken_T.Nothing);
                else emitExpression(statement.value);
                return;
            case "set":
                token(ExprToken_T.Let);
                emitLValue(statement.target);
                emitExpression(statement.value);
                return;
            default:
                emitExpression(statement);
        }
    }

    emitStatements(statements);

    return { virtualSize: virtualOffset, entries };
}
