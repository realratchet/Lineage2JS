import { AnimationAction, AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, Matrix4, Mesh, Skeleton, Texture, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, ObjectComponent } from "../../game/components";
import { SCRIPT_NATIVE_EVENT, ScriptComponent } from "../../game/script-component";
import { ANIMATION_NOTIFY_EVENT } from "../../audio/components/sound-component";
import { isScriptSlot, ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import { PAWN_COLLISION_SIZE_CHANGED_EVENT, type PawnMovementState_T } from "../../physics/components/pawn-movement-component";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type LocalSpaceSkeleton from "../local-space-skeleton";
import type LitSkinnedMesh from "../lit-skinned-mesh";
import type PawnFishingComponent from "./pawn-fishing-component";
import type PawnEquipmentComponent from "./pawn-equipment-component";
import type { IAnimationNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";

export const MESHES_CHANGED_EVENT = "meshesChanged";
const MOVEMENT_TWEEN_TIME = 0.1;
const IDLE_TWEEN_TIME = MOVEMENT_TWEEN_TIME * 2;
const cacheOnceAnimations = new WeakMap<AnimationClip, AnimationClip>();
const cacheTweenTwins = new WeakMap<AnimationClip, AnimationClip>();

function getTweenTwin(clip: AnimationClip): AnimationClip { // Same tracks under a second clip, so a restart gets its own action to cross-fade into.
    let twin = cacheTweenTwins.get(clip);

    if (twin) return twin;

    twin = new AnimationClip(clip.name, clip.duration, clip.tracks, clip.blendMode);

    for (const key of Object.keys(clip))
        if (!(key in twin)) (twin as any)[key] = (clip as any)[key];

    cacheTweenTwins.set(clip, twin);
    cacheTweenTwins.set(twin, clip);

    return twin;
}

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

function fadeOutAction(action: AnimationAction, duration: number): boolean { // AnimationAction.fadeOut always fades from full weight
    const interpolant = (action as any)._weightInterpolant;
    const weight = !action.enabled || !action.isScheduled() ? 0 : interpolant ? action.weight * interpolant.evaluate(action.getMixer().time)[0] : action.weight;

    if (weight <= 0 || duration <= 0) {
        action.stop();
        return false;
    }

    (action as any)._scheduleFading(duration, weight, 0);

    return true;
}

export class AnimationComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "animation";
    protected readonly renderManager: RenderManager;
    protected mixer: AnimationMixer;
    protected meshes: Mesh[] = [];
    protected meshTextures = new Set<Texture>();
    protected currAnimations = new WeakMap<Mesh, AnimationAction>();
    protected prevAnimations = new WeakMap<Mesh, AnimationAction[]>();
    protected actorAnimations: Record<string, AnimationClip> = {};
    protected animationNotifyAction: AnimationAction = null;
    protected animationNotifyTime = 0;
    protected animationTweenEndTime = 0;
    protected readonly tweenTimeScales = new Map<AnimationAction, number>();
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
        this.mixer = renderManager.mixer;
    }

    public onUpdate(_currentTime: number, _deltaTime: number): void {
        if (this.tweenTimeScales.size > 0 && this.mixer.time >= this.animationTweenEndTime) {
            for (const [tweened, timeScale] of this.tweenTimeScales) tweened.setEffectiveTimeScale(timeScale);

            this.tweenTimeScales.clear();
        }

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
        if (type === PAWN_COLLISION_SIZE_CHANGED_EVENT) {
            this.placeMeshes();
            return COMPONENT_EVENT_NOT_HANDLED;
        }

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
        outRate.set(action ? this.tweenTimeScales.get(action) ?? action.getEffectiveTimeScale() : 0);
    }

    public getMeshes(): readonly Mesh[] { return this.meshes; }
    public getAction(): AnimationAction { return this.animationNotifyAction; }
    public getAnimationNames(): string[] { return Object.keys(this.actorAnimations); }
    public getAnimationClip(name: string): AnimationClip { return this.actorAnimations[Object.keys(this.actorAnimations).find(key => key.toLowerCase() === name.toLowerCase())]; }
    public isAnimating(): boolean {
        const action = this.animationNotifyAction;

        return !!action && (action.isRunning() || action.isScheduled() && action.enabled && this.mixer.time < this.animationTweenEndTime);
    }

    public setMeshes(meshes: Mesh[]): void {
        const parent = this.getParent();

        this.stop();

        const textures = new Set<Texture>();

        for (const mesh of meshes) this.renderManager.retainGeometry(mesh.geometry);
        this.renderManager.retainMeshTextures(meshes, textures);
        for (const mesh of this.meshes) {
            parent.remove(mesh);
            this.mixer.uncacheRoot(mesh);
            this.renderManager.releaseGeometry(mesh.geometry);
        }
        this.disposeSkeletons();
        this.renderManager.releaseTextures(this.meshTextures);

        this.meshes = meshes;
        this.meshTextures = textures;

        for (const mesh of meshes) {
            (mesh as any).hasStartedAnimation = true;
            mesh.frustumCulled = false;
            parent.add(mesh);
        }

        this.placeMeshes();
        this.dispatchEvent(MESHES_CHANGED_EVENT, meshes);
        this.renderManager.invalidatePawnLighting(parent);
    }

    protected disposeSkeletons(): void {
        const skeletons = new Set<Skeleton>();

        for (const mesh of this.meshes) if ((mesh as any).skeleton) skeletons.add((mesh as any).skeleton);
        for (const skeleton of skeletons) skeleton.dispose();
    }

    protected placeMeshes(): void {
        const parent = this.getParent();
        const collisionHeight = parent.getCollisionHeight();
        const drawScale = parent.scriptClassId ? parent.getUnrealScriptProperty("DrawScale") as number : 1;

        // USubSkeletalMeshInstance::MeshToWorld 0x946530 draws at Location - Origin * Scale * DrawScale; bindMatrix already cancels meshOrigin
        for (const mesh of this.meshes as LitSkinnedMesh[])
            mesh.position.z = mesh.meshOrigin.z + collisionHeight - mesh.meshOrigin.z * mesh.scale.z * drawScale;
    }

    public getBoneWorldPosition(name: string | number, target: Vector3, offset?: Vector3): Vector3 {
        for (const mesh of this.meshes) {
            const skeleton = (mesh as any).skeleton as LocalSpaceSkeleton;

            if (!skeleton) continue;

            const index = typeof name === "number" ? name : skeleton.matchRefBone(name);

            if (skeleton.bones[index]) return skeleton.getBoneWorldPosition(index, target, offset);
        }

        throw new Error(`${this.getParent().type} has no '${name}' bone.`);
    }

    public getBoneWorldMatrix(name: string | number, target: Matrix4, fallback?: number): Matrix4 {
        for (const mesh of this.meshes) {
            const skeleton = (mesh as any).skeleton as LocalSpaceSkeleton;

            if (!skeleton) continue;

            let index = typeof name === "number" ? name : skeleton.matchRefBone(name);

            if (index < 0 && fallback !== undefined) index = fallback;
            if (skeleton.bones[index]) return skeleton.getBoneWorldMatrix(index, target);
        }

        throw new Error(`${this.getParent().type} has no '${name}' bone.`);
    }

    public setMeshAnimations(mesh: LitSkinnedMesh): void {
        this.meshes = [mesh];
        this.actorAnimations = (mesh as any).meshAnimations;
        this.isAnimationsInit = true;
        (mesh as any).hasStartedAnimation = true;
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
        const fishing = state === "idle" ? this.findComponent<PawnFishingComponent>("pawnFishing") : null;
        const fishingAnimation = fishing && fishing.getIdleAnimationName();

        this.play(fishingAnimation || this.basicActorAnimations[state], tweenTime, this.getMovementRate(state, fishingAnimation));
    }

    protected getMovementRate(state: PawnMovementState_T, fishingAnimation: string): number {
        const isScaled = fishingAnimation || (state === "walking" || state === "running" || state === "swimming") && this.getParent().scriptClassId;

        return isScaled ? this.getParent().getUnrealScriptProperty("NonAttackSpeedRate") as number : 1;
    }

    public isPlayingMovement(state: PawnMovementState_T): boolean {
        const action = this.animationNotifyAction;

        const fishing = state === "idle" ? this.findComponent<PawnFishingComponent>("pawnFishing") : null;
        const fishingAnimation = fishing && fishing.getIdleAnimationName();
        const clip = fishingAnimation ? this.getAnimationClip(fishingAnimation) : this.actorAnimations[this.basicActorAnimations[state]];

        return !!action && action.enabled && action.isScheduled() && (action.getClip() === clip || action.getClip() === cacheTweenTwins.get(clip)) && (this.tweenTimeScales.get(action) ?? action.getEffectiveTimeScale()) === this.getMovementRate(state, fishingAnimation);
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
        if (isDying) return true;

        this.animationNotifyTime = 0;

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
        const mixer = this.mixer;
        const tweenEndTime = mixer.time + Math.max(0, tweenTime);
        let notifyAction: AnimationAction = null;
        let didBegin = false;

        for (const mesh of this.meshes) {
            if ((mesh as any).isBoneAttachment) continue; // rides the bone it hangs off, its own skeleton is untouched by this clip
            if ((mesh as any).sharesSkeleton) continue; // skinned off the bodypart that owns the bone tree, one action drives both

            const prevActs = this.prevAnimations.get(mesh) || [];
            const currAct = this.currAnimations.get(mesh) || null;
            const meshAnimations = (mesh as any).meshAnimations as Record<string, AnimationClip>;
            const meshClip = (mesh as any).skeleton?.rootBoneSource
                ? meshAnimations[Object.keys(meshAnimations).find(name => name.toLowerCase() === resolvedName.toLowerCase())]
                : sourceClip;

            if (!meshClip) {
                for (const action of prevActs) action.stop();
                if (currAct) currAct.stop();
                continue;
            }

            const clip = loop ? meshClip : getOnceAnimation(meshClip);
            const twin = cacheTweenTwins.get(clip);
            let nextAct = currAct && twin && currAct.getClip() === twin ? currAct : mixer.clipAction(clip, mesh);

            if (currAct === nextAct && tweenTime > 0 && (restart || nextAct.paused) && nextAct.isScheduled() && nextAct.enabled)
                nextAct = mixer.clipAction(getTweenTwin(nextAct.getClip()), mesh);
            else if (currAct !== nextAct && tweenTime > 0 && prevActs.includes(nextAct) && nextAct.isScheduled() && nextAct.enabled)
                nextAct = mixer.clipAction(getTweenTwin(nextAct.getClip()), mesh);

            if (!notifyAction) notifyAction = nextAct;

            const timeScale = meshClip === sourceClip ? rate : rate * clip.duration / sourceClip.duration;

            if (this.tweenTimeScales.has(nextAct)) this.tweenTimeScales.set(nextAct, timeScale);
            else nextAct.setEffectiveTimeScale(timeScale);
            nextAct.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
            nextAct.clampWhenFinished = !loop;

            if (currAct === nextAct) {
                if (restart || !nextAct.isScheduled() || !nextAct.enabled || nextAct.paused) {
                    nextAct.reset();
                    if (tweenTime > 0) this.holdFirstFrame(nextAct, timeScale);
                    nextAct.play();
                    didBegin = true;
                }
                continue;
            }

            this.currAnimations.set(mesh, nextAct);

            const fadingActs = prevActs.filter(action => action !== nextAct && fadeOutAction(action, tweenTime));

            nextAct.reset();

            if (currAct && fadeOutAction(currAct, tweenTime)) fadingActs.push(currAct);
            if (fadingActs.length > 0) nextAct.fadeIn(tweenTime);

            this.prevAnimations.set(mesh, fadingActs);

            // Engine.dll PlayAnim 0x943c41 / UpdateAnimation 0x94a549: tween before frame zero.
            if (tweenTime > 0) this.holdFirstFrame(nextAct, timeScale);
            nextAct.play();
            didBegin = true;
        }

        if (this.animationNotifyAction !== notifyAction || didBegin) {
            this.animationNotifyAction = notifyAction;
            this.animationNotifyTime = notifyAction ? notifyAction.time : 0;
        }

        if (didBegin) this.animationTweenEndTime = tweenEndTime;

        const equipment = this.findComponent<PawnEquipmentComponent>("pawnEquipment");
        if (equipment) equipment.playExtraAnimation(animationName, tweenTime, rate, loop, restart);

        const script = this.findComponent<ScriptComponent<BaseActor>>("script");

        if (didBegin && script?.hasFunction("AnimBegin")) script.call("AnimBegin", [resolvedName]);
    }

    protected holdFirstFrame(action: AnimationAction, timeScale: number): void { // startAt() would drop the action's weight until the tween ends, blending the skeleton toward its bind pose.
        action.setEffectiveTimeScale(0);
        this.tweenTimeScales.set(action, timeScale);
    }

    public stop(): void {
        this.tweenTimeScales.clear();

        for (const mesh of this.meshes) {
            if (this.prevAnimations.has(mesh)) for (const action of this.prevAnimations.get(mesh)) action.stop();
            if (this.currAnimations.has(mesh)) this.currAnimations.get(mesh).stop();
        }

        this.animationNotifyAction = null;
        this.animationNotifyTime = 0;
        this.animationTweenEndTime = 0;
    }

    public release(): void {
        this.stop();

        for (const mesh of this.meshes) {
            this.mixer.uncacheRoot(mesh);
            this.renderManager.releaseGeometry(mesh.geometry);
        }
        this.disposeSkeletons();
        this.renderManager.releaseTextures(this.meshTextures);

        this.meshes = [];
    }
}

type BasicActorAnimations_T = Record<PawnMovementState_T, string>;

export class ExtraMeshAnimationComponent extends AnimationComponent {
    public constructor(renderManager: RenderManager, mesh: LitSkinnedMesh) {
        super(renderManager);

        this.mixer = new AnimationMixer(mesh);
        this.mixer.addEventListener("finished", event => this.onAnimationFinished(event.action, false));
        this.setMeshAnimations(mesh);
    }

    protected resolveOwnerAnimation(name: string): string {
        if (this.getAnimationClip(name)) return name;

        const suffix = name.lastIndexOf("_");
        if (suffix < 0) return null;

        return name.slice(0, suffix);
    }

    public playOwnerAnimation(name: string, tween: number, rate: number, loop: boolean, restart: boolean): void {
        const resolved = this.resolveOwnerAnimation(name);
        if (resolved === null) return;
        if (!this.getAnimationClip(resolved)) { this.stop(); return; }

        this.play(resolved, tween, rate, loop, restart);
    }

    public copyOwnerAnimation(owner: AnimationAction, deltaTime: number): void {
        if (!owner) return;

        const name = owner.getClip().name;
        const resolved = this.resolveOwnerAnimation(name);
        if (resolved === null) return;

        let action = this.getAction();
        if (!action || action.getClip().name.toLowerCase() !== name.toLowerCase()) {
            if (!this.getAnimationClip(resolved)) { this.stop(); return; }
            this.play(resolved, 0, owner.getEffectiveTimeScale(), owner.loop === LoopRepeat, true);
            action = this.getAction();
        }

        if (!action) return;
        this.mixer.update(deltaTime);
        this.onUpdate(0, deltaTime);
        action.time = owner.getClip().duration > 0 ? owner.time / owner.getClip().duration * action.getClip().duration : 0;
        this.mixer.update(0);
    }

    public onDetach(): void {
        this.stop();
        this.mixer.uncacheRoot(this.meshes[0]);
    }
}

export default AnimationComponent;
