import { AnimationAction, AnimationClip, Mesh, Object3D, Sphere, Vector3 } from "three";
import RAPIER from "@dimforge/rapier3d";
import { EDrawType_T, EPhysics_T } from "./assets/unreal/un-aactor";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "./objects/objects";
import RenderManager from "./rendering/render-manager";
import type { CheckResult_T } from "./physics/collision-world";
import UnScriptVM, { unregisterLevelActor, updateLevelActor, ScriptNativeCall_T, ScriptValue_T } from "./ue-script/vm";
import { GameObject, COMPONENT_EVENT_NOT_HANDLED } from "./game/components";
import { ColliderComponent } from "./physics/components/physics-component";
import PawnMovementComponent, { PawnMovementState_T } from "./physics/components/pawn-movement-component";
import type NProjectileComponent from "./physics/components/projectile-component";
import AnimationComponent, { MESH_SCALE_CHANGED_EVENT } from "./objects/components/animation-component";
import TransformComponent from "./objects/components/transform-component";
import ActorOwnershipComponent from "./objects/components/actor-ownership-component";
import NpcLifecycleComponent from "./objects/components/npc-lifecycle-component";
import PawnAttackComponent, { type PawnAttackSelection_T, type PawnAttack_T } from "./objects/components/pawn-attack-component";
import PawnRenderableComponent from "./rendering/components/pawn-renderable-component";
import { findScriptPropertyKey, getScriptPropertyName, ScriptComponent, ScriptObjectFactory_T } from "./game/script-component";
import type { Vector3Arr } from "@l2js/engine";
import type { INpcEnterEvent } from "@l2js/engine/contracts/pawn";

const tmpUp = new Vector3(0, 0, 1);
const tmpScriptLocation = new Vector3();
const arrVehicleClass: ScriptValue_T[] = ["Vehicle"];
export class BaseActor extends GameObject implements ICollidable {
    public readonly isActor = true;
    declare public readonly isCollidable: boolean;
    public readonly type: string = "Actor";
    public effectSpawnBoneIndex: number = null;
    public charClassId = -1;
    public ridePawn: BaseActor = null;
    public scriptBase: BaseActor = null;
    public npcMovementAnimationRate = 1;
    public rideType = 0;

    protected renderManager: RenderManager;
    protected readonly movementComponent: PawnMovementComponent;
    protected scriptComponent: ScriptComponent<BaseActor> = null;
    protected isPendingDelete = false;
    protected isDeleted = false;
    public scriptClassId: string = null;
    public scriptProperties: Map<string, ScriptValue_T> = null;

    public constructor(renderManager: RenderManager) {
        super();

        (this as any).isCollidable = true;

        this.renderManager = renderManager;
        this.up.copy(tmpUp);
        this.addComponent(new ActorOwnershipComponent());
        this.movementComponent = this.addComponent(new PawnMovementComponent(renderManager));
        this.addComponent(new ColliderComponent());
    }

    protected getAnimationComponent(): AnimationComponent { return this.getComponent("animation"); }

    public setScriptRuntime(vm: UnScriptVM, classId: string, objectFactory: ScriptObjectFactory_T): void {
        if (this.scriptComponent && this.scriptClassId === classId) {
            this.scriptComponent.setRuntime(vm, objectFactory);
            return;
        }

        const isOnVehicle = this.scriptComponent ? this.getStoredUnrealScriptProperty("bGetOnVehicle") : null;
        const loadingResourceRef = this.scriptComponent ? this.getStoredUnrealScriptProperty("LoadingResourceRef") : null;
        const createdResource = this.scriptComponent ? this.getStoredUnrealScriptProperty("bCreatedResource") : null;

        if (this.scriptComponent) this.removeComponent(this.scriptComponent);

        const component = new ScriptComponent<BaseActor>(vm, objectFactory, classId);

        this.scriptComponent = component;
        this.scriptClassId = classId;
        this.scriptProperties = component.getProperties();
        this.addComponent(component);
        if (isOnVehicle !== null) this.setUnrealScriptProperty("bGetOnVehicle", isOnVehicle);
        if (loadingResourceRef !== null) this.setUnrealScriptProperty("LoadingResourceRef", loadingResourceRef);
        if (createdResource !== null) this.setUnrealScriptProperty("bCreatedResource", createdResource);
        for (const field of ["bCollideActors", "bCollideWorld", "bBlockActors", "bBlockPlayers", "bBlockZeroExtentTraces", "bBlockNonZeroExtentTraces", "bWorldGeometry"])
            this.setUnrealScriptProperty(field, this.getStoredUnrealScriptProperty(field));
        this.setCollisionSize(this.getStoredUnrealScriptProperty("CollisionRadius") as number, this.getStoredUnrealScriptProperty("CollisionHeight") as number);
    }

    public beginPlay(): void {
        this.scriptComponent?.beginPlay(() => {
            if (this.renderManager.getLevel()) {
                const physics = this.renderManager.getPhysicsManager();
                physics.setPawnZone(this, false, true);
                physics.setPawnVolumes(this);
            }
        });
    }

    public resolveUnrealObject(id: string): string { return id; }

    public getUnrealScriptProperty(id: string): ScriptValue_T {
        const name = getScriptPropertyName(id);

        switch (name) {
            case "bpendingdelete": return this.isPendingDelete;
            case "bdeleteme": return this.isDeleted;
            case "base": return (this.scriptBase || this.getBaseActor()) as unknown as ScriptValue_T;
            case "location":
                this.getWorldPosition(tmpScriptLocation);
                tmpScriptLocation.z += this.movementComponent.getCollisionHeight();
                return tmpScriptLocation.toArray();
            case "velocity": return this.movementComponent.getVelocity().toArray();
            case "acceleration": return this.movementComponent.getAcceleration().toArray();
            case "collisionradius": return this.movementComponent.getCollisionRadius();
            case "collisionheight": return this.movementComponent.getCollisionHeight();
            case "biswalking": return this.movementComponent.isWalkingMovement();
            case "rotation": {
                const rotation = this.getStoredUnrealScriptProperty(id) as Vector3Arr;

                return [rotation[0], this.movementComponent.getRotationYaw(), rotation[2]];
            }
            case "physics": return this.movementComponent.getPhysicsMode() === "nMover" ? EPhysics_T.PHYS_NMover : ["none", "walking", "falling", "swimming", "flying"].indexOf(this.movementComponent.getPhysicsMode());
        }

        return this.getStoredUnrealScriptProperty(id);
    }

    protected getStoredUnrealScriptProperty(id: string): ScriptValue_T {
        const properties = this.scriptProperties;

        if (!properties) return null;

        const value = properties.get(id);

        if (value !== undefined || properties.has(id)) return value;

        const key = findScriptPropertyKey(properties, getScriptPropertyName(id));

        return key === undefined ? null : properties.get(key);
    }

    public setUnrealScriptProperty(id: string, value: ScriptValue_T): void {
        const field = id.slice(id.lastIndexOf(".") + 1);

        switch (field.toLowerCase()) {
            case "location":
                tmpScriptLocation.fromArray(value as Vector3Arr);
                tmpScriptLocation.z -= this.movementComponent.getCollisionHeight();
                if (this.parent) this.parent.worldToLocal(tmpScriptLocation);
                this.position.copy(tmpScriptLocation);
                this.renderManager.getPhysicsManager().updatePawnCollision(this);
                return;
            case "velocity": this.movementComponent.setVelocity(value as Vector3Arr); return;
            case "acceleration": this.movementComponent.setAcceleration(value as Vector3Arr); return;
            case "collisionradius": this.movementComponent.setCollisionSize(Number(value), this.movementComponent.getCollisionHeight()); return;
            case "collisionheight": this.movementComponent.setCollisionSize(this.movementComponent.getCollisionRadius(), Number(value)); return;
            case "biswalking": this.movementComponent.setWalking(!!value); return;
            case "physics": this.movementComponent.setPhysicsMode(Number(value)); return;
            case "level": {
                this.renderManager.getPhysicsManager().setPawnLevel(this, value as any);
                if (this.getStoredUnrealScriptProperty(id) !== value) this.setUnrealScriptProperty("Region", { Zone: value, iLeaf: -1, ZoneNumber: 0 });
                break;
            }
        }

        if (!this.scriptProperties) throw new Error(`${this.type} has no UnrealScript property storage.`);

        const property = findScriptPropertyKey(this.scriptProperties, field.toLowerCase()) ?? field;

        this.scriptProperties.set(property, value);
        if (field.toLowerCase() === "level") updateLevelActor(this);
        switch (field.toLowerCase()) {
            case "bcollideactors":
                this.movementComponent.setCollideActors(!!value);
                this.renderManager.getPhysicsManager().updatePawnCollision(this);
                break;
            case "bcollideworld": this.movementComponent.getCollisionProfile().collideWorld = !!value; break;
            case "bblockactors": this.movementComponent.getCollisionProfile().blockActors = !!value; break;
            case "bblockplayers": this.movementComponent.getCollisionProfile().blockPlayers = !!value; break;
            case "bblockzeroextenttraces": this.movementComponent.getCollisionProfile().blockZeroExtent = !!value; break;
            case "bblocknonzeroextenttraces": this.movementComponent.getCollisionProfile().blockNonZeroExtent = !!value; break;
            case "bworldgeometry": this.movementComponent.getCollisionProfile().worldGeometry = !!value; break;
        }
        if (field.toLowerCase() === "drawscale" || field.toLowerCase() === "drawscale3d") this.dispatchComponentEvent(MESH_SCALE_CHANGED_EVENT);
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        const componentResult = this.scriptComponent ? this.scriptComponent.dispatchNative(call) : COMPONENT_EVENT_NOT_HANDLED;

        if (componentResult !== COMPONENT_EVENT_NOT_HANDLED) return componentResult;

        throw new Error(`UnrealScript native '${call.name}' (${call.index}) is not implemented for '${call.context.scriptClassId}'.`);
    }

    public getAnimationAction(): AnimationAction { return this.getAnimationComponent().getAction(); }

    public getSocialAnimDuration(action: number): number { // Engine 0x105e5a20.
        if (this.getUnrealScriptProperty("bNpc") || action < 0 || action >= 20) return -1;

        const weapon = this.getUnrealScriptProperty("CurWeaponType") as number;
        const names = this.getUnrealScriptProperty(action === 0 ? "SitAnimName" : action === 1 ? "StandAnimName" : "PcSocialAnimName") as string[];
        const clip = this.getAnimationComponent().getAnimationClip(names[action < 2 ? weapon : action]);

        if (!clip) return -1;

        return ((clip as any).skinNotify.frameCount / (clip as any).framerate + Math.fround(action < 2 ? 0.1 : 0.3)) / (this.getUnrealScriptProperty("NonAttackSpeedRate") as number);
    }

    public getCollisionRadius(): number { return this.movementComponent.getCollisionRadius(); }
    public getCollisionHeight(): number { return this.movementComponent.getCollisionHeight(); }
    public getCollider(): RAPIER.Collider { return this.movementComponent.getCollider(); }
    public getRigidbody(): RAPIER.RigidBody { return this.movementComponent.getRigidbody(); }
    public getBaseActor(): ICollidable | null { return this.movementComponent.getBaseActor(); }
    public getBasedActors(): ReadonlySet<ICollidable> { return this.movementComponent.getBasedActors(); }
    public addBasedActor(actor: ICollidable): void { this.movementComponent.addBasedActor(actor); }
    public removeBasedActor(actor: ICollidable): void { this.movementComponent.removeBasedActor(actor); }
    public setBase(actor: ICollidable | null): void { this.movementComponent.setBase(actor); }
    public getCollisionProfile(): ActorCollisionProfile_T { return this.movementComponent.getCollisionProfile(); }
    public getCollisionPrimitive(): CollisionPrimitive_T { return this.movementComponent.getCollisionPrimitive(); }
    public createCollider(physicsWorld: RAPIER.World): RAPIER.Collider { return this.movementComponent.createCollider(physicsWorld); }
    public releaseCollider(): void { this.movementComponent.releaseCollider(); }
    public ignoreOverlappingActors(actors: Iterable<ICollidable>): void { this.movementComponent.ignoreOverlappingActors(actors); }
    public moveSmooth(movement: Vector3, ignoredActor?: ICollidable): void { this.movementComponent.moveSmooth(movement, ignoredActor); }
    public moveActor(position: Vector3, movement: Vector3): CheckResult_T | null { return this.movementComponent.moveActor(position, movement); }
    public isInteractive(): boolean { return this.movementComponent.isInteractive(); }

    public checkLoadingResource(includeZero = true): boolean {
        if (!this.scriptComponent || !this.renderManager.manGame.getComponent("network")?.isInWorld()) return false;
        if (this.ridePawn || this.getUnrealScriptProperty("RidePawn") || this.getUnrealScriptProperty("bRide") || this.getUnrealScriptProperty("DrawType") === EDrawType_T.DT_Custom) return false;
        // FNActorResourceLoader::CheckLoadingResource 0x769050..0x769190; browser world runs normal network-client mode.
        const count = this.getUnrealScriptProperty("LoadingResourceRef") as number;
        if (Number.isInteger(count) && count < 0) return false;
        if (this.scriptComponent.getVM().invokeNative(this, this, 303, "IsA", arrVehicleClass)) return false;
        if (!Number.isInteger(count)) throw new Error(`Pawn '${this.name}' has no loading-resource counter.`);

        return includeZero ? count >= 0 : count > 0;
    }

    public isInStasis(currentTime: number): boolean {
        if (!this.getUnrealScriptProperty("bStasis")) return false;

        const physics = this.getUnrealScriptProperty("Physics");
        if (physics !== EPhysics_T.PHYS_None && physics !== EPhysics_T.PHYS_Rotating) return false;

        // AActor::Tick 0x86580f..0x865886.
        return currentTime / 1000 - (this.getUnrealScriptProperty("LastRenderTime") as number) > 5 && (this.getUnrealScriptProperty("Level") as GameObject).getUnrealScriptProperty("NetMode") === 0;
    }

    public updatePresentation(currentTime: number, deltaTime: number) {
        this.updateComponents(currentTime, deltaTime);
    }

    public update(_renderManager: RenderManager, currentTime: number, deltaTime: number) {
        this.updatePresentation(currentTime, deltaTime);
    }

    public updateMatrixWorld(force?: boolean): void { // culled actors skip three's per-frame walk, getWorldPosition/updateWorldMatrix still resolve on demand
        if (this.visible) super.updateMatrixWorld(force);
    }

    public getBoneWorldPosition(name: string | number, target: Vector3, offset?: Vector3): Vector3 { return this.getAnimationComponent().getBoneWorldPosition(name, target, offset); }

    public getEffectTargetLocation(target: Vector3): Vector3 {
        if (this.scriptComponent) {
            this.scriptComponent.call("GetEffTargetLocation", [{ get: () => target.toArray(), set: value => target.fromArray(value as Vector3Arr) } as any]);
            return target;
        }

        const index = this.effectSpawnBoneIndex;

        if (!Number.isInteger(index)) throw new Error(`${this.name} has no effect target bone index.`);

        return this.getBoneWorldPosition(Math.max(0, index), target);
    }

    public attachObjectToBone(object: Object3D, boneNameOrIndex: string | number, absolute: boolean = false): boolean { return this.getComponent<TransformComponent>("transform").attachObjectToBone(object, boneNameOrIndex, absolute); }
    public detachBoneObject(object: Object3D): boolean { return this.getComponent<TransformComponent>("transform").detachBoneObject(object); }
    public gainScriptChild(object: Object3D): void { this.getComponent<ActorOwnershipComponent>("actorOwnership").gainScriptChild(object); }
    public loseScriptChild(object: Object3D): void { this.getComponent<ActorOwnershipComponent>("actorOwnership").loseScriptChild(object); }
    public getScriptChildren(): ReadonlySet<Object3D> { return this.getComponent<ActorOwnershipComponent>("actorOwnership").getScriptChildren(); }

    public getRenderSphere(): Sphere { return this.getComponent<PawnRenderableComponent>("pawnRenderable").getRenderSphere(); }

    public setMeshes(meshes: Mesh[]): void { this.getAnimationComponent().setMeshes(meshes); }

    public setAnimations(animations: Record<string, AnimationClip>): void { this.getAnimationComponent().setAnimations(animations); }
    public getAnimationNames(): string[] { return this.getAnimationComponent().getAnimationNames(); }
    public stopAnimations(): void { this.getAnimationComponent().stop(); }

    // materials stay - material-decoder hands those out of name-keyed shared caches
    public release(): void {
        if (this.isPendingDelete) return;

        this.isPendingDelete = true;
        this.renderManager.replaceRetainedSkillTargets(this, null);
        for (const movement of this.renderManager.getPhysicsManager().getPhysicsComponents<PawnMovementComponent>("pawnMovement"))
            movement.replaceTarget(this, null);
        for (const projectile of this.renderManager.getPhysicsManager().getPhysicsComponents<NProjectileComponent>("nProjectile"))
            projectile.removeTarget(this);
        this.renderManager.getPhysicsManager().setPawnLevel(this, null);
        this.findComponent<NpcLifecycleComponent>("npcLifecycle")?.release();
        this.isDeleted = true;
        this.detachComponents();
        unregisterLevelActor(this);
    }

    public isPendingKill(): boolean { return this.isDeleted; }

    public setIdleAnimation(animationName: string): void { this.getAnimationComponent().setBasicAnimation("idle", animationName); }
    public setWalkingAnimation(animationName: string): void { this.getAnimationComponent().setBasicAnimation("walking", animationName); }
    public setRunningAnimation(animationName: string): void { this.getAnimationComponent().setBasicAnimation("running", animationName); }
    public setDeathAnimation(animationName: string): void { this.getAnimationComponent().setBasicAnimation("dying", animationName); }
    public setFallingAnimation(animationName: string): void { this.getAnimationComponent().setBasicAnimation("falling", animationName); }
    public setSwimmingAnimation(animationName: string): void { this.getAnimationComponent().setBasicAnimation("swimming", animationName); }
    public setSwimmingIdleAnimation(animationName: string): void { this.getAnimationComponent().setBasicAnimation("swimmingIdle", animationName); }
    public playMovementAnimation(state: PawnMovementState_T): void {
        this.getAnimationComponent().playMovement(state);

        if (!this.ridePawn) return;

        const field = state === "dying" ? "RiderDeathAnimName" : state === "idle" || state === "turning" || state === "swimmingIdle" ? "RiderWaitAnimName" : "RiderRunAnimName";
        const animation = (this.ridePawn.getUnrealScriptProperty(field) as string[])[this.rideType];
        const rate = state === "walking" || state === "running" ? this.ridePawn.getComponent<AnimationComponent>("animation").getMovementRate(state, null) : state === "idle" || state === "turning" || state === "swimmingIdle" ? this.ridePawn.getUnrealScriptProperty("NonAttackSpeedRate") as number : 1;

        if (animation.toLowerCase() !== "none") this.ridePawn.playAnimation(animation, 0.1, rate);
    }
    public setDeathAnimationFromScript(): void { this.getAnimationComponent().setDeathAnimationFromScript(); }
    public initAnimations(): void { this.getAnimationComponent().init(); }

    public spawnEnterEvent(event: INpcEnterEvent): void {
        this.getComponent<NpcLifecycleComponent>("npcLifecycle").spawnEnter(event);
    }

    public onAnimationFinished(action: AnimationAction): void { this.getComponent<NpcLifecycleComponent>("npcLifecycle").onAnimationFinished(action); }

    public playDeathAnimation(onFinished: (actor: BaseActor) => void): void { this.getComponent<NpcLifecycleComponent>("npcLifecycle").playDeath(onFinished); }
    public revive(): void { this.getComponent<NpcLifecycleComponent>("npcLifecycle").revive(); }

    public getNpcAttacks(): readonly PawnAttack_T[] { return this.getComponent<PawnAttackComponent>("pawnAttack").getAttacks(); }
    public attack(target: BaseActor, selection: PawnAttackSelection_T, locList: readonly Vector3Arr[] = [], associatedActors: readonly BaseActor[] = null, targetExcepted: boolean = false): void { this.getComponent<PawnAttackComponent>("pawnAttack").attack(target, selection, locList, associatedActors, targetExcepted); }
    public stopAttack(): void { this.renderManager.getParent().getComponent("asset").stopPawnSkill(this); }

    public isPlayingOneShotAnimation(animationName: string): boolean { return this.getAnimationComponent().isPlayingOneShot(animationName); }
    public playAnimation(animationName: string, tweenTime: number = 0.1, rate: number = 1, loop: boolean = true, restart: boolean = false): void { this.getAnimationComponent().play(animationName, tweenTime, rate, loop, restart); }

    public goTo(position: Vector3): void { this.movementComponent.goTo(position); }
    public flyTo(position: Vector3): void { this.movementComponent.flyTo(position); }
    public addFlyTo(origin: Vector3, position: Vector3): void { this.movementComponent.addFlyTo(origin, position); }
    public validateLocation(position: Vector3): void { this.movementComponent.validateLocation(position); }
    public goToActor(actor: Object3D, offset: number = 0): void { this.movementComponent.goToActor(actor, offset); }
    public copyMovement(actor: BaseActor): void { this.movementComponent.copyMovement(actor.movementComponent); }
    public moveInDirection(direction: Vector3, faceMovement: boolean = true): void { this.movementComponent.moveInDirection(direction, faceMovement); }
    public faceActor(actor: Object3D | null): void { this.movementComponent.faceActor(actor); }
    public stopMove(): void { this.movementComponent.stopMove(); }
    public stopMoving(): void { this.movementComponent.stopMoving(); }
    public setWalking(isWalking: boolean): void { this.movementComponent.setWalking(isWalking); }
    public isIdle(): boolean { return this.movementComponent.isIdle(); }
    public isLocomoting(): boolean { return this.movementComponent.isLocomoting(); }
    public isWalkingMovement(): boolean { return this.movementComponent.isWalkingMovement(); }
    public isSwimmingMovement(): boolean { return this.movementComponent.isSwimmingMovement(); }
    public isFlyingMovement(): boolean { return this.movementComponent.isFlyingMovement(); }
    public getSpeed(): number { return this.movementComponent.getSpeed(); }
    public isUnderwaterMovement(): boolean { return this.movementComponent.isUnderwaterMovement(); }
    public setFlying(isFlying: boolean): void { this.movementComponent.setFlying(isFlying); }
    public setAirSpeed(airSpeed: number): void { this.movementComponent.setAirSpeed(airSpeed); }
    public setMovementSpeeds(groundSpeed: number, walkSpeed: number, waterSpeed: number): void { this.movementComponent.setMovementSpeeds(groundSpeed, walkSpeed, waterSpeed); }
    public setRotationYaw(yaw: number): void { this.movementComponent.setRotationYaw(yaw); }
    public startRotating(direction: number, speed: number): void { this.movementComponent.startRotating(direction, speed); }
    public finishRotating(yaw: number, speed: number): void { this.movementComponent.finishRotating(yaw, speed); }
    public stopRotating(): void { this.movementComponent.stopRotating(); }
    public resetRotationYaw(yaw: number): void { this.movementComponent.resetRotationYaw(yaw); }
    public getRotationYaw(): number { return this.movementComponent.getRotationYaw(); }
    public setCollisionSize(collisionRadius: number, collisionHeight: number): void { this.movementComponent.setCollisionSize(collisionRadius, collisionHeight); }
    public l2Teleport(position: Vector3, base: ICollidable = null): void { this.movementComponent.l2Teleport(position, base); }
    public teleportTo(position: Vector3, adjustToFloor: boolean = false): void { this.movementComponent.teleportTo(position, adjustToFloor); }
    public adjustLocation(position: Vector3): void { this.movementComponent.adjustLocation(position); }

}

export default BaseActor;
