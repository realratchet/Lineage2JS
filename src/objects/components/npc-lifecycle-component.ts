import { AnimationAction } from "three";
import { ObjectComponent } from "../../game/components";
import { NPC_ENTER_EVENT } from "../../audio/components/sound-component";
import { EPhysics_T } from "../../assets/unreal/un-aactor";
import { MountType_T } from "../../network/game-packets";
import type AnimationComponent from "./animation-component";
import type PawnMovementComponent from "../../physics/components/pawn-movement-component";
import type { ScriptComponent } from "../../game/script-component";
import type BaseActor from "../../base-actor";
import type TransformComponent from "./transform-component";
import type { INpcEnterEvent } from "@l2js/engine/contracts/pawn";

export enum PStopType_T { STP_SIT, STP_STAND, STP_FAKE_DEAD, STP_FAKE_DEAD_STAND, STP_CHAIR_SIT }

export class NpcLifecycleComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "npcLifecycle";
    protected deathAnimationFinishedHandler: ((actor: BaseActor) => void) = null;
    protected isDying = false;
    protected isReleased = false;
    protected deathSkyAnimation: string = null;
    protected isDeathFalling = false;
    protected scriptController = { scriptClassId: "engine.Controller", scriptProperties: new Map<string, number | boolean>([["bDead", false], ["WaitType", PStopType_T.STP_STAND], ["bAutoAttacking", false]]) };

    public setControllerState(waitType: number, isAutoAttacking: boolean): void {
        const rider = this.getParent().ridePawn;

        if (rider) this.scriptController = rider.getComponent<NpcLifecycleComponent>("npcLifecycle").scriptController;

        this.scriptController.scriptProperties.set("WaitType", waitType);
        this.scriptController.scriptProperties.set("bAutoAttacking", isAutoAttacking);
        this.getParent().setUnrealScriptProperty("Controller", this.scriptController);
    }

    public onDetach(): void { this.release(); }
    public hasDeathActions(): boolean { return !!this.deathSkyAnimation || this.isDeathFalling; }

    public onUpdate(_currentTime: number, _deltaTime: number): void {
        if (!this.deathSkyAnimation && !this.isDeathFalling) return;

        const parent = this.getParent();
        const movement = this.getComponent<PawnMovementComponent>("pawnMovement");

        // DeathSkyWyvern/DeathFallingWyvern 0x10496e40/0x10496f00.
        if (this.deathSkyAnimation && parent.getAnimationAction().getClip().name.toLowerCase() !== this.deathSkyAnimation) {
            movement.setPhysicsMode(EPhysics_T.PHYS_Walking);
            this.deathSkyAnimation = null;
        }

        if (this.isDeathFalling && parent.getBaseActor()) {
            const animation = (parent.getUnrealScriptProperty("NpcSocialAnimName") as string[])[0];

            if (animation.toLowerCase() !== "none") parent.playAnimation(animation, 0.1, 1, false, true);
            movement.setPhysicsMode(EPhysics_T.PHYS_Flying);
            this.isDeathFalling = false;
        }
    }

    public spawnEnter(event: INpcEnterEvent): void {
        this.dispatchEvent(NPC_ENTER_EVENT, event);
        this.getComponent<PawnMovementComponent>("pawnMovement").startEnterRise(event.isRise);
        this.getComponent<AnimationComponent>("animation").playEnter(event.animation);
    }

    public onAnimationFinished(action: AnimationAction): void {
        if (!this.getComponent<AnimationComponent>("animation").onAnimationFinished(action, this.isDying)) return;
        if (!this.isDying) return;

        const handler = this.deathAnimationFinishedHandler;

        this.deathAnimationFinishedHandler = null;

        const parent = this.getParent();

        if (parent.ridePawn) {
            const animation = this.getComponent<ScriptComponent<BaseActor>>("script").call("GetDeathWaitAnimName") as string;

            if (animation.toLowerCase() !== "none") parent.playAnimation(animation, 0.2);
        }

        if (handler) handler(parent);
    }

    public playDeath(onFinished: (actor: BaseActor) => void): void {
        if (this.isDying) return;

        const parent = this.getParent();
        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        this.isDying = true;
        this.deathAnimationFinishedHandler = onFinished;
        this.getComponent<PawnMovementComponent>("pawnMovement").setDying();

        if (script) {
            this.scriptController.scriptProperties.set("bDead", true);
            parent.setUnrealScriptProperty("Controller", this.scriptController);

            if (script.hasFunction("NotifyDie")) script.call("NotifyDie");
        }

        this.getComponent<AnimationComponent>("animation").playDeath();

        if (parent.ridePawn && parent.rideType === MountType_T.WYVERN) {
            this.deathSkyAnimation = parent.getAnimationAction().getClip().name.toLowerCase();
            this.isDeathFalling = true;
        }
    }

    public revive(): void {
        const parent = this.getParent();

        if (this.isDying) this.getComponent<PawnMovementComponent>("pawnMovement").setRevived();

        this.isDying = false;
        this.deathAnimationFinishedHandler = null;
        this.scriptController.scriptProperties.set("bDead", false);

        const animation = (parent.getUnrealScriptProperty("DeathStandAnimName") as string[])[parent.getUnrealScriptProperty("CurWeaponType") as number];

        // OnRevive 0x745373..0x7453c6: clear bDead, then play DeathStandAnimName at NonAttackSpeedRate.
        if (animation.toLowerCase() !== "none") parent.playAnimation(animation, 0.1, parent.getUnrealScriptProperty("NonAttackSpeedRate") as number, false, true);
        else parent.playMovementAnimation("idle");
    }

    public release(): void {
        if (this.isReleased) return;

        const parent = this.getParent();
        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        this.isReleased = true;

        if (script && parent.getUnrealScriptProperty("Controller") === this.scriptController)
            parent.setUnrealScriptProperty("Controller", null);

        script?.destroy();
        parent.getComponent<TransformComponent>("transform").releaseTouching();
        const equipment = parent.findComponent("pawnEquipment");

        if (equipment) parent.removeComponent(equipment);
        this.getComponent<AnimationComponent>("animation").release();
        this.deathAnimationFinishedHandler = null;
        this.isDying = false;
        this.deathSkyAnimation = null;
        this.isDeathFalling = false;
    }
}

export default NpcLifecycleComponent;
