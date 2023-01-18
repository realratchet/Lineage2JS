import { PlaneBufferGeometry } from "three";
import BaseEmitter from "./base-emitter";

const geometry = new PlaneBufferGeometry(10, 10);

class SpriteEmitter extends BaseEmitter {
    constructor(texture: MapData_T) {
        super();
    }
}

export default SpriteEmitter;
export { SpriteEmitter };

/*
switch (info.blendingMode) {
        case "normal":
            // case "masked":
            material.blending = NormalBlending;
            break;
        case "alpha":
            material.blending = CustomBlending
            material.blendSrc = SrcAlphaFactor;
            material.blendDst = OneMinusSrcAlphaFactor;
            break;
        case "brighten":
            material.blending = AdditiveBlending;
            break;
        case "translucent":
            material.blending = CustomBlending;
            material.blendSrc = OneFactor;
            material.blendDst = OneMinusSrcColorFactor;
            break;
        default: console.warn("Unknown blending mode:", info.blendingMode); break;
    }
*/