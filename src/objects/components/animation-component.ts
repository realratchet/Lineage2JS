import { AnimationAction, AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, Matrix4, Mesh, Skeleton, Texture, Vector3, Bone } from "three";
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
import type NpcLifecycleComponent from "./npc-lifecycle-component";
import type { IAnimationNotifyDecodeInfo } from "@l2js/engine/contracts/anim-notify";

export const MESHES_CHANGED_EVENT = "meshesChanged";
export const MESH_SCALE_CHANGED_EVENT = "meshScaleChanged";
const MOVEMENT_TWEEN_TIME = 0.1;
const IDLE_TWEEN_TIME = MOVEMENT_TWEEN_TIME * 2;
const cacheOnceAnimations = new WeakMap<AnimationClip, AnimationClip>();
const cacheTweenTwins = new WeakMap<AnimationClip, AnimationClip[]>();

function getTweenTwin(clip: AnimationClip, mixer: AnimationMixer, mesh: Mesh): AnimationClip { // A restart cannot reset an action that is still fading.
    let twins = cacheTweenTwins.get(clip);

    if (!twins) {
        twins = [clip];
        cacheTweenTwins.set(clip, twins);
    }

    for (const twin of twins) {
        const action = mixer.existingAction(twin, mesh);

        if (twin !== clip && (!action || !action.enabled || !action.isScheduled())) return twin;
    }

    const twin = new AnimationClip(clip.name, clip.duration, clip.tracks, clip.blendMode);

    for (const key of Object.keys(clip))
        if (!(key in twin)) (twin as any)[key] = (clip as any)[key];

    twins.push(twin);
    cacheTweenTwins.set(twin, twins);

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
    protected readonly boneScalers = new Map<string, BoneScaler_T>();
    protected readonly tweenTimeScales = new Map<AnimationAction, number>();
    protected isAnimationsInit = false;
    protected readonly basicActorAnimations: BasicActorAnimations_T = {
        idle: null,
        turning: null,
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
        if (type === PAWN_COLLISION_SIZE_CHANGED_EVENT || type === MESH_SCALE_CHANGED_EVENT) {
            this.placeMeshes();
            if (type === MESH_SCALE_CHANGED_EVENT) this.renderManager.invalidatePawnLighting(this.getParent());
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

    public setBoneScale(name: string, scale: number): void {
        const key = name.toLowerCase();
        let scaler = this.boneScalers.get(key);

        if (scale === 1) {
            if (scaler) for (const [bone, original] of scaler.bones) bone.scale.copy(original);
            this.boneScalers.delete(key);
            return;
        }

        if (!scaler) this.boneScalers.set(key, scaler = { scale, bones: new Map() });
        scaler.scale = scale;

        for (const mesh of this.meshes) {
            const skeleton = (mesh as LitSkinnedMesh).skeleton;
            if (!skeleton) continue;
            const index = skeleton.matchRefBone(name);
            if (index < 0) continue;
            const bone = skeleton.bones[index];
            if (!scaler.bones.has(bone)) scaler.bones.set(bone, bone.scale.clone());
            bone.scale.copy(scaler.bones.get(bone)).multiplyScalar(scale);
        }
    }

    public setMeshes(meshes: Mesh[]): void {
        const parent = this.getParent();

        this.stop();

        for (const scaler of this.boneScalers.values()) {
            for (const [bone, scale] of scaler.bones) bone.scale.copy(scale);
            scaler.bones.clear();
        }

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

        for (const [name, scaler] of this.boneScalers) this.setBoneScale(name, scaler.scale);

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
        const drawScale3D = parent.scriptClassId ? parent.getUnrealScriptProperty("DrawScale3D") as Vector3Arr : [1, 1, 1];

        // USubSkeletalMeshInstance::MeshToWorld 0x946885..0x9468d9 combines actor and mesh scale before rotation.
        for (const mesh of this.meshes as LitSkinnedMesh[]) {
            mesh.scale.fromArray(drawScale3D).multiply(mesh.meshScale).multiplyScalar(drawScale);
            mesh.position.z = mesh.meshOrigin.z + collisionHeight - mesh.meshOrigin.z * mesh.scale.z;
        }
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
        const animation = fishingAnimation || this.getMovementAnimation(state);

        if (state === "turning" && animation.toLowerCase() === "none") return;

        this.play(animation, tweenTime, this.getMovementRate(state, fishingAnimation));
    }

    protected getMovementAnimation(state: PawnMovementState_T): string {
        if (state !== "turning") return this.basicActorAnimations[state];

        const parent = this.getParent();
        const isRiding = parent.getUnrealScriptProperty("bRide");

        return (parent.getUnrealScriptProperty(isRiding ? "RiderWaitAnimName" : "TurnAnimName") as string[])[parent.getUnrealScriptProperty(isRiding ? "CurRideType" : "CurWeaponType") as number];
    }

    public getMovementRate(state: PawnMovementState_T, fishingAnimation: string): number {
        const parent = this.getParent();
        const isScaled = fishingAnimation || (state === "idle" || state === "turning" || state === "swimmingIdle" || state === "walking" || state === "running" || state === "swimming") && parent.scriptClassId;
        let rate = isScaled ? parent.getUnrealScriptProperty("NonAttackSpeedRate") as number : 1;

        if ((state === "walking" || state === "running") && parent.scriptClassId) {
            const rates = parent.getUnrealScriptProperty(state === "walking" ? "WalkAnimRate" : "RunAnimRate") as number[];
            const weaponRate = rates[parent.getUnrealScriptProperty("CurWeaponType") as number];

            if (weaponRate !== 0) rate *= weaponRate;
            if (parent.getUnrealScriptProperty("bNpc") && parent.npcMovementAnimationRate !== 0) rate *= parent.npcMovementAnimationRate;

            const groundSpeed = parent.getUnrealScriptProperty("GroundSpeed") as number;

            if (parent.getUnrealScriptProperty("Environment") === 1 && groundSpeed > 0) rate *= (parent.getUnrealScriptProperty("WaterSpeed") as number) / groundSpeed;
        }

        return rate;
    }

    public isPlayingMovement(state: PawnMovementState_T): boolean {
        const action = this.animationNotifyAction;

        const fishing = state === "idle" ? this.findComponent<PawnFishingComponent>("pawnFishing") : null;
        const fishingAnimation = fishing && fishing.getIdleAnimationName();
        const animation = this.getMovementAnimation(state);

        if (state === "turning" && animation.toLowerCase() === "none") return true;

        const clip = fishingAnimation ? this.getAnimationClip(fishingAnimation) : state === "turning" ? this.getAnimationClip(animation) : this.actorAnimations[animation];

        return !!action && action.enabled && action.isScheduled() && (action.getClip() === clip || cacheTweenTwins.get(clip)?.includes(action.getClip())) && (this.tweenTimeScales.get(action) ?? action.getEffectiveTimeScale()) === this.getMovementRate(state, fishingAnimation);
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
        if (this.findComponent<NpcLifecycleComponent>("npcLifecycle")?.isDead()) this.playDeath();
        else this.play(this.basicActorAnimations.idle, IDLE_TWEEN_TIME);
    }

    public playEnter(animationName: string): void {
        if (animationName && animationName.toLowerCase() !== "none") this.play(animationName, MOVEMENT_TWEEN_TIME, 1, false, true);
    }

    public playDeath(animationName: string = this.basicActorAnimations.dying, tweenTime: number = MOVEMENT_TWEEN_TIME, loop: boolean = false): void { this.play(animationName, tweenTime, 1, loop, true, true); }

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

    public play(animationName: string, tweenTime: number = MOVEMENT_TWEEN_TIME, rate: number = 1, loop: boolean = true, restart: boolean = false, isDeathAnimation: boolean = false): void {
        if (!this.isAnimationsInit) return;
        if (!isDeathAnimation && this.findComponent<NpcLifecycleComponent>("npcLifecycle")?.isDead()) return;

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
            const twins = cacheTweenTwins.get(clip);
            let nextAct = currAct && twins && twins.includes(currAct.getClip()) ? currAct : mixer.clipAction(clip, mesh);

            if (currAct === nextAct && tweenTime > 0 && (restart || nextAct.paused) && nextAct.isScheduled() && nextAct.enabled)
                nextAct = mixer.clipAction(getTweenTwin(nextAct.getClip(), mixer, mesh), mesh);
            else if (currAct !== nextAct && tweenTime > 0 && prevActs.includes(nextAct) && nextAct.isScheduled() && nextAct.enabled)
                nextAct = mixer.clipAction(getTweenTwin(nextAct.getClip(), mixer, mesh), mesh);

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

            nextAct.reset();
            nextAct.play();

            const fadingActs = prevActs.filter(action => action !== nextAct && fadeOutAction(action, tweenTime));

            if (currAct && fadeOutAction(currAct, tweenTime)) fadingActs.push(currAct);
            if (fadingActs.length > 0) nextAct.fadeIn(tweenTime);

            this.prevAnimations.set(mesh, fadingActs);

            // Engine.dll PlayAnim 0x943c41 / UpdateAnimation 0x94a549: tween before frame zero.
            if (tweenTime > 0) this.holdFirstFrame(nextAct, timeScale);
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
        for (const name of this.boneScalers.keys()) this.setBoneScale(name, 1);

        for (const mesh of this.meshes) {
            this.mixer.uncacheRoot(mesh);
            this.renderManager.releaseGeometry(mesh.geometry);
        }
        this.disposeSkeletons();
        this.renderManager.releaseTextures(this.meshTextures);

        this.meshes = [];
    }
}

type BoneScaler_T = { scale: number, bones: Map<Bone, Vector3> };
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
