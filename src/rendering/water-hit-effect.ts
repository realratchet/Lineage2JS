import { Vector3 } from "three";
import Rotator from "../utils/rotator";
import type BaseActor from "../base-actor";
import type { SectorObject } from "../objects/zone-object";
import type RenderManager from "./render-manager";
import decodeObject3D from "../assets/decoders/object3d-decoder";
import type { DecodeLibrary } from "@l2js/engine";

const tmpRotator = new Rotator();

export class WaterHitEffect {
    protected static readonly SIZE_SCALE = 0.1111111119389534;

    protected readonly owner: BaseActor;
    protected readonly renderManager: RenderManager;

    public constructor(owner: BaseActor, renderManager: RenderManager) {

        this.owner = owner;
        this.renderManager = renderManager;
    }

    public spawn(sector: SectorObject, effectName: string, position: Vector3, velocity: Vector3, moving: boolean): number {
        const library = (sector as any).decodeLibrary as DecodeLibrary;
        const info = library.effectTemplates[effectName] || library.effectTemplates[effectName.toLowerCase()];

        if (!info) throw new Error(`Water hit effect '${effectName}' is not in '${library.name}'.`);

        const effect = decodeObject3D(library, info);

        sector.scriptVM.initializeHost(effect as any);

        effect.position.copy(position);
        const scale = Math.fround(this.owner.getCollisionRadius() * WaterHitEffect.SIZE_SCALE);
        for (const emitter of (effect as any).scriptProperties.get("Emitters")) emitter.setSizeScale(scale);
        if (moving) tmpRotator.set(0, Math.trunc(Math.atan2(velocity.y, velocity.x) * 10430.219195527361), 0).toQuaternion(effect.quaternion);
        else effect.quaternion.copy(this.owner.quaternion);

        this.renderManager.addTransientEffect(effect);

        const spawnRate = Number(sector.scriptVM.call(effect as any, "GetSpawnRate", [Math.fround(velocity.length())]));

        return Math.fround(1 / (spawnRate > 0 ? spawnRate : 2));
    }
}

export default WaterHitEffect;
