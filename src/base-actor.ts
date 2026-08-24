import { AnimationAction, AnimationClip, Bone, Box3, LoopOnce, LoopRepeat, Mesh, Object3D, Quaternion, Sphere, Vector3 } from "three";
import RAPIER from "@dimforge/rapier3d";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "./objects/objects";
import RenderManager from "./rendering/render-manager";
import type { CheckResult_T, CollisionQuery_T } from "./physics/collision-world";
import { findVolumeTransition } from "./physics/volume-bsp";
import LocalSpaceSkeleton from "./objects/local-space-skeleton";
import UnScriptVM, { ScriptHost_T, ScriptNativeCall_T, ScriptValue_T, isScriptSlot } from "./ue-script/vm";
import Rotator from "./utils/rotator";

const tmpPosition = new Vector3();
const tmpWaterPosition = new Vector3();
const cacheOnceAnimations = new WeakMap<AnimationClip, AnimationClip>();
const tmpWaterEnd = new Vector3();
const tmpSwimStart = new Vector3();
const tmpBodyPosition = new Vector3();
const tmpMovement = new Vector3();
const tmpRemaining = new Vector3();
const tmpStepRemaining = new Vector3();
const tmpStepPosition = new Vector3();
const tmpStepUp = new Vector3();
const tmpDown = new Vector3();
const tmpAccelDir = new Vector3();
const tmpOldVelocity = new Vector3();
const tmpVelocityDelta = new Vector3();
const tmpNormal = new Vector3();
const tmpStepNormal = new Vector3();
const tmpDesiredDirection = new Vector3();
const tmpLedgeDelta = new Vector3();
const tmpLedgeEnd = new Vector3();
const tmpLedgeSide = new Vector3();
const tmpLedgeDir = new Vector3();
const tmpLedgeDrop = new Vector3();
const tmpTraceExtent = new Vector3();
const tmpGravityDirection = new Vector3();
const tmpVelocityDirection = new Vector3();
const tmpUp = new Vector3(0, 0, 1);
const tmpHairVelocity = new Vector3();
const tmpHairRotationX = new Quaternion();
const tmpHairRotationY = new Quaternion();
const tmpHairAxisX = new Vector3(1, 0, 0);
const tmpHairAxisY = new Vector3(0, 1, 0);
const tmpBasePosition = new Vector3();
const tmpBaseQuaternion = new Quaternion();
const tmpBaseInverseQuaternion = new Quaternion();
const tmpBaseDeltaQuaternion = new Quaternion();
const tmpBaseOffset = new Vector3();
const tmpWalkingStart = new Vector3();
const tmpWalkingSubStart = new Vector3();
const tmpDesiredMove = new Vector3();
const tmpRenderSphere = new Sphere();
const tmpRotator = new Rotator();
const colliderRotation = new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2);

const COLLISION_RADIUS = 7.5; // Live retail pawn APawn+752.
const COLLISION_HEIGHT = 23; // Live retail pawn APawn+756.
const WYVERN_COLLISION_RADIUS = 60; // Live retail wyvern; l2j-lisvus npc.sql agrees.
const WYVERN_COLLISION_HEIGHT = 80; // Live retail wyvern; l2j-lisvus npc.sql instead has 58.
const MAX_STEP_HEIGHT = 10; // EngineClasses.h UCONST_MAXSTEPHEIGHT; retail APawn::stepUp 0x8cf65f.
const FLOOR_CHECK_DISTANCE = MAX_STEP_HEIGHT + 2; // Retail APawn::physWalking 0x8d4b6f.
const MIN_FLOOR_DISTANCE = 1.9; // Engine/Inc/UnPhysic.h; retail APawn::physWalking 0x8d5482.
const MAX_FLOOR_DISTANCE = 2.4; // Engine/Inc/UnPhysic.h; retail APawn::physWalking 0x8d53d2.
const FLOOR_DISTANCE = 0.5 * (MIN_FLOOR_DISTANCE + MAX_FLOOR_DISTANCE);
const MIN_FLOOR_Z = 0.7; // EngineClasses.h UCONST_MINFLOORZ; retail APawn::physWalking 0x8d4df4.
const MAX_STEP_SIDE_Z = MIN_FLOOR_Z; // Retail APawn::stepUp 0x8cf6c1; leaked UnPhysic.h instead has 0.08.
const STEP_RECURSE_DIST_SQ = FLOOR_CHECK_DISTANCE * FLOOR_CHECK_DISTANCE; // Retail APawn::stepUp 0x8cfd2d.
const LEDGE_PROBE = 4; // Retail APawn::CheckForLedges 0x8ca895.
const LEDGE_DROP = MAX_STEP_HEIGHT + LEDGE_PROBE; // Retail APawn::CheckForLedges 0x8cac56.
const GROUND_SPEED = 120; // l2j-lisvus classTemplates.xml Archmage baseRunSpd; retail APawn+5224 is the packet base times its movement multiplier.
const WALK_SPEED = GROUND_SPEED * 78 / 120; // l2j-lisvus classTemplates.xml Archmage baseWalkSpd/run ratio.
const WATER_SPEED = GROUND_SPEED * 50 / 120; // l2j-lisvus PcStat unmounted swimming base/run ratio.
const AIR_SPEED = 118.09999084472656; // Live retail wyvern APawn+5232.
const ACCEL_RATE = 2048; // Live retail player APawn+5240; Engine.u Pawn default.
const DEFAULT_VOLUME_GRAVITY_Z = -1500; // Engine.u PhysicsVolume default Gravity.Z.
const YAW_RATE = 65000; // Live retail FMagic RotationRate.Yaw.
const PLAYER_YAW_RATE = 45000 * 2; // Live Controller.EnemyTurnSpeed; APawn::physicsRotation doubles it.
const SPAWN_FLOOR_PROBE = 1000;
const DEFAULT_VOLUME_TERMINAL_VELOCITY = 2500; // Engine.u PhysicsVolume default TerminalVelocity.
const WATERLINE_DEPTH = 13; // Retail APawn::findWaterLine 0x8d2959.
const MOVEMENT_TWEEN_TIME = 0.1; // LineageWarrior.u retains this in the disabled LineagePawn walking/running blend calls.
const IDLE_TWEEN_TIME = MOVEMENT_TWEEN_TIME * 2; // LineageWarrior.u LineagePawn AnimateStanding uses 0.2.
const HAIR_STEP = 1 / 60; // Local fixed step; retail DynamicHairGetFrame 0x94f010 only supplies bone coordinates.
const HAIR_SPRING = 32;
const HAIR_DAMPING = 8;
const HAIR_MAX_ANGLE = 0.24;
const BLINK_U_MIN = 0.1;
const BLINK_U_MAX = 0.47;
const BLINK_V_MIN = 0.18;
const BLINK_V_MAX = 0.33;
const BLINK_CREASE_V = 0.265;
const BLINK_CENTERLINE_CUTOFF = 0.07;
const BLINK_CLOSE_TIME = 0.08;
const BLINK_HOLD_TIME = 0.06;
const BLINK_OPEN_TIME = 0.12;
// APawn::SpawnEnterEvent (0x8b47e0): rise moves 5/9 of its full offset per second.
const ENTER_RISE_RATE = 5 / 9;
// APawn::SpawnEnterEvent (0x8b490a): AEmitter::SetSizeScale(CollisionRadius * 0.1).
const ENTER_EFFECT_RADIUS_SCALE = 0.1;

type AnimationNotifyHandler_T = (actor: BaseActor, notify: GD.IAnimationNotifyDecodeInfo) => void;

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
    cacheOnceAnimations.set(clip, once);

    return once;
}

function setScriptObjectProperty(object: Object3D, field: string, value: ScriptValue_T): void {
    const properties = (object as any).scriptProperties as Map<string, ScriptValue_T>;

    if (!properties) return;

    for (const key of properties.keys())
        if (key.slice(key.lastIndexOf(".") + 1).toLowerCase() === field.toLowerCase()) {
            properties.set(key, value);
            return;
        }

    properties.set(field, value);
}

type ScriptObjectFactory_T = (classId: string) => ScriptHost_T;

class BaseActor extends Object3D implements ICollidable {
    public readonly isActor = true;
    declare public readonly isCollidable: boolean;
    public readonly type: string = "Actor";
    public scriptClassId: string = null;
    public scriptProperties: Map<string, ScriptValue_T> = null;

    protected collider: RAPIER.Collider = null;
    protected rigidbody: RAPIER.RigidBody = null;
    protected readonly velocity = new Vector3();
    protected readonly acceleration = new Vector3();
    protected readonly floor = new Vector3(0, 0, 1);
    protected collisionRadius = COLLISION_RADIUS;
    protected collisionHeight = COLLISION_HEIGHT;
    protected readonly analyticalCenter = new Vector3();
    protected readonly analyticalBounds = new Box3();
    protected readonly analyticalOrigin = new Vector3(NaN, NaN, NaN);
    protected readonly renderSphereLocal = new Sphere();
    protected readonly renderSphereWorld = new Sphere();
    protected readonly collisionProfile: ActorCollisionProfile_T = {
        collideActors: true,
        collideWorld: true,
        blockActors: true,
        blockPlayers: true,
        blockZeroExtent: true,
        blockNonZeroExtent: true,
        worldGeometry: false,
        useCylinderCollision: true,
        collisionRadius: COLLISION_RADIUS,
        collisionHeight: COLLISION_HEIGHT,
        isPawn: true
    };
    protected readonly analyticalPrimitive: CollisionPrimitive_T = { kind: "cylinder", center: this.analyticalCenter, radius: this.collisionRadius, halfHeight: this.collisionHeight, bounds: this.analyticalBounds, supportsZeroExtent: true, supportsNonZeroExtent: true, supportsPointCheck: true };
    protected rotationYaw = 0;
    protected desiredRotationYaw = 0;
    protected hasDesiredRotation = false;
    protected isGrounded = false;
    protected hasStartedPhysics = false;
    protected physicsMode: PhysicsMode_T = "falling";
    protected isWalking = false;
    protected airSpeed = AIR_SPEED;
    protected waterVolume: GD.IWaterVolumeDecodeInfo = null;
    protected base: (ICollidable & Object3D) = null;
    protected readonly basedActors = new Set<ICollidable>();
    protected readonly basePosition = new Vector3();
    protected readonly baseQuaternion = new Quaternion();
    protected readonly baseRelativePosition = new Vector3();
    protected renderManager: RenderManager;
    protected meshes: Mesh[] = [];
    protected currAnimations = new WeakMap<Mesh, AnimationAction>();
    protected prevAnimations = new WeakMap<Mesh, AnimationAction>();
    protected actorAnimations: Record<string, AnimationClip> = {};
    protected animationNotifyAction: AnimationAction = null;
    protected animationNotifyTime = 0;
    protected animationNotifyHandler: AnimationNotifyHandler_T = null;
    protected deathAnimationFinishedHandler: ((actor: BaseActor) => void) = null;
    protected isDying = false;
    protected isAnimationsInit = false;
    protected hairStepTime = 0;
    protected readonly hairChains: HairChainState_T[] = [];
    protected blinkStartTime = -Infinity;
    protected blinkNextTime = 0;
    protected blinkIndex = 0;
    protected readonly blinkFaces: BlinkFaceState_T[] = [];
    protected readonly ignoredActors = new Set<ICollidable>();
    protected readonly visitedBases = new Set<ICollidable>();
    protected readonly collisionQuery: CollisionQuery_T = { location: null, delta: null, extent: null, sourceIsPlayer: false };
    protected readonly actorState = new ActorState();
    protected readonly basicActorAnimations: BasicActorAnimations_T = {
        idle: null,
        walking: null,
        running: null,
        dying: null,
        falling: null,
        swimming: null,
        swimmingIdle: null
    };
    protected scriptVM: UnScriptVM = null;
    protected scriptObjectFactory: ScriptObjectFactory_T = null;
    protected hasBegunPlay = false;
    protected isScriptTicking = false;
    protected isScriptDestroyed = false;
    protected enterRiseTargetZ: number = null;
    protected enterRiseVelocity = 0;
    protected readonly scriptDeathController: ScriptHost_T = { scriptClassId: "Engine.Controller", scriptProperties: new Map([["bDead", true]]) };

    public constructor(renderManager: RenderManager) {
        super();

        (this as any).isCollidable = true;

        this.renderManager = renderManager;
        this.up.copy(tmpUp);
    }

    public setScriptRuntime(vm: UnScriptVM, classId: string, objectFactory: ScriptObjectFactory_T): void {
        this.scriptVM = vm;
        this.scriptClassId = classId;
        this.scriptProperties = new Map();
        this.scriptObjectFactory = objectFactory;
        this.scriptVM.initializeHost(this);
        this.isScriptTicking = this.scriptVM.hasScriptFunction(classId, "Tick") && this.scriptVM.findFunction(classId, "Tick").program.entries.length > 2;
    }

    public beginPlay(): void {
        if (this.hasBegunPlay || !this.scriptVM) return;

        this.hasBegunPlay = true;
        this.scriptVM.call(this, "PostBeginPlay");
    }

    public resolveUnrealObject(id: string): string { return id; }

    public getUnrealScriptProperty(id: string): ScriptValue_T {
        const name = id.slice(id.lastIndexOf(".") + 1).toLowerCase();

        switch (name) {
            case "location": return [this.position.x, this.position.y, this.position.z];
            case "velocity": return [this.velocity.x, this.velocity.y, this.velocity.z];
            case "acceleration": return [this.acceleration.x, this.acceleration.y, this.acceleration.z];
            case "collisionradius": return this.collisionRadius;
            case "collisionheight": return this.collisionHeight;
            case "biswalking": return this.isWalking;
            case "physics": return ["none", "walking", "falling", "swimming", "flying"].indexOf(this.physicsMode);
        }

        return this.getStoredUnrealScriptProperty(id);
    }

    protected getStoredUnrealScriptProperty(id: string): ScriptValue_T {
        const name = id.slice(id.lastIndexOf(".") + 1).toLowerCase();
        const properties = this.scriptProperties;

        if (!properties) return null;
        if (properties.has(id)) return properties.get(id);

        for (const [key, value] of properties)
            if (key.slice(key.lastIndexOf(".") + 1).toLowerCase() === name) return value;

        return null;
    }

    public setUnrealScriptProperty(id: string, value: ScriptValue_T): void {
        const field = id.slice(id.lastIndexOf(".") + 1);

        switch (field.toLowerCase()) {
            case "location": this.position.fromArray(value as GD.Vector3Arr); return;
            case "velocity": this.velocity.fromArray(value as GD.Vector3Arr); return;
            case "acceleration": this.acceleration.fromArray(value as GD.Vector3Arr); return;
            case "collisionradius": this.collisionRadius = Number(value); return;
            case "collisionheight": this.collisionHeight = Number(value); return;
            case "biswalking": this.isWalking = !!value; return;
            case "physics": {
                const modes: PhysicsMode_T[] = ["none", "walking", "falling", "swimming", "flying"];
                const mode = modes[Number(value)];

                if (!mode) throw new Error(`Unsupported UnrealScript physics mode '${value}'.`);

                this.physicsMode = mode;
                return;
            }
        }

        if (!this.scriptProperties) throw new Error(`${this.type} has no UnrealScript property storage.`);

        for (const key of this.scriptProperties.keys())
            if (key.slice(key.lastIndexOf(".") + 1).toLowerCase() === field.toLowerCase()) {
                this.scriptProperties.set(key, value);
                return;
            }

        this.scriptProperties.set(field, value);
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        const context = call.context as any;
        const name = call.name.toLowerCase();

        if (call.index === 259 || call.index === 260 || name === "playanim" || name === "loopanim") {
            const sequence = call.args[0] as string;
            const rate = call.args.length > 1 ? Number(call.args[1]) : 1;
            const tweenTime = call.args.length > 2 ? Number(call.args[2]) : 0;
            const channel = call.args.length > 3 ? Number(call.args[3]) : 0;
            const loop = call.index === 260 || name === "loopanim";

            if (channel !== 0) throw new Error(`UnrealScript ${call.name} channel '${channel}' is not implemented for '${context.scriptClassId}'.`);
            if (sequence === "None") return undefined;

            context.playAnimation(sequence, tweenTime, rate, loop, true);
            return undefined;
        }

        if (call.index === 282 || name === "isanimating") {
            const channel = call.args.length > 0 ? Number(call.args[0]) : 0;

            if (channel !== 0) throw new Error(`UnrealScript IsAnimating channel '${channel}' is not implemented for '${context.scriptClassId}'.`);

            return !!context.animationNotifyAction && context.animationNotifyAction.isRunning();
        }

        if (call.index === 0 && name === "getanimparams") {
            const channel = Number(call.args[0]);
            const outName = call.args[1], outFrame = call.args[2], outRate = call.args[3];

            if (channel !== 0) throw new Error(`UnrealScript GetAnimParams channel '${channel}' is not implemented for '${context.scriptClassId}'.`);
            if (!isScriptSlot(outName) || !isScriptSlot(outFrame) || !isScriptSlot(outRate)) throw new Error("UnrealScript GetAnimParams requires out parameters.");

            const action = context.animationNotifyAction as AnimationAction;
            const duration = action ? action.getClip().duration : 0;

            outName.set(action ? action.getClip().name : "None");
            outFrame.set(action && duration > 0 ? action.time / duration : 0);
            outRate.set(action ? action.getEffectiveTimeScale() : 0);
            return undefined;
        }

        if (call.index === 278 || name === "spawn") {
            if (!this.scriptObjectFactory) throw new Error(`${this.type} cannot spawn script object '${call.args[0]}'.`);

            const object = this.scriptObjectFactory(call.args[0] as string);

            if ((object as any).isObject3D) {
                const actor = object as unknown as Object3D;
                const location = call.args[3];
                const rotation = call.args[4];

                if (Array.isArray(location)) actor.position.fromArray(location as GD.Vector3Arr);
                else if (context.isObject3D) context.getWorldPosition(actor.position);
                else this.getWorldPosition(actor.position);

                if (Array.isArray(rotation)) {
                    const [pitch, yaw, roll] = rotation as GD.Vector3Arr;

                    tmpRotator.set(pitch, yaw, roll).toQuaternion(actor.quaternion);
                }

                const owner = call.args[1] as any;

                this.renderManager.addTransientEffect(actor, owner && owner.isActor ? owner : null);
            }

            return object;
        }

        if (call.index === 279 || name === "destroy" || name === "ndestroy") {
            if (!context.isObject3D) throw new Error(`'${context.scriptClassId}' cannot be destroyed as an actor.`);

            this.renderManager.removeTransientEffect(context as Object3D);
            return true;
        }

        if (call.index === 3970 || name === "setphysics") {
            if (typeof context.setUnrealScriptProperty === "function") context.setUnrealScriptProperty("Physics", call.args[0]);
            else if (context.scriptProperties instanceof Map) context.scriptProperties.set("Physics", call.args[0]);
            else throw new Error(`'${context.scriptClassId}' has no physics mode.`);

            return undefined;
        }

        if (call.index === 298 || name === "setbase") {
            const base = call.args[0] as any;

            if (typeof context.setBase === "function") context.setBase(base);
            else {
                if (!context.isObject3D) throw new Error(`'${context.scriptClassId}' cannot be based.`);
                if (base && !base.isObject3D) throw new Error(`'${context.scriptClassId}' cannot use '${base}' as a base.`);

                (base || this.renderManager.scene).attach(context);
                if (context.scriptProperties instanceof Map) context.scriptProperties.set("Base", base);
            }

            return undefined;
        }

        switch (name) {
            case "attachtobone": {
                if (typeof context.attachObjectToBone !== "function") throw new Error(`'${context.scriptClassId}' cannot attach an object to a bone.`);

                return context.attachObjectToBone(call.args[0] as unknown as Object3D, call.args[1] as string);
            }
            case "attachtobonewithindex": {
                if (typeof context.attachObjectToBone !== "function") throw new Error(`'${context.scriptClassId}' cannot attach an object to a bone.`);

                return context.attachObjectToBone(call.args[0] as unknown as Object3D, Number(call.args[1]));
            }
            case "detachfrombone": {
                if (typeof context.detachBoneObject !== "function") throw new Error(`'${context.scriptClassId}' cannot detach an object from a bone.`);

                return context.detachBoneObject(call.args[0] as unknown as Object3D);
            }
            case "setrelativelocation": {
                if (!context.isObject3D) throw new Error(`'${context.scriptClassId}' has no relative location.`);

                context.position.fromArray(call.args[0] as GD.Vector3Arr);
                return true;
            }
            case "setrelativerotation": {
                if (!context.isObject3D) throw new Error(`'${context.scriptClassId}' has no relative rotation.`);

                const [pitch, yaw, roll] = call.args[0] as GD.Vector3Arr;

                tmpRotator.set(pitch, yaw, roll).toQuaternion(context.quaternion);
                return true;
            }
            default: throw new Error(`UnrealScript native '${call.name}' (${call.index}) is not implemented for '${context.scriptClassId}'.`);
        }
    }

    public getCollisionRadius() { return this.collisionRadius; }
    public getCollisionHeight() { return this.collisionHeight; }
    public getCollider(): RAPIER.Collider { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }
    public getBaseActor(): ICollidable | null { return this.base; }
    public getBasedActors(): ReadonlySet<ICollidable> { return this.basedActors; }
    public addBasedActor(actor: ICollidable) { this.basedActors.add(actor); }
    public removeBasedActor(actor: ICollidable) { this.basedActors.delete(actor); }
    public isInteractive(): boolean { return this.renderManager.isSectorCollisionReady(this.position); }
    public getCollisionProfile(): ActorCollisionProfile_T {
        this.collisionProfile.collideActors = this.isInteractive();
        this.collisionProfile.collisionRadius = this.collisionRadius;
        this.collisionProfile.collisionHeight = this.collisionHeight;

        return this.collisionProfile;
    }

    public getCollisionPrimitive(): CollisionPrimitive_T {
        // Caching avoids an n^2 getWorldPosition chain walk across pawn traces.
        if (this.analyticalOrigin.equals(this.position)) return this.analyticalPrimitive;

        this.analyticalOrigin.copy(this.position);
        this.getWorldPosition(this.analyticalCenter);
        this.analyticalCenter.z += this.collisionHeight;
        this.analyticalBounds.min.set(this.analyticalCenter.x - this.collisionRadius, this.analyticalCenter.y - this.collisionRadius, this.analyticalCenter.z - this.collisionHeight);
        this.analyticalBounds.max.set(this.analyticalCenter.x + this.collisionRadius, this.analyticalCenter.y + this.collisionRadius, this.analyticalCenter.z + this.collisionHeight);
        this.analyticalPrimitive.radius = this.collisionRadius;
        this.analyticalPrimitive.halfHeight = this.collisionHeight;

        return this.analyticalPrimitive;
    }

    public createCollider(physicsWorld: RAPIER.World): RAPIER.Collider {
        if (this.collider) return this.collider;

        const rigidbodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.position.x, this.position.y, this.position.z + this.collisionHeight);
        const colliderDesc = RAPIER.ColliderDesc.cylinder(this.collisionHeight, this.collisionRadius).setRotation(colliderRotation);

        this.rigidbody = physicsWorld.createRigidBody(rigidbodyDesc);
        this.collider = physicsWorld.createCollider(colliderDesc, this.rigidbody);

        return this.collider;
    }

    public updatePhysics(currentTime: number, deltaTime: number) {
        if (this.enterRiseTargetZ !== null) {
            this.updateEnterRise(deltaTime);
            return;
        }

        const isInteractive = this.isInteractive();

        this.collisionProfile.collideActors = isInteractive;

        if (!this.rigidbody || !isInteractive) return;

        this.renderManager.collisionWorld.updateDynamicEntries(currentTime);

        let remainingTime = Math.min(deltaTime, 0.4);
        let iteration = 0;

        while (remainingTime > 0 && iteration++ < 8) {
            const tick = this.hasStartedPhysics && this.physicsMode === "walking" ? remainingTime : remainingTime <= 0.05 ? remainingTime : Math.min(0.05, remainingTime * 0.5);

            remainingTime -= tick;
            this.tickPhysics(tick);
        }

        this.rigidbody.setNextKinematicTranslation(tmpBodyPosition.set(this.position.x, this.position.y, this.position.z + this.collisionHeight));
        this.checkAnimationState();
    }

    public updatePresentation(currentTime: number, deltaTime: number) {
        if (this.hasBegunPlay && this.isScriptTicking) this.scriptVM.call(this, "Tick", [deltaTime]);
        this.updateAnimationNotifies();
        this.updateHair(currentTime * 0.001, deltaTime);
        this.updateBlink(currentTime * 0.001);
    }

    protected updateAnimationNotifies() {
        const action = this.animationNotifyAction;

        if (!action) return;

        const oldTime = this.animationNotifyTime;
        const time = action.time;

        this.animationNotifyTime = time;

        if (!this.animationNotifyHandler || time === oldTime) return;

        const duration = action.getClip().duration;
        const notifications = (action.getClip() as any).animationNotifies as GD.IAnimationNotifyDecodeInfo[];

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

            if (crossed) this.animationNotifyHandler(this, notify);
        }
    }

    public update(_renderManager: RenderManager, currentTime: number, deltaTime: number) {
        this.updatePhysics(currentTime, deltaTime);
        this.updatePresentation(currentTime, deltaTime);
    }

    protected updateEnterRise(deltaTime: number): void {
        const targetZ = this.enterRiseTargetZ;
        const nextZ = this.position.z + this.enterRiseVelocity * deltaTime;

        if ((this.enterRiseVelocity >= 0 && nextZ >= targetZ) || (this.enterRiseVelocity < 0 && nextZ <= targetZ)) {
            this.position.z = targetZ;
            this.enterRiseTargetZ = null;
            this.enterRiseVelocity = 0;
        } else this.position.z = nextZ;

        if (this.rigidbody) this.rigidbody.setNextKinematicTranslation(tmpBodyPosition.set(this.position.x, this.position.y, this.position.z + this.collisionHeight));
    }

    // UE ignores a blocking actor you spawned inside of until you are no longer intersecting it
    protected updateIgnoredActors(position: Vector3) {
        if (this.ignoredActors.size === 0) return;

        for (const actor of this.ignoredActors)
            if (!this.isOverlapping(actor, position)) this.ignoredActors.delete(actor);
    }

    protected isOverlapping(actor: ICollidable, position: Vector3): boolean {
        const primitive = actor.getCollisionPrimitive ? actor.getCollisionPrimitive() : null;

        if (!primitive || primitive.kind !== "cylinder") return false;

        const dx = primitive.center.x - position.x;
        const dy = primitive.center.y - position.y;
        const dz = primitive.center.z - (position.z + this.collisionHeight);
        const radius = primitive.radius + this.collisionRadius;

        return dx * dx + dy * dy < radius * radius && Math.abs(dz) < primitive.halfHeight + this.collisionHeight;
    }

    public ignoreOverlappingActors(actors: Iterable<ICollidable>) {
        for (const actor of actors)
            if (actor !== (this as any) && this.isOverlapping(actor, this.position)) this.ignoredActors.add(actor);
    }

    public moveSmooth(movement: Vector3, ignoredActor?: ICollidable) {
        if (!this.isInteractive()) return;

        const position = tmpPosition.copy(this.position);
        const wasIgnored = ignoredActor && this.ignoredActors.has(ignoredActor);

        if (ignoredActor) this.ignoredActors.add(ignoredActor);
        this.moveWithWallResponse(position, movement);
        if (ignoredActor && !wasIgnored) this.ignoredActors.delete(ignoredActor);

        this.position.copy(position);
    }

    protected tickPhysics(deltaTime: number) {
        const desired = this.actorState.desired;
        const position = tmpPosition.copy(this.position);

        this.updateBaseMovement(position);
        this.updateIgnoredActors(position);
        const waterVolume = this.getWaterVolume(position);

        if (!this.hasStartedPhysics) {
            if (waterVolume) {
                this.hasStartedPhysics = true;
                this.physicsMode = "swimming";
            } else {
                const floorMovement = tmpMovement.set(0, 0, -SPAWN_FLOOR_PROBE);
                const floorHit = this.findFloor(position, floorMovement);

                this.hasStartedPhysics = true;
                this.isGrounded = false;
                this.physicsMode = "falling";

                if (floorHit) {
                    this.getHitNormal(floorHit, tmpNormal);

                    if (tmpNormal.z >= MIN_FLOOR_Z) {
                        position.addScaledVector(floorMovement, floorHit.time).addScaledVector(tmpUp, FLOOR_DISTANCE);
                        this.isGrounded = true;
                        this.physicsMode = "walking";
                        this.setBase(floorHit.actor, tmpNormal);
                    }
                }
            }
        }

        if (desired.actor) {
            desired.actor.getWorldPosition(desired.position);
            desired.swimToDepth = !!this.getWaterVolumeAt(desired.position);
        }

        const distanceX = desired.position.x - position.x;
        const distanceY = desired.position.y - position.y;
        const isThreeDimensional = this.physicsMode === "flying" || this.physicsMode === "swimming" && desired.swimToDepth;
        const distanceZ = isThreeDimensional ? desired.position.z - position.z : 0;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ);
        const maxSpeed = this.physicsMode === "swimming" ? WATER_SPEED : this.physicsMode === "flying" ? this.airSpeed : this.isWalking ? WALK_SPEED : GROUND_SPEED;

        const willReachDestination = this.actorState.locomotion && Math.max(0, distance - desired.offset) <= maxSpeed * deltaTime;

        if (this.actorState.locomotion) {
            this.acceleration.set(distanceX, distanceY, distanceZ).normalize().multiplyScalar(ACCEL_RATE);

            if (desired.faceTarget) {
                desired.faceTarget.getWorldPosition(tmpMovement);
                this.setDesiredHeading(tmpMovement.x - position.x, tmpMovement.y - position.y);
            } else if (desired.faceMovement) this.setDesiredHeading(distanceX, distanceY);
        } else {
            this.acceleration.set(0, 0, 0);
        }

        if (this.physicsMode === "walking" && waterVolume) this.physicsMode = "swimming";

        switch (this.physicsMode) {
            case "none": this.velocity.set(0, 0, 0); break;
            case "walking": this.physWalking(position, deltaTime); break;
            case "falling": this.physFalling(position, deltaTime); break;
            case "swimming": this.physSwimming(position, deltaTime, waterVolume); break;
            case "flying": this.physFlying(position, deltaTime); break;
            default: throw new Error(`Unknown player physics mode '${this.physicsMode}'.`);
        }

        if (willReachDestination) {
            const dx = desired.position.x - position.x;
            const dy = desired.position.y - position.y;
            const dz = isThreeDimensional ? desired.position.z - position.z : 0;

            if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= desired.offset + 0.01)
                this.actorState.locomotion = false;
        }

        this.physicsRotation(deltaTime);

        this.position.copy(position);
        this.updateBaseRelativePosition();
        this.waterVolume = this.getWaterVolume(position);
    }

    protected calcVelocity(position: Vector3, accelDir: Vector3, deltaTime: number, maxSpeed: number) {
        if (this.acceleration.lengthSq() === 0) {
            this.velocity.set(0, 0, 0);
            return;
        }

        const dx = this.actorState.desired.position.x - position.x;
        const dy = this.actorState.desired.position.y - position.y;
        const dz = this.physicsMode === "flying" || this.physicsMode === "swimming" && this.actorState.desired.swimToDepth ? this.actorState.desired.position.z - position.z : 0;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) - this.actorState.desired.offset;
        const speed = Math.min(maxSpeed, Math.max(0, distance / deltaTime));

        this.velocity.copy(accelDir).multiplyScalar(speed);
    }

    protected updateBaseMovement(position: Vector3) {
        if (!this.base) return;

        this.base.getWorldPosition(tmpBasePosition);
        this.base.getWorldQuaternion(tmpBaseQuaternion);

        if (tmpBasePosition.equals(this.basePosition) && tmpBaseQuaternion.equals(this.baseQuaternion)) return;

        tmpBaseInverseQuaternion.copy(this.baseQuaternion).invert();
        tmpBaseOffset.copy(position).sub(this.basePosition).applyQuaternion(tmpBaseInverseQuaternion).applyQuaternion(tmpBaseQuaternion).add(tmpBasePosition);
        tmpMovement.copy(tmpBaseOffset).sub(position);

        const wasIgnored = this.ignoredActors.has(this.base);

        this.ignoredActors.add(this.base);
        const hit = this.moveActor(position, tmpMovement);
        if (!wasIgnored) this.ignoredActors.delete(this.base);

        if (hit) {
            this.setBase(null);
            return;
        }

        tmpBaseDeltaQuaternion.copy(tmpBaseQuaternion).multiply(tmpBaseInverseQuaternion);

        const yaw = Math.atan2(2 * (tmpBaseDeltaQuaternion.w * tmpBaseDeltaQuaternion.z + tmpBaseDeltaQuaternion.x * tmpBaseDeltaQuaternion.y), 1 - 2 * (tmpBaseDeltaQuaternion.y * tmpBaseDeltaQuaternion.y + tmpBaseDeltaQuaternion.z * tmpBaseDeltaQuaternion.z));

        this.rotationYaw = (this.rotationYaw + Math.round(yaw * 32768 / Math.PI)) & 65535;
        this.rotation.set(0, 0, this.rotationYaw * Math.PI / 32768 - Math.PI / 2);
        this.basePosition.copy(tmpBasePosition);
        this.baseQuaternion.copy(tmpBaseQuaternion);
    }

    protected setBase(actor: ICollidable | null, floor?: Vector3) {
        const base = actor as ICollidable & Object3D;

        if (floor) this.floor.copy(floor);
        if (base === this.base) return;

        this.visitedBases.clear();

        for (let current = base; current; current = current.getBaseActor ? current.getBaseActor() as ICollidable & Object3D : null) {
            if (current === this || this.visitedBases.has(current)) return;

            this.visitedBases.add(current);
        }

        if (this.base && this.base.removeBasedActor) this.base.removeBasedActor(this);

        this.base = base;

        if (!base) return;

        if (base.addBasedActor) base.addBasedActor(this);

        base.getWorldPosition(this.basePosition);
        base.getWorldQuaternion(this.baseQuaternion);
        this.updateBaseRelativePosition();
    }

    protected updateBaseRelativePosition() {
        if (!this.base) return;

        this.base.getWorldPosition(tmpBasePosition);
        this.base.getWorldQuaternion(tmpBaseQuaternion);
        tmpBaseInverseQuaternion.copy(tmpBaseQuaternion).invert();
        this.baseRelativePosition.copy(this.position).sub(tmpBasePosition).applyQuaternion(tmpBaseInverseQuaternion);
    }

    protected physWalking(position: Vector3, deltaTime: number, iterations: number = 0) {
        this.velocity.z = 0;
        this.acceleration.z = 0;

        tmpAccelDir.copy(this.acceleration);

        if (tmpAccelDir.lengthSq() > 0) tmpAccelDir.normalize();

        this.calcVelocity(position, tmpAccelDir, deltaTime, this.isWalking ? WALK_SPEED : GROUND_SPEED);
        tmpDesiredMove.copy(this.velocity);
        tmpDesiredMove.z = 0;
        tmpWalkingStart.copy(position);

        let remainingTime = deltaTime;

        while (remainingTime > 0 && iterations++ < 8) {
            const timeTick = (this as any).isPlayer && remainingTime > 0.05 ? Math.min(0.05, remainingTime * 0.5) : remainingTime;

            remainingTime -= timeTick;
            tmpMovement.copy(tmpDesiredMove).multiplyScalar(timeTick);
            tmpWalkingSubStart.copy(position);

            const deltaX = tmpMovement.x;
            const deltaY = tmpMovement.y;
            const desiredDistance = tmpMovement.length();

            if (desiredDistance > 0) this.moveWalking(position, tmpMovement);
            else remainingTime = 0;

            const floorMovement = tmpMovement.set(0, 0, -FLOOR_CHECK_DISTANCE);
            const floorHit = this.castShape(position, floorMovement);

            if (floorHit) {
                this.getHitNormal(floorHit, tmpNormal);

                if (tmpNormal.z >= MIN_FLOOR_Z) {
                    const floorDistance = floorHit.time * FLOOR_CHECK_DISTANCE;

                    if (floorDistance > MAX_FLOOR_DISTANCE)
                        this.moveSwept(position, tmpDown.set(0, 0, -(floorDistance - FLOOR_DISTANCE)));
                    else if (floorDistance > 0 && floorDistance < MIN_FLOOR_DISTANCE)
                        this.moveSwept(position, tmpStepUp.set(0, 0, FLOOR_DISTANCE - floorDistance));

                    this.setBase(floorHit.actor, tmpNormal);
                    continue;
                }

                if (deltaX * tmpNormal.x + deltaY * tmpNormal.y < 0) {
                    tmpStepUp.copy(tmpUp).multiplyScalar(MAX_STEP_HEIGHT).addScaledVector(tmpNormal, -MAX_STEP_HEIGHT * tmpNormal.z).multiplyScalar(-1);

                    const slopeHit = this.moveSwept(position, tmpStepUp);

                    if (slopeHit) {
                        this.getHitNormal(slopeHit, tmpNormal);

                        if (tmpNormal.z >= MIN_FLOOR_Z) {
                            this.setBase(slopeHit.actor, tmpNormal);
                            continue;
                        }
                    }
                }
            }

            const actualX = position.x - tmpWalkingSubStart.x;
            const actualY = position.y - tmpWalkingSubStart.y;
            const actualDistance = Math.sqrt(actualX * actualX + actualY * actualY);

            if (desiredDistance > 0) remainingTime += timeTick * (1 - Math.min(1, actualDistance / desiredDistance));

            this.setBase(null);
            this.isGrounded = false;
            this.physicsMode = "falling";
            this.velocity.z = 0;
            this.physFalling(position, remainingTime, iterations);
            return;
        }

        this.velocity.copy(position).sub(tmpWalkingStart).multiplyScalar(1 / deltaTime);
        this.velocity.z = 0;
    }

    protected moveWalking(position: Vector3, movement: Vector3) {
        const hit = this.moveActor(position, movement);

        if (!hit) return;

        tmpDesiredDirection.copy(movement);

        if (tmpDesiredDirection.lengthSq() > 0) tmpDesiredDirection.normalize();

        tmpRemaining.copy(movement).multiplyScalar(1 - hit.time);
        this.stepUp(position, tmpDesiredDirection, tmpRemaining, hit);
    }

    protected moveSwept(position: Vector3, movement: Vector3): CheckResult_T | null {
        return this.moveActor(position, movement);
    }

    protected traceExtent(start: Vector3, movement: Vector3, radius: number, height: number): CheckResult_T | null {
        const query = this.collisionQuery;

        query.location = tmpBodyPosition.copy(start).addScaledVector(tmpUp, this.collisionHeight);
        query.delta = movement;
        query.extent = tmpTraceExtent.set(radius, radius, height);
        query.sourceCollider = this.collider;
        query.sourceBody = this.rigidbody;
        query.sourceActor = this;
        query.sourceIsPlayer = !!(this as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
        query.zeroExtent = false;

        return this.renderManager.collisionWorld.singleLineCheck(query);
    }

    // APawn::CheckForLedges 0x8ca7f0; StopAtLedge is false and WantsLedgeCheck had zero hits over 5111 ticks.
    protected checkForLedges(position: Vector3, accelDir: Vector3, movement: Vector3) {
        const radius = this.collisionRadius;
        const height = this.collisionHeight;

        if (!this.traceExtent(position, tmpLedgeDelta.set(0, 0, -LEDGE_PROBE), radius, height)) return;

        const distance = movement.length();

        tmpLedgeEnd.copy(position).add(movement).addScaledVector(accelDir, radius);

        if (this.traceExtent(position, tmpLedgeDelta.copy(tmpLedgeEnd).sub(position), 0, 0)) return;

        const dropDistance = Math.max(MAX_STEP_HEIGHT, distance + radius) + height + LEDGE_PROBE;
        const dropHit = this.traceExtent(tmpLedgeEnd, tmpLedgeDelta.set(0, 0, -dropDistance), 0, 0);

        tmpLedgeEnd.copy(position).add(movement);

        if (dropHit && dropHit.normal.z >= MIN_FLOOR_Z) {
            const slope = Math.min(MAX_STEP_HEIGHT, (distance + radius) * Math.sqrt(1 - dropHit.normal.z * dropHit.normal.z) / dropHit.normal.z);

            if (height + LEDGE_PROBE + slope >= dropDistance * dropHit.time) return;
        }

        if (this.traceExtent(position, tmpLedgeDelta.copy(tmpLedgeEnd).sub(position), radius, height)) return;

        const floorHit = this.traceExtent(tmpLedgeEnd, tmpLedgeDelta.set(0, 0, -LEDGE_DROP), radius, height);

        if (floorHit && floorHit.normal.z >= MIN_FLOOR_Z) return;

        tmpLedgeDir.copy(tmpLedgeEnd).sub(position);

        if (tmpLedgeDir.lengthSq() > 0) tmpLedgeDir.normalize();

        tmpLedgeSide.set(tmpLedgeDir.y, -tmpLedgeDir.x, 0).multiplyScalar(distance);

        if (this.findLedgeDetour(position, tmpLedgeEnd, tmpLedgeSide, movement, distance)) return;

        tmpLedgeSide.multiplyScalar(-1);
        this.findLedgeDetour(position, tmpLedgeEnd, tmpLedgeSide, movement, distance);
    }

    protected findLedgeDetour(position: Vector3, ledgeEnd: Vector3, side: Vector3, movement: Vector3, distance: number): boolean {
        const radius = this.collisionRadius;
        const height = this.collisionHeight;

        if (this.traceExtent(ledgeEnd, side, radius, height)) return false;

        tmpLedgeDelta.copy(ledgeEnd).add(side);

        const floorHit = this.traceExtent(tmpLedgeDelta, tmpLedgeDrop.set(0, 0, -LEDGE_DROP), radius, height);

        if (!floorHit || floorHit.normal.z < MIN_FLOOR_Z) return false;

        movement.copy(tmpLedgeDelta).sub(position);

        if (movement.lengthSq() > 0) movement.normalize();

        movement.multiplyScalar(distance);

        return true;
    }

    // APawn::stepUp (0x8cf640) is void; the step only counts when the lifted move is clear (0x8cf859)
    protected stepUp(position: Vector3, desiredDir: Vector3, movement: Vector3, hit: CheckResult_T) {
        this.getHitNormal(hit, tmpStepNormal);

        let current: CheckResult_T | null = hit;

        if (Math.abs(tmpStepNormal.z) < MAX_STEP_SIDE_Z || tmpStepNormal.z >= MIN_FLOOR_Z) {
            this.moveActor(position, tmpStepUp.set(0, 0, MAX_STEP_HEIGHT));

            current = this.moveActor(position, movement);
        } else if (this.physicsMode !== "walking") {
            tmpStepRemaining.set(movement.x, movement.y, movement.z + movement.length() * tmpStepNormal.z);
            current = this.moveActor(position, tmpStepRemaining);
        }

        if (!current) {
            this.moveActor(position, tmpDown.set(0, 0, -MAX_STEP_HEIGHT));
            return;
        }

        this.getHitNormal(current, tmpNormal);

        if (Math.abs(tmpNormal.z) < MAX_STEP_SIDE_Z && movement.lengthSq() * current.time > STEP_RECURSE_DIST_SQ) {
            this.moveActor(position, tmpDown.set(0, 0, -MAX_STEP_HEIGHT));
            tmpStepRemaining.copy(movement).multiplyScalar(1 - current.time);
            this.stepUp(position, desiredDir, tmpStepRemaining, current);
            return;
        }

        tmpStepNormal.copy(tmpNormal);
        tmpStepNormal.z = 0;

        if (tmpStepNormal.lengthSq() > 0) tmpStepNormal.normalize();

        tmpStepRemaining.copy(movement).addScaledVector(tmpStepNormal, -movement.dot(tmpStepNormal)).multiplyScalar(1 - current.time);

        if (tmpStepRemaining.dot(desiredDir) >= 0) {
            const slideHit = this.moveActor(position, tmpStepRemaining);

            if (slideHit) {
                this.getHitNormal(slideHit, tmpNormal);
                twoWallAdjust(desiredDir, tmpStepRemaining, tmpNormal, tmpStepNormal, slideHit.time);
                this.moveActor(position, tmpStepRemaining);
            }
        }

        this.moveActor(position, tmpDown.set(0, 0, -MAX_STEP_HEIGHT));
    }

    protected physFalling(position: Vector3, deltaTime: number, iterations: number = 0) {
        if (deltaTime < 0.0003 || iterations > 7) return;

        this.setBase(null);
        tmpOldVelocity.copy(this.velocity);
        this.velocity.z = Math.max(-DEFAULT_VOLUME_TERMINAL_VELOCITY, this.velocity.z + DEFAULT_VOLUME_GRAVITY_Z * deltaTime);
        tmpMovement.addVectors(tmpOldVelocity, this.velocity).multiplyScalar(0.5 * deltaTime);

        const start = tmpSwimStart.copy(position);
        const waterTime = this.findWaterTransition(position, tmpMovement, false);

        const pendingHit = this.castShape(position, tmpMovement);

        if (waterTime < (pendingHit ? pendingHit.time : 1)) {
            position.addScaledVector(tmpMovement, waterTime);
            const remainingTime = deltaTime * (1 - waterTime);

            if (this.velocity.z < 0 && this.velocity.z > -160)
                this.velocity.z = -80 - Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y) * 0.7;

            this.physicsMode = "swimming";
            if (remainingTime > 0.01) this.physSwimming(position, remainingTime, this.getWaterVolume(position), iterations + 1);
            return;
        }

        const hit = this.moveActor(position, tmpMovement);

        if (!hit) return;

        this.getHitNormal(hit, tmpNormal);

        if (tmpNormal.z >= MIN_FLOOR_Z) {
            this.velocity.z = 0;
            this.isGrounded = true;
            this.physicsMode = "walking";
            this.setBase(hit.actor, tmpNormal);

            const remainingTime = deltaTime * (1 - hit.time);

            if (remainingTime >= 0.0003) this.physWalking(position, remainingTime, iterations);
            return;
        }

        tmpStepNormal.copy(tmpNormal);
        tmpRemaining.copy(tmpMovement).multiplyScalar(1 - hit.time).addScaledVector(tmpNormal, -tmpRemaining.dot(tmpNormal));

        const secondHit = this.moveSwept(position, tmpRemaining);

        if (secondHit) {
            this.getHitNormal(secondHit, tmpNormal);
            twoWallAdjust(tmpMovement, tmpRemaining, tmpNormal, tmpStepNormal, secondHit.time);
            this.moveSwept(position, tmpRemaining);
        }

        this.velocity.copy(position).sub(start).multiplyScalar(1 / deltaTime);

    }

    protected physSwimming(position: Vector3, deltaTime: number, volume: GD.IWaterVolumeDecodeInfo | null, iterations: number = 0) {
        if (deltaTime < 0.0003 || iterations > 7) return;

        this.setBase(null);
        if (!volume) {
            this.physicsMode = "falling";
            this.physFalling(position, deltaTime, iterations + 1);
            return;
        }

        this.isGrounded = false;
        tmpAccelDir.copy(this.acceleration);

        if (tmpAccelDir.lengthSq() > 0) tmpAccelDir.normalize();
        this.calcVelocity(position, tmpAccelDir, deltaTime, WATER_SPEED);

        tmpSwimStart.copy(position);
        tmpMovement.copy(this.velocity).addScaledVector(tmpVelocityDelta.fromArray(volume.zoneVelocity), 25 * deltaTime).multiplyScalar(deltaTime);
        const hit = this.moveWithWallResponse(position, tmpMovement);
        const nextVolume = this.getWaterVolume(position);

        tmpMovement.copy(position).sub(tmpSwimStart);

        if (nextVolume) {
            this.velocity.copy(tmpMovement).multiplyScalar(1 / deltaTime);
            return;
        }

        let remainingTime = 0;

        if (!hit) {
            const outZ = position.z;

            position.z = Math.min(tmpSwimStart.z, position.z);
            remainingTime = deltaTime * Math.min(1, Math.abs(position.z - outZ) / tmpMovement.length());
            tmpMovement.copy(position).sub(tmpSwimStart);

            if (this.getWaterVolume(position)) {
                if (remainingTime < deltaTime)
                    this.velocity.copy(tmpMovement).multiplyScalar(1 / (deltaTime - remainingTime));

                return;
            }
        }

        this.velocity.copy(tmpMovement).multiplyScalar(1 / Math.max(0.0003, deltaTime - remainingTime));

        if (this.velocity.z > 0 && this.velocity.z < 160)
            this.velocity.z = 40 + Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y) * 0.4;

        this.physicsMode = "falling";
        this.physFalling(position, remainingTime, iterations + 1);
    }

    protected physFlying(position: Vector3, deltaTime: number) {
        this.setBase(null);
        this.isGrounded = false;
        tmpAccelDir.copy(this.acceleration);

        if (tmpAccelDir.lengthSq() > 0) tmpAccelDir.normalize();

        this.calcVelocity(position, tmpAccelDir, deltaTime, this.airSpeed);
        tmpSwimStart.copy(position);

        const volume = this.getWaterVolume(position);
        const gravityZ = volume ? volume.gravity[2] : DEFAULT_VOLUME_GRAVITY_Z;

        tmpVelocityDelta.set(0, 0, 0);

        if (volume) {
            tmpVelocityDelta.fromArray(volume.zoneVelocity);

            if (!(this as any).isPlayer && tmpVelocityDelta.lengthSq() <= 90000)
                tmpVelocityDelta.set(0, 0, 0);
        }

        tmpMovement.copy(this.velocity).add(tmpVelocityDelta).multiplyScalar(deltaTime);
        tmpDesiredDirection.copy(tmpMovement);

        if (tmpDesiredDirection.lengthSq() > 0) tmpDesiredDirection.normalize();

        const hit = this.moveSwept(position, tmpMovement);

        if (hit) this.resolveFlyingHit(position, tmpMovement, hit, gravityZ);
        else this.floor.set(0, 0, 1);

        this.velocity.copy(position).sub(tmpSwimStart).multiplyScalar(1 / deltaTime);
    }

    protected resolveFlyingHit(position: Vector3, movement: Vector3, hit: CheckResult_T, gravityZ: number) {
        this.getHitNormal(hit, tmpStepNormal);
        this.floor.copy(tmpStepNormal);
        tmpGravityDirection.set(0, 0, gravityZ > 0 ? 1 : -1);
        tmpVelocityDirection.copy(this.velocity);

        if (tmpVelocityDirection.lengthSq() > 0) tmpVelocityDirection.normalize();

        const gravityVelocityDot = tmpGravityDirection.dot(tmpVelocityDirection);

        if (Math.abs(tmpStepNormal.z) < 0.2 && gravityVelocityDot > -0.2 && gravityVelocityDot < 0.5) {
            tmpRemaining.copy(movement).multiplyScalar(1 - hit.time);
            this.stepUpFlying(position, tmpRemaining, tmpGravityDirection, tmpDesiredDirection);
            return;
        }

        tmpRemaining.copy(movement).addScaledVector(tmpStepNormal, -movement.dot(tmpStepNormal)).multiplyScalar(1 - hit.time);

        if (movement.dot(tmpRemaining) < 0) return;

        const secondHit = this.moveSwept(position, tmpRemaining);

        if (!secondHit) return;

        this.getHitNormal(secondHit, tmpNormal);
        twoWallAdjust(tmpDesiredDirection, tmpRemaining, tmpNormal, tmpStepNormal, secondHit.time);
        this.moveSwept(position, tmpRemaining);
    }

    protected stepUpFlying(position: Vector3, movement: Vector3, gravityDirection: Vector3, desiredDirection: Vector3) {
        this.moveSwept(position, tmpStepUp.copy(gravityDirection).multiplyScalar(-MAX_STEP_HEIGHT));

        const hit = this.moveSwept(position, movement);

        if (hit) {
            this.getHitNormal(hit, tmpStepNormal);
            tmpStepNormal.z = 0;

            if (tmpStepNormal.lengthSq() > 0) {
                tmpStepNormal.normalize();
                tmpStepRemaining.copy(movement).multiplyScalar(1 - hit.time).addScaledVector(tmpStepNormal, -tmpStepRemaining.dot(tmpStepNormal));

                const secondHit = this.moveSwept(position, tmpStepRemaining);

                if (secondHit) {
                    this.getHitNormal(secondHit, tmpNormal);
                    twoWallAdjust(desiredDirection, tmpStepRemaining, tmpNormal, tmpStepNormal, secondHit.time);
                    this.moveSwept(position, tmpStepRemaining);
                }
            }
        }

        this.moveSwept(position, tmpDown.copy(gravityDirection).multiplyScalar(MAX_STEP_HEIGHT));
    }

    protected moveWithWallResponse(position: Vector3, movement: Vector3) {
        const hit = this.moveSwept(position, movement);

        if (!hit) return null;

        this.getHitNormal(hit, tmpStepNormal);
        tmpRemaining.copy(movement).multiplyScalar(1 - hit.time).addScaledVector(tmpStepNormal, -tmpRemaining.dot(tmpStepNormal));

        const secondHit = this.moveSwept(position, tmpRemaining);

        if (!secondHit) return hit;

        this.getHitNormal(secondHit, tmpNormal);
        twoWallAdjust(movement, tmpRemaining, tmpNormal, tmpStepNormal, secondHit.time);
        this.moveSwept(position, tmpRemaining);

        return hit;
    }

    protected getWaterVolume(position: Vector3): GD.IWaterVolumeDecodeInfo | null {
        tmpWaterPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight + WATERLINE_DEPTH);

        return this.getWaterVolumeAt(tmpWaterPosition);
    }

    protected getWaterVolumeAt(position: Vector3): GD.IWaterVolumeDecodeInfo | null {
        let selected: GD.IWaterVolumeDecodeInfo = null;

        for (const sector of this.renderManager.getLoadedSectors()) {
            const volume = sector.getWaterVolumeAt(position);

            if (volume && (!selected || volume.priority >= selected.priority)) selected = volume;
        }

        return selected;
    }

    protected findWaterTransition(position: Vector3, movement: Vector3, startsInWater: boolean): number {
        tmpWaterEnd.copy(position).add(movement);
        const volume = startsInWater ? this.getWaterVolume(position) : this.getWaterVolume(tmpWaterEnd);

        if (!volume) return 1;

        tmpWaterPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight + WATERLINE_DEPTH);
        tmpWaterEnd.addScaledVector(tmpUp, this.collisionHeight + WATERLINE_DEPTH);

        return findVolumeTransition(tmpWaterPosition, tmpWaterEnd, volume.bsp, startsInWater);
    }

    public moveActor(position: Vector3, movement: Vector3): CheckResult_T | null {
        const bodyPosition = tmpBodyPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight);
        const query = this.collisionQuery;

        query.location = bodyPosition;
        query.delta = movement;
        query.extent = tmpStepPosition.set(this.collisionRadius, this.collisionRadius, this.collisionHeight);
        query.sourceCollider = this.collider;
        query.sourceBody = this.rigidbody;
        query.sourceActor = this;
        query.sourceIsPlayer = !!(this as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = true;
        query.zeroExtent = false;

        const hit = this.renderManager.collisionWorld.moveActor(query);

        position.copy(bodyPosition).addScaledVector(tmpUp, -this.collisionHeight);

        return hit;
    }

    protected castShape(position: Vector3, movement: Vector3): CheckResult_T | null {
        const bodyPosition = tmpBodyPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight);
        const query = this.collisionQuery;

        query.location = bodyPosition;
        query.delta = movement;
        query.extent = tmpStepPosition.set(this.collisionRadius, this.collisionRadius, this.collisionHeight);
        query.sourceCollider = this.collider;
        query.sourceBody = this.rigidbody;
        query.sourceActor = this;
        query.sourceIsPlayer = !!(this as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
        query.zeroExtent = false;

        return this.renderManager.collisionWorld.singleLineCheck(query);
    }

    protected findFloor(position: Vector3, movement: Vector3): CheckResult_T | null {
        let hit = this.castShape(position, movement);

        if (hit && hit.normal.z >= MIN_FLOOR_Z) return hit;

        const query = this.collisionQuery;

        query.location = tmpBodyPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight);
        query.delta = movement;
        query.extent = tmpStepPosition.set(0, 0, this.collisionHeight);
        query.sourceCollider = this.collider;
        query.sourceBody = this.rigidbody;
        query.sourceActor = this;
        query.sourceIsPlayer = !!(this as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
        query.zeroExtent = false;

        hit = this.renderManager.collisionWorld.singleLineCheck(query);

        return hit && hit.normal.z >= MIN_FLOOR_Z ? hit : null;
    }

    protected getHitNormal(hit: CheckResult_T, target: Vector3): Vector3 {
        return target.copy(hit.normal);
    }

    protected setDesiredHeading(x: number, y: number) {
        if (x === 0 && y === 0) return;

        this.desiredRotationYaw = Math.round(Math.atan2(y, x) * 32768 / Math.PI) & 65535;
        this.hasDesiredRotation = true;
    }

    protected physicsRotation(deltaTime: number) {
        if (!this.hasDesiredRotation) return;

        const deltaRate = (this as any).isPlayer ? Math.round(PLAYER_YAW_RATE * deltaTime) : Math.trunc(YAW_RATE * deltaTime);

        this.rotationYaw = fixedTurn(this.rotationYaw, this.desiredRotationYaw, deltaRate);
        this.rotation.set(0, 0, this.rotationYaw * Math.PI / 32768 - Math.PI / 2);

        if (this.rotationYaw === this.desiredRotationYaw) this.hasDesiredRotation = false;
    }

    protected checkAnimationState() {
        if (this.isDying) return;
        if (this.animationNotifyAction && this.animationNotifyAction.loop === LoopOnce) return;

        const isMoving = this.velocity.lengthSq() > 0;
        const state: ValidStateNames_T = !this.hasStartedPhysics ? "idle" : this.physicsMode === "falling" ? "falling" : this.physicsMode === "swimming" ? isMoving ? "swimming" : "swimmingIdle" : isMoving ? this.isWalking ? "walking" : "running" : "idle";

        if (state === this.actorState.state) return;

        this.actorState.state = state;

        switch (this.actorState.state) {
            case "falling": this.playAnimation(this.basicActorAnimations.falling, MOVEMENT_TWEEN_TIME); break;
            case "idle": this.playAnimation(this.basicActorAnimations.idle, IDLE_TWEEN_TIME); break;
            case "dying": this.playAnimation(this.basicActorAnimations.dying, MOVEMENT_TWEEN_TIME); break;
            case "walking": this.playAnimation(this.basicActorAnimations.walking, MOVEMENT_TWEEN_TIME); break;
            case "running": this.playAnimation(this.basicActorAnimations.running, MOVEMENT_TWEEN_TIME); break;
            case "swimming": this.playAnimation(this.basicActorAnimations.swimming, MOVEMENT_TWEEN_TIME); break;
            case "swimmingIdle": this.playAnimation(this.basicActorAnimations.swimmingIdle, IDLE_TWEEN_TIME); break;
            default: throw new Error(`Unknown actor state: '${this.actorState.state}'`);
        }
    }

    public getBoneWorldPosition(name: string, target: Vector3): Vector3 {
        for (const mesh of this.meshes) {
            const skeleton = (mesh as any).skeleton as THREE.Skeleton;

            if (!skeleton) continue;

            const bone = skeleton.bones.find(bone => bone.name === name);

            if (bone) return bone.getWorldPosition(target);
        }

        throw new Error(`${this.type} has no '${name}' bone.`);
    }

    public attachObjectToBone(object: Object3D, boneNameOrIndex: string | number): boolean {
        const oldBase = (object as any).scriptBase as BaseActor;

        if (oldBase && oldBase !== this) oldBase.detachBoneObject(object);

        for (const mesh of this.meshes) {
            const skeleton = (mesh as any).skeleton as LocalSpaceSkeleton;

            if (!skeleton || !skeleton.attachObject(object, boneNameOrIndex)) continue;

            const properties = (object as any).scriptProperties as Map<string, ScriptValue_T>;
            let relativeLocation: ScriptValue_T = null;
            let relativeRotation: ScriptValue_T = null;

            if (properties)
                for (const [key, value] of properties) {
                    const name = key.slice(key.lastIndexOf(".") + 1).toLowerCase();

                    if (name === "relativelocation") relativeLocation = value;
                    else if (name === "relativerotation") relativeRotation = value;
                }

            if (relativeLocation !== null && !Array.isArray(relativeLocation)) throw new Error(`'${(object as any).scriptClassId}' has invalid RelativeLocation.`);
            if (relativeRotation !== null && !Array.isArray(relativeRotation)) throw new Error(`'${(object as any).scriptClassId}' has invalid RelativeRotation.`);

            if (relativeLocation === null) object.position.set(0, 0, 0);
            else object.position.fromArray(relativeLocation as GD.Vector3Arr);

            if (relativeRotation === null) object.quaternion.identity();
            else {
                const [pitch, yaw, roll] = relativeRotation as GD.Vector3Arr;

                tmpRotator.set(pitch, yaw, roll).toQuaternion(object.quaternion);
            }

            (object as any).scriptBase = this;
            setScriptObjectProperty(object, "Base", this);

            if (oldBase !== this && this.scriptVM && this.scriptVM.hasScriptFunction(this.scriptClassId, "Attach"))
                this.scriptVM.call(this, "Attach", [object as unknown as ScriptHost_T]);

            return true;
        }

        return false;
    }

    public detachBoneObject(object: Object3D): boolean {
        for (const mesh of this.meshes) {
            const skeleton = (mesh as any).skeleton as LocalSpaceSkeleton;

            if (!skeleton || !skeleton.detachObject(object)) continue;

            (object as any).scriptBase = null;
            setScriptObjectProperty(object, "Base", null);

            if (this.scriptVM && this.scriptVM.hasScriptFunction(this.scriptClassId, "Detach"))
                this.scriptVM.call(this, "Detach", [object as unknown as ScriptHost_T]);

            return true;
        }

        return false;
    }

    public gainScriptChild(object: Object3D): void {
        const owner = (object as any).scriptOwner as BaseActor;

        if (owner === this) return;
        if (owner) owner.loseScriptChild(object);

        (object as any).scriptOwner = this;
        setScriptObjectProperty(object, "Owner", this);

        if (this.scriptVM && this.scriptVM.hasScriptFunction(this.scriptClassId, "GainedChild"))
            this.scriptVM.call(this, "GainedChild", [object as unknown as ScriptHost_T]);
    }

    public loseScriptChild(object: Object3D): void {
        if ((object as any).scriptOwner !== this) return;

        (object as any).scriptOwner = null;
        setScriptObjectProperty(object, "Owner", null);

        if (this.scriptVM && this.scriptVM.hasScriptFunction(this.scriptClassId, "LostChild"))
            this.scriptVM.call(this, "LostChild", [object as unknown as ScriptHost_T]);
    }

    public getRenderSphere(): Sphere {
        if (this.renderSphereLocal.isEmpty()) return this.getCollisionPrimitive().bounds.getBoundingSphere(this.renderSphereWorld);

        this.updateWorldMatrix(true, false);

        return this.renderSphereWorld.copy(this.renderSphereLocal).applyMatrix4(this.matrixWorld);
    }

    public setMeshes(meshes: Mesh[]) {
        this.stopAnimations();
        this.disposeBlinkFaces();

        for (const mesh of this.meshes)
            this.remove(mesh);

        this.meshes = meshes;
        this.renderSphereLocal.makeEmpty();

        for (const mesh of meshes) {
            (mesh as any).hasStartedAnimation = true;
            mesh.frustumCulled = false;
            mesh.updateMatrix();

            if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
            if (mesh.geometry.boundingSphere) this.renderSphereLocal.union(tmpRenderSphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrix));

            this.add(mesh);
        }

        this.initHair();
        this.initBlink();
        this.renderManager.invalidatePawnLighting(this);
    }

    protected initHair() {
        this.hairChains.length = 0;
        this.hairStepTime = 0;

        for (const mesh of this.meshes) {
            const skeleton = (mesh as any).skeleton as THREE.Skeleton;

            if (!skeleton) continue;
            if (!/(?:^|_)(?:ah|bh)$/i.test(mesh.name)) continue;

            const bones = skeleton.bones.filter(bone => /^hair/i.test(bone.name));

            if (bones.length === 0) continue;

            this.hairChains.push({ bones, rest: bones.map(bone => bone.quaternion.clone()), angleX: 0, angleY: 0, velocityX: 0, velocityY: 0, phase: hashName(mesh.name) / 0xffffffff * Math.PI * 2 });
        }
    }

    protected updateHair(currentTime: number, deltaTime: number) {
        if (this.hairChains.length === 0) return;

        this.hairStepTime += Math.min(deltaTime, 0.2);
        tmpHairVelocity.copy(this.velocity).applyAxisAngle(tmpUp, -this.rotation.z);

        while (this.hairStepTime >= HAIR_STEP) {
            for (const chain of this.hairChains) {
                const targetX = clampHairAngle(-tmpHairVelocity.x * 0.002 + Math.sin(currentTime * 1.7 + chain.phase) * 0.035);
                const targetY = clampHairAngle(-tmpHairVelocity.y * 0.002 + Math.sin(currentTime * 1.3 + chain.phase * 0.7) * 0.025);

                chain.velocityX += ((targetX - chain.angleX) * HAIR_SPRING - chain.velocityX * HAIR_DAMPING) * HAIR_STEP;
                chain.velocityY += ((targetY - chain.angleY) * HAIR_SPRING - chain.velocityY * HAIR_DAMPING) * HAIR_STEP;
                chain.angleX += chain.velocityX * HAIR_STEP;
                chain.angleY += chain.velocityY * HAIR_STEP;
            }

            this.hairStepTime -= HAIR_STEP;
        }

        for (const chain of this.hairChains) {
            for (let i = 0, len = chain.bones.length; i < len; i++) {
                const strength = (i + 1) / chain.bones.length;

                tmpHairRotationX.setFromAxisAngle(tmpHairAxisX, chain.angleX * strength);
                tmpHairRotationY.setFromAxisAngle(tmpHairAxisY, chain.angleY * strength);

                chain.bones[i].quaternion.copy(chain.rest[i]);

                chain.bones[i].quaternion.multiply(tmpHairRotationX).multiply(tmpHairRotationY);
            }
        }
    }

    protected initBlink() {
        this.blinkStartTime = -Infinity;
        this.blinkIndex = 0;
        this.blinkNextTime = 0;

        for (const mesh of this.meshes) {
            if (!/(?:^|_)f$/i.test(mesh.name)) continue;

            const sourcePosition = mesh.geometry.getAttribute("position");
            const uv = mesh.geometry.getAttribute("uv");

            if (!sourcePosition || !uv) throw new Error(`Face mesh '${mesh.name}' has no position or UV data.`);

            mesh.geometry = mesh.geometry.clone();
            mesh.geometry.setAttribute("position", sourcePosition.clone());

            const position = mesh.geometry.getAttribute("position");
            const arrPosition = position.array as Float32Array;
            const arrUv = uv.array as Float32Array;
            const candidates: number[] = [];
            let maxX = 0;

            for (let i = 0; i < position.count; i++)
                maxX = Math.max(maxX, Math.abs(arrPosition[i * 3]));

            // All 14 playable C4 face meshes map both eyes into this shared half-face UV island.
            for (let i = 0; i < position.count; i++) {
                const x = arrPosition[i * 3];
                const u = arrUv[i * 2];
                const v = arrUv[i * 2 + 1];

                if (u < BLINK_U_MIN || u > BLINK_U_MAX || v < BLINK_V_MIN || v > BLINK_V_MAX) continue;
                if (Math.abs(x) <= maxX * BLINK_CENTERLINE_CUTOFF) continue;

                candidates.push(i);
            }

            if (candidates.length < 4) throw new Error(`Face mesh '${mesh.name}' has no eyelid topology.`);

            let meanV = 0;
            let meanZ = 0;

            for (const index of candidates) {
                meanV += arrUv[index * 2 + 1];
                meanZ += arrPosition[index * 3 + 2];
            }

            meanV /= candidates.length;
            meanZ /= candidates.length;

            let covariance = 0;
            let variance = 0;

            for (const index of candidates) {
                const dv = arrUv[index * 2 + 1] - meanV;

                covariance += dv * (arrPosition[index * 3 + 2] - meanZ);
                variance += dv * dv;
            }

            if (variance === 0) throw new Error(`Face mesh '${mesh.name}' eyelid UVs have no vertical range.`);

            const creaseZ = meanZ + covariance / variance * (BLINK_CREASE_V - meanV);
            const indices = new Uint16Array(candidates);
            const openZ = new Float32Array(indices.length);

            for (let i = 0, len = indices.length; i < len; i++)
                openZ[i] = arrPosition[indices[i] * 3 + 2];

            this.blinkFaces.push({ mesh, position, indices, openZ, creaseZ });
        }
    }

    protected updateBlink(currentTime: number) {
        if (this.blinkFaces.length === 0) return;

        if (this.blinkNextTime === 0)
            this.blinkNextTime = currentTime + 1.5 + hashName(this.blinkFaces[0].mesh.name) % 1500 / 1000;

        if (currentTime >= this.blinkNextTime) {
            this.blinkStartTime = currentTime;
            this.blinkIndex++;
            this.blinkNextTime = currentTime + 2.7 + hashName(`${this.blinkFaces[0].mesh.name}:${this.blinkIndex}`) % 2800 / 1000;
        }

        const elapsed = currentTime - this.blinkStartTime;
        let amount = 0;

        if (elapsed < BLINK_CLOSE_TIME)
            amount = elapsed / BLINK_CLOSE_TIME;
        else if (elapsed < BLINK_CLOSE_TIME + BLINK_HOLD_TIME)
            amount = 1;
        else if (elapsed < BLINK_CLOSE_TIME + BLINK_HOLD_TIME + BLINK_OPEN_TIME)
            amount = 1 - (elapsed - BLINK_CLOSE_TIME - BLINK_HOLD_TIME) / BLINK_OPEN_TIME;

        amount = Math.max(0, Math.min(1, amount));

        for (const face of this.blinkFaces) {
            const arrPosition = face.position.array as Float32Array;

            for (let i = 0, len = face.indices.length; i < len; i++) {
                const offset = face.indices[i] * 3 + 2;

                arrPosition[offset] = face.openZ[i] + (face.creaseZ - face.openZ[i]) * amount;
            }

            face.position.needsUpdate = true;
        }
    }

    protected disposeBlinkFaces() {
        for (const face of this.blinkFaces)
            face.mesh.geometry.dispose();

        this.blinkFaces.length = 0;
    }

    public setAnimations(animations: Record<string, AnimationClip>) {
        this.stopAnimations();
        this.actorState.reset();
        this.actorAnimations = animations;
    }

    public setAnimationNotifyHandler(handler: AnimationNotifyHandler_T) {
        this.animationNotifyHandler = handler;
        this.animationNotifyTime = this.animationNotifyAction ? this.animationNotifyAction.time : 0;
    }

    public stopAnimations() {
        for (const mesh of this.meshes) {
            if (this.prevAnimations.has(mesh)) this.prevAnimations.get(mesh).stop();
            if (this.currAnimations.has(mesh)) this.currAnimations.get(mesh).stop();
        }

        this.animationNotifyAction = null;
        this.animationNotifyTime = 0;
    }

    // materials and textures stay - material-decoder hands those out of name-keyed shared caches
    public release() {
        if (this.isScriptDestroyed) return;

        this.isScriptDestroyed = true;

        if (this.scriptVM && this.getUnrealScriptProperty("Controller") === this.scriptDeathController)
            this.setUnrealScriptProperty("Controller", null);

        if (this.scriptVM && this.hasBegunPlay && this.scriptVM.hasScriptFunction(this.scriptClassId, "Destroyed"))
            this.scriptVM.call(this, "Destroyed");

        this.stopAnimations();
        this.deathAnimationFinishedHandler = null;
        this.isDying = false;
        this.isScriptTicking = false;
        this.disposeBlinkFaces();

        for (const mesh of this.meshes) {
            this.renderManager.mixer.uncacheRoot(mesh);
            mesh.geometry.dispose();
        }
    }

    protected setBasicActorAnimation(key: ValidStateNames_T, animationName: string) {
        const resolvedName = Object.keys(this.actorAnimations).find(name => name.toLowerCase() === animationName.toLowerCase());

        if (!resolvedName)
            throw new Error(`'${animationName}' is not available.`);

        if (!(key in this.basicActorAnimations))
            throw new Error(`'${key}' is not a valid basic actor animation`);

        (this.basicActorAnimations as any)[key] = resolvedName;
    }

    public setIdleAnimation(animationName: string) { this.setBasicActorAnimation("idle", animationName); }
    public setWalkingAnimation(animationName: string) { this.setBasicActorAnimation("walking", animationName); }
    public setRunningAnimation(animationName: string) { this.setBasicActorAnimation("running", animationName); }
    public setDeathAnimation(animationName: string) { this.setBasicActorAnimation("dying", animationName); }
    public setFallingAnimation(animationName: string) { this.setBasicActorAnimation("falling", animationName); }
    public setSwimmingAnimation(animationName: string) { this.setBasicActorAnimation("swimming", animationName); }
    public setSwimmingIdleAnimation(animationName: string) { this.setBasicActorAnimation("swimmingIdle", animationName); }

    public setDeathAnimationFromScript() {
        if (!this.scriptVM) throw new Error(`${this.type} has no UnrealScript runtime.`);

        const oldWeaponType = Number(this.getUnrealScriptProperty("CurWeaponType"));
        let invalidAnimationName: string = null;

        for (let weaponType = 0; weaponType < 8; weaponType++) {
            this.setUnrealScriptProperty("CurWeaponType", weaponType);

            const animationName = this.scriptVM.call(this, "GetDeathAnimName");

            if (typeof animationName !== "string") throw new Error(`${this.type} has invalid death animation '${animationName}'.`);
            if (animationName.toLowerCase() === "none") continue;

            const resolvedName = Object.keys(this.actorAnimations).find(name => name.toLowerCase() === animationName.toLowerCase());

            if (!resolvedName) {
                invalidAnimationName = animationName;
                continue;
            }

            this.setDeathAnimation(resolvedName);
            return;
        }

        this.setUnrealScriptProperty("CurWeaponType", oldWeaponType);

        if (invalidAnimationName) throw new Error(`'${invalidAnimationName}' is not available.`);
    }

    public initAnimations() {
        this.isAnimationsInit = true;
        this.playAnimation(this.basicActorAnimations.idle, IDLE_TWEEN_TIME);
    }

    public spawnEnterEvent(event: GD.INpcEnterEvent, soundUri: string = null) {
        if (event.effect && event.effect.toLowerCase() !== "none") {
            if (!this.scriptObjectFactory) throw new Error(`${this.type} cannot spawn enter effect '${event.effect}'.`);

            const effect = this.scriptObjectFactory(event.effect);

            if (!(effect as any).isObject3D) throw new Error(`NPC enter effect '${event.effect}' is not an actor.`);

            const actor = effect as unknown as Object3D;
            const collisionRadius = Number(this.getStoredUnrealScriptProperty("CollisionRadius"));

            if (!Number.isFinite(collisionRadius) || collisionRadius <= 0) throw new Error(`${this.type} has invalid CollisionRadius '${collisionRadius}'.`);

            this.getWorldPosition(actor.position);
            actor.traverse(child => {
                const emitter = child as any;

                if (typeof emitter.setSizeScale === "function") emitter.setSizeScale(collisionRadius * ENTER_EFFECT_RADIUS_SCALE);
            });
            this.renderManager.addTransientEffect(actor);
        }

        if (event.isRise) {
            const targetZ = this.position.z;

            if (event.isRise === 1) this.position.z -= this.collisionHeight * 2;
            else if (event.isRise === 2) this.position.z += this.collisionHeight * 2;

            this.enterRiseTargetZ = targetZ;
            this.enterRiseVelocity = (targetZ - this.position.z) * ENTER_RISE_RATE;
        }

        if (event.animation && event.animation.toLowerCase() !== "none") this.playAnimation(event.animation, MOVEMENT_TWEEN_TIME, 1, false, true);

        if (event.sound && event.sound.toLowerCase() !== "none") {
            if (!soundUri) throw new Error(`NPC enter sound '${event.sound}' has no decoded audio.`);

            this.getWorldPosition(tmpPosition);
            this.renderManager.audioManager.playOneShotSound(soundUri, tmpPosition, event.soundVolume / 255, 1, event.soundRadius, event.soundRadius * 100);
        }
    }

    public onAnimationFinished(action: AnimationAction) {
        if (action !== this.animationNotifyAction) return;

        this.animationNotifyTime = 0;

        if (this.isDying) {
            action.stop();
            this.animationNotifyAction = null;

            const handler = this.deathAnimationFinishedHandler;

            this.deathAnimationFinishedHandler = null;
            if (handler) handler(this);
            return;
        }

        if (this.scriptVM) {
            this.scriptVM.call(this, "AnimEnd", [0]);

            if (this.animationNotifyAction !== action) return;
        }

        action.stop();
        this.animationNotifyAction = null;
    }

    public playDeathAnimation(onFinished: (actor: BaseActor) => void) {
        if (this.isDying) return;

        this.isDying = true;
        this.deathAnimationFinishedHandler = onFinished;
        this.actorState.state = "dying";
        this.stopMoving();

        if (this.scriptVM) {
            this.setUnrealScriptProperty("Controller", this.scriptDeathController);

            if (this.scriptVM.hasScriptFunction(this.scriptClassId, "NotifyDie")) this.scriptVM.call(this, "NotifyDie");
        }

        this.playAnimation(this.basicActorAnimations.dying, MOVEMENT_TWEEN_TIME, 1, false, true);
    }

    public isPlayingOneShotAnimation(animationName: string): boolean {
        const action = this.animationNotifyAction;

        return !!action && action.isRunning() && action.loop === LoopOnce && action.getClip().name.toLowerCase() === animationName.toLowerCase();
    }

    public playAnimation(animationName: string, tweenTime: number = MOVEMENT_TWEEN_TIME, rate: number = 1, loop: boolean = true, restart: boolean = false) {
        if (!this.isAnimationsInit) return;

        const resolvedName = Object.keys(this.actorAnimations).find(name => name.toLowerCase() === animationName.toLowerCase());

        if (!resolvedName)
            throw new Error(`'${animationName}' is not available.`);

        const sourceClip = this.actorAnimations[resolvedName];
        const clip = loop ? sourceClip : getOnceAnimation(sourceClip);
        const mixer = this.renderManager.mixer;
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
                if (restart || !nextAct.isRunning()) {
                    nextAct.reset().play();
                    didBegin = true;
                }
                continue;
            }

            this.currAnimations.set(mesh, nextAct);

            if (prevAct) prevAct.stop();
            nextAct.reset();

            if (currAct && (currAct.isRunning() || currAct.enabled && currAct.paused)) {
                this.prevAnimations.set(mesh, currAct);
                currAct.crossFadeTo(nextAct, tweenTime, false);
            } else if (currAct) currAct.stop();

            nextAct.play();
            didBegin = true;
        }

        if (this.animationNotifyAction !== notifyAction) {
            this.animationNotifyAction = notifyAction;
            this.animationNotifyTime = notifyAction ? notifyAction.time : 0;
        }

        if (didBegin && this.scriptVM && this.scriptVM.hasScriptFunction(this.scriptClassId, "AnimBegin"))
            this.scriptVM.call(this, "AnimBegin", [resolvedName]);
    }

    public goTo(position: Vector3) {
        if (!this.isInteractive()) return;

        console.log(`[actor] goTo from=(${this.position.x}, ${this.position.y}, ${this.position.z}) to=(${position.x}, ${position.y}, ${position.z})`);
        this.actorState.locomotion = true;
        this.actorState.desired.position.copy(position);
        this.actorState.desired.actor = null;
        this.actorState.desired.swimToDepth = !!this.getWaterVolumeAt(position);
        this.actorState.desired.offset = 0;
        this.actorState.desired.faceMovement = true;
        this.actorState.desired.faceTarget = null;
    }

    public goToActor(actor: Object3D, offset: number = 0) {
        if (!this.isInteractive()) return;

        this.actorState.locomotion = true;
        actor.getWorldPosition(this.actorState.desired.position);
        this.actorState.desired.actor = actor;
        this.actorState.desired.swimToDepth = !!this.getWaterVolumeAt(this.actorState.desired.position);
        this.actorState.desired.offset = offset;
        this.actorState.desired.faceMovement = true;
        this.actorState.desired.faceTarget = null;
    }

    public moveInDirection(direction: Vector3, faceMovement: boolean = true) {
        if (!this.isInteractive()) return;

        this.actorState.locomotion = true;
        this.actorState.desired.position.copy(direction).normalize().multiplyScalar(100000).add(this.position);
        this.actorState.desired.actor = null;
        this.actorState.desired.swimToDepth = true;
        this.actorState.desired.offset = 0;
        this.actorState.desired.faceMovement = faceMovement;
    }

    public faceActor(actor: Object3D | null) {
        if (!this.isInteractive()) return;

        this.actorState.desired.faceTarget = actor;
    }

    public stopMoving() {
        this.actorState.locomotion = false;
        this.acceleration.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
    }

    public setWalking(isWalking: boolean) {
        this.isWalking = isWalking;
    }

    public isIdle(): boolean { return this.actorState.state === "idle"; }
    public isLocomoting(): boolean { return this.actorState.locomotion; }
    public isWalkingMovement(): boolean { return this.isWalking; }
    public isSwimmingMovement(): boolean { return this.physicsMode === "swimming"; }
    public getSpeed(): number { return this.velocity.length(); }
    public isUnderwaterMovement(): boolean {
        tmpWaterPosition.copy(this.position).addScaledVector(tmpUp, this.collisionHeight * 2);

        return !!this.getWaterVolumeAt(tmpWaterPosition);
    }

    public setFlying(isFlying: boolean) {
        this.setBase(null);
        this.physicsMode = isFlying ? "flying" : "falling";
        this.isGrounded = false;

        if (isFlying) {
            this.hasStartedPhysics = true;
            this.setCollisionSize(WYVERN_COLLISION_RADIUS, WYVERN_COLLISION_HEIGHT);
        }
    }

    public setAirSpeed(airSpeed: number) {
        if (!Number.isFinite(airSpeed) || airSpeed < 0) throw new Error(`Invalid pawn AirSpeed '${airSpeed}'.`);

        this.airSpeed = airSpeed;
    }

    public setCollisionSize(collisionRadius: number, collisionHeight: number) {
        if (!Number.isFinite(collisionRadius) || collisionRadius <= 0) throw new Error(`Invalid pawn CollisionRadius '${collisionRadius}'.`);
        if (!Number.isFinite(collisionHeight) || collisionHeight <= 0) throw new Error(`Invalid pawn CollisionHeight '${collisionHeight}'.`);

        this.collisionRadius = collisionRadius;
        this.collisionHeight = collisionHeight;

        if (this.collider) this.collider.setShape(new RAPIER.Cylinder(collisionHeight, collisionRadius));
        if (this.rigidbody) this.rigidbody.setTranslation(tmpBodyPosition.set(this.position.x, this.position.y, this.position.z + collisionHeight), true);
    }

    public teleportTo(position: Vector3) {
        this.setBase(null);
        this.position.copy(position);
        this.velocity.set(0, 0, 0);
        this.isGrounded = false;
        this.hasDesiredRotation = false;
        this.physicsMode = "falling";
        this.hasStartedPhysics = false;

        this.actorState.locomotion = false;
        this.actorState.desired.position.copy(position);
        this.actorState.desired.actor = null;
        this.actorState.desired.swimToDepth = false;

        if (this.rigidbody)
            this.rigidbody.setTranslation(tmpBodyPosition.set(position.x, position.y, position.z + this.collisionHeight), true);
    }
}

class ActorState {
    public state: ValidStateNames_T = "idle";
    public locomotion: boolean = false;
    public readonly desired: DesiredState_T = {
        position: new Vector3(),
        actor: null,
        swimToDepth: false,
        offset: 0,
        faceMovement: true,
        faceTarget: null
    };

    public reset() {
        this.state = "idle";
        this.locomotion = false;
    }
}

type BasicActorAnimations_T = {
    idle: string;
    walking: string;
    running: string;
    dying: string;
    falling: string;
    swimming: string;
    swimmingIdle: string;
};

type DesiredState_T = {
    position: Vector3;
    actor: Object3D | null;
    swimToDepth: boolean;
    offset: number;
    faceMovement: boolean;
    faceTarget: Object3D | null;
};

type PhysicsMode_T = "none" | "walking" | "falling" | "swimming" | "flying";

type ValidStateNames_T = "idle" | "walking" | "running" | "dying" | "falling" | "swimming" | "swimmingIdle";

type HairChainState_T = {
    bones: Bone[];
    rest: Quaternion[];
    angleX: number;
    angleY: number;
    velocityX: number;
    velocityY: number;
    phase: number;
};

type BlinkFaceState_T = {
    mesh: Mesh;
    position: THREE.BufferAttribute;
    indices: Uint16Array;
    openZ: Float32Array;
    creaseZ: number;
};

function hashName(name: string): number {
    let hash = 2166136261;

    for (let i = 0, len = name.length; i < len; i++) {
        hash ^= name.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function clampHairAngle(value: number): number {
    return Math.max(-HAIR_MAX_ANGLE, Math.min(HAIR_MAX_ANGLE, value));
}

function fixedTurn(current: number, desired: number, deltaRate: number): number {
    current &= 65535;
    desired &= 65535;

    if (deltaRate === 0) return current;

    let result = current;

    if (current > desired) {
        if (current - desired < 32768) result -= Math.min(current - desired, Math.abs(deltaRate));
        else result += Math.min(desired + 65536 - current, Math.abs(deltaRate));
    } else {
        if (desired - current < 32768) result += Math.min(desired - current, Math.abs(deltaRate));
        else result -= Math.min(current + 65536 - desired, Math.abs(deltaRate));
    }

    return result & 65535;
}

function twoWallAdjust(desiredDir: Vector3, delta: Vector3, hitNormal: Vector3, oldHitNormal: Vector3, hitTime: number) {
    if (oldHitNormal.dot(hitNormal) <= 0) {
        tmpStepUp.crossVectors(hitNormal, oldHitNormal).normalize();
        delta.copy(tmpStepUp).multiplyScalar(delta.dot(tmpStepUp) * (1 - hitTime));

        if (desiredDir.dot(delta) < 0) delta.multiplyScalar(-1);
    } else {
        delta.addScaledVector(hitNormal, -delta.dot(hitNormal)).multiplyScalar(1 - hitTime);

        if (delta.dot(desiredDir) <= 0) delta.set(0, 0, 0);
    }
}

export default BaseActor;
export { BaseActor };
