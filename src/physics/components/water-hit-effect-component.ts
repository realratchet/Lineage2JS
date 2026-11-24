import { Vector3 } from "three";
import { PhysicsComponent } from "./physics-component";
import WaterHitEffect from "../../rendering/water-hit-effect";
import type PhysicsManager from "../../physics/physics-manager";
import type PawnRenderableComponent from "../../rendering/components/pawn-renderable-component";
import type PhysicsVolume from "../../objects/physics-volume";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type { SectorObject } from "../../objects/zone-object";
import type { ScriptPropertyValue_T } from "@l2js/engine/contracts/script";

const tmpWaterVelocity = new Vector3();
const tmpWaterHitPosition = new Vector3();

export class WaterHitEffectComponent extends PhysicsComponent<BaseActor> {
    public readonly componentName = "waterHitEffect";

    protected renderManager: RenderManager = null;
    protected waterHitEffect: WaterHitEffect = null;
    protected waterEntryVolume: PhysicsVolume = null;
    protected readonly waterEntryPosition = new Vector3();
    protected readonly waterEntryVelocity = new Vector3();

    public onPhysicsAdded(manager: PhysicsManager): void {
        super.onPhysicsAdded(manager);

        this.renderManager = manager.getParent().getComponent("render");
        this.waterHitEffect = new WaterHitEffect(this.getParent(), this.renderManager);
    }

    public onPhysicsRemoved(manager: PhysicsManager): void {
        this.renderManager = null;
        this.waterHitEffect = null;
        this.waterEntryVolume = null;

        super.onPhysicsRemoved(manager);
    }

    public onPhysicsTick(_currentTime: number, deltaTime: number): boolean {
        this.updateWaterHitEffect(deltaTime);

        return false;
    }

    public recordWaterEntry(volume: PhysicsVolume, position: Vector3): void {
        this.waterEntryVolume = volume;
        this.waterEntryPosition.copy(position);
        this.waterEntryVelocity.fromArray(this.getParent().getUnrealScriptProperty("Velocity") as number[]);
    }

    protected updateWaterHitEffect(deltaTime: number): void { // APawn::UpdateWaterHitEffectMovement 0x8c0620, every pawn from APawn::Tick 0x865f2c
        const owner = this.getParent();
        const foot = owner.getUnrealScriptProperty("FootVolume") as unknown as PhysicsVolume;
        const entered = foot && foot === this.waterEntryVolume;
        this.waterEntryVolume = null;
        if (!owner.getComponent<PawnRenderableComponent>("pawnRenderable").isRendered || !foot || !foot.getUnrealScriptProperty("bL2WaterVolume")) return;
        const volumeLevel = foot.getUnrealScriptProperty("Level");
        const sector = this.renderManager.getLoadedSectors().find(sector => sector.levelInfoActor === volumeLevel);
        if (!sector) throw new Error(`Water volume '${foot.name}' has no registered level for water effects.`);

        tmpWaterHitPosition.fromArray(owner.getUnrealScriptProperty("HitLocation") as number[]);
        const useEntry = entered && tmpWaterHitPosition.lengthSq() === 0;
        if (useEntry) tmpWaterHitPosition.copy(this.waterEntryPosition);
        else if (tmpWaterHitPosition.lengthSq() === 0) {
            owner.setUnrealScriptProperty("HitWaterEffectTimer", 0);
            return;
        }

        if (owner.getUnrealScriptProperty("HitWaterEffectTimer") === 0) {
            if (useEntry) tmpWaterVelocity.copy(this.waterEntryVelocity);
            else tmpWaterVelocity.fromArray(owner.getUnrealScriptProperty("Velocity") as number[]);
            const moving = Math.abs(tmpWaterVelocity.x) >= 0.0001 || Math.abs(tmpWaterVelocity.y) >= 0.0001 || Math.abs(tmpWaterVelocity.z) >= 0.0001;
            const wait = (owner.getUnrealScriptProperty("SitWaitAnimName") as string[])[owner.getUnrealScriptProperty("CurWeaponType") as number];
            const action = owner.getAnimationAction();
            const resting = !moving &&
                action &&
                action.getClip().name.toLowerCase() === wait.toLowerCase() &&
                (owner.getUnrealScriptProperty("Location") as number[])[2] - tmpWaterHitPosition.z <= owner.getCollisionHeight() * 0.2;
            if (!resting) {
                const effectName = WaterHitEffectComponent.getWaterHitEffectName(sector, foot, moving);
                if (effectName) owner.setUnrealScriptProperty("RecentHitWaterInterval", this.waterHitEffect.spawn(sector, effectName, tmpWaterHitPosition, tmpWaterVelocity, moving));
            }
        }

        // APawn::UpdateWaterHitEffectMovement 0x8c08f1 resets before the following tick can spawn.
        const elapsed = owner.getUnrealScriptProperty("HitWaterEffectTimer") as number;
        owner.setUnrealScriptProperty("HitWaterEffectTimer", elapsed > (owner.getUnrealScriptProperty("RecentHitWaterInterval") as number) ? 0 : Math.fround(elapsed + Math.fround(deltaTime / 1000)));
    }

    protected static getWaterHitEffectName(sector: SectorObject, volume: PhysicsVolume, isMoving: boolean): string | null {
        if (!volume.scriptClassId) throw new Error(`Water volume '${volume.name}' has no UnrealScript class.`);

        let waitHitEffect: ScriptPropertyValue_T = null;
        let runHitEffect: ScriptPropertyValue_T = null;
        const waitSlot = { get: () => waitHitEffect, set: (value: ScriptPropertyValue_T) => waitHitEffect = value };
        const runSlot = { get: () => runHitEffect, set: (value: ScriptPropertyValue_T) => runHitEffect = value };
        const fn = sector.scriptVM.findFunction(volume.scriptClassId, "GetHitEffectName");

        sector.scriptVM.invoke(volume as any, fn, [waitSlot, runSlot]);

        const effectName = isMoving ? runHitEffect : waitHitEffect;

        if (effectName === null) return null;
        if (typeof effectName !== "string") throw new Error(`'${volume.scriptClassId}.GetHitEffectName' returned a non-name value.`);

        return effectName.toLowerCase() === "none" ? null : effectName;
    }
}

export default WaterHitEffectComponent;
