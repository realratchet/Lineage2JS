import UPackage from "./un-package";
import FConstructable from "./un-constructable";

const REGISTER: GenericObjectContainer_T<typeof FConstructable> = {

};

const NATIVE = {

};

const REGEX_DROP_COMMENT_BLOCKS = /\/\*(\*(?!\/)|[^*])*\*\//g;
const REGEXP_COMMENT_LINE = /\s*\/\/.*(?=\n|$)/gm;

const UClassRegistry = new class UClassRegistry {
    get structs() { return Object.freeze(REGISTER); }

    public register(object: UStruct) {
        const SuperKlass = object.superField ? REGISTER[(object.superField as UStruct).friendlyName] : FConstructable;
        const klassName = object.friendlyName;
        const Klass = REGISTER[klassName] = createStruct(klassName, SuperKlass, object.childPropFields);

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

        const classCode = ExpressionConstructor.fromExpression(expressions);

        debugger;
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

    public build(depth: number, code: string[]): string[] {
        throw new Error("Not yet implemented");
    }
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

    public build(depth: number, code: string[]): string[] {
        let codeString = ``;

        const ws = this.getWS(depth);
        const modifiers = this.modifiers.reduce((acc, val) => {

            acc[val] = true;

            return acc;
        }, {} as GenericObjectContainer_T<boolean>);

        // if (this.parent instanceof ClassConstruct) {
        //     let access;

        //     if ("public" in modifiers) access = "public";
        //     else if ("private" in modifiers) access = "private";
        //     else access = "public";

        //     codeString += access;

        //     delete modifiers[access];

        // } else {
        //     debugger;
        // }

        // if("static" in modifiers) {
        //     delete modifiers["static"];
        //     codeString += " static";
        // }

        let opType;

        if (this.functionType === "function") opType = "";
        else {
            opType = ` /* ${this.functionType}`;

            if (Number.isFinite(this.precedence))
                opType += `[${this.precedence}]`

            opType += ` */ `;
        };

        codeString = `${ws}/* ${Object.keys(modifiers).join(", ")} */ ${codeString}${this.name}${opType}(`;

        const fnArgs = this.arguments.map(([type, name, flags]) => {
            return `${name} /* type[${type}] [${flags.join(", ")}] */`;
        });

        codeString += fnArgs.join(", ") + `) /* type[${this.returnType}] */ {`;

        code.push(codeString);

        const fnWS = this.getWS(depth + 1);

        if (this.implementation)
            code.push(...this.implementation.split("\n").map(v => `${fnWS} /* ${v} */`));

        code.push(`${fnWS}throw new Error("Not yet implemented!");`);
        code.push(`${ws}}`);

        return code;
    }
}

class EnumConstruct extends BaseConstruct {
    public readonly constuctType: string = "Enum";
    public readonly members: string[] = [];
}

class StructConstruct extends BaseConstruct {
    public readonly constuctType: string = "Struct";
    public readonly members: BaseConstruct[] = [];
    public readonly enumerators: GenericObjectContainer_T<EnumConstruct> = {};
    public readonly events: GenericObjectContainer_T<EventStruct> = {};
    public extends: string;
}

class ClassConstruct extends StructConstruct {
    public readonly constuctType: string = "Class";
    public readonly members: BaseConstruct[] = [];
    public readonly structures: GenericObjectContainer_T<StructConstruct> = {};

    public build(depth: number, code: string[]): string[] {
        const ws = this.getWS(depth);
        const metaclass = this.parent ? this.parent.name : "UClass";

        code.push(`${ws}class ${this.name} extends ${metaclass} {`);

        for (const construct of this.members) {
            construct.build(depth + 1, code);
        }

        code.push(`${ws}}`);

        debugger;

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

    public build(depth: number, code: string[]): string[] {
        let codeString = ``;

        const ws = this.getWS(depth);
        const modifiers = this.modifiers.reduce((acc, val) => {

            acc[val] = true;

            return acc;
        }, {} as GenericObjectContainer_T<boolean>);

        // if (this.parent instanceof ClassConstruct) {
        //     let access;

        //     if ("public" in modifiers) access = "public";
        //     else if ("private" in modifiers) access = "private";
        //     else access = "public";

        //     codeString += access;

        //     delete modifiers[access];

        // } else {
        //     debugger;
        // }

        codeString = `${ws}/* ${Object.keys(modifiers).join(", ")} */${codeString} ${this.name}`;

        let defaultValue;

        codeString += ` /* type[${this.dataType}] */`;

        switch (this.dataType) {
            case "int":
            case "float": defaultValue = 0; break;
            case "bool": defaultValue = false; break;
            case "name": defaultValue = "\"\""; break;
            case "class":
            case "object": defaultValue = null; break;
            default: throw new Error(`Unsupported dtype: ${this.dataType}`);
        }

        if (this.isArray) {
            if (Number.isFinite(this.arraySize)) codeString += ` = new Array(${this.arraySize}).fill(${defaultValue});`;
            else codeString += ` = [];`;

        } else codeString += ` = ${defaultValue};`;

        code.push(codeString);

        return code;
    }
}

class ConstConstruct extends BaseConstruct {
    public readonly constuctType = "Constant";

    public value: any;

    public build(depth: number, code: string[]): string[] {
        const ws = this.getWS(depth);
        const codeString = `${ws}/* public readonly */ ${this.name} = ${typeof this.value === "string" ? `"${this.value}"` : this.value};`

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

    protected readNextStatement(): Statement_T {
        let expr = "";

        while (this.offset < this.srcLen) {
            const token = this.readToken();

            if (/[\w\d]/.test(token)) expr = expr + token;
            else if (/[\s\n]/.test(token)) {
                if (expr.length === 0)
                    continue;

                return [expr, false, {}];
            }
            else if ('.' === token) {
                if (/^\d+$/.test(expr)) expr = expr + token;
                else return [expr, true, { period: true }];
            }
            else if (';' === token) return [expr, true, { semicolon: true }];
            else if (',' === token) return [expr, true, { comma: true }];
            else if (['[', ']'].includes(token)) return [expr, true, { brackets: token }];
            else if (['<', '>'].includes(token)) return [expr, true, { comparator: token }];
            else if (['{', '}'].includes(token)) return [expr, true, { braces: token }];
            else if (['(', ')'].includes(token)) return [expr, true, { parenthesis: token }];
            else if (['=', '!', '&', '|', '*', '/', '+', '-', '~', '^', '%', '$', '@'].includes(token)) return [expr, true, { operator: token }];
            else {
                debugger;
            }
        }

        debugger;
    }

    protected exprConstruct(parent: BaseConstruct): BaseConstruct {
        let statement = this.readNextStatement();
        let [expr, hasFlags, flags] = statement;

        switch (expr) {
            case "var": return this.exprConstructVar(parent, statement);
            case "const": return this.exprConstructConst(parent, statement);
            case "struct": return this.exprConstructStruct(parent, statement);
            case "enum": return this.exprConstructEnum(parent, statement, false);
            case "event": return this.exprConstructEvent(parent, statement);
            case "final":
            case "native":
                return this.exprConstructFunction(parent, statement);
            default:
                debugger;
                throw new Error(`Unknown construct type: ${expr}`);

        }

        return null;
    }

    protected exprConstructEvent(parent: BaseConstruct, statement: Statement_T): EventStruct {
        const cEvent = new EventStruct(parent);

        let [expr, hasFlags, flags] = this.readNextStatement();

        cEvent.name = expr;

        do {
            [expr, hasFlags, flags] = this.readNextStatement();

            if (expr.length > 0) debugger;
            if (!hasFlags) debugger;
            if (!("parenthesis" in flags)) debugger;
            if (flags.parenthesis !== ')') debugger;
        } while ("parenthesis" in flags && flags.parenthesis !== ')')

        [expr, hasFlags, flags] = this.readNextStatement();

        if (!hasFlags)
            debugger;

        if (!("semicolon" in flags))
            debugger;

        return cEvent;
    }

    protected exprConstructFunction(parent: BaseConstruct, statement: Statement_T): FunctionStruct {
        const funcDirective = ["preoperator", "operator", "postoperator", "function"]
        const varTypes = this.getVarTypes(parent);
        const cFunc = new FunctionStruct(parent);
        let [expr, hasFlags, flags] = statement;

        if(parent.members.slice(-1)[0].name === "FindObject") {
            debugger;
        }

        while (!funcDirective.includes(expr.toLowerCase())) {
            cFunc.modifiers.push(expr);

            if (expr === "native") {
                if (hasFlags) {
                    if (!("parenthesis" in flags))
                        debugger;

                    if (flags.parenthesis !== "(")
                        debugger;

                    [expr, hasFlags, flags] = this.readNextStatement();

                    cFunc.nativeIndex = parseInt(expr);
                }
            }

            [expr, hasFlags, flags] = this.readNextStatement();
        }

        cFunc.functionType = expr.toLowerCase();

        if (expr !== "function" && hasFlags && "parenthesis" in flags && flags.parenthesis === "(") {
            [expr, hasFlags, flags] = this.readNextStatement();
            cFunc.precedence = parseInt(expr);
        }

        [expr, hasFlags, flags] = this.readNextStatement();

        if (!varTypes.includes(expr.toLowerCase())) {
            if (hasFlags && "parenthesis" in flags && flags.parenthesis === "(") {
                cFunc.returnType = "void";

                debugger;
            } else {
                [expr, hasFlags, flags] = this.readNextStatement();

                if (hasFlags && "parenthesis" in flags && flags.parenthesis === "(") {
                    cFunc.returnType = "void";
                } else {
                    debugger;
                    throw new Error("Invalid function header");
                }
            }
        } else cFunc.returnType = expr;

        [expr, hasFlags, flags] = this.readNextStatement();

        let operatorExpr;

        if (cFunc.functionType !== "function") {
            operatorExpr = '';

            do {
                if (!("operator" in flags) && !("comparator" in flags) && expr.length === 0) {
                    debugger;
                }

                if (("operator" in flags)) operatorExpr = operatorExpr + flags.operator;
                else if (("comparator" in flags)) operatorExpr = operatorExpr + flags.comparator;
                else operatorExpr = expr;

                if (!("parenthesis" in flags))
                    [expr, hasFlags, flags] = this.readNextStatement();
            } while (!("parenthesis" in flags));
        } else cFunc.name = expr;

        while (!("parenthesis" in flags) || (flags.parenthesis !== ')')) {
            const argFlags: string[] = [];

            [expr, hasFlags, flags] = this.readNextStatement();

            while (!varTypes.includes(expr.toLowerCase())) {
                argFlags.push(expr);

                [expr, hasFlags, flags] = this.readNextStatement();
            }

            const varType = expr;

            [expr, hasFlags, flags] = this.readNextStatement();

            cFunc.arguments.push([varType, expr, argFlags]);

            if (!hasFlags) [expr, hasFlags, flags] = this.readNextStatement();
        }

        if (cFunc.functionType !== "function") {
            const operatorTokens = [];

            if (/^\w[\w\d]*/.test(operatorExpr)) operatorTokens.push(operatorExpr.toLowerCase());
            else {

                switch (operatorExpr.toLowerCase()) {
                    case "!": operatorTokens.push("not"); break;
                    case "==": operatorTokens.push("eq"); break;
                    case "!=": operatorTokens.push("not", "eq"); break;
                    case "&&": operatorTokens.push("and"); break;
                    case "||": operatorTokens.push("or"); break;
                    case "^^": operatorTokens.push("xor"); break;
                    case "*=": operatorTokens.push("add", "assign"); break;
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
                    default:
                        debugger;
                        throw new Error(`Unknown operator expression: ${operatorExpr}`);
                }
            }

            cFunc.arguments.forEach(([dtype,]) => operatorTokens.push(dtype));
            cFunc.name = operatorTokens.join("_");
        }

        if (cFunc.modifiers.includes("native")) {
            [expr, hasFlags, flags] = this.readNextStatement();

            if (!hasFlags)
                debugger;

            if (!("semicolon" in flags))
                debugger;

            return cFunc;
        }

        [expr, hasFlags, flags] = this.readNextStatement();

        if (expr.length > 0) debugger;
        if (!hasFlags) debugger;
        if (!("braces" in flags)) debugger;
        if (flags.braces !== '{') debugger;

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

        return cFunc;
    }

    protected exprConstructStruct(parent: BaseConstruct, statement: Statement_T): StructConstruct {
        const cStruct = new StructConstruct(parent);
        let [expr, hasFlags, flags] = statement;

        if (hasFlags)
            debugger;

        [expr, hasFlags, flags] = this.readNextStatement();

        if (hasFlags)
            debugger;

        cStruct.name = expr;

        [expr, hasFlags, flags] = this.readNextStatement();

        if (expr === "extends") {
            [expr, hasFlags, flags] = this.readNextStatement();

            if (!(expr in (parent as ClassConstruct).structures))
                debugger;

            cStruct.extends = expr;

            if (hasFlags)
                debugger;

            [expr, hasFlags, flags] = this.readNextStatement();
        }

        if (!hasFlags)
            debugger;

        if (expr.length !== 0)
            debugger;

        if (!("braces" in flags))
            debugger;

        if (flags.braces !== "{")
            debugger;

        while (this.offset < this.srcLen) {
            const construct = this.exprConstruct(cStruct);
            const prevOffset = this.offset;

            switch (construct.constuctType) {
                case "Variable":
                    cStruct.members.push(construct);
                    break;
                default:
                    debugger;
                    throw new Error(`Unknown construct type: ${construct.constuctType}`);
            }

            [expr, hasFlags, flags] = this.readNextStatement();

            if (expr.length > 0) {
                this.offset = prevOffset;
                continue;
            }

            if (!("braces" in flags))
                debugger;

            if (flags.braces !== "}")
                debugger;

            break;
        }

        [expr, hasFlags, flags] = this.readNextStatement();

        if (expr.length > 0)
            debugger;

        if (!hasFlags)
            debugger;

        if (!("semicolon" in flags))
            debugger;

        return cStruct;
    }

    protected exprConstructConst(parent: BaseConstruct, statement: Statement_T): ConstConstruct {
        const cConst = new ConstConstruct(parent);

        let [expr, hasFlags, flags] = statement;

        if (hasFlags)
            debugger;

        [expr, hasFlags, flags] = this.readNextStatement();

        if (hasFlags)
            debugger;

        cConst.name = expr;

        [expr, hasFlags, flags] = this.readNextStatement();

        if (!hasFlags) throw new Error("Needs flags.");
        if (!("operator" in flags)) throw new Error("Must have operator.");
        if (flags.operator !== "=") throw new Error("Must be an assignment '='");

        [expr, hasFlags, flags] = this.readNextStatement();

        if (!hasFlags)
            debugger;

        if (!flags.semicolon)
            debugger;

        if (expr.startsWith("0x")) cConst.value = parseInt(expr, 16);
        else cConst.value = parseFloat(expr);

        return cConst;
    }

    protected getVarTypes(parent: BaseConstruct): string[] {
        const registeredStructs = Object.keys((parent.root as ClassConstruct).structures).map(x => x.toLowerCase());
        const varTypes = ["array", "bool", "int", "byte", "float", "string", "name", "enum", "object", "class", ...registeredStructs, "pointer"];

        return varTypes;
    }

    protected exprConstructVar(parent: BaseConstruct, statement: Statement_T): VarConstruct {
        const cVar = new VarConstruct(parent);

        let [expr, hasFlags, flags] = statement;

        if (hasFlags) {
            if ("parenthesis" in flags) {
                if (flags.parenthesis === "(") {
                    [expr, hasFlags, flags] = this.readNextStatement();

                    if (!hasFlags) throw new Error("Should have a flag.");
                    if (!("parenthesis" in flags)) throw new Error("Missing 'parenthesis' flags")
                    if (flags.parenthesis !== ")") throw new Error("Expected '('");

                    cVar.group = expr;
                } else throw new Error("Expected ')'");
            } else {
                debugger;
            }
        }

        do {
            statement = [expr, hasFlags, flags] = this.readNextStatement();

            if (this.getVarTypes(parent).includes(expr.toLowerCase())) {

                if (expr === "enum") {
                    const construct = this.exprConstructEnum(parent, statement, true);

                    cVar.dataType = construct.name;
                    (parent as StructConstruct).enumerators[construct.name] = construct;
                } else if (expr === "array") {
                    [expr, hasFlags, flags] = this.readNextStatement();

                    if (!hasFlags)
                        debugger;

                    if (!("comparator" in flags))
                        debugger;

                    if (flags.comparator !== ">")
                        debugger;

                    cVar.arraySize = Infinity;
                    cVar.dataType = expr;
                } else cVar.dataType = expr;
                break;
            } else {

                switch (expr) {
                    case "private":
                    case "native":
                    case "const":
                    case "editconst":
                    case "config":
                        cVar.modifiers.push(expr);
                        break;
                    default:
                        debugger;
                        throw new Error(`Unknown construct type: ${expr}`);
                }
            }
        } while (!hasFlags)

        if (hasFlags && cVar.arraySize !== Infinity)
            debugger;

        [expr, hasFlags, flags] = this.readNextStatement();

        cVar.name = expr;

        if (hasFlags) {
            if ("brackets" in flags) {
                const bracket = flags["brackets"];
                switch (bracket) {
                    case "[": {
                        [expr, hasFlags, flags] = this.readNextStatement();

                        cVar.isArray = true;
                        cVar.arraySize = parseInt(expr);
                    } break;
                    default:
                        debugger;
                        throw new Error(`Unknown bracket type: ${bracket}`);
                }
            }
            else if ("semicolon" in flags) return cVar;
            else if ("comma" in flags) {
                do {
                    [expr, hasFlags, flags] = this.readNextStatement();

                    if (!hasFlags)
                        debugger;

                    if (expr.length > 0) cVar.siblings.push(expr);

                    if ("semicolon" in flags) return cVar;

                    if (!("comma" in flags))
                        debugger;
                } while (this.offset < this.srcLen);
            } else {
                debugger;
            }
        }


        [expr, hasFlags, flags] = this.readNextStatement();

        if (expr !== "")
            throw new Error("No token expected.");

        if (!hasFlags)
            throw new Error("Flags expected.");

        if (!("semicolon" in flags))
            throw new Error("Semicolon expected.");

        return cVar;
    }

    protected exprConstructEnum(parent: BaseConstruct, statement: Statement_T, isVar: boolean): EnumConstruct {
        const cEnum = new EnumConstruct(parent);

        let [expr, hasFlags, flags] = this.readNextStatement();

        cEnum.name = expr;

        if (hasFlags)
            debugger;

        [expr, hasFlags, flags] = this.readNextStatement();

        if (expr.length !== 0)
            debugger;

        if (!hasFlags)
            debugger;

        if (!("braces" in flags))
            debugger;

        if (flags.braces !== "{")
            debugger;

        while (this.offset < this.srcLen) {
            [expr, hasFlags, flags] = this.readNextStatement();

            if (expr.length > 0) cEnum.members.push(expr);

            if (!hasFlags) [expr, hasFlags, flags] = this.readNextStatement();

            if ("comma" in flags)
                continue;

            if (!("braces" in flags))
                debugger;

            if (flags.braces !== "}")
                debugger;

            break;
        }

        if (!isVar) {
            [expr, hasFlags, flags] = this.readNextStatement();

            if (expr.length > 0)
                debugger;

            if (!hasFlags)
                debugger;

            if (!("semicolon" in flags))
                debugger;
        }

        return cEnum;
    }

    protected exprConstructClass(parent: BaseConstruct, statement: Statement_T): ClassConstruct {
        const cClass = new ClassConstruct(parent);

        let [expr, hasFlags, flags] = this.readNextStatement();

        if (hasFlags)
            debugger;

        cClass.name = expr;

        do {
            [expr, hasFlags, flags] = this.readNextStatement();

            cClass.modifiers.push(expr);
        } while (!hasFlags);

        if (!("semicolon" in flags))
            debugger;

        while (this.offset < this.srcLen) {
            const construct = this.exprConstruct(cClass);

            // debugger;

            switch (construct.constuctType) {
                case "Variable":
                case "Constant":
                case "Function":
                    cClass.members.push(construct);
                    break;
                case "Struct":
                    cClass.structures[(construct as StructConstruct).name] = (construct as StructConstruct);
                    break;
                case "Enum":
                    cClass.enumerators[(construct as EnumConstruct).name] = (construct as EnumConstruct);
                    break;
                case "Event":
                    cClass.events[(construct as EventStruct).name] = (construct as EventStruct);
                    break;
                default:
                    debugger;
                    throw new Error(`Unknown construct type: ${construct.constuctType}`);
            }
        }

        return cClass;
    }

    static fromExpression(expression: string): string {
        const constructor = new ExpressionConstructor(expression);

        const statement = constructor.readNextStatement();
        const [expr, hasFlags, flags] = statement;

        if (expr !== "class")
            throw new Error(`Construct must begin with a 'class', got '${expr}'`);

        if (hasFlags)
            throw new Error(`Construct must not contain flags, got: ${flags}`);

        const klass = constructor.exprConstructClass(null, statement);

        klass.build(0, []);

        debugger;

        return "";
    }
}

type Statement_T = [string, boolean, any];

// function createClassConstruct(expression: string[], offset: number, jsArray: []) {
//     const jsArray = [`class ${expression[offset]} extends UClass {`];

//     let offset = [];

//     for (let i = 2, len = expression.length; i < len; i++) {
//         const token = expression[i];

//         switch(token) {
//             case "native":
//         }

//         debugger;
//     }

//     jsArray.push("}");

//     const jsCode = jsArray.join("\n");

//     debugger;

//     return jsCode;
// }

// function constructExpression(expression: string[]) {
//     switch (expression[0]) {
//         case "class": return createClassConstruct(expression);
//         default: throw new Error(`Unknown construct type: ${expression[0]}`);
//     }
// }

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

