import UPackage from "./un-package";
import FConstructable from "./un-constructable";

const REGISTER: GenericObjectContainer_T<typeof FConstructable> = {

};

const NATIVE = {

};

const REGEXP_COMMENT = /^\s*\/\//;
const REGEXP_COMMENT_BLOCK = /\/\*(\*(?!\/)|[^*])*\*\//g;

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
            .replaceAll(REGEXP_COMMENT_BLOCK, "")
            .split("\n")
            .filter(ln => !REGEXP_COMMENT.test(ln))
            .map(ln => {
                const trimmed = ln.trim().replaceAll(/\s+/g, " ").replace(/\s*\/\/.*$/, "");
                const allMatches = [...trimmed.matchAll(/[^\w\s]+/g)];

                let tokenizedLine = allMatches.length > 0 ? "" : trimmed;
                let offset = 0;

                for (const match of allMatches) {
                    const token = match[0];
                    const len = token.length;
                    const dt = match.index - offset;

                    tokenizedLine = tokenizedLine + trimmed.slice(offset, match.index) + ` ${token} `;

                    offset = offset + dt + len;
                }

                debugger;

                if (!tokenizedLine.includes(";")) return [tokenizedLine];

                const arr = tokenizedLine.split(";").filter(x => x.length > 0);

                arr[arr.length - 1] = arr[arr.length - 1] + ";";

                return arr;
            })
            .flat(1)
            .filter(ln => ln.length > 0)
            .reduce((acc, ln) => {

                const activeLine = acc.activeLine.length === 0
                    ? ln
                    : acc.activeLine + " " + ln;

                let parenthesis = 0;

                for (const c of ln) {
                    switch (c) {
                        case "{": parenthesis++; break;
                        case "}": parenthesis--; break;
                    }
                }

                acc.parenthesis = acc.parenthesis + parenthesis;

                if (ln.endsWith(";") && acc.parenthesis === 0) {
                    const expression = activeLine.split(" ");

                    expression.push(";");

                    acc.expressions.push(expression);
                    acc.activeLine = "";
                    acc.parenthesis = 0;
                } else acc.activeLine = activeLine;

                return acc;
            }, { expressions: [], activeLine: "", parenthesis: 0 })
            .expressions;

        debugger;

        const constructs = expressions.map(expr => ExpressionConstructor.fromExpression(expr));


        debugger;
    }
};

export default UClassRegistry;
export { UClassRegistry };

class ExpressionConstructor {
    protected expression: string[];
    protected construct: string[] = [];
    protected offset = 0;

    protected constructor(expression: string[]) {
        this.expression = expression;
    }

    protected getWhitespace(depth: number) { return new Array(depth * 4).fill(" ").join(""); }

    protected exprConstructClass(depth: number) {
        const className = this.expression[this.offset++];
        const ws = this.getWhitespace(depth + 1);

        this.construct.push(`class ${className} extends UClass {`);

        for (let len = this.expression.length; this.offset < len; this.offset++) {
            const token = this.expression[this.offset];

            switch (token) {
                case "native":
                case "noexport":
                    this.construct.push(`${ws}protected static fl_${token} = true;`);
                    break;
                case ";": break;
                default: throw new Error(`Unknown token: ${token}`);
            }
        }

        this.construct.push("}");

        debugger;
    }

    protected exprConstruct() {
        const token = this.expression[this.offset++];

        switch (token) {
            case "class": this.exprConstructClass(0); break;

            default: throw new Error(`Unknown construct type: ${token}`);
        }

        return this.construct;
    }

    static fromExpression(expression: string[]): string {
        const constructor = new ExpressionConstructor(expression);
        const jsCode = constructor.exprConstruct().join("\n");

        debugger;

        return jsCode;
    }
}

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

