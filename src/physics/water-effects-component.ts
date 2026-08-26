import { Vector2, Vector3 } from "three";
import { IObject } from "@client/game/components";
import { PhysicsComponent } from "@client/physics/physics-component";
import { encompassesVolume, findVolumeTransition } from "@client/physics/volume-bsp";
import WaterHitEffect from "@client/rendering/water-hit-effect";
import type PhysicsManager from "@client/physics/physics-manager";
import type Player from "@client/player";
import type RenderManager from "@client/rendering/render-manager";
import type { SectorObject } from "@client/objects/zone-object";

const tmpWaterSurfaceEnd = new Vector3();
const tmpWaterFloorStart = new Vector3();
const tmpWaterHitStart = new Vector3();
const tmpWaterHitEnd = new Vector3();
const tmpWaterHitPosition = new Vector3();
const tmpDown = new Vector3(0, 0, -1);
const tmpSunBeamSample = new Vector2();

class WaterEffectsComponent extends PhysicsComponent<Player & IObject> {
    protected static readonly UNDERWATER_SUN_BEAM_DEPTH = 2000;
    protected static readonly UNDERWATER_SUN_BEAM_TRACE_START = 200;
    protected static readonly UNDERWATER_SAMPLE_DISTANCE_SQ = 40000;
    protected static readonly WATER_HIT_SURFACE_HEIGHT = 20;
    protected static readonly WATER_HIT_MIN_SURFACE_HEIGHT = 0.85;

    public readonly componentName = "waterEffects";

    protected renderManager: RenderManager = null;
    protected waterHitEffect: WaterHitEffect = null;
    protected readonly underWaterPosition = new Vector3(Infinity, Infinity, Infinity);
    protected readonly lastUnderWaterSamplingLocation = new Vector3(Infinity, Infinity, Infinity);
    protected underWaterVolume: GD.IWaterVolumeDecodeInfo = null;
    protected hasUnderWaterSample = false;
    protected wasUnderWaterDay = false;
    protected isUnderWaterDay = false;
    protected waterHitEffectName: string = null;
    protected waterHitElapsed = 0;
    protected waterHitInterval = 0;

    public onPhysicsAdded(manager: PhysicsManager): void {
        super.onPhysicsAdded(manager);

        this.renderManager = manager.getParent().getComponent("render");
        this.waterHitEffect = new WaterHitEffect(this.getParent(), this.renderManager);
    }

    public onPhysicsRemoved(manager: PhysicsManager): void {
        this.renderManager = null;
        this.waterHitEffect = null;

        super.onPhysicsRemoved(manager);
    }

    public setUnderWaterState(position: Vector3, isDay: boolean): void {
        this.underWaterPosition.copy(position);
        this.isUnderWaterDay = isDay;
    }

    public onPhysicsTick(_currentTime: number, deltaTime: number): boolean {
        this.updateWaterHitEffect(deltaTime);
        this.updateUnderWaterSunBeam();

        return false;
    }

    protected updateWaterHitEffect(deltaTime: number): void {
        const owner = this.getParent();

        if (!owner.isSwimmingMovement()) {
            this.waterHitEffectName = null;
            this.waterHitElapsed = 0;
            return;
        }

        const height = owner.getCollisionHeight();

        tmpWaterHitStart.copy(owner.position);
        tmpWaterHitEnd.copy(tmpWaterHitStart);
        tmpWaterHitEnd.z += height * 2 + WaterEffectsComponent.WATER_HIT_SURFACE_HEIGHT;

        let selectedSector: SectorObject = null;
        let selectedVolume: GD.IWaterVolumeDecodeInfo = null;
        let selectedTime = 0;

        for (const sector of this.renderManager.getLoadedSectors()) {
            if (!sector.waterVolumes) continue;

            for (const volume of sector.waterVolumes) {
                const startsInside = encompassesVolume(tmpWaterHitStart, volume.bsp);

                if (!startsInside || encompassesVolume(tmpWaterHitEnd, volume.bsp)) continue;

                const time = findVolumeTransition(tmpWaterHitStart, tmpWaterHitEnd, volume.bsp, true);
                const surfaceHeight = time * (height * 2 + WaterEffectsComponent.WATER_HIT_SURFACE_HEIGHT);

                if (surfaceHeight < height * (1 + WaterEffectsComponent.WATER_HIT_MIN_SURFACE_HEIGHT)) continue;
                if (!selectedVolume || volume.priority >= selectedVolume.priority) {
                    selectedSector = sector;
                    selectedVolume = volume;
                    selectedTime = time;
                }
            }
        }

        if (!selectedVolume) {
            this.waterHitEffectName = null;
            this.waterHitElapsed = 0;
            return;
        }

        const speed = owner.getSpeed();
        const effectName = WaterEffectsComponent.getWaterHitEffectName(selectedSector, selectedVolume, speed > 0);

        if (!effectName) return;

        this.waterHitElapsed += deltaTime / 1000;

        if (effectName === this.waterHitEffectName && this.waterHitElapsed < this.waterHitInterval) return;

        this.waterHitEffectName = effectName;
        this.waterHitElapsed = 0;

        tmpWaterHitPosition.lerpVectors(tmpWaterHitStart, tmpWaterHitEnd, selectedTime);
        this.waterHitInterval = this.waterHitEffect.spawn(selectedSector, effectName, tmpWaterHitPosition, speed);
    }

    protected static getWaterHitEffectName(sector: SectorObject, volume: GD.IWaterVolumeDecodeInfo, isMoving: boolean): string | null {
        if (!volume.scriptClassId) throw new Error(`Water volume '${volume.name}' has no UnrealScript class.`);

        let waitHitEffect: GD.ScriptPropertyValue_T = null;
        let runHitEffect: GD.ScriptPropertyValue_T = null;
        const waitSlot = { get: () => waitHitEffect, set: (value: GD.ScriptPropertyValue_T) => waitHitEffect = value };
        const runSlot = { get: () => runHitEffect, set: (value: GD.ScriptPropertyValue_T) => runHitEffect = value };
        const fn = sector.scriptVM.findFunction(volume.scriptClassId, "GetHitEffectName");

        sector.scriptVM.invoke(volume as any, fn, [waitSlot, runSlot]);

        const effectName = isMoving ? runHitEffect : waitHitEffect;

        if (effectName === null) return null;
        if (typeof effectName !== "string") throw new Error(`'${volume.scriptClassId}.GetHitEffectName' returned a non-name value.`);

        return effectName;
    }

    protected sampleUnderWaterSunBeam(position: Vector3, volume: GD.IWaterVolumeDecodeInfo, target: Vector2): boolean {
        tmpWaterSurfaceEnd.copy(position);
        tmpWaterSurfaceEnd.z += WaterEffectsComponent.UNDERWATER_SUN_BEAM_DEPTH;

        const surfaceTime = findVolumeTransition(position, tmpWaterSurfaceEnd, volume.bsp, true);

        if (surfaceTime <= 0 || surfaceTime >= 1) return false;

        const surfaceZ = position.z + WaterEffectsComponent.UNDERWATER_SUN_BEAM_DEPTH * surfaceTime;

        tmpWaterFloorStart.set(position.x, position.y, surfaceZ - WaterEffectsComponent.UNDERWATER_SUN_BEAM_TRACE_START);

        const floorHit = this.physicsManager.rayCheck(tmpWaterFloorStart, tmpDown, WaterEffectsComponent.UNDERWATER_SUN_BEAM_DEPTH - WaterEffectsComponent.UNDERWATER_SUN_BEAM_TRACE_START, undefined, undefined, false);

        if (!floorHit || floorHit.distance <= 0 || floorHit.distance >= WaterEffectsComponent.UNDERWATER_SUN_BEAM_DEPTH - WaterEffectsComponent.UNDERWATER_SUN_BEAM_TRACE_START) return false;

        target.set(surfaceZ, surfaceZ - floorHit.location.z);

        return true;
    }

    protected updateUnderWaterSunBeam(): void {
        const effect = this.renderManager.underWaterEffect;
        const volume = effect.getVolume();

        if (!effect.visible || !effect.hasSunBeamEffects()) return;

        if (!this.isUnderWaterDay) {
            this.wasUnderWaterDay = false;
            this.hasUnderWaterSample = false;
            effect.setSunBeamVisible(false);
            return;
        }

        if (!this.wasUnderWaterDay || this.underWaterVolume !== volume) this.hasUnderWaterSample = false;

        this.wasUnderWaterDay = true;
        this.underWaterVolume = volume;

        if (this.hasUnderWaterSample && this.lastUnderWaterSamplingLocation.distanceToSquared(this.underWaterPosition) <= WaterEffectsComponent.UNDERWATER_SAMPLE_DISTANCE_SQ) return;

        this.lastUnderWaterSamplingLocation.copy(this.underWaterPosition);
        this.hasUnderWaterSample = true;

        if (!volume || !this.sampleUnderWaterSunBeam(this.underWaterPosition, volume, tmpSunBeamSample)) {
            effect.setSunBeamVisible(false);
            return;
        }

        effect.setSunBeamSample(this.underWaterPosition, tmpSunBeamSample.x, tmpSunBeamSample.y);
    }
}

export default WaterEffectsComponent;
export { WaterEffectsComponent };
