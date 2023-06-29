import { UObject } from "@l2js/core";
import { generateUUID } from "three/src/math/MathUtils";

Object.assign(UObject, {
    onClassCreated(this: typeof UObject, cls: new (...args: any) => UObject) {
        if (this === UObject)
            throw new Error("Cannot be called on UObject");

        console.log(this.name, "->", cls.name);

        const baseClass = this as any;

        baseClass["make"] = function (...args: any) { return new cls(...args); }
        baseClass["class"] = function () { return cls; }
    }
});

Object.assign(UObject.prototype, {
    uuid: undefined,

    getDecodeInfo() { debugger; throw new Error(`'${this.constructor.name}' must implemented 'getDecodeInfo' method!`) },
    onSuperConstructed() {
        this.uuid = generateUUID();
    }
});