import { Object3D } from "three";

abstract class BaseEmitter extends Object3D {
}

export default BaseEmitter;
export { BaseEmitter };

type EmitterConfig_T = {
    blendingMode: ParticleBlendModes_T,
    maxParticles: number,
    opacity: number,
    lifetime: [number, number]
};