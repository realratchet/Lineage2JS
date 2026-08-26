import { Vector3 } from "three";
import type BaseActor from "@client/base-actor";
import type { SectorObject } from "@client/objects/zone-object";
import type RenderManager from "@client/rendering/render-manager";
import decodeObject3D from "@client/assets/decoders/object3d-decoder";

const SIZE_SCALE = 1 / 9;

class WaterHitEffect {
    protected readonly owner: BaseActor;
    protected readonly renderManager: RenderManager;

    public constructor(owner: BaseActor, renderManager: RenderManager) {

        this.owner = owner;
        this.renderManager = renderManager;
    }

    public spawn(sector: SectorObject, effectName: string, position: Vector3, speed: number): number {
        const library = (sector as any).decodeLibrary as GD.DecodeLibrary;
        const info = library.effectTemplates[effectName] || library.effectTemplates[effectName.toLowerCase()];

        if (!info) throw new Error(`Water hit effect '${effectName}' is not in '${library.name}'.`);

        const effect = decodeObject3D(library, info);

        sector.scriptVM.initializeHost(effect as any);

        effect.position.copy(position);
        effect.scale.multiplyScalar(this.owner.getCollisionRadius() * SIZE_SCALE);
        if (speed > 0) effect.quaternion.copy(this.owner.quaternion);

        this.renderManager.addTransientEffect(effect);

        const spawnRate = Number(sector.scriptVM.call(effect as any, "GetSpawnRate", [speed]));

        return 1 / (spawnRate > 0 ? spawnRate : 2);
    }
}

export default WaterHitEffect;
export { WaterHitEffect };
