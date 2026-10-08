import { Matrix4, Quaternion, Vector3 } from "three";
import { ObjectComponent } from "../../game/components";
import Rotator, { getPawnRotation } from "../../utils/rotator";
import ViewportWindowController, { ECALCSTEP_T } from "../../rendering/viewport-window-controller";
import L2Float from "../l2-float";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type PhysicsManager from "../../physics/physics-manager";
import type AssetManager from "../../assets/asset-manager";
import type { DecodeLibrary } from "@l2js/engine";

export enum FishingType_T {
    FST_NONE,
    FST_WAIT,
    FST_BATTLE
}

const tmpRotation = new Quaternion();
const tmpRotationMatrix = new Matrix4();
const tmpTraceStart = new Vector3();
const tmpTraceEnd = new Vector3();

export class PawnFishingComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnFishing";
    protected readonly renderManager: RenderManager;
    protected readonly physicsManager: PhysicsManager;
    protected readonly location = new Vector3();
    protected readonly rotation = new Rotator();
    protected library: DecodeLibrary = null;
    protected float: L2Float = null;
    protected controller: ViewportWindowController = null;
    protected request = 0;
    protected fishType = 0;
    protected actionStage = 0;
    protected active = false;
    protected endResult: boolean = null;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
        this.physicsManager = renderManager.manGame.getComponent("physics");
    }

    public async start(location: Vector3, fishType: number, isLocal: boolean, screenWidth: number): Promise<void> {
        const pawn = this.getParent();
        if (pawn.getUnrealScriptProperty("bFish")) return;

        const request = ++this.request;
        this.active = true;
        this.endResult = null;
        this.actionStage = 0;
        this.fishType = fishType;
        this.location.copy(location);
        tmpTraceStart.copy(location).z += 50;
        tmpTraceEnd.copy(location).z -= 50;

        const hit = this.physicsManager.physicsVolumeLineCheck(tmpTraceStart, tmpTraceEnd, this.renderManager.player, true);

        if (hit && hit.location.z !== 0) this.location.copy(hit.location);
        this.updateRotation();

        if (isLocal) {
            this.controller = new ViewportWindowController(pawn.position, this.rotation);
            this.renderManager.setViewportWindowParam(this.controller.location, this.controller.quaternion, screenWidth);
        }

        pawn.setUnrealScriptProperty("bFish", true);
        pawn.setUnrealScriptProperty("CurFishingType", FishingType_T.FST_WAIT);
        this.playAnimation("FishStartAnimName");
        this.renderManager.registerPawnFishing(this);

        const library = await this.renderManager.manGame.getComponent<AssetManager>("asset").loadFishingLibrary();

        if (!this.active || request !== this.request) return;

        this.library = library;
    }

    public getFloat(): L2Float { return this.float; }
    public getController(): ViewportWindowController { return this.controller; }
    public getActionStage(): number { return this.actionStage; }
    public isActive(): boolean { return this.active; }

    public getIdleAnimationName(): string {
        if (!this.active) return null;

        const pawn = this.getParent();
        return pawn.getUnrealScriptProperty(pawn.getUnrealScriptProperty("CurFishingType") === FishingType_T.FST_WAIT ? "FishWaitAnimName" : "FishControlAnimName") as string;
    }

    protected playAnimation(property: string): void {
        const pawn = this.getParent();
        const name = pawn.getUnrealScriptProperty(property) as string;

        if (name.toLowerCase() !== "none") pawn.playAnimation(name, 0.1, pawn.getUnrealScriptProperty("NonAttackSpeedRate") as number, false, true);
    }

    protected updateRotation(): void {
        getPawnRotation(this.getParent(), tmpRotation);
        this.rotation.setFromRotationMatrix(tmpRotationMatrix.makeRotationFromQuaternion(tmpRotation));
    }

    public tick(deltaTime: number): void {
        const pawn = this.getParent();
        const dt = Math.fround(Math.max(0.0005, Math.min(0.4, deltaTime)));

        if (!this.active) {
            if (this.endResult === null) return;

            const action = pawn.getAnimationAction();
            const name = action ? action.getClip().name : "None";
            const endName = pawn.getUnrealScriptProperty("bFish") ? pawn.getUnrealScriptProperty("FishEndAnimName") as string : "None";

            // Engine 10497C00 compares against GetFishingEndAnimName after bFish is cleared.
            if (name.toLowerCase() !== endName.toLowerCase()) {
                const animation = (pawn.getUnrealScriptProperty("PcSocialAnimName") as string[])[this.endResult ? 3 : 13];
                if (animation.toLowerCase() !== "none") pawn.playAnimation(animation, 0.3, pawn.getUnrealScriptProperty("NonAttackSpeedRate") as number, false, true);
                this.endResult = null;
                this.renderManager.unregisterPawnFishing(this);
            }
            return;
        }

        this.updateRotation();

        if (this.actionStage === 0 && this.library) {
            const action = pawn.getAnimationAction();
            const name = action ? action.getClip().name : "None";

            // Engine 1049794A compares channel-0 FName, not animation completion.
            if (name.toLowerCase() !== (pawn.getUnrealScriptProperty("FishStartAnimName") as string).toLowerCase()) {
                this.float = new L2Float(this.renderManager, this.library, this.location, this.rotation, this.fishType, (start, end, target) => {
                    const hit = this.physicsManager.physicsVolumeLineCheck(start, end, this.renderManager.player, true);
                    if (hit) target.copy(hit.location);
                });
                this.renderManager.addTransientEffect(this.float);
                pawn.setUnrealScriptProperty("FishFloat", this.float as any);
                this.actionStage = 1;
                if (this.controller) this.controller.setCalcStep(ECALCSTEP_T.STEP_MOVE_BACK, this.rotation);
            }
        }

        if (this.float) this.float.tick(dt);
        if (this.controller) {
            this.controller.calcView(dt, this.rotation, this.float ? this.float.position : this.location);
            this.renderManager.modifyViewportWindowParam(this.controller.location, this.controller.quaternion);
        }
    }

    public startCombat(mode: number): void {
        if (!this.active) return;

        const pawn = this.getParent();
        if (pawn.getUnrealScriptProperty("CurFishingType") === FishingType_T.FST_BATTLE) return;

        pawn.setUnrealScriptProperty("CurFishingType", FishingType_T.FST_BATTLE);
        if (!this.float) return;

        this.float.startCombat(!!(mode & 1));
        if (this.controller) this.controller.setCalcStep(ECALCSTEP_T.STEP_MOVE_FLOAT, this.rotation, this.float.position, this.float.getSkeleton());
    }

    public updateCombat(mode: number, animation: number): void {
        if (!this.active || this.getParent().getUnrealScriptProperty("CurFishingType") !== FishingType_T.FST_BATTLE) return;

        if (animation > 0) this.playAnimation("FishPullAnimName");
        if (!this.float) return;

        if (animation > 0) this.float.setEffectType(animation);
        this.float.setMode(!!(mode & 1));
    }

    public end(isWin: boolean): void {
        if (!this.active) return;

        this.clearActors();
        this.playAnimation("FishEndAnimName");
        this.clearState();
        this.endResult = isWin;
        this.renderManager.registerPawnFishing(this);
    }

    protected clearActors(): void {
        if (this.float) this.renderManager.removeTransientEffect(this.float);
        if (this.controller) this.renderManager.clearViewportWindowParam();

        this.float = null;
        this.controller = null;
    }

    protected clearState(): void {
        const pawn = this.getParent();

        ++this.request;
        this.active = false;
        this.endResult = null;
        this.library = null;
        pawn.setUnrealScriptProperty("bFish", false);
        pawn.setUnrealScriptProperty("CurFishingType", FishingType_T.FST_NONE);
        pawn.setUnrealScriptProperty("FishFloat", null);
        this.renderManager.unregisterPawnFishing(this);
    }

    public onDetach(): void {
        if (!this.active && this.endResult === null) return;

        this.clearActors();
        this.clearState();
    }
}

export default PawnFishingComponent;
