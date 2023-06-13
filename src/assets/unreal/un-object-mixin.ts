import { UObject } from "@l2js/core";
import { generateUUID } from "three/src/math/MathUtils";

Object.assign(UObject.prototype, {
    uuid: undefined,

    getDecodeInfo() { debugger; throw new Error(`'${this.constructor.name}' must implemented 'getDecodeInfo' method!`) },
    onSuperConstructed() {
        this.uuid = generateUUID();
    }
});