import { Vector3 } from "three";
import type BaseActor from "@client/base-actor";
import type { SectorObject } from "@client/objects/zone-object";
import type RenderManager from "@client/rendering/render-manager";
import decodeObject3D from "@client/assets/decoders/object3d-decoder";
import { encompassesVolume, findVolumeTransition } from "@client/physics/volume-bsp";

const SURFACE_HEIGHT = 20;
const MIN_SURFACE_HEIGHT = 0.85;
const SIZE_SCALE = 1 / 9;

const tmpStart = new Vector3();
const tmpEnd = new Vector3();
const tmpPosition = new Vector3();

type SurfaceHit_T = { sector: SectorObject, volume: GD.IWaterVolumeDecodeInfo, time: number };
const tmpSurfaceHit: SurfaceHit_T = { sector: null, volume: null, time: 0 };

class WaterHitEffect {
    protected readonly owner: BaseActor;
    protected readonly renderManager: RenderManager;
    protected effectName: string = null;
    protected elapsed = 0;
    protected interval = 0;

    public constructor(owner: BaseActor, renderManager: RenderManager) {

        this.owner = owner;
        this.renderManager = renderManager;
    }

    public update(sectors: readonly SectorObject[], deltaTime: number): void {
        if (!this.owner.isSwimmingMovement()) {
            this.effectName = null;
            this.elapsed = 0;
            return;
        }

        const hit = this.findSurface(sectors);

        if (!hit) {
            this.effectName = null;
            this.elapsed = 0;
            return;
        }

        const speed = this.owner.getSpeed();
        const effectName = this.getEffectName(hit, speed > 0);

        if (!effectName) return;

        this.elapsed += deltaTime / 1000;

        if (effectName === this.effectName && this.elapsed < this.interval) return;

        this.effectName = effectName;
        this.elapsed = 0;
        this.spawn(hit, effectName, speed);
    }

    protected findSurface(sectors: readonly SectorObject[]): SurfaceHit_T | null {
        const height = this.owner.getCollisionHeight();

        tmpStart.copy(this.owner.position);
        tmpEnd.copy(tmpStart);
        tmpEnd.z += height * 2 + SURFACE_HEIGHT;

        let selectedSector: SectorObject = null;
        let selectedVolume: GD.IWaterVolumeDecodeInfo = null;
        let selectedTime = 0;

        for (const sector of sectors) {
            if (!sector.waterVolumes) continue;

            for (const volume of sector.waterVolumes) {
                const startsInside = encompassesVolume(tmpStart, volume.bsp);

                if (!startsInside || encompassesVolume(tmpEnd, volume.bsp)) continue;

                const time = findVolumeTransition(tmpStart, tmpEnd, volume.bsp, true);
                const surfaceHeight = time * (height * 2 + SURFACE_HEIGHT);

                if (surfaceHeight < height * (1 + MIN_SURFACE_HEIGHT)) continue;
                if (!selectedVolume || volume.priority >= selectedVolume.priority) {
                    selectedSector = sector;
                    selectedVolume = volume;
                    selectedTime = time;
                }
            }
        }

        if (!selectedVolume) return null;

        tmpSurfaceHit.sector = selectedSector;
        tmpSurfaceHit.volume = selectedVolume;
        tmpSurfaceHit.time = selectedTime;

        return tmpSurfaceHit;
    }

    protected spawn(hit: SurfaceHit_T, effectName: string, speed: number): void {
        const library = (hit.sector as any).decodeLibrary as GD.DecodeLibrary;
        const info = library.effectTemplates[effectName] || library.effectTemplates[effectName.toLowerCase()];

        if (!info) throw new Error(`Water hit effect '${effectName}' is not in '${library.name}'.`);

        const effect = decodeObject3D(library, info);

        hit.sector.scriptVM.initializeHost(effect as any);

        tmpPosition.lerpVectors(tmpStart, tmpEnd, hit.time);
        effect.position.copy(tmpPosition);
        effect.scale.multiplyScalar(this.owner.getCollisionRadius() * SIZE_SCALE);
        if (speed > 0) effect.quaternion.copy(this.owner.quaternion);

        this.renderManager.addTransientEffect(effect);

        const spawnRate = Number(hit.sector.scriptVM.call(effect as any, "GetSpawnRate", [speed]));

        this.interval = 1 / (spawnRate > 0 ? spawnRate : 2);
    }

    protected getEffectName(hit: SurfaceHit_T, isMoving: boolean): string | null {
        const volume = hit.volume;

        if (!volume.scriptClassId) throw new Error(`Water volume '${volume.name}' has no UnrealScript class.`);

        let waitHitEffect: GD.ScriptPropertyValue_T = null;
        let runHitEffect: GD.ScriptPropertyValue_T = null;
        const waitSlot = { get: () => waitHitEffect, set: (value: GD.ScriptPropertyValue_T) => waitHitEffect = value };
        const runSlot = { get: () => runHitEffect, set: (value: GD.ScriptPropertyValue_T) => runHitEffect = value };
        const fn = hit.sector.scriptVM.findFunction(volume.scriptClassId, "GetHitEffectName");

        hit.sector.scriptVM.invoke(volume, fn, [waitSlot, runSlot]);

        const effectName = isMoving ? runHitEffect : waitHitEffect;

        if (effectName === null) return null;
        if (typeof effectName !== "string") throw new Error(`'${volume.scriptClassId}.GetHitEffectName' returned a non-name value.`);

        return effectName;
    }
}

export default WaterHitEffect;
export { WaterHitEffect };
