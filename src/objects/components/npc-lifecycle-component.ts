import { AnimationAction } from "three";
import { ObjectComponent } from "../../game/components";
import { NPC_ENTER_EVENT } from "../../audio/components/sound-component";
import type AnimationComponent from "../animation-component";
import type PawnMovementComponent from "../../physics/components/pawn-movement-component";
import type { ScriptComponent } from "../../game/script-component";
import type BaseActor from "../../base-actor";
import type { ScriptHost_T } from "../../ue-script/vm";
import type { INpcEnterEvent } from "@l2js/engine";

class NpcLifecycleComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "npcLifecycle";
    protected deathAnimationFinishedHandler: ((actor: BaseActor) => void) = null;
    protected isDying = false;
    protected isReleased = false;
    protected readonly scriptDeathController: ScriptHost_T = { scriptClassId: "Engine.Controller", scriptProperties: new Map([["bDead", true]]) };

    public onDetach(): void { this.release(); }

    public spawnEnter(event: INpcEnterEvent): void {
        this.getComponent<PawnMovementComponent>("pawnMovement").startEnterRise(event.isRise);
        this.getComponent<AnimationComponent>("animation").playEnter(event.animation);
        this.dispatchEvent(NPC_ENTER_EVENT, event);
    }

    public onAnimationFinished(action: AnimationAction): void {
        if (!this.getComponent<AnimationComponent>("animation").onAnimationFinished(action, this.isDying)) return;
        if (!this.isDying) return;

        const handler = this.deathAnimationFinishedHandler;

        this.deathAnimationFinishedHandler = null;
        if (handler) handler(this.getParent());
    }

    public playDeath(onFinished: (actor: BaseActor) => void): void {
        if (this.isDying) return;

        const parent = this.getParent();
        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        this.isDying = true;
        this.deathAnimationFinishedHandler = onFinished;
        this.getComponent<PawnMovementComponent>("pawnMovement").setDying();

        if (script) {
            parent.setUnrealScriptProperty("Controller", this.scriptDeathController);

            if (script.hasFunction("NotifyDie")) script.call("NotifyDie");
        }

        this.getComponent<AnimationComponent>("animation").playDeath();
    }

    public release(): void {
        if (this.isReleased) return;

        const parent = this.getParent();
        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        this.isReleased = true;

        if (script && parent.getUnrealScriptProperty("Controller") === this.scriptDeathController)
            parent.setUnrealScriptProperty("Controller", null);

        script?.destroy();
        this.getComponent<AnimationComponent>("animation").release();
        this.deathAnimationFinishedHandler = null;
        this.isDying = false;
    }
}

export default NpcLifecycleComponent;
export { NpcLifecycleComponent };
