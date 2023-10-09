import { UObject } from "@l2js/core";
import { generateUUID } from "three/src/math/MathUtils";

Object.assign(UObject, {
    ALLOW_EDITING: false,
    onClassCreated(this: typeof UObject, cls: new (...args: any) => UObject) {
        if (this === UObject) {
            console.warn(`Cannot register '${cls.name}' because it's directly inheriting 'UObject'.`)
            return;
        }

        // console.log(this.name, "->", cls.name);

        const baseClass = this as any;

        baseClass["make"] = function (...args: any) { return new cls(...args); }
        baseClass["class"] = function () { return cls; }
    }
});

Object.assign(UObject.prototype, {
    uuid: undefined,

    getDecodeInfo() { debugger; throw new Error(`'${this.constructor.name}' must implemented 'getDecodeInfo' method!`) },
    onSuperConstructed() { this.uuid = generateUUID(); },
    dumpLayout() {
        const layout = (this.constructor as any).inheritedProps as Record<string, string[]>;
        const layoutStrings = [`Layout of '${(this as any).objectName}':`];
        const pdict = (this as any).propertyDict as Record<string, any>;

        for (const [base, properties] of Object.entries(layout).reverse()) {
            layoutStrings.push("--------------------------------------");
            layoutStrings.push(`    '${base}' properties:`);

            if (properties.length > 0) {
                for (const propName of properties) {
                    const paddingRequired = Math.max(25 - propName.length, 0);
                    const padding = new Array(paddingRequired).fill(" ").join("");
                    layoutStrings.push(`        '${propName}'${padding}:= ${pdict.get(propName)}`);
                }
            } else layoutStrings.push(`        * no properties *`);
        }

        const layoutString = layoutStrings.join("\n");

        return layoutString;
    }
});