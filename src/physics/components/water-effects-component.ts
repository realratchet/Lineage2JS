import { Vector2, Vector3 } from "three";
import { PhysicsComponent } from "./physics-component";
import { findVolumeTransition } from "../volume-bsp";
import UnderWaterEffect from "../../rendering/under-water-effect";
import type { IWaterVolumeDecodeInfo } from "@l2js/engine/contracts/volume";

const tmpWaterSurfaceEnd = new Vector3();
const tmpWaterFloorStart = new Vector3();
const tmpDown = new Vector3(0, 0, -1);
const tmpSunBeamSample = new Vector2();

export class WaterEffectsComponent extends PhysicsComponent {
    protected static readonly UNDERWATER_SUN_BEAM_DEPTH = 2000;
    protected static readonly UNDERWATER_SUN_BEAM_TRACE_START = 200;
    protected static readonly UNDERWATER_SAMPLE_DISTANCE_SQ = 40000;

    public readonly componentName = "waterEffects";
    public readonly underWaterEffect = new UnderWaterEffect();

    protected readonly underWaterPosition = new Vector3(Infinity, Infinity, Infinity);
    protected readonly lastUnderWaterSamplingLocation = new Vector3(Infinity, Infinity, Infinity);
    protected underWaterVolume: IWaterVolumeDecodeInfo = null;
    protected hasUnderWaterSample = false;
    protected wasUnderWaterDay = false;
    protected isUnderWaterDay = false;

    public setUnderWaterState(position: Vector3, isDay: boolean): void {
        this.underWaterPosition.copy(position);
        this.isUnderWaterDay = isDay;
    }

    public onPhysicsTick(): boolean {
        this.updateUnderWaterSunBeam();

        return false;
    }

    protected sampleUnderWaterSunBeam(position: Vector3, volume: IWaterVolumeDecodeInfo, target: Vector2): boolean {
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
        const effect = this.underWaterEffect;
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
