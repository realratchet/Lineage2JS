import UPackage from "../un-package";
import FConstructable from "../un-constructable";
import UNativeRegistry from "./un-native-registry";

const REGISTER: Record<string, typeof FConstructable> = {

};

const REGEX_DROP_COMMENT_BLOCKS = /\/\*(\*(?!\/)|[^*])*\*\//g;
const REGEXP_COMMENT_LINE = /\s*\/\/.*(?=\n|$)/gm;

const UClassRegistry = new class UClassRegistry {
    get structs() { return Object.freeze(REGISTER); }

    public register(object: UStruct) {
        const SuperKlass = object.superField ? REGISTER[(object.superField as UStruct).friendlyName] : FConstructable;
        const klassName = object.friendlyName;
        const Klass = REGISTER[klassName] = createStruct(klassName, SuperKlass, object.childPropFields);

        debugger;

        return Klass;
    }

    public parse(srcCode: string) {
        const expressions = srcCode
            .replaceAll(REGEX_DROP_COMMENT_BLOCKS, "")
            .replaceAll(/\s*\n\s*/g, "\n")
            .replaceAll(/[^\S\r\n]+/g, " ")
            .replaceAll(REGEXP_COMMENT_LINE, "")
            .replaceAll(/(\s+(?=[^\w\s\d]))|((?<=[^\w\s\d])\s+)|(\n+)/g, " ")
            .trim();

        const invoker = ExpressionConstructor.fromSource(expressions);

        invoker(UNativeRegistry)
    }
};

export default UClassRegistry;
export { UClassRegistry };

abstract class BaseConstruct {
    public abstract constuctType: string;

    public readonly modifiers: string[] = [];
    public readonly parent: BaseConstruct;
    public readonly root: BaseConstruct;
    public name: string;
    public nativeIndex: number;

    constructor(parent: BaseConstruct) {
        this.parent = parent;
        this.root = parent === null ? this : parent.root;
    }

    public getWS(depth: number) { return new Array(depth * 4).fill(' ').join(""); }

    public build(invokeName: string, depth: number, code: string[]): string[] {
        throw new Error("Not yet implemented");
    }
}

abstract class BaseObjectConstruct extends BaseConstruct {
    public readonly members: BaseConstruct[] = [];
    public readonly enumerators: Record<string, EnumConstruct> = {};
    public readonly events: Record<string, EventStruct> = {};
    public readonly structures: Record<string, StructConstruct> = {};
}

class EventStruct extends BaseConstruct {
    public readonly constuctType: string = "Event";
}

class FunctionStruct extends BaseConstruct {
    public readonly constuctType: string = "Function";
    public functionType: string;
    public returnType: string;
    public arguments: [string, string, string[]][] = [];
    public precedence: number;
    public implementation: string;

    public build(invokeName: string, depth: number, code: string[]): string[] {
        const isNative = this.modifiers.includes("native");
        const isStatic = this.modifiers.includes("static");

        const fnName = `add${isStatic ? "Static" : ""}${isNative ? "Native" : ""}Func`;
        const parameters: Record<string, any> = {};
        const ws = this.getWS(depth);

        if (isNative && Number.isFinite(this.nativeIndex)) {
            parameters["nativeIndex"] = this.nativeIndex;
        }

        let codeString = `${ws}${invokeName}.${fnName}("${this.name}", ${JSON.stringify(parameters)}`;

        if (!isNative) {
            if (this.functionType !== "function") throw new Error("Don't know how to deal with this yet.");
            if (typeof this.implementation !== "string") throw new Error("Don't know how to deal with this yet.");

            const fnArgs = this.arguments.map(([type, name, flags]) => {
                return `${name} /* type[${type}] [${flags.join(", ")}] */`;
            });

            codeString = codeString + `, function ${this.name} /* type[${this.returnType}] */ (${fnArgs.join(", ")}) {`;
            code.push(codeString);

            const wsInner = this.getWS(depth + 1);

            for (const impl of this.implementation.split("\n"))
                code.push(`${wsInner}/* ${impl} */`);
            code.push(`${wsInner}throw new Error("Not yet implemented");`);
            code.push(`${ws}});`);
        } else {
            codeString = codeString + ");";
            code.push(codeString);
        }

        return code;
    }
}

class EnumConstruct extends BaseConstruct {
    public readonly constuctType: string = "Enum";
    public readonly members: string[] = [];

    public build(invokeName: string, depth: number, code: string[]): string[] {
        if (this.modifiers.length > 0)
            throw new Error("Don't know what to do with this");

        const wsOuter = this.getWS(depth);
        const wsInner = this.getWS(depth + 1);

        code.push(`${wsOuter}${invokeName}.addEnum("${this.name}", {`);

        for (let i = 0, len = this.members.length; i < len; i++)
            code.push(`${wsInner}"${this.members[i]}": ${i},`);

        code.push('');

        for (let i = 0, len = this.members.length; i < len; i++)
            code.push(`${wsInner}"${i}": "${this.members[i]}",`);

        code.push(`${wsOuter}})${invokeName ? ';' : ''}`);

        return code;
    }
}

class StructConstruct extends BaseObjectConstruct {
    public readonly constuctType: string = "Struct";
    public extends: string;

    public build(invokeName: string, depth: number, code: string[]): string[] {
        if (this.modifiers.length > 0)
            throw new Error("Don't know what to do with this");


        const wsOuter = this.getWS(depth);
        const wsInner = this.getWS(depth + 2);

        code.push(`${wsOuter}${invokeName}.addStruct("${this.name}", "${this.extends ? this.extends : "Struct"}")`);

        for (let enumerators of Object.values(this.enumerators))
            enumerators.build("", depth + 2, code);

        for (let member of this.members)
            member.build("", depth + 2, code);

        code.push(`${wsInner}.finalize();`);

        return code;
    }
}

class ClassConstruct extends BaseObjectConstruct {
    public readonly constuctType: string = "Class";

    public build(invokeName: string, depth: number, code: string[]): string[] {
        if (!this.modifiers.includes("native"))
            throw new Error(`Must be native`);

        const wsOuter = this.getWS(depth + 1);
        const wsInner = this.getWS(depth + 2);
        const clsName = `cls_${this.name}`;

        code.push("(function() {");
        code.push(`${wsOuter}return function ${invokeName}(nativeRegistry) {`);
        code.push(`${wsInner}const ${clsName} = nativeRegistry.getClass("${this.name}");`);
        code.push("");

        for (const member of this.members)
            member.build(clsName, depth + 2, code);

        // code.push("");

        // for (const enumerator of Object.values(this.enumerators))
        //     enumerator.build(clsName, depth + 2, code);

        // code.push("");

        // for (const struct of Object.values(this.structures))
        //     struct.build(clsName, depth + 2, code);

        code.push(`${wsOuter}}`);
        code.push("}());");

        return code;
    }
}

class VarConstruct extends BaseConstruct {
    public readonly constuctType: string = "Variable";

    public isArray: boolean = false;
    public arraySize: number;
    public dataType: string;
    public group: string;

    public siblings: string[] = [];

    public build(invokeName: string, depth: number, code: string[]): string[] {

        const isNative = this.modifiers.includes("native");
        const isStatic = this.modifiers.includes("static");
        const memFunc = `add${isStatic ? "Static" : ""}${isNative ? "Native" : ""}Member`;

        const ws = this.getWS(depth);
        const parameters: Record<string, any> = {};

        if (this.isArray) {
            if (Number.isFinite(this.arraySize)) {
                parameters["isArray"] = true;
                parameters["arraySize"] = this.arraySize;
            } else parameters["isList"] = true;
        }

        [this.name, ...this.siblings].forEach(name => {
            const codeString = `${ws}${invokeName}.${memFunc}("${name}", ${JSON.stringify(parameters)})${invokeName ? ';' : ''}`;

            code.push(codeString);
        });

        return code;
    }
}

class ConstConstruct extends BaseConstruct {
    public readonly constuctType = "Constant";

    public value: any;

    public build(invokeName: string, depth: number, code: string[]): string[] {
        if (this.modifiers.length > 0)
            throw new Error("Don't yet know how to deal with this");

        const ws = this.getWS(depth);
        const codeString = `${ws}${invokeName}.addConst("${this.name}", ${this.value});`;

        code.push(codeString);

        return code;
    }
}

class ExpressionConstructor {
    protected readonly src: string;
    protected readonly srcLen: number;

    protected offset = 0;

    protected constructor(src: string) {
        this.src = src;
        this.srcLen = src.length;
    }

    protected getWhitespace(depth: number) { return new Array(depth * 4).fill(" ").join(""); }

    protected readToken() { return this.src[this.offset++]; }
    protected peekToken() { return this.src[this.offset + 1]; }
    protected getToken() { return this.src[this.offset]; }

    protected readNextStatement(): string {
        let offBegin = this.offset;
        let offFinish = offBegin;

        while (offFinish < this.srcLen) {
            const token = this.src[offFinish];

            if (/[\w\d]/.test(token)) { offFinish++; continue; }
            else if ('.' === token) {
                if (offFinish > offBegin && /^\d+$/.test(this.src.slice(offBegin, offFinish))) {
                    offFinish++;
                    continue;
                }
            } else if (/[\s\n]/.test(token)) {
                if (offFinish === offBegin) {
                    offBegin = ++offFinish;
                    continue;
                }

                break;
            }

            if (offFinish === offBegin)
                offFinish++;

            break;
        }

        if (offFinish <= offBegin) throw new Error("No offset");

        this.offset = offFinish;

        return this.src.slice(offBegin, offFinish);
    }

    protected getVarTypes(parent: BaseConstruct): string[] {
        const registeredStructs = Object.keys((parent.root as ClassConstruct).structures).map(x => x.toLowerCase());
        const varTypes = ["array", "bool", "int", "byte", "float", "string", "name", "enum", ...registeredStructs, parent.name.toLowerCase(), "pointer", "class"];

        return varTypes;
    }


    protected exprConstructVar(parent: BaseObjectConstruct, prevStatements: string[]): VarConstruct {
        if (prevStatements.length > 0) debugger;

        const cVar = new VarConstruct(parent);
        const dtypes = this.getVarTypes(parent);

        let statement;

        while (!dtypes.includes((statement = this.readNextStatement().toLowerCase()))) {
            if (/[\w\d]/.test(statement)) {
                cVar.modifiers.push(statement);
                continue;
            }

            switch (statement) {
                case "(":
                    cVar.group = this.readNextStatement();
                    if (this.readNextStatement() !== ')')
                        throw new Error("Must end with ')");
                    break;
                default: throw new Error(`Unknown token: ${statement}`);
            }
        }

        cVar.dataType = statement;
        cVar.name = statement = this.readNextStatement()

        statement = this.readNextStatement();

        parent.members.push(cVar);

        if (statement === ';') return cVar;
        if (statement !== '[') throw new Error(`Uknown statement: ${statement}`);

        cVar.isArray = true;
        statement = this.readNextStatement();

        if (statement.startsWith("0x")) cVar.arraySize = parseInt(statement, 16);
        else cVar.arraySize = parseInt(statement);

        if (this.readNextStatement() !== ']')
            throw new Error("Must end with ']");

        if (this.readNextStatement() !== ';')
            throw new Error("Must end with '];");

        return cVar;
    }

    protected exprConstructConst(parent: BaseObjectConstruct, prevStatements: string[]): ConstConstruct {
        if (prevStatements.length > 0) debugger;

        const cConst = new ConstConstruct(parent);

        cConst.name = this.readNextStatement();

        if (this.readNextStatement() !== '=') throw new Error("Must have assignment '=");

        let statement = this.readNextStatement();

        if (statement.startsWith("0x")) cConst.value = parseInt(statement, 16);
        else cConst.value = parseFloat(statement);

        if (this.readNextStatement() !== ';') throw new Error("Must have assignment ';");

        parent.members.push(cConst);

        return cConst;
    }

    protected exprConstructEnum(parent: BaseObjectConstruct, prevStatements: string[]): EnumConstruct {
        if (prevStatements.length > 0 && !(prevStatements.length === 1 && prevStatements[0] === "var")) debugger;

        const cEnum = new EnumConstruct(parent);

        cEnum.name = this.readNextStatement();
        parent.enumerators[cEnum.name] = cEnum;

        let statement = this.readNextStatement();

        if (statement !== '{') throw new Error(`Unknown statement: ${statement}`);

        while (this.offset < this.srcLen && (statement = this.readNextStatement()) !== '}') {
            if (statement === ',') continue;

            cEnum.members.push(statement);
        }

        if (statement !== '}') throw new Error(`Unknown statement: ${statement}`);

        if (!prevStatements.includes("var"))
            if ((statement = this.readNextStatement()) !== ';')
                throw new Error(`Unknown statement: ${statement}`);

        return cEnum;
    }

    protected exprConstructStruct(parent: BaseObjectConstruct, prevStatements: string[]): StructConstruct {
        if (prevStatements.length > 0) debugger;

        const cStruct = new StructConstruct(parent);

        cStruct.name = this.readNextStatement();

        parent.structures[cStruct.name] = cStruct;

        let statement = this.readNextStatement();

        if (statement === "extends") {
            cStruct.extends = this.readNextStatement();
            statement = this.readNextStatement();
        }

        if (statement !== '{') throw new Error(`Unknown statement: ${statement}`);

        const dtypes = this.getVarTypes(parent);

        while (this.offset < this.srcLen && (statement = this.readNextStatement()) !== '}') {
            if (statement !== "var") throw new Error(`Unknown statement: ${statement}`);

            const cVar = new VarConstruct(cStruct);

            statement = this.readNextStatement();

            if (statement === '(') {
                statement = this.readNextStatement();

                if (statement !== ')') {
                    cVar.group = statement;

                    if ((statement = this.readNextStatement()) !== ')')
                        throw new Error(`Unknown statement: ${statement}`);
                }

                statement = this.readNextStatement();
            }

            while (this.offset < this.srcLen && !dtypes.includes(statement.toLowerCase())) {
                cVar.modifiers.push(statement);
                statement = this.readNextStatement();
            }

            let dtype = statement;

            if (statement === "enum")
                dtype = this.exprConstructEnum(cStruct, ["var"]).name;
            else if (statement === "array") {
                if ((statement = this.readNextStatement()) !== '<') throw new Error(`Unknown statement: ${statement}`);

                dtype = this.readNextStatement();
                cVar.arraySize = Infinity;

                if ((statement = this.readNextStatement()) !== '>') throw new Error(`Unknown statement: ${statement}`);
            }

            cVar.dataType = dtype;
            cVar.name = this.readNextStatement();
            statement = this.readNextStatement();

            if (statement === ',') {
                statement = this.readNextStatement();

                while (this.offset < this.srcLen && statement !== ';') {
                    if (statement === ',') {
                        statement = this.readNextStatement();
                        continue;
                    }

                    cVar.siblings.push(statement);

                    statement = this.readNextStatement();
                }
            } else if (statement !== ';') throw new Error(`Unknown statement: ${statement}`);

            cStruct.members.push(cVar);
        }

        if ((statement = this.readNextStatement()) !== ';') throw new Error(`Unknown statement: ${statement}`);

        return cStruct;
    }

    protected exprConstructFunction(parent: BaseObjectConstruct, prevStatements: string[], funcType: string): FunctionStruct {
        const isOperator = ["preoperator", "operator", "postoperator"].includes(funcType);
        const cFunc = new FunctionStruct(parent);

        parent.members.push(cFunc);
        cFunc.functionType = funcType;

        let statement;

        for (let i = 0, len = prevStatements.length; i < len; i++) {
            statement = prevStatements[i];

            switch (statement) {
                case '(': {
                    const prevStatement = prevStatements[i - 1];

                    if (prevStatement !== "native") throw new Error(`Unknown statement: ${prevStatement}`);

                    const nextStatement = prevStatements[++i];

                    if (nextStatement !== ')') {
                        if (prevStatements[++i] !== ')')
                            throw new Error(`Unknown statement: ${prevStatements[i]}`);

                        cFunc.nativeIndex = parseInt(nextStatement);
                    }
                } break;
                default: cFunc.modifiers.push(statement); break;
            }
        }

        const dtypes = this.getVarTypes(parent);
        let funcReturn = this.readNextStatement();

        if (funcReturn === '(') {
            if (!isOperator) throw new Error(`Unexpected statement: ${funcType}`);

            statement = this.readNextStatement();

            cFunc.precedence = parseInt(statement);

            if ((statement = this.readNextStatement()) !== ')') throw new Error(`Unknown statement: ${statement}`);

            funcReturn = this.readNextStatement();
        }

        let funcName = "";

        while (this.offset < this.srcLen && (statement = this.readNextStatement()) !== '(')
            funcName = funcName + statement;

        if (funcName.length === 0) {
            funcName = funcReturn;
            funcReturn = "void";
        } else if (!dtypes.includes(funcReturn.toLowerCase())) throw new Error(`Unknown return type: ${funcReturn}`);

        const operatorTokens = [];

        if (isOperator) {
            switch (funcType) {
                case "preoperator": operatorTokens.push("pre", "op"); break;
                case "operator": operatorTokens.push("op"); break;
                case "postoperator": operatorTokens.push("post", "op"); break;
                default: throw new Error(`Invalid operator type: ${funcType}`);
            }

            if (/^\w[\w\d]*/.test(funcName)) operatorTokens.push(funcName);
            else {
                switch (funcName) {
                    case "!": operatorTokens.push("not"); break;
                    case "==": operatorTokens.push("eq"); break;
                    case "!=": operatorTokens.push("neq"); break;
                    case "&&": operatorTokens.push("and"); break;
                    case "||": operatorTokens.push("or"); break;
                    case "^^": operatorTokens.push("xor"); break;
                    case "*=": operatorTokens.push("mul", "assign"); break;
                    case "/=": operatorTokens.push("div", "assign"); break;
                    case "+=": operatorTokens.push("add", "assign"); break;
                    case "-=": operatorTokens.push("sub", "assign"); break;
                    case "++": operatorTokens.push("inc"); break;
                    case "--": operatorTokens.push("dec"); break;
                    case "~": operatorTokens.push("inv"); break;
                    case "+": operatorTokens.push("add"); break;
                    case "-": operatorTokens.push("sub"); break;
                    case "*": operatorTokens.push("mul"); break;
                    case "/": operatorTokens.push("div"); break;
                    case "<<": operatorTokens.push("shl"); break;
                    case ">>": operatorTokens.push("shr", "arithmetic"); break;
                    case ">>>": operatorTokens.push("shr"); break;
                    case "<": operatorTokens.push("le"); break;
                    case ">": operatorTokens.push("gt"); break;
                    case ">=": operatorTokens.push("geq"); break;
                    case "<=": operatorTokens.push("leq"); break;
                    case "&": operatorTokens.push("and", "bit"); break;
                    case "|": operatorTokens.push("or", "bit"); break;
                    case "^": operatorTokens.push("xor", "bit"); break;
                    case "**": operatorTokens.push("pow"); break;
                    case "%": operatorTokens.push("mod"); break;
                    case "~=": operatorTokens.push("eq", "approx"); break;
                    case "$": operatorTokens.push("cat"); break;
                    case "$=": operatorTokens.push("cat", "assign"); break;
                    case "@": operatorTokens.push("scat"); break;
                    case "@=": operatorTokens.push("scat", "assign"); break;
                    default: throw new Error(`Unknown operator: ${funcName}`);
                }
            }
        } else operatorTokens.push(funcName);

        cFunc.returnType = funcReturn.toLowerCase();

        let lastStack: string[] = null;
        const argStack = [];

        while (this.offset < this.srcLen && (statement = this.readNextStatement()) !== ')') {
            if (lastStack === null) {
                lastStack = [];
                argStack.push(lastStack);
            }

            if (statement === ',') {
                lastStack = null
                continue;
            }

            lastStack.push(statement);
        }

        for (const arg of argStack) {
            if (arg.length < 2) throw new Error(`Invalid stack length: ${arg.length} < 2`);

            const name = arg.pop();
            const dtype = arg.pop().toLowerCase();
            const flags = arg.reverse();

            if (!dtypes.includes(dtype)) throw new Error(`Invalid dtype: ${dtype}`);
            if (isOperator) operatorTokens.push(dtype);

            cFunc.arguments.push([dtype, name, flags]);
        }

        cFunc.name = operatorTokens.join("_");

        statement = this.readNextStatement();

        if (statement === '{') {
            let impl = '', token = '{', openBraces = 1;

            // eat the remaining implementation code for now
            do {
                token = this.readToken();

                if (token === '{') openBraces++;
                if (token === '}') openBraces--;
                if (openBraces === 0) { break; }

                impl = impl + token;

            } while (this.offset < this.srcLen);

            cFunc.implementation = impl.trim();
        } else if (statement !== ';') throw new Error(`Unknown statement: ${statement}`);

        return cFunc;
    }

    protected exprConstructEvent(parent: BaseObjectConstruct, prevStatements: string[]): EventStruct {
        if (prevStatements.length > 0) debugger;

        const cEvent = new EventStruct(parent);

        cEvent.name = this.readNextStatement();

        let statement;

        if ((statement = this.readNextStatement()) !== '(') throw new Error(`Unknown statement: ${statement}`);
        if ((statement = this.readNextStatement()) !== ')') throw new Error(`Unknown statement: ${statement}`);
        if ((statement = this.readNextStatement()) !== ';') throw new Error(`Unknown statement: ${statement}`);

        parent.events[cEvent.name] = cEvent;

        return cEvent;
    }


    protected exprConstruct(parent: BaseObjectConstruct): BaseConstruct {
        const prevStatements = [];

        while (this.offset < this.srcLen) {
            const statement = this.readNextStatement();

            switch (statement.toLowerCase()) {
                case "class": throw new Error("Shouldn't have child classess.");
                case "var": return this.exprConstructVar(parent, prevStatements);
                case "const": return this.exprConstructConst(parent, prevStatements);
                case "struct": return this.exprConstructStruct(parent, prevStatements);
                case "enum": return this.exprConstructEnum(parent, prevStatements);
                case "preoperator":
                case "operator":
                case "postoperator":
                case "function": return this.exprConstructFunction(parent, prevStatements, statement.toLowerCase());
                case "event": return this.exprConstructEvent(parent, prevStatements);
                default:
                    prevStatements.push(statement);
                    continue;
            }

            debugger;
        }

        return null;
    }

    protected exprConstructClass(parent: BaseObjectConstruct, prevStatements: string[]): ClassConstruct {
        const cClass = new ClassConstruct(parent);

        if (prevStatements.length > 0)
            debugger;

        cClass.name = this.readNextStatement();

        let statement: string;

        while ((statement = this.readNextStatement()) !== ';')
            cClass.modifiers.push(statement);

        while (this.offset < this.srcLen)
            this.exprConstruct(cClass);

        return cClass;
    }

    static fromSource(expression: string): Function {
        const constructor = new ExpressionConstructor(expression);
        const statement = constructor.readNextStatement();

        if (statement.toLowerCase() !== "class")
            throw new Error(`Construct must begin with a 'class', got '${statement}'`);

        const klass = constructor.exprConstructClass(null, []);
        const codeArr = klass.build("invoke", 0, []);
        const code = codeArr.join("\n");

        return eval(code) as Function;
    }
}


function createStruct(name: string, cls: typeof FConstructable, props: UProperty[]) {
    const Klass = class extends cls {
        constructor() {
            super();

            for (const prop of props) {
                const propName = prop.objectName.slice(4);

                (this as any)[propName] = undefined;
            }
        }

        public load(pkg: UPackage): this {

            for (const prop of props) {
                const propName = prop.objectName.slice(4);

                (this as any)[propName] = prop.loadValue(pkg);
            }

            return this;
        }
    }

    Object.defineProperty(Klass, "name", { value: name });

    return Klass;
}