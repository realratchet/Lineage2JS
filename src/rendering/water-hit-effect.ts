import { Vector3 } from "three";
import type BaseActor from "../base-actor";
import type { SectorObject } from "../objects/zone-object";
import type RenderManager from "./render-manager";
import decodeObject3D from "../assets/decoders/object3d-decoder";
import type { DecodeLibrary } from "@l2js/engine/decode-library";

class WaterHitEffect {
    protected static readonly SIZE_SCALE = 1 / 9;

    protected readonly owner: BaseActor;
    protected readonly renderManager: RenderManager;

    public constructor(owner: BaseActor, renderManager: RenderManager) {

        this.owner = owner;
        this.renderManager = renderManager;
    }

    public spawn(sector: SectorObject, effectName: string, position: Vector3, speed: number): number {
        const library = (sector as any).decodeLibrary as DecodeLibrary;
        const info = library.effectTemplates[effectName] || library.effectTemplates[effectName.toLowerCase()];

        if (!info) throw new Error(`Water hit effect '${effectName}' is not in '${library.name}'.`);

        const effect = decodeObject3D(library, info);

        sector.scriptVM.initializeHost(effect as any);

        effect.position.copy(position);
        effect.scale.multiplyScalar(this.owner.getCollisionRadius() * WaterHitEffect.SIZE_SCALE);
        if (speed > 0) effect.quaternion.copy(this.owner.quaternion);

        this.renderManager.addTransientEffect(effect);

        const spawnRate = Number(sector.scriptVM.call(effect as any, "GetSpawnRate", [speed]));

        return 1 / (spawnRate > 0 ? spawnRate : 2);
    }
}

export default WaterHitEffect;
export { WaterHitEffect };
