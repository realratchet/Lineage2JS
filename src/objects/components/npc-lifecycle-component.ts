import { AnimationAction } from "three";
import { ObjectComponent } from "../../game/components";
import { NPC_ENTER_EVENT } from "../../audio/components/sound-component";
import { EPhysics_T } from "../../assets/unreal/un-aactor";
import { PMoveType_T } from "../../assets/unreal/un-controller";
import { getProperty, setProperty, type ScriptHost_T, type ScriptValue_T } from "../../ue-script/vm";
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
    protected readonly defaultController = { scriptClassId: "engine.Controller", scriptProperties: new Map<string, ScriptValue_T>([["bDead", false], ["WaitType", PStopType_T.STP_STAND], ["bAutoAttacking", false]]) };
    protected scriptController: ScriptHost_T = this.defaultController;

    protected initializeController(): ScriptHost_T {
        const parent = this.getParent(), rider = parent.ridePawn;

        if (rider) this.scriptController = rider.getComponent<NpcLifecycleComponent>("npcLifecycle").initializeController();
        else if (this.scriptController === this.defaultController) this.getComponent<ScriptComponent>("script").getVM().initializeHost(this.scriptController);

        parent.setUnrealScriptProperty("Controller", this.scriptController);
        return this.scriptController;
    }

    public setController(controller: ScriptHost_T): void {
        const rider = this.getParent().ridePawn;

        if (rider) rider.getComponent<NpcLifecycleComponent>("npcLifecycle").setController(controller);
        this.scriptController = controller || this.defaultController;
        setProperty(this.initializeController(), "bDead", this.isDying);
    }

    public setControllerState(waitType: number, isAutoAttacking: boolean): void {
        const controller = this.initializeController();

        setProperty(controller, "MoveType", this.getComponent<PawnMovementComponent>("pawnMovement").isWalkingMovement() ? PMoveType_T.PMT_SLOW : PMoveType_T.PMT_FAST);
        setProperty(controller, "WaitType", waitType);
        setProperty(controller, "bAutoAttacking", isAutoAttacking);
    }

    public onDetach(): void { this.release(); }
    public hasDeathActions(): boolean { return !!this.deathSkyAnimation || this.isDeathFalling; }
    public isDead(): boolean { return this.isDying; }

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

            if (animation.toLowerCase() !== "none") this.getComponent<AnimationComponent>("animation").playDeath(animation);
            movement.setPhysicsMode(EPhysics_T.PHYS_Flying);
            this.isDeathFalling = false;
        }
    }

    public spawnEnter(event: INpcEnterEvent): void {
        if (this.isDying) return;

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

            if (animation.toLowerCase() !== "none") this.getComponent<AnimationComponent>("animation").playDeath(animation, 0.2, true);
        }

        if (handler) handler(parent);
    }

    public playDeath(onFinished: (actor: BaseActor) => void): void {
        if (this.isDying) return;

        const parent = this.getParent();
        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        this.isDying = true;
        this.deathAnimationFinishedHandler = onFinished;
        parent.stopAttack();
        this.getComponent<PawnMovementComponent>("pawnMovement").setDying();

        if (script) {
            setProperty(this.initializeController(), "bDead", true);

            if (script.hasFunction("NotifyDie")) script.call("NotifyDie");
        }

        this.getComponent<AnimationComponent>("animation").playDeath();

        if (parent.ridePawn && parent.rideType === MountType_T.WYVERN) {
            this.deathSkyAnimation = parent.getAnimationAction().getClip().name.toLowerCase();
            this.isDeathFalling = true;
        }
    }

    public resetDeath(): void {
        if (this.isDying) this.getComponent<PawnMovementComponent>("pawnMovement").setRevived();
        if (this.isDeathFalling) this.getComponent<PawnMovementComponent>("pawnMovement").setPhysicsMode(EPhysics_T.PHYS_Flying);

        this.isDying = false;
        this.deathAnimationFinishedHandler = null;
        this.deathSkyAnimation = null;
        this.isDeathFalling = false;
        setProperty(this.initializeController(), "bDead", false);
    }

    public revive(): void {
        const parent = this.getParent();

        this.resetDeath();

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

        if (getProperty(this.scriptController, "Pawn") === parent) setProperty(this.scriptController, "Pawn", null);
        if (getProperty(this.scriptController, "ViewTarget") === parent) setProperty(this.scriptController, "ViewTarget", this.scriptController);

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
