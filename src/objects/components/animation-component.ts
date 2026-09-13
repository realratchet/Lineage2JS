import { AnimationAction, AnimationClip, LoopOnce, LoopRepeat, Mesh, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { SCRIPT_NATIVE_EVENT, ScriptComponent } from "../../game/script-component";
import { ANIMATION_NOTIFY_EVENT } from "../../audio/components/sound-component";
import { isScriptSlot, ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import type { PawnMovementState_T } from "../../physics/components/pawn-movement-component";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type LocalSpaceSkeleton from "../local-space-skeleton";
import type { IAnimationNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";

export const MESHES_CHANGED_EVENT = "meshesChanged";
const MOVEMENT_TWEEN_TIME = 0.1;
const IDLE_TWEEN_TIME = MOVEMENT_TWEEN_TIME * 2;
const cacheOnceAnimations = new WeakMap<AnimationClip, AnimationClip>();

function getOnceAnimation(clip: AnimationClip): AnimationClip {
    let once = cacheOnceAnimations.get(clip);

    if (once) return once;

    once = clip.clone();

    // decoded looping clips close on frame 0; LoopOnce holds the preceding real frame instead
    for (const track of once.tracks) {
        const size = track.getValueSize();

        if (track.values.length >= size * 2)
            track.values.copyWithin(track.values.length - size, track.values.length - size * 2, track.values.length - size);
    }

    (once as any).animationNotifies = (clip as any).animationNotifies;
    (once as any).skinNotify = (clip as any).skinNotify;
    (once as any).attackEffectFrame = (clip as any).attackEffectFrame;
    (once as any).attackEndEffectFrame = (clip as any).attackEndEffectFrame;
    cacheOnceAnimations.set(clip, once);

    return once;
}

export class AnimationComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "animation";
    protected readonly renderManager: RenderManager;
    protected meshes: Mesh[] = [];
    protected currAnimations = new WeakMap<Mesh, AnimationAction>();
    protected prevAnimations = new WeakMap<Mesh, AnimationAction>();
    protected actorAnimations: Record<string, AnimationClip> = {};
    protected animationNotifyAction: AnimationAction = null;
    protected animationNotifyTime = 0;
    protected animationTweenEndTime = 0;
    protected isAnimationsInit = false;
    protected readonly basicActorAnimations: BasicActorAnimations_T = {
        idle: null,
        walking: null,
        running: null,
        dying: null,
        falling: null,
        swimming: null,
        swimmingIdle: null
    };

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onUpdate(_currentTime: number, _deltaTime: number): void {
        const action = this.animationNotifyAction;

        if (!action) return;

        const oldTime = this.animationNotifyTime;
        const time = action.time;

        this.animationNotifyTime = time;

        if (time === oldTime) return;

        const duration = action.getClip().duration;
        const notifications = (action.getClip() as any).animationNotifies as IAnimationNotifyDecodeInfo[];

        if (!notifications || notifications.length === 0 || duration <= 0) return;

        const oldFrame = oldTime / duration;
        const frame = time / duration;
        const forward = action.getEffectiveTimeScale() >= 0;

        for (let i = 0, len = notifications.length; i < len; i++) {
            const notify = notifications[i];
            const notifyTime = notify.time;
            const crossed = forward
                ? frame >= oldFrame ? oldFrame < notifyTime && notifyTime <= frame : oldFrame < notifyTime || notifyTime <= frame
                : frame <= oldFrame ? frame <= notifyTime && notifyTime < oldFrame : notifyTime < oldFrame || frame <= notifyTime;

            if (crossed) this.dispatchEvent(ANIMATION_NOTIFY_EVENT, notify);
        }
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        if (type !== SCRIPT_NATIVE_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        const call = data as ScriptNativeCall_T;
        const context = call.context as any;
        const name = call.name.toLowerCase();

        if (call.index === 259 || call.index === 260 || name === "playanim" || name === "loopanim") {
            const sequence = call.args[0] as string;
            const rate = call.args.length > 1 ? Number(call.args[1]) : 1;
            const tweenTime = call.args.length > 2 ? Number(call.args[2]) : 0;
            const channel = call.args.length > 3 ? Number(call.args[3]) : 0;
            const loop = call.index === 260 || name === "loopanim";

            if (channel !== 0) throw new Error(`UnrealScript ${call.name} channel '${channel}' is not implemented for '${context.scriptClassId}'.`);
            if (sequence === "None") return;
            if (context !== this.getParent()) throw new Error(`'${context.scriptClassId}' cannot use '${this.getParent().type}' animation.`);

            this.play(sequence, tweenTime, rate, loop, true);
            return;
        }

        if (call.index === 282 || name === "isanimating") {
            const channel = call.args.length > 0 ? Number(call.args[0]) : 0;

            if (channel !== 0) throw new Error(`UnrealScript IsAnimating channel '${channel}' is not implemented for '${context.scriptClassId}'.`);

            return this.isAnimating();
        }

        if (call.index !== 0 || name !== "getanimparams") return COMPONENT_EVENT_NOT_HANDLED;

        const channel = Number(call.args[0]);
        const outName = call.args[1], outFrame = call.args[2], outRate = call.args[3];

        if (channel !== 0) throw new Error(`UnrealScript GetAnimParams channel '${channel}' is not implemented for '${context.scriptClassId}'.`);
        if (!isScriptSlot(outName) || !isScriptSlot(outFrame) || !isScriptSlot(outRate)) throw new Error("UnrealScript GetAnimParams requires out parameters.");

        const action = this.animationNotifyAction;
        const duration = action ? action.getClip().duration : 0;

        outName.set(action ? action.getClip().name : "None");
        outFrame.set(action && duration > 0 ? action.time / duration : 0);
        outRate.set(action ? action.getEffectiveTimeScale() : 0);
    }

    public getMeshes(): readonly Mesh[] { return this.meshes; }
    public getAction(): AnimationAction { return this.animationNotifyAction; }
    public getAnimationNames(): string[] { return Object.keys(this.actorAnimations); }
    public getAnimationClip(name: string): AnimationClip { return this.actorAnimations[Object.keys(this.actorAnimations).find(key => key.toLowerCase() === name.toLowerCase())]; }
    public isAnimating(): boolean {
        const action = this.animationNotifyAction;

        return !!action && (action.isRunning() || action.isScheduled() && action.enabled && this.renderManager.mixer.time < this.animationTweenEndTime);
    }

    public setMeshes(meshes: Mesh[]): void {
        const parent = this.getParent();

        this.stop();

        for (const mesh of this.meshes) parent.remove(mesh);

        this.meshes = meshes;

        for (const mesh of meshes) {
            (mesh as any).hasStartedAnimation = true;
            mesh.frustumCulled = false;
            parent.add(mesh);
        }

        this.dispatchEvent(MESHES_CHANGED_EVENT, meshes);
        this.renderManager.invalidatePawnLighting(parent);
    }

    public getBoneWorldPosition(name: string | number, target: Vector3): Vector3 {
        if (typeof name === "string") name = name.replaceAll(" ", "_").toLowerCase();

        for (const mesh of this.meshes) {
            const skeleton = (mesh as any).skeleton as LocalSpaceSkeleton;

            if (!skeleton) continue;

            const index = typeof name === "number" ? name : skeleton.bones.findIndex(bone => bone.name === name);

            if (skeleton.bones[index]) return skeleton.getBoneWorldPosition(index, target);
        }

        throw new Error(`${this.getParent().type} has no '${name}' bone.`);
    }

    public setAnimations(animations: Record<string, AnimationClip>): void {
        this.stop();
        this.getComponent<any>("pawnMovement").resetAnimationState();
        this.actorAnimations = animations;
    }

    public setBasicAnimation(key: PawnMovementState_T, animationName: string): void {
        const resolvedName = Object.keys(this.actorAnimations).find(name => name.toLowerCase() === animationName.toLowerCase());

        if (!resolvedName) throw new Error(`'${animationName}' is not available.`);
        if (!(key in this.basicActorAnimations)) throw new Error(`'${key}' is not a valid basic actor animation`);

        (this.basicActorAnimations as any)[key] = resolvedName;
    }

    public playMovement(state: PawnMovementState_T): void {
        const tweenTime = state === "idle" || state === "swimmingIdle" ? IDLE_TWEEN_TIME : MOVEMENT_TWEEN_TIME;

        this.play(this.basicActorAnimations[state], tweenTime);
    }

    public setDeathAnimationFromScript(): void {
        const parent = this.getParent();
        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        if (!script) throw new Error(`${parent.type} has no UnrealScript runtime.`);

        const oldWeaponType = parent.getUnrealScriptProperty("CurWeaponType");
        let invalidAnimationName: string = null;

        try {
            for (let weaponType = 0; weaponType < 8; weaponType++) {
                parent.setUnrealScriptProperty("CurWeaponType", weaponType);

                const animationName = script.call("GetDeathAnimName");

                if (typeof animationName !== "string") throw new Error(`${parent.type} has invalid death animation '${animationName}'.`);
                if (animationName.toLowerCase() === "none") continue;

                const resolvedName = Object.keys(this.actorAnimations).find(name => name.toLowerCase() === animationName.toLowerCase());

                if (!resolvedName) {
                    invalidAnimationName = animationName;
                    continue;
                }

                this.setBasicAnimation("dying", resolvedName);
                return;
            }
        } finally {
            parent.setUnrealScriptProperty("CurWeaponType", oldWeaponType);
        }

        if (invalidAnimationName) throw new Error(`'${invalidAnimationName}' is not available.`);
    }

    public init(): void {
        this.isAnimationsInit = true;
        this.play(this.basicActorAnimations.idle, IDLE_TWEEN_TIME);
    }

    public playEnter(animationName: string): void {
        if (animationName && animationName.toLowerCase() !== "none") this.play(animationName, MOVEMENT_TWEEN_TIME, 1, false, true);
    }

    public playDeath(): void { this.play(this.basicActorAnimations.dying, MOVEMENT_TWEEN_TIME, 1, false, true); }

    public onAnimationFinished(action: AnimationAction, isDying: boolean): boolean {
        if (action !== this.animationNotifyAction) return false;

        this.onUpdate(0, 0);
        if (action !== this.animationNotifyAction) return true;

        this.animationNotifyTime = 0;

        if (isDying) {
            action.stop();
            this.animationNotifyAction = null;
            return true;
        }

        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        if (script) {
            script.call("AnimEnd", [0]);

            if (this.animationNotifyAction !== action) return true;
        }

        this.animationNotifyAction = null;

        return true;
    }

    public isPlayingOneShot(animationName: string): boolean {
        const action = this.animationNotifyAction;

        return this.isAnimating() && action.loop === LoopOnce && action.getClip().name.toLowerCase() === animationName.toLowerCase();
    }

    public play(animationName: string, tweenTime: number = MOVEMENT_TWEEN_TIME, rate: number = 1, loop: boolean = true, restart: boolean = false): void {
        if (!this.isAnimationsInit) return;

        const resolvedName = Object.keys(this.actorAnimations).find(name => name.toLowerCase() === animationName.toLowerCase());

        if (!resolvedName) throw new Error(`'${animationName}' is not available.`);

        const sourceClip = this.actorAnimations[resolvedName];
        const clip = loop ? sourceClip : getOnceAnimation(sourceClip);
        const mixer = this.renderManager.mixer;
        const tweenEndTime = mixer.time + Math.max(0, tweenTime);
        let notifyAction: AnimationAction = null;
        let didBegin = false;

        for (const mesh of this.meshes) {
            if ((mesh as any).isBoneAttachment) continue; // rides the bone it hangs off, its own skeleton is untouched by this clip
            if ((mesh as any).sharesSkeleton) continue; // skinned off the bodypart that owns the bone tree, one action drives both

            const prevAct = this.prevAnimations.get(mesh) || null;
            const currAct = this.currAnimations.get(mesh) || null;
            const nextAct = mixer.clipAction(clip, mesh);

            if (!notifyAction) notifyAction = nextAct;

            nextAct.setEffectiveTimeScale(rate);
            nextAct.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
            nextAct.clampWhenFinished = !loop;

            if (currAct === nextAct) {
                if (restart || !nextAct.isScheduled() || !nextAct.enabled || nextAct.paused) {
                    nextAct.reset();
                    if (tweenTime > 0) nextAct.startAt(tweenEndTime);
                    nextAct.play();
                    didBegin = true;
                }
                continue;
            }

            this.currAnimations.set(mesh, nextAct);

            if (prevAct) prevAct.stop();
            nextAct.reset();

            if (currAct && currAct.isScheduled() && currAct.enabled) {
                this.prevAnimations.set(mesh, currAct);
                currAct.crossFadeTo(nextAct, tweenTime, false);
            } else if (currAct) currAct.stop();

            // Engine.dll PlayAnim 0x943c41 / UpdateAnimation 0x94a549: tween before frame zero.
            if (tweenTime > 0) nextAct.startAt(tweenEndTime);
            nextAct.play();
            didBegin = true;
        }

        if (this.animationNotifyAction !== notifyAction || didBegin) {
            this.animationNotifyAction = notifyAction;
            this.animationNotifyTime = notifyAction ? notifyAction.time : 0;
        }

        if (didBegin) this.animationTweenEndTime = tweenEndTime;

        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        if (didBegin && script?.hasFunction("AnimBegin")) script.call("AnimBegin", [resolvedName]);
    }

    public stop(): void {
        for (const mesh of this.meshes) {
            if (this.prevAnimations.has(mesh)) this.prevAnimations.get(mesh).stop();
            if (this.currAnimations.has(mesh)) this.currAnimations.get(mesh).stop();
        }

        this.animationNotifyAction = null;
        this.animationNotifyTime = 0;
        this.animationTweenEndTime = 0;
    }

    public release(): void {
        this.stop();

        for (const mesh of this.meshes) {
            this.renderManager.mixer.uncacheRoot(mesh);
            mesh.geometry.dispose();
        }
    }
}

type BasicActorAnimations_T = Record<PawnMovementState_T, string>;

export default AnimationComponent;
