import RAPIER from "@dimforge/rapier3d";
import { Box3, Euler, LoopOnce, Object3D, Quaternion, Sphere, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T } from "../../game/components";
import { SCRIPT_NATIVE_EVENT, type ScriptComponent } from "../../game/script-component";
import { PhysicsComponent } from "./physics-component";
import L2NMover from "../l2-nmover";
import { EPhysics_T } from "../../assets/unreal/un-aactor";
import { PMoveType_T } from "../../assets/unreal/un-controller";
import { findVolumeTransition } from "../volume-bsp";
import { sinRotator } from "../../assets/unreal/utils/rotator";
import type PhysicsVolume from "../../objects/physics-volume";
import type BaseActor from "../../base-actor";
import type Vehicle from "../../objects/vehicle";
import type RenderManager from "../../rendering/render-manager";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "../../objects/objects";
import type { CheckResult_T, CollisionQuery_T } from "../collision-world";
import { getProperty, setProperty, type ScriptHost_T, type ScriptNativeCall_T, type ScriptValue_T } from "../../ue-script/vm";
import type TransformComponent from "../../objects/components/transform-component";
import type AnimationComponent from "../../objects/components/animation-component";
import type PawnAttackComponent from "../../objects/components/pawn-attack-component";
import type { Vector3Arr } from "@l2js/engine";
import type { IWaterVolumeDecodeInfo } from "@l2js/engine/contracts/volume";

const tmpPosition = new Vector3();
const tmpFloorPosition = new Vector3();
const tmpWaterPosition = new Vector3();
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
const tmpBasePosition = new Vector3();
const tmpBaseQuaternion = new Quaternion();
const tmpBaseInverseQuaternion = new Quaternion();
const tmpBaseDeltaQuaternion = new Quaternion();
const tmpBaseOffset = new Vector3();
const tmpWalkingStart = new Vector3();
const tmpWalkingSubStart = new Vector3();
const tmpDesiredMove = new Vector3();
const tmpCrouchStart = new Vector3();
const tmpCrouchEnd = new Vector3();
const tmpCrouchLocation = new Vector3();
const tmpCrouchDelta = new Vector3();
const tmpCrouchExtent = new Vector3();
const tmpVehicleDestination = new Vector3();
const colliderRotation = new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2);
const arrMoveTemps = [tmpPosition, tmpBodyPosition, tmpStepPosition, tmpStepNormal, tmpRemaining, tmpNormal, tmpStepUp];
let moveActorDepth = 0;

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
// APawn::SpawnEnterEvent (0x8b47e0): rise moves 5/9 of its full offset per second.
const ENTER_RISE_RATE = 5 / 9;
export const PAWN_TELEPORTED_EVENT = "pawnTeleported";
export const PAWN_COLLISION_SIZE_CHANGED_EVENT = "pawnCollisionSizeChanged";

export class PawnMovementComponent extends PhysicsComponent<BaseActor> {
    public readonly componentName = "pawnMovement";
    protected tickRate = 30;
    protected readonly renderManager: RenderManager;
    protected collider: RAPIER.Collider = null;
    protected rigidbody: RAPIER.RigidBody = null;
    protected readonly velocity = new Vector3();
    protected readonly acceleration = new Vector3();
    protected readonly floor = new Vector3(0, 0, 1);
    protected collisionRadius = COLLISION_RADIUS;
    protected collisionHeight = COLLISION_HEIGHT;
    protected collideActors = true;
    protected readonly analyticalCenter = new Vector3();
    protected readonly analyticalBounds = new Box3();
    protected readonly analyticalOrigin = new Vector3(NaN, NaN, NaN);
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
    protected readonly analyticalPrimitive: CollisionPrimitive_T<"cylinder"> = { kind: "cylinder", center: this.analyticalCenter, radius: this.collisionRadius, halfHeight: this.collisionHeight, bounds: this.analyticalBounds, supportsZeroExtent: true, supportsNonZeroExtent: true, supportsPointCheck: true };
    protected rotationYaw = 0;
    protected desiredRotationYaw = 0;
    protected hasDesiredRotation = false;
    protected keyboardRotationDirection: number = null;
    protected keyboardRotationYaw: number = null;
    protected keyboardRotationSpeed = 0;
    protected isGrounded = false;
    protected hasStartedPhysics = false;
    protected adjustToFloor = false;
    protected teleportLanding = false;
    protected isPhysicInit = false;
    protected validateLocationPending = false;
    protected readonly validatePosition = new Vector3();
    protected physicsMode: PhysicsMode_T = "falling";
    protected nMover: L2NMover = null;
    protected flyDestination: Vector3 = null;
    protected vehicleId = 0;
    protected readonly vehicleMovePoint = new Vector3();
    protected isWalking = false;
    protected groundSpeed = GROUND_SPEED;
    protected walkSpeed = WALK_SPEED;
    protected waterSpeed = WATER_SPEED;
    protected airSpeed = AIR_SPEED;
    protected waterVolume: IWaterVolumeDecodeInfo = null;
    protected readonly ignoredActors = new Set<ICollidable>();
    protected readonly collisionQuery: CollisionQuery_T = { location: null, delta: null, extent: null, sourceIsPlayer: false };
    protected readonly adjustmentQuery: CollisionQuery_T = { location: tmpBodyPosition, delta: tmpMovement, extent: tmpStepPosition, sourceIsPlayer: false, traceWorld: true, ignorePawns: false, ignoreBases: false };
    protected readonly crouchQuery: CollisionQuery_T = { location: tmpCrouchLocation, delta: tmpCrouchDelta, extent: tmpCrouchExtent, sourceIsPlayer: false, traceWorld: true, ignorePawns: false, ignoreBases: false };
    protected readonly actorState = new ActorState();
    protected oldRotationYaw = 0;
    protected enterRiseTargetZ: number = null;
    protected enterRiseVelocity = 0;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    protected getPosition(): Vector3 { return this.getParent().position; }
    protected getRotation(): Euler { return this.getParent().rotation; }
    protected getTransformComponent(): TransformComponent { return this.getComponent("transform"); }

    public getPhysicsTickRate(): number { return this.tickRate; }
    public setPhysicsTickRate(tickRate: number): void { this.tickRate = tickRate; }

    public onPhysicsTick(currentTime: number, deltaTime: number, _actors: BaseActor[]): boolean {
        if (this.vehicleId) this.tickMoveInVehicle();
        this.updatePhysics(currentTime, deltaTime * 0.001);

        return true;
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        if (type !== SCRIPT_NATIVE_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        const call = data as ScriptNativeCall_T;
        const name = call.name.toLowerCase();
        const context = call.context as any;

        if (call.index === 262 || name === "setcollision") {
            if (context !== this.getParent()) throw new Error(`SetCollision for '${context.scriptClassId}' is not implemented by '${this.getParent().name}'.`);

            this.renderManager.getPhysicsManager().setCollision(context, call.args[0] as boolean, call.args[1] as boolean, call.args[2] as boolean);
            return;
        }

        if (call.index !== 3970 && name !== "setphysics") return COMPONENT_EVENT_NOT_HANDLED;

        if (typeof context.setUnrealScriptProperty === "function") context.setUnrealScriptProperty("Physics", call.args[0]);
        else if (context.scriptProperties instanceof Map) context.scriptProperties.set("Physics", call.args[0]);
        else throw new Error(`'${context.scriptClassId}' has no physics mode.`);
    }

    public getCollisionRadius() { return this.collisionRadius; }
    public getCollisionHeight() { return this.collisionHeight; }
    public getDesiredRotationYaw(): number { return this.desiredRotationYaw; }
    public getCollider(): RAPIER.Collider { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }
    public getBaseActor(): ICollidable | null { return this.getTransformComponent().getBase(); }
    public getBasedActors(): ReadonlySet<ICollidable> { return this.getTransformComponent().getBasedActors(); }
    public addBasedActor(actor: ICollidable) { this.getTransformComponent().addBasedActor(actor); }
    public removeBasedActor(actor: ICollidable) { this.getTransformComponent().removeBasedActor(actor); }
    public isInteractive(): boolean {
        const owner = this.getParent();

        if (owner.scriptBase) return owner.scriptBase.isInteractive();
        if (!this.renderManager.isSectorCollisionReady(this.getPosition())) return false;
        if (!owner.scriptClassId) return false;

        const level = owner.getUnrealScriptProperty("Level"), main = this.renderManager.getLevel();

        return !!level && (!!main && main.levelInfoActor === level || this.renderManager.getLoadedSectors().some(sector => sector.levelInfoActor === level));
    }
    public getCollisionProfile(): ActorCollisionProfile_T {
        this.collisionProfile.collideActors = this.collideActors && this.isInteractive();
        this.collisionProfile.collisionRadius = this.collisionRadius;
        this.collisionProfile.collisionHeight = this.collisionHeight;

        return this.collisionProfile;
    }

    public setCollideActors(value: boolean): void {
        this.collideActors = value;
        this.collisionProfile.collideActors = value && this.isInteractive();
    }

    public getCollisionPrimitive(): CollisionPrimitive_T {
        // Caching avoids an n^2 getWorldPosition chain walk across pawn traces.
        if (this.analyticalOrigin.equals(this.getPosition())) return this.analyticalPrimitive;

        this.analyticalOrigin.copy(this.getPosition());
        this.getParent().getWorldPosition(this.analyticalCenter);
        this.analyticalCenter.z += this.collisionHeight;
        this.analyticalBounds.min.set(this.analyticalCenter.x - this.collisionRadius, this.analyticalCenter.y - this.collisionRadius, this.analyticalCenter.z - this.collisionHeight);
        this.analyticalBounds.max.set(this.analyticalCenter.x + this.collisionRadius, this.analyticalCenter.y + this.collisionRadius, this.analyticalCenter.z + this.collisionHeight);
        this.analyticalPrimitive.radius = this.collisionRadius;
        this.analyticalPrimitive.halfHeight = this.collisionHeight;

        return this.analyticalPrimitive;
    }

    public createCollider(physicsWorld: RAPIER.World): RAPIER.Collider {
        if (this.collider) return this.collider;

        const rigidbodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.getPosition().x, this.getPosition().y, this.getPosition().z + this.collisionHeight);
        const colliderDesc = RAPIER.ColliderDesc.cylinder(this.collisionHeight, this.collisionRadius).setRotation(colliderRotation);

        this.rigidbody = physicsWorld.createRigidBody(rigidbodyDesc);
        this.collider = physicsWorld.createCollider(colliderDesc, this.rigidbody);

        return this.collider;
    }

    protected updatePhysics(currentTime: number, deltaTime: number) {
        this.updateSpeedCorrection(deltaTime);
        this.updateValidateLocation();

        if (this.flyDestination && this.isInteractive() && this.renderManager.isSectorCollisionReady(this.flyDestination)) this.startNMover();

        if (this.physicsMode === "none" || !this.isInteractive()) return;
        if (this.getParent().getUnrealScriptProperty("bIgnorePhysics") || !this.getParent().getUnrealScriptProperty("PhysicsVolume")) return; // APawn::performPhysics 0x10607517..0x10607549.
        if (this.getParent() === this.renderManager.player && this.renderManager.getParent().getComponent("network").isObserving()) return; // AController::IsObserverMode, APawn::performPhysics 0x10607524.

        if (this.enterRiseTargetZ !== null) {
            this.updateEnterRise(deltaTime);
            return;
        }

        const isInteractive = this.isInteractive();

        this.collisionProfile.collideActors = this.collideActors && isInteractive;

        if (!this.rigidbody || !isInteractive) {
            this.checkAnimationState(deltaTime);
            return;
        }

        this.physicsManager.updateDynamicEntries(currentTime);

        let remainingTime = Math.min(deltaTime, 0.4);
        let iteration = 0;

        while (remainingTime > 0 && iteration++ < 8) {
            const tick = this.hasStartedPhysics && this.physicsMode === "walking" ? remainingTime : remainingTime <= 0.05 ? remainingTime : Math.min(0.05, remainingTime * 0.5);

            remainingTime -= tick;
            this.tickPhysics(tick);
        }

        this.rigidbody.setNextKinematicTranslation(tmpBodyPosition.set(this.getPosition().x, this.getPosition().y, this.getPosition().z + this.collisionHeight));
        this.checkAnimationState(deltaTime);
    }

    protected updateEnterRise(deltaTime: number): void {
        const targetZ = this.enterRiseTargetZ;
        const nextZ = this.getPosition().z + this.enterRiseVelocity * deltaTime;

        if ((this.enterRiseVelocity >= 0 && nextZ >= targetZ) || (this.enterRiseVelocity < 0 && nextZ <= targetZ)) {
            this.getPosition().z = targetZ;
            this.enterRiseTargetZ = null;
            this.enterRiseVelocity = 0;
        } else this.getPosition().z = nextZ;

        this.renderManager.getPhysicsManager().updatePawnCollision(this.getParent());
        if (this.rigidbody) this.rigidbody.setNextKinematicTranslation(tmpBodyPosition.set(this.getPosition().x, this.getPosition().y, this.getPosition().z + this.collisionHeight));
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
            if (actor !== this.getParent() && this.isOverlapping(actor, this.getPosition())) this.ignoredActors.add(actor);
    }

    public removeIgnoredActor(actor: ICollidable): void { this.ignoredActors.delete(actor); }

    public moveSmooth(movement: Vector3, ignoredActor?: ICollidable) {
        if (!this.isInteractive()) return;

        const arrSaved = moveActorDepth ? arrMoveTemps.map(value => value.clone()) : null;
        const wasIgnored = ignoredActor && this.ignoredActors.has(ignoredActor);
        try {
            const position = tmpPosition.copy(this.getPosition());
            if (ignoredActor) this.ignoredActors.add(ignoredActor);
            this.moveWithWallResponse(position, movement);
            this.getPosition().copy(position);
            this.renderManager.getPhysicsManager().updatePawnCollision(this.getParent());
        } finally {
            if (ignoredActor && !wasIgnored) this.ignoredActors.delete(ignoredActor);
            if (arrSaved) arrMoveTemps.forEach((value, index) => value.copy(arrSaved[index]));
        }
    }

    protected tickPhysics(deltaTime: number) {
        const desired = this.actorState.desired;
        const position = tmpPosition.copy(this.getPosition());

        this.updateBaseMovement(position);
        this.updateIgnoredActors(position);
        if (this.adjustToFloor) {
            this.adjustToFloor = false;
            const teleport = this.teleportLanding;
            this.teleportLanding = false;

            this.physicsManager.farMoveActor(this.getParent(), this.findAdjustmentLocation(position, teleport), false, false, !!this.getBaseActor());
            if (this.getBaseActor()) {
                this.getTransformComponent().updateBaseRelativePosition();
                this.getTransformComponent().updateRelativeLocation();
            }
            position.copy(this.getPosition());
        }

        const waterVolume = this.getWaterVolume(position);

        if (!this.hasStartedPhysics) {
            if (waterVolume) {
                this.hasStartedPhysics = true;
                this.physicsMode = "swimming";
            } else {
                const floorMovement = tmpMovement.set(0, 0, -SPAWN_FLOOR_PROBE);
                const floorHit = this.findFloor(position, floorMovement, true);

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
            const controller = this.getParent().getUnrealScriptProperty("Controller") as ScriptHost_T;

            if (controller) {
                const destination = getProperty(controller, "Destination") as Vector3Arr, height = (desired.actor as BaseActor).getCollisionHeight();

                // AController::execPollMoveToward 0x1053522f..0x10535280.
                destination[0] = Math.fround(desired.position.x);
                destination[1] = Math.fround(desired.position.y);
                destination[2] = Math.fround(Math.fround(desired.position.z + height) + (this.physicsMode === "flying" ? height * 0.7 : 0));
                setProperty(controller, "Destination", destination);
                desired.position.set(destination[0], destination[1], destination[2] - this.collisionHeight);
            }
        }

        const distanceX = desired.position.x - position.x;
        const distanceY = desired.position.y - position.y;
        const isThreeDimensional = this.physicsMode === "flying" || this.physicsMode === "swimming";
        const distanceZ = isThreeDimensional ? desired.position.z - position.z : 0;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ);
        const maxSpeed = this.getMovementSpeed();

        const willReachDestination = this.actorState.locomotion && Math.max(0, distance - desired.offset) <= maxSpeed * deltaTime;

        if (this.actorState.locomotion) {
            this.acceleration.set(distanceX, distanceY, distanceZ).normalize().multiplyScalar(ACCEL_RATE);
        } else {
            this.acceleration.set(0, 0, 0);
        }

        if (desired.faceTarget) {
            desired.faceTarget.getWorldPosition(tmpMovement);
            this.setDesiredHeading(tmpMovement.x - position.x, tmpMovement.y - position.y);
        } else if (this.actorState.locomotion && desired.faceMovement) this.setDesiredHeading(distanceX, distanceY);

        if (this.physicsMode === "walking" && waterVolume) this.physicsMode = "swimming";

        switch (this.physicsMode) {
            case "none": this.velocity.set(0, 0, 0); break;
            case "walking": this.physWalking(position, deltaTime); break;
            case "falling": this.physFalling(position, deltaTime); break;
            case "swimming": this.physSwimming(position, deltaTime, waterVolume); break;
            case "flying": this.physFlying(position, deltaTime); break;
            case "nMover": this.physNMover(position, deltaTime); break;
            default: throw new Error(`Unknown player physics mode '${this.physicsMode}'.`);
        }

        if (willReachDestination) {
            const dx = desired.position.x - position.x;
            const dy = desired.position.y - position.y;
            const dz = isThreeDimensional ? desired.position.z - position.z : 0;

            if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= desired.offset + 0.01) {
                this.actorState.locomotion = false;
                this.vehicleId = 0;
            }
        }

        this.physicsRotation(deltaTime);

        this.getPosition().copy(position);
        this.renderManager.getPhysicsManager().updatePawnCollision(this.getParent());
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
        const dz = this.physicsMode === "flying" || this.physicsMode === "swimming" ? this.actorState.desired.position.z - position.z : 0;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) - this.actorState.desired.offset;
        const speed = Math.min(maxSpeed, Math.max(0, distance / deltaTime));

        this.velocity.copy(accelDir).multiplyScalar(speed);
    }

    protected updateBaseMovement(position: Vector3) {
        const transform = this.getTransformComponent();
        const base = transform.getBase() as ICollidable & Object3D;

        if (!base) return;

        base.getWorldPosition(tmpBasePosition);
        base.getWorldQuaternion(tmpBaseQuaternion);

        if (tmpBasePosition.equals(transform.getBasePosition()) && tmpBaseQuaternion.equals(transform.getBaseQuaternion())) return;

        tmpBaseInverseQuaternion.copy(transform.getBaseQuaternion()).invert();
        tmpBaseOffset.copy(position).sub(transform.getBasePosition()).applyQuaternion(tmpBaseInverseQuaternion).applyQuaternion(tmpBaseQuaternion).add(tmpBasePosition);
        tmpMovement.copy(tmpBaseOffset).sub(position);

        const wasIgnored = this.ignoredActors.has(base);

        this.ignoredActors.add(base);
        const hit = this.moveActor(position, tmpMovement);
        if (!wasIgnored) this.ignoredActors.delete(base);

        if (hit) {
            this.setBase(null);
            return;
        }

        tmpBaseDeltaQuaternion.copy(tmpBaseQuaternion).multiply(tmpBaseInverseQuaternion);

        const yaw = Math.atan2(2 * (tmpBaseDeltaQuaternion.w * tmpBaseDeltaQuaternion.z + tmpBaseDeltaQuaternion.x * tmpBaseDeltaQuaternion.y), 1 - 2 * (tmpBaseDeltaQuaternion.y * tmpBaseDeltaQuaternion.y + tmpBaseDeltaQuaternion.z * tmpBaseDeltaQuaternion.z));

        this.rotationYaw = (this.rotationYaw + Math.round(yaw * 32768 / Math.PI)) & 65535;
        this.getRotation().set(0, 0, this.rotationYaw * Math.PI / 32768 - Math.PI / 2);
        transform.updateBaseTransform(tmpBasePosition, tmpBaseQuaternion);
    }

    public setBase(actor: ICollidable | null, floor?: Vector3): void {
        if (floor) this.floor.copy(floor);

        const transform = this.getTransformComponent(), previous = transform.getBase();

        if (previous === actor || !transform.setBase(actor)) return;
        if (this.getParent() !== this.renderManager.player) return;

        const oldVehicle = previous as Vehicle, vehicle = actor as Vehicle;

        if ((!oldVehicle || !oldVehicle.isVehicle) && (!vehicle || !vehicle.isVehicle)) return;

        const network = this.renderManager.getParent().getComponent("network");

        // APawn::SetBase 0x10500b20 sends world center on exit, yaw-relative center on entry.
        tmpVehicleDestination.fromArray(this.getParent().getUnrealScriptProperty("Location") as Vector3Arr);
        if (oldVehicle && oldVehicle.isVehicle) network.requestGetOffVehicle(oldVehicle.getUnrealScriptProperty("L2ServerObjectID") as number, tmpVehicleDestination);
        if (vehicle && vehicle.isVehicle) {
            vehicle.getLocalLocation(tmpVehicleDestination, tmpVehicleDestination);
            network.requestGetOnVehicle(vehicle.getUnrealScriptProperty("L2ServerObjectID") as number, tmpVehicleDestination);
        }
    }

    protected updateBaseRelativePosition(): void { this.getTransformComponent().updateBaseRelativePosition(); }

    protected physWalking(position: Vector3, deltaTime: number, iterations: number = 0) {
        this.velocity.z = 0;
        this.acceleration.z = 0;

        tmpAccelDir.copy(this.acceleration);

        if (tmpAccelDir.lengthSq() > 0) tmpAccelDir.normalize();

        this.calcVelocity(position, tmpAccelDir, deltaTime, this.getMovementSpeed(0));
        if (this.isPhysicInit && this.velocity.x === 0 && this.velocity.y === 0 && this.velocity.z === 0) return; // bPhysicInit, APawn::physWalking 0x8d49eb

        tmpDesiredMove.copy(this.velocity);
        tmpDesiredMove.z = 0;
        tmpWalkingStart.copy(position);

        let remainingTime = deltaTime;

        while (remainingTime > 0 && iterations++ < 8) {
            const timeTick = (this.getParent() as any).isPlayer && remainingTime > 0.05 ? Math.min(0.05, remainingTime * 0.5) : remainingTime;

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
                    else if (floorDistance >= MIN_FLOOR_DISTANCE && floorHit.actor === this.getBaseActor())
                        this.isPhysicInit = true; // APawn::physWalking 0x8d554d

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

            if (!(this.getBaseActor() as Vehicle)?.isVehicle || !this.getParent().getUnrealScriptProperty("bGetOnVehicle"))
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
        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
        query.ignorePawns = !query.sourceIsPlayer;
        query.zeroExtent = false;

        return this.physicsManager.singleLineCheck(query);
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
    protected stepUp(position: Vector3, desiredDir: Vector3, movement: Vector3, hit: CheckResult_T | null) {
        if (hit) this.getHitNormal(hit, tmpStepNormal);
        else tmpStepNormal.set(0, 0, 0);

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
            current = this.moveActor(position, tmpDown.set(0, 0, -MAX_STEP_HEIGHT));
            tmpStepRemaining.copy(movement).multiplyScalar(1 - (current ? current.time : 1));
            this.stepUp(position, desiredDir, tmpStepRemaining, current);
            return;
        }

        this.processHitWall(current.normal, current.actor);
        position.copy(this.getPosition());
        if (this.physicsMode === "falling") return;

        this.getHitNormal(current, tmpNormal);
        tmpStepNormal.copy(tmpNormal);
        tmpStepNormal.z = 0;

        if (tmpStepNormal.lengthSq() > 0) tmpStepNormal.normalize();

        tmpStepRemaining.copy(movement).addScaledVector(tmpStepNormal, -movement.dot(tmpStepNormal)).multiplyScalar(1 - current.time);

        if (tmpStepRemaining.dot(desiredDir) >= 0) {
            const slideHit = this.moveActor(position, tmpStepRemaining);

            if (slideHit) {
                this.processHitWall(slideHit.normal, slideHit.actor);
                position.copy(this.getPosition());
                if (this.physicsMode === "falling") return;

                this.getHitNormal(slideHit, tmpNormal);
                twoWallAdjust(desiredDir, tmpStepRemaining, tmpNormal, tmpStepNormal, slideHit.time);
                this.moveActor(position, tmpStepRemaining);
            }
        }

        this.moveActor(position, tmpDown.set(0, 0, -MAX_STEP_HEIGHT));
    }

    protected processHitWall(normal: Vector3, actor: ICollidable): void {
        if (!actor) return;

        const parent = this.getParent(), script = this.getComponent<ScriptComponent>("script"), vm = script.getVM();
        const target = actor as unknown as ScriptHost_T;
        if (target.scriptClassId && vm.invokeNative(parent, target, 303, "IsA", ["Pawn"])) return;

        let controller = parent.getUnrealScriptProperty("Controller") as ScriptHost_T;
        const hitNormal = normal.toArray() as Vector3Arr;

        // APawn::processHitWall 0x8d01b0..0x8d04de.
        moveActorDepth++;
        try {
            if (!parent.getUnrealScriptProperty("bDirectHitWall") && controller) {
                if (this.acceleration.lengthSq() === 0) return;

                const destination = getProperty(controller, "Destination") as Vector3Arr, location = parent.getUnrealScriptProperty("Location") as Vector3Arr;
                let x = destination[0] - location[0], y = destination[1] - location[1], z = destination[2] - location[2];
                let square = x * x + y * y + z * z;
                let length = Math.sqrt(square);
                if (square >= 1e-8) { x /= length; y /= length; z /= length; }
                else x = y = z = 0;

                if (this.physicsMode === "walking") {
                    hitNormal[2] = z = 0;
                    square = hitNormal[0] * hitNormal[0] + hitNormal[1] * hitNormal[1];
                    length = Math.sqrt(square);
                    if (square >= 1e-8) { hitNormal[0] /= length; hitNormal[1] /= length; }
                    else hitNormal[0] = hitNormal[1] = 0;
                    square = x * x + y * y;
                    length = Math.sqrt(square);
                    if (square >= 1e-8) { x /= length; y /= length; }
                    else x = y = 0;
                }

                if (x * hitNormal[0] + y * hitNormal[1] + z * hitNormal[2] > (getProperty(controller, "MinHitWall") as number)) return;
                if (vm.call(controller, "NotifyHitWall", [hitNormal.slice(), target])) return;

                if (this.physicsMode !== "falling") {
                    controller = parent.getUnrealScriptProperty("Controller") as ScriptHost_T;
                    const tryCrouch = this.physicsMode === "walking" && parent.getUnrealScriptProperty("bCanCrouch") && !parent.getUnrealScriptProperty("bIsCrouched") && !(controller && vm.invokeNative(parent, controller, 303, "IsA", ["PlayerController"]));
                    if (tryCrouch) {
                        tmpCrouchStart.fromArray(parent.getUnrealScriptProperty("Location") as Vector3Arr);
                        tmpCrouchEnd.set(tmpCrouchStart.x + this.collisionRadius * x, tmpCrouchStart.y + this.collisionRadius * y, tmpCrouchStart.z + this.collisionRadius * z);
                        if (this.canCrouchWalk(tmpCrouchStart, tmpCrouchEnd)) return;
                    }

                    this.moveActor(this.getPosition(), tmpDown.set(0, 0, -MAX_STEP_HEIGHT));
                    if (tryCrouch) {
                        tmpCrouchStart.fromArray(parent.getUnrealScriptProperty("Location") as Vector3Arr);
                        tmpCrouchEnd.set(tmpCrouchStart.x + this.collisionRadius * x, tmpCrouchStart.y + this.collisionRadius * y, tmpCrouchStart.z + this.collisionRadius * z);
                        if (this.canCrouchWalk(tmpCrouchStart, tmpCrouchEnd)) return;
                    }

                    controller = parent.getUnrealScriptProperty("Controller") as ScriptHost_T;
                    if (controller && vm.invokeNative(parent, controller, 303, "IsA", ["AIController"])) {
                        debugger;
                        throw new Error(`AI controller wall adjustment is not implemented for '${parent.name}'.`);
                    }
                }
            }

            script.call("HitWall", [hitNormal, target]);
        } finally { moveActorDepth--; }
    }

    protected canCrouchWalk(start: Vector3, end: Vector3): boolean {
        const parent = this.getParent();
        if (!parent.getUnrealScriptProperty("bCanCrouch")) return false;

        const height = parent.getUnrealScriptProperty("CrouchHeight") as number, radius = parent.getUnrealScriptProperty("CrouchRadius") as number;
        const query = this.crouchQuery;
        tmpCrouchLocation.copy(start).setZ(start.z + height - this.collisionHeight);
        tmpCrouchDelta.subVectors(end, start);
        tmpCrouchExtent.set(0, 0, 0);
        query.sourceActor = parent;
        query.sourceProfile = this.collisionProfile;
        query.sourceCollider = this.collider;
        query.sourceBody = this.rigidbody;
        query.sourceIsPlayer = !!(parent as any).isPlayer;
        query.zeroExtent = true;

        // APawn::CanCrouchWalk 0x8cbca0..0x8cbeb1.
        const pointHit = this.physicsManager.singleLineCheck(query);
        if (pointHit && pointHit.actor) return false;

        tmpCrouchExtent.set(radius, radius, height);
        query.zeroExtent = false;
        const hit = this.physicsManager.singleLineCheck(query);
        if (hit && hit.time !== 1) return false;

        parent.setUnrealScriptProperty("bWantsToCrouch", true);
        parent.setUnrealScriptProperty("bTryToUncrouch", true);
        parent.setUnrealScriptProperty("UncrouchTime", 0.5);
        return true;
    }

    protected physFalling(position: Vector3, deltaTime: number, iterations: number = 0) {
        if (deltaTime < 0.0003 || iterations > 7) return;

        if (!(this.getBaseActor() as Vehicle)?.isVehicle || !this.getParent().getUnrealScriptProperty("bGetOnVehicle"))
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

    protected physSwimming(position: Vector3, deltaTime: number, volume: IWaterVolumeDecodeInfo | null, iterations: number = 0) {
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
        this.calcVelocity(position, tmpAccelDir, deltaTime, this.getMovementSpeed(1));

        tmpSwimStart.copy(position);
        const body = this.getParent().getUnrealScriptProperty("PhysicsVolume") as unknown as PhysicsVolume;
        tmpMovement.copy(this.velocity).addScaledVector(tmpVelocityDelta.fromArray(body.getUnrealScriptProperty("ZoneVelocity") as Vector3Arr), 25 * deltaTime).multiplyScalar(deltaTime);
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

            this.moveSwept(position, tmpDown.set(0, 0, Math.min(0, tmpSwimStart.z - position.z)));
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

        this.calcVelocity(position, tmpAccelDir, deltaTime, this.getMovementSpeed(2));
        tmpSwimStart.copy(position);

        const volume = this.getParent().getUnrealScriptProperty("PhysicsVolume") as unknown as PhysicsVolume;
        const gravityZ = (volume.getUnrealScriptProperty("Gravity") as Vector3Arr)[2];

        tmpVelocityDelta.fromArray(volume.getUnrealScriptProperty("ZoneVelocity") as Vector3Arr);

        if (!(this.getParent() as any).isPlayer && tmpVelocityDelta.lengthSq() <= 90000)
            tmpVelocityDelta.set(0, 0, 0);

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



    protected getWaterVolume(position: Vector3): IWaterVolumeDecodeInfo | null {
        if (this.hasStartedPhysics && position.equals(this.getPosition()))
            return this.getWaterVolumeData(this.getParent().getUnrealScriptProperty("HeadVolume") as unknown as PhysicsVolume);

        tmpWaterPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight + WATERLINE_DEPTH);

        return this.getWaterVolumeAt(tmpWaterPosition);
    }

    protected getWaterVolumeAt(position: Vector3): IWaterVolumeDecodeInfo | null {
        const owner = this.getParent(), sectors = this.renderManager.getLoadedSectors();
        const main = this.renderManager.getLevel(), ownerLevel = owner.getUnrealScriptProperty("Level");
        const level = main && main.levelInfoActor === ownerLevel ? main : sectors.find(sector => sector.levelInfoActor === ownerLevel);

        if (!level) throw new Error(`Pawn '${owner.name}' has no registered level for water selection.`);

        const selected = this.renderManager.getPhysicsManager().getPhysicsVolume(level, position, owner);

        return this.getWaterVolumeData(selected);
    }

    protected getWaterVolumeData(selected: PhysicsVolume): IWaterVolumeDecodeInfo | null {
        if (!selected || !selected.getUnrealScriptProperty("bL2WaterVolume")) return null;

        const sectors = this.renderManager.getLoadedSectors(), main = this.renderManager.getLevel();
        const info = main && main.waterVolumes.find(volume => volume.uuid === selected.actorUuid);

        if (info) return info;

        for (const sector of sectors) {
            const volume = sector.waterVolumes.find(volume => volume.uuid === selected.actorUuid);

            if (volume) return volume;
        }

        throw new Error(`Water volume '${selected.name}' has no decoded water data.`);
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
        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
        query.ignorePawns = !query.sourceIsPlayer;
        query.zeroExtent = false;

        let hit: CheckResult_T;
        moveActorDepth++;
        try { hit = this.physicsManager.moveActor(query, this.getParent()); }
        finally { moveActorDepth--; }

        position.copy(this.getPosition());

        return hit;
    }

    protected castShape(position: Vector3, movement: Vector3, ignorePawns: boolean = false): CheckResult_T | null {
        const bodyPosition = tmpBodyPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight);
        const query = this.collisionQuery;

        query.location = bodyPosition;
        query.delta = movement;
        query.extent = tmpStepPosition.set(this.collisionRadius, this.collisionRadius, this.collisionHeight);
        query.sourceCollider = this.collider;
        query.sourceBody = this.rigidbody;
        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
        query.ignorePawns = !query.sourceIsPlayer || ignorePawns;
        query.zeroExtent = false;

        return this.physicsManager.singleLineCheck(query);
    }

    protected findFloor(position: Vector3, movement: Vector3, ignorePawns: boolean = false): CheckResult_T | null {
        let hit = this.castShape(position, movement, ignorePawns);

        if (hit && hit.normal.z >= MIN_FLOOR_Z) return hit;

        const query = this.collisionQuery;

        query.location = tmpBodyPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight);
        query.delta = movement;
        query.extent = tmpStepPosition.set(0, 0, this.collisionHeight);
        query.sourceCollider = this.collider;
        query.sourceBody = this.rigidbody;
        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
        query.ignorePawns = !query.sourceIsPlayer || ignorePawns;
        query.zeroExtent = false;

        hit = this.physicsManager.singleLineCheck(query);

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
        if (this.keyboardRotationDirection !== null || this.keyboardRotationYaw !== null) this.updateKeyboardRotation(deltaTime);
        if (!this.hasDesiredRotation) return;

        const deltaRate = (this.getParent() as any).isPlayer ? Math.round(PLAYER_YAW_RATE * deltaTime) : Math.trunc(YAW_RATE * deltaTime);

        this.rotationYaw = fixedTurn(this.rotationYaw, this.desiredRotationYaw, deltaRate);
        this.getRotation().set(0, 0, this.rotationYaw * Math.PI / 32768 - Math.PI / 2);

        if (this.rotationYaw === this.desiredRotationYaw) this.hasDesiredRotation = false;
    }

    protected updateKeyboardRotation(deltaTime: number) {
        if (this.actorState.locomotion || this.findComponent<PawnAttackComponent>("pawnAttack")?.isAttacking()) return;

        const rate = (this.getParent().getUnrealScriptProperty("KayboardRotationRate") as Vector3Arr)[1];
        let yaw = this.keyboardRotationDirection !== null ? this.rotationYaw : signedYaw(this.rotationYaw);

        // APawn::Tick 0x865fc2..0x8661f6: keyboard direction, then server stop-heading correction.
        if (this.keyboardRotationDirection !== null) yaw = Math.trunc(yaw + this.keyboardRotationDirection * rate * deltaTime);
        else if (Math.abs(this.keyboardRotationYaw - yaw) < rate * deltaTime) {
            yaw = this.keyboardRotationYaw;
            this.keyboardRotationYaw = null;
            this.keyboardRotationSpeed = 0;
        } else {
            const difference = this.keyboardRotationYaw - yaw;

            // Bluff's server rate exceeds the keyboard rate; clamp the step to avoid overshooting.
            yaw = Math.trunc(yaw + Math.sign(difference) * Math.min(Math.abs(difference), (this.keyboardRotationSpeed || rate) * deltaTime));
        }

        this.desiredRotationYaw = yaw & 65535;
        this.hasDesiredRotation = true;
    }

    public checkAnimationState(deltaTime: number) {
        // APawn::UpdateMovementAnimation 0x8bbfdf..0x8bc0f2; OldRotYaw writer 0x8bc5ed.
        const yawChange = this.rotationYaw - this.oldRotationYaw;
        const isTurning = Math.abs(deltaTime === 0 ? yawChange : yawChange / (deltaTime * 1000)) > 1;

        this.oldRotationYaw = this.rotationYaw;

        if (this.actorState.state === "dying") return;

        const parent = this.getParent(), level = parent.getUnrealScriptProperty("Level") as ScriptHost_T, isMoving = this.velocity.lengthSq() > 0;

        if (parent.scriptClassId && (!level || getProperty(level, "NetMode") !== 1)) {
            const controller = parent.getUnrealScriptProperty("Controller") as ScriptHost_T;
            const arrReservedMovePoint = controller && getProperty(controller, "ReservedMovePoint") as ScriptValue_T[];

            if (controller && !(arrReservedMovePoint && arrReservedMovePoint.length) && !getProperty(controller, "ReservedMoveActor") && !isMoving)
                parent.setUnrealScriptProperty("MoveTimer", 0);
            else if (this.physicsMode !== "falling" && this.physicsMode !== "nMover" && (this.physicsMode !== "swimming" || parent.getUnrealScriptProperty("bHitGroundInWater")))
                parent.setUnrealScriptProperty("MoveTimer", Math.fround((parent.getUnrealScriptProperty("MoveTimer") as number) + Math.fround(deltaTime)));
        }

        if (this.getParent().scriptClassId && this.getParent().getUnrealScriptProperty("bUpdateMovementAnim")) return;

        const action = this.getParent().getAnimationAction();

        if (!this.actorState.locomotion && (action && action.loop === LoopOnce || this.findComponent<PawnAttackComponent>("pawnAttack")?.isAttacking())) return;

        const state: PawnMovementState_T = !this.hasStartedPhysics ? "idle" : this.physicsMode === "falling" ? "falling" : this.physicsMode === "swimming" ? isMoving ? "swimming" : "swimmingIdle" : isMoving ? this.isWalking ? "walking" : "running" : isTurning && this.getParent().scriptClassId ? "turning" : "idle";

        if (state === this.actorState.state && this.getComponent<AnimationComponent>("animation").isPlayingMovement(state)) return;

        this.actorState.state = state;
        this.getParent().playMovementAnimation(state);
    }

    public goTo(position: Vector3) {
        // console.log(`[actor] goTo from=(${this.getPosition().x}, ${this.getPosition().y}, ${this.getPosition().z}) to=(${position.x}, ${position.y}, ${position.z})`);
        this.vehicleId = 0;
        this.stopNMover();
        this.validateLocationPending = false;
        this.actorState.locomotion = true;
        this.actorState.desired.position.copy(position);
        this.actorState.desired.actor = null;
        this.actorState.desired.offset = 0;
        this.actorState.desired.faceMovement = true;
        this.actorState.desired.faceTarget = null;
        const controller = this.getParent().getUnrealScriptProperty("Controller") as ScriptHost_T;

        if (controller) setProperty(controller, "Destination", position.toArray().map(Math.fround));
    }

    public goToActor(actor: Object3D, offset: number = 0) {
        this.vehicleId = 0;
        this.stopNMover();
        this.validateLocationPending = false;
        this.actorState.locomotion = true;
        actor.getWorldPosition(this.actorState.desired.position);
        this.actorState.desired.actor = actor;
        this.actorState.desired.offset = offset;
        this.actorState.desired.faceMovement = true;
        this.actorState.desired.faceTarget = null;
        const controller = this.getParent().getUnrealScriptProperty("Controller") as ScriptHost_T;

        if (controller) setProperty(controller, "Destination", (getProperty(actor as unknown as ScriptHost_T, "Location") as Vector3Arr).map(Math.fround));
    }

    public copyMovement(component: PawnMovementComponent): void {
        const desired = this.actorState.desired, source = component.actorState.desired;

        this.validateLocationPending = false;
        this.stopNMover();
        this.nMover = component.nMover;
        this.flyDestination = component.flyDestination;
        for (const field of ["ValidateLocationMoveTime", "ValidateLocationSpeed"])
            this.getParent().setUnrealScriptProperty(field, component.getParent().getUnrealScriptProperty(field));
        if (this.nMover) {
            this.physicsMode = "nMover";
            this.hasStartedPhysics = true;
            this.adjustToFloor = this.teleportLanding = false;
        }
        this.actorState.locomotion = component.actorState.locomotion;
        this.vehicleId = component.vehicleId;
        this.vehicleMovePoint.copy(component.vehicleMovePoint);
        desired.position.copy(source.position);
        desired.actor = source.actor;
        desired.offset = source.offset;
        desired.faceMovement = source.faceMovement;
        desired.faceTarget = source.faceTarget;
        const controller = this.getParent().getUnrealScriptProperty("Controller") as ScriptHost_T, sourceController = component.getParent().getUnrealScriptProperty("Controller") as ScriptHost_T;

        if (controller && sourceController) setProperty(controller, "Destination", (getProperty(sourceController, "Destination") as Vector3Arr).slice());
    }

    public moveInDirection(direction: Vector3, faceMovement: boolean = true) {
        if (!this.isInteractive()) return;

        this.vehicleId = 0;
        this.stopNMover();
        this.validateLocationPending = false;
        this.actorState.locomotion = true;
        this.actorState.desired.position.copy(direction).normalize().multiplyScalar(100000).add(this.getPosition());
        this.actorState.desired.actor = null;
        this.actorState.desired.offset = 0;
        this.actorState.desired.faceMovement = faceMovement;
    }

    public replaceTarget(actor: Object3D, replacement: Object3D): void {
        const desired = this.actorState.desired;

        if (desired.actor === actor) desired.actor = replacement;
        if (desired.faceTarget === actor) desired.faceTarget = replacement;
    }

    public faceActor(actor: Object3D | null) {
        if (!this.isInteractive()) return;

        this.actorState.desired.faceTarget = actor;
    }

    public stopMove() {
        this.vehicleId = 0;
        this.stopNMover();
        this.actorState.locomotion = false;
        this.actorState.desired.actor = null;
        this.actorState.desired.faceTarget = null;
        this.acceleration.set(0, 0, 0);
        this.desiredRotationYaw = this.rotationYaw;
        this.hasDesiredRotation = false;
        this.adjustToFloor = this.teleportLanding = false;
        this.validateLocationPending = false;
    }

    public stopMoving() {
        this.vehicleId = 0;
        this.stopNMover();
        this.validateLocationPending = false;
        this.actorState.locomotion = false;
        this.actorState.desired.actor = null;
        this.acceleration.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
    }

    public moveInVehicle(vehicleId: number, position: Vector3): void {
        this.vehicleId = vehicleId;
        this.vehicleMovePoint.copy(position);
    }

    protected tickMoveInVehicle(): void {
        const vehicleId = this.vehicleId;
        const vehicle = this.renderManager.getParent().getComponent("network").getVehicleActor(vehicleId);
        const controller = this.getParent().getUnrealScriptProperty("Controller") as ScriptHost_T;

        if (!vehicle || !controller || getProperty(controller, "bDead")) return;

        // APawn::TickMoveInVehicle 0x10593bc0 rotates the queued center by current vehicle yaw.
        const yaw = (vehicle.getUnrealScriptProperty("Rotation") as Vector3Arr)[1];
        const sine = sinRotator(yaw), cosine = sinRotator(yaw + 16384), point = this.vehicleMovePoint;

        tmpVehicleDestination.set(Math.fround(Math.fround(point.x * cosine - point.y * sine) + vehicle.position.x), Math.fround(Math.fround(point.x * sine + point.y * cosine) + vehicle.position.y), Math.fround(point.z + vehicle.position.z) - this.collisionHeight);
        this.goTo(tmpVehicleDestination);
        this.vehicleId = vehicleId;
    }

    public setWalking(isWalking: boolean) {
        this.isWalking = isWalking;
        const controller = this.getParent().getUnrealScriptProperty("Controller") as ScriptHost_T;
        if (controller) setProperty(controller, "MoveType", isWalking ? PMoveType_T.PMT_SLOW : PMoveType_T.PMT_FAST);
    }

    public isIdle(): boolean { return this.actorState.state === "idle"; }
    public isDying(): boolean { return this.actorState.state === "dying"; }
    public isRunning(): boolean { return this.actorState.state === "running"; }
    public isLocomoting(): boolean { return this.actorState.locomotion; }
    public isWalkingMovement(): boolean { return this.isWalking; }
    public isSwimmingMovement(): boolean { return this.physicsMode === "swimming"; }
    public isFlyingMovement(): boolean { return this.physicsMode === "flying"; }
    public getSpeed(): number { return this.velocity.length(); }
    public isUnderwaterMovement(): boolean {
        tmpWaterPosition.copy(this.getPosition()).addScaledVector(tmpUp, this.collisionHeight * 2);

        return !!this.getWaterVolumeAt(tmpWaterPosition);
    }

    public setFlying(isFlying: boolean) {
        this.setBase(null);
        if (!this.nMover) this.physicsMode = isFlying ? "flying" : "falling";
        this.isGrounded = false;

        if (isFlying) {
            this.hasStartedPhysics = true;
            this.setCollisionSize(WYVERN_COLLISION_RADIUS, WYVERN_COLLISION_HEIGHT);
        }
    }

    public setMovementSpeeds(groundSpeed: number, walkSpeed: number, waterSpeed: number) {
        if (![groundSpeed, walkSpeed, waterSpeed].every(speed => Number.isFinite(speed) && speed >= 0)) throw new Error(`Invalid pawn speeds '${groundSpeed}/${walkSpeed}/${waterSpeed}'.`);

        this.groundSpeed = groundSpeed;
        this.walkSpeed = walkSpeed;
        this.waterSpeed = waterSpeed;

        const parent = this.getParent();

        if (parent.scriptClassId) {
            parent.setUnrealScriptProperty("GroundSpeed", Math.fround(this.isWalking ? walkSpeed : groundSpeed));
            parent.setUnrealScriptProperty("WaterSpeed", Math.fround(waterSpeed));
        }
    }

    public setRotationYaw(yaw: number) {
        this.rotationYaw = this.desiredRotationYaw = yaw & 65535;
        this.hasDesiredRotation = false;
        this.keyboardRotationDirection = this.keyboardRotationYaw = null;
        this.getRotation().set(0, 0, this.rotationYaw * Math.PI / 32768 - Math.PI / 2);
    }

    public startRotating(direction: number, speed: number) {
        this.keyboardRotationDirection = direction;
        this.keyboardRotationSpeed = speed;
    }

    public finishRotating(yaw: number, speed: number) {
        this.stopRotating();
        this.keyboardRotationSpeed = speed;

        // OnFinishRotating 0x73caee..0x73cb09 only starts correcting errors greater than 5000.
        if (this.keyboardRotationYaw !== null || Math.abs(signedYaw(yaw) - signedYaw(this.rotationYaw)) > 5000) this.keyboardRotationYaw = signedYaw(yaw);
    }

    public stopRotating() {
        this.keyboardRotationDirection = null;
        this.desiredRotationYaw = this.rotationYaw;
        this.hasDesiredRotation = false;
    }

    public resetRotationYaw(yaw: number) { // ResetDefaultCharacterYaw 0x1042d920 queues keyboard yaw correction, retaining the held direction.
        while (yaw > 65536) yaw -= 65536;
        while (yaw < 0) yaw += 65536;

        if (this.rotationYaw !== yaw) this.keyboardRotationYaw = signedYaw(Math.trunc(yaw));
    }

    public getRotationYaw(): number { return this.rotationYaw; }
    public syncRotationYaw(yaw: number): void { this.rotationYaw = yaw | 0; }
    public addBaseRotation(yaw: number): void {
        this.desiredRotationYaw = (this.desiredRotationYaw + yaw) & 65535;
        this.oldRotationYaw += yaw;
        if (this.keyboardRotationYaw !== null) this.keyboardRotationYaw = signedYaw(this.keyboardRotationYaw + yaw);
    }

    public setAirSpeed(airSpeed: number) {
        if (!Number.isFinite(airSpeed) || airSpeed < 0) throw new Error(`Invalid pawn AirSpeed '${airSpeed}'.`);

        this.airSpeed = airSpeed;
        if (this.getParent().scriptClassId) this.getParent().setUnrealScriptProperty("AirSpeed", Math.fround(airSpeed));
    }

    public setCollisionSize(collisionRadius: number, collisionHeight: number) {
        if (!Number.isFinite(collisionRadius) || collisionRadius < 0) throw new Error(`Invalid pawn CollisionRadius '${collisionRadius}'.`);
        if (!Number.isFinite(collisionHeight) || collisionHeight < 0) throw new Error(`Invalid pawn CollisionHeight '${collisionHeight}'.`);

        this.collisionRadius = collisionRadius;
        this.collisionHeight = collisionHeight;

        if (this.collider) this.collider.setShape(new RAPIER.Cylinder(collisionHeight, collisionRadius));
        this.syncCollisionLocation();

        this.dispatchEvent(PAWN_COLLISION_SIZE_CHANGED_EVENT);
    }

    public syncCollisionLocation(): void {
        this.analyticalOrigin.set(NaN, NaN, NaN);
        const primitive = this.getCollisionPrimitive();
        this.renderManager.getPhysicsManager().updatePawnCollision(this.getParent());

        if (!this.rigidbody) return;

        this.rigidbody.setTranslation(primitive.center, true);
        this.rigidbody.setNextKinematicTranslation(primitive.center);
        this.collider.setTranslation(primitive.center);
    }

    public l2Teleport(position: Vector3, base: ICollidable = null) {
        this.teleportTo(position, true, base);
        this.teleportLanding = this.adjustToFloor;
    }

    public validateLocation(position: Vector3) {
        this.validateLocationPending = false;

        const parent = this.getParent();
        const action = parent.getUnrealScriptProperty("NPrimeAction") as any;

        if (this.actorState.locomotion) {
            const speed = Math.fround(this.getCurSpeed()), rate = parent.getUnrealScriptProperty("NonAttackSpeedRate") as number;
            const desired = this.actorState.desired;

            if (desired.actor) desired.actor.getWorldPosition(tmpPosition);
            else tmpPosition.copy(desired.position);

            const x = Math.fround(position.x) - Math.fround(tmpPosition.x), y = Math.fround(position.y) - Math.fround(tmpPosition.y);
            const delta = (getDistance2D(this.getPosition(), tmpPosition) - Math.sqrt(x * x + y * y)) / 3;
            const environment = parent.getUnrealScriptProperty("Environment");

            parent.setUnrealScriptProperty("ValidateLocationMoveTime", 3);
            parent.setUnrealScriptProperty(environment === 1 ? "WaterSpeed" : environment === 2 ? "AirSpeed" : "GroundSpeed", Math.fround(speed * rate + delta));
            return;
        }

        if (action.ActionID || this.getComponent<PawnAttackComponent>("pawnAttack").hasAction()) return;

        const distance = Math.hypot(position.x - this.getPosition().x, position.y - this.getPosition().y);

        if (distance > 2 && distance < 200) {
            parent.setUnrealScriptProperty("ValidateLocationMoveTime", 0);
            parent.setUnrealScriptProperty("ValidateLocationSpeed", 0);
            this.goTo(position);
            return;
        }

        if (distance < 200) return;

        this.validatePosition.copy(position);
        this.validateLocationPending = true;
        this.updateValidateLocation();
    }

    protected updateValidateLocation() {
        if (!this.validateLocationPending || !this.renderManager.isSectorCollisionReady(this.validatePosition)) return;

        this.validateLocationPending = false;
        this.physicsManager.farMoveActor(this.getParent(), this.findAdjustmentLocation(this.validatePosition, false, true));
    }

    protected findAdjustmentLocation(position: Vector3, teleport: boolean, validate: boolean = false): Vector3 {
        // AdjustPawnLocation 0x7426ac / L2_Teleport 0x83bb90 / OnValidateLocation 0x743434.
        let hit: CheckResult_T = null;
        let i = 0;
        const query = this.adjustmentQuery;

        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.sourceCollider = this.collider;
        query.sourceBody = this.rigidbody;
        query.extent.set(this.collisionRadius, this.collisionRadius, this.collisionHeight);

        for (; i < 30; i++) {
            query.location.copy(position).addScaledVector(tmpUp, teleport ? (i + 1) * 30 : this.collisionHeight + 20 + i * 30);
            query.delta.set(0, 0, teleport ? -(i + 1) * 60 : -(validate ? 30 : 50) - this.collisionHeight - i * 60);
            hit = this.physicsManager.singleLineCheck(query);

            if (hit && hit.location.z !== 0) break;
        }

        if (i === 30) tmpFloorPosition.copy(position);
        else tmpFloorPosition.copy(hit.location);
        if (hit && (!(teleport || validate) || i < 30)) {
            const distance = (teleport || validate ? Math.fround(hit.time) : hit.time) * 12;
            const minimum = teleport || validate ? Math.fround(1.9) : 1.9;

            if (distance < minimum) tmpFloorPosition.z += (teleport || validate ? (Math.fround(2.4) + minimum) * 0.5 : FLOOR_DISTANCE) - distance;
        }

        return tmpFloorPosition;
    }

    public resetPhysicInit() { this.isPhysicInit = false; }

    public teleportTo(position: Vector3, adjustToFloor: boolean = false, base: ICollidable = null) {
        this.vehicleId = 0;
        this.velocity.set(0, 0, 0);
        this.hasDesiredRotation = false;
        this.keyboardRotationDirection = this.keyboardRotationYaw = null;

        this.actorState.locomotion = false;
        this.actorState.desired.position.copy(position);
        this.actorState.desired.actor = null;
        this.adjustLocation(position, adjustToFloor, base);
    }

    public adjustLocation(position: Vector3, adjustToFloor: boolean = true, base: ICollidable = null) {
        this.stopNMover();
        this.enterRiseTargetZ = null;
        this.enterRiseVelocity = 0;
        const isFlying = this.physicsMode === "flying";

        this.adjustToFloor = adjustToFloor && !isFlying;
        this.teleportLanding = false;
        this.isPhysicInit = false;
        this.validateLocationPending = false;
        this.getPosition().copy(position);
        this.setBase(base);
        this.getTransformComponent().updateBaseRelativePosition();
        this.getTransformComponent().updateRelativeLocation();
        this.isGrounded = false;
        if (!isFlying) {
            this.physicsMode = "falling";
            this.hasStartedPhysics = false;
        }
        this.dispatchEvent(PAWN_TELEPORTED_EVENT);

        this.syncCollisionLocation();
    }
    public getVelocity(): Vector3 { return this.velocity; }
    public getGroundSpeed(): number { return this.getParent().scriptClassId ? this.getMovementSpeed(0) : this.groundSpeed; }
    public getAcceleration(): Vector3 { return this.acceleration; }
    public getPhysicsMode(): PhysicsMode_T { return this.physicsMode; }
    public setVelocity(value: Vector3Arr): void { this.velocity.fromArray(value); }
    public setAcceleration(value: Vector3Arr): void { this.acceleration.fromArray(value); }
    public setPhysicsMode(value: number): void {
        const modes: PhysicsMode_T[] = ["none", "walking", "falling", "swimming", "flying"];
        const mode = value === EPhysics_T.PHYS_NMover ? "nMover" : modes[value];

        if (!mode) throw new Error(`Unsupported UnrealScript physics mode '${value}'.`);
        if (mode === "nMover" && !this.nMover) throw new Error(`Pawn '${this.getParent().name}' has no NMover.`);

        if (mode !== "nMover") this.stopNMover();
        this.physicsMode = mode;
    }

    public flyTo(destination: Vector3): void {
        this.stopMoving();
        this.flyDestination = destination.clone();
        if (this.isInteractive() && this.renderManager.isSectorCollisionReady(destination)) this.startNMover();
    }

    public getCurSpeed(environment = -1): number {
        const parent = this.getParent(), controller = parent.getUnrealScriptProperty("Controller") as ScriptHost_T;
        if (controller && getProperty(controller, "bCameraWalking") && this.getComponent<ScriptComponent>("script").getVM().invokeNative(parent, controller, 303, "IsA", ["LineagePlayerController"]))
            return parent.getUnrealScriptProperty("AirSpeed") as number;
        if (parent.getUnrealScriptProperty("bNotRotationMoving")) return (parent.getUnrealScriptProperty("GroundMinSpeed") as number) * Math.fround(2 / 3);
        if (environment === -1) environment = parent.getUnrealScriptProperty("Environment") as number;

        let isFast = !!controller && getProperty(controller, "MoveType") === PMoveType_T.PMT_FAST;
        if (isFast && !parent.getUnrealScriptProperty("bNpc") && environment !== 1 && environment !== 2) {
            const animation = (parent.getUnrealScriptProperty("WalkAnimName") as string[])[parent.getUnrealScriptProperty("CurWeaponType") as number];
            if (this.getComponent<AnimationComponent>("animation").getAnimationClip(animation))
                isFast = (parent.getUnrealScriptProperty("MoveTimer") as number) > (parent.getUnrealScriptProperty("WalkAnimFrameInMove") as number) * Math.fround(1 / 30);
        }

        return parent.getUnrealScriptProperty(environment === 2 ? isFast ? "AirMaxSpeed" : "AirMinSpeed" : environment === 1 ? isFast ? "WaterMaxSpeed" : "WaterMinSpeed" : isFast ? "GroundMaxSpeed" : "GroundMinSpeed") as number;
    }

    public addMoveTo(origin: Vector3, destination: Vector3): void {
        const parent = this.getParent(), speed = Math.fround(this.getCurSpeed()), rate = parent.getUnrealScriptProperty("NonAttackSpeedRate") as number;
        let time = 0, delta = 0;

        if (speed > 0) {
            const distance = getDistance2D(origin, destination);

            if (distance > 0 && rate > 0) {
                time = Math.fround(rate / speed * distance);
                delta = Math.fround((getDistance2D(this.getPosition(), destination) - distance) / time);
            }
        }

        parent.setUnrealScriptProperty("ValidateLocationMoveTime", time);
        parent.setUnrealScriptProperty("ValidateLocationSpeed", delta);
        if (speed > 0) this.goTo(destination);
    }

    public addMoveToward(origin: Vector3, actor: BaseActor, offset: number): void {
        const parent = this.getParent(), speed = Math.fround(this.getCurSpeed());
        let time = 0, delta = 0;

        if (speed > 0) {
            const distance = getDistance2D(origin, actor.position);

            if (distance > 0 && this.getMovementSpeed(0) > 0) {
                time = Math.fround(distance / speed);
                delta = Math.fround((getDistance2D(this.getPosition(), actor.position) - distance) / time);
            }
        }

        parent.setUnrealScriptProperty("ValidateLocationMoveTime", time);
        parent.setUnrealScriptProperty("ValidateLocationSpeed", delta);
        if (speed > 0) this.goToActor(actor, offset);
    }

    public addFlyTo(origin: Vector3, destination: Vector3): void {
        const parent = this.getParent(), speed = Math.fround(this.getCurSpeed());
        let time = 0, delta = 0;
        if (speed > 0) {
            const distance = getDistance(origin, destination);
            if (distance > 0 && this.getMovementSpeed(0) > 0) {
                time = Math.fround(distance / speed);
                tmpPosition.copy(this.getPosition());
                tmpPosition.z += this.collisionHeight;
                delta = Math.fround((getDistance(tmpPosition, destination) - distance) / time);
            }
        }
        parent.setUnrealScriptProperty("ValidateLocationMoveTime", time);
        parent.setUnrealScriptProperty("ValidateLocationSpeed", delta);
        if (speed > 0) this.flyTo(destination);
    }

    protected updateSpeedCorrection(deltaTime: number): void {
        const parent = this.getParent();
        if (!parent.scriptClassId) return;

        const time = parent.getUnrealScriptProperty("ValidateLocationMoveTime") as number;

        if (time && parent.getUnrealScriptProperty("Controller") && this.renderManager.getParent().getComponent("network").isInWorld()) {
            const remaining = Math.fround(time - Math.fround(deltaTime));
            parent.setUnrealScriptProperty("ValidateLocationMoveTime", remaining > 0 ? remaining : 0);
            if (remaining <= 0) parent.setUnrealScriptProperty("ValidateLocationSpeed", 0);
        }

        const rate = parent.getUnrealScriptProperty("NonAttackSpeedRate") as number, delta = parent.getUnrealScriptProperty("ValidateLocationSpeed") as number;

        parent.setUnrealScriptProperty("GroundSpeed", Math.fround(this.getCurSpeed(0) * rate + delta));
        parent.setUnrealScriptProperty("WaterSpeed", Math.fround(this.getCurSpeed(1) * rate + delta));
        parent.setUnrealScriptProperty("AirSpeed", Math.fround(this.getCurSpeed(2) * rate + delta));
    }

    protected getMovementSpeed(environment = -1): number {
        if (environment === -1) environment = this.physicsMode === "swimming" ? 1 : this.physicsMode === "flying" ? 2 : 0;
        if (this.getParent().scriptClassId) return this.getParent().getUnrealScriptProperty(environment === 1 ? "WaterSpeed" : environment === 2 ? "AirSpeed" : "GroundSpeed") as number;

        const speed = environment === 1 ? this.waterSpeed : environment === 2 ? this.airSpeed : this.isWalking ? this.walkSpeed : this.groundSpeed;
        const delta = Number(this.getParent().getUnrealScriptProperty("ValidateLocationSpeed"));
        return delta === 0 ? speed : Math.fround(speed + delta);
    }

    protected startNMover(): void {
        const destination = this.flyDestination, query = this.adjustmentQuery;
        this.flyDestination = null;
        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.sourceCollider = this.collider;
        query.sourceBody = this.rigidbody;
        query.extent.set(this.collisionRadius, this.collisionRadius, this.collisionHeight);

        let radius = 10;
        tmpFloorPosition.copy(destination);
        tmpBodyPosition.copy(destination);
        tmpBodyPosition.z += 40;

        // AController::FlyTo 0x10533b90..0x10533ffa.
        for (let i = 0; i < 100; i++) {
            for (let j = 0; j < 5; j++) {
                tmpFloorPosition.z -= 50;
                query.delta.subVectors(tmpFloorPosition, tmpBodyPosition);
                const hit = this.physicsManager.singleLineCheck(query);
                if (!hit || hit.location.z === 0) continue;

                const landing = hit.location.clone();
                const time = Math.fround(hit.time) * 12, clearance = Math.fround(1.9);
                if (time < clearance) landing.z += clearance - time;
                landing.z -= this.collisionHeight;
                const target = landing.clone();
                target.z += this.getPosition().distanceTo(landing);
                const mover = new L2NMover(target, landing, 300, 100);
                this.nMover = new L2NMover(this.getPosition(), mover.position, 300, 100, mover);
                this.physicsMode = "nMover";
                this.hasStartedPhysics = true;
                this.adjustToFloor = this.teleportLanding = false;
                this.setBase(null);
                return;
            }
            if (i % 4 === 0) radius += 10;
            tmpFloorPosition.copy(destination);
            if (i % 4 === 1) tmpFloorPosition.x += radius;
            else if (i % 4 === 2) tmpFloorPosition.x -= radius;
            else if (i % 4 === 3) tmpFloorPosition.y += radius;
            else tmpFloorPosition.y -= radius;
            tmpBodyPosition.copy(tmpFloorPosition);
        }
    }

    protected physNMover(position: Vector3, deltaTime: number): void {
        const mover = this.nMover;
        mover.tick(deltaTime);
        tmpMovement.subVectors(mover.position, position);
        this.moveActor(position, tmpMovement);
        if (!mover.isEnded()) return;

        this.nMover = null;
        this.physicsMode = "walking";
        this.isPhysicInit = false;
    }

    protected stopNMover(): void {
        this.nMover = null;
        this.flyDestination = null;
        if (this.physicsMode === "nMover") {
            this.physicsMode = "falling";
            this.isPhysicInit = false;
        }
    }

    public onDetach(): void {
        this.stopNMover();
        super.onDetach();
    }
    public setDying(): void {
        this.actorState.state = "dying";
        this.keyboardRotationDirection = this.keyboardRotationYaw = null;
        this.collisionProfile.blockPlayers = false;
        this.stopMoving();
    }
    public setRevived(): void {
        this.actorState.reset();
        this.collisionProfile.blockPlayers = true;
    }
    public resetAnimationState(): void { if (!this.isDying()) this.actorState.state = "idle"; }
    public startEnterRise(mode: number): void {
        if (!mode) return;

        const targetZ = this.getPosition().z;

        if (mode === 1) this.getPosition().z -= this.collisionHeight * 2;
        else if (mode === 2) this.getPosition().z += this.collisionHeight * 2;

        this.enterRiseTargetZ = targetZ;
        this.enterRiseVelocity = (targetZ - this.getPosition().z) * ENTER_RISE_RATE;
    }
    public releaseCollider(): void {
        this.collider = null;
        this.rigidbody = null;
    }
}

class ActorState {
    public state: PawnMovementState_T = "idle";
    public locomotion = false;
    public readonly desired: DesiredState_T = {
        position: new Vector3(),
        actor: null,
        offset: 0,
        faceMovement: true,
        faceTarget: null
    };

    public reset(): void {
        this.state = "idle";
        this.locomotion = false;
    }
}

export type DesiredState_T = {
    position: Vector3;
    actor: Object3D | null;
    offset: number;
    faceMovement: boolean;
    faceTarget: Object3D | null;
};

export type PhysicsMode_T = "none" | "walking" | "falling" | "swimming" | "flying" | "nMover";
export type PawnMovementState_T = "idle" | "turning" | "walking" | "running" | "dying" | "falling" | "swimming" | "swimmingIdle";

function signedYaw(yaw: number): number { return ((yaw + 32767) & 65535) - 32767; }

function getDistance2D(a: Vector3, b: Vector3): number {
    const x = Math.fround(a.x) - Math.fround(b.x), y = Math.fround(a.y) - Math.fround(b.y);
    return Math.fround(Math.sqrt(x * x + y * y));
}

function getDistance(a: Vector3, b: Vector3): number {
    const x = Math.fround(Math.fround(a.x) - Math.fround(b.x)), y = Math.fround(Math.fround(a.y) - Math.fround(b.y)), z = Math.fround(Math.fround(a.z) - Math.fround(b.z));
    return Math.fround(Math.sqrt(x * x + y * y + z * z));
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
        const distance = delta.dot(tmpStepUp) * (1 - hitTime);
        delta.copy(tmpStepUp).multiplyScalar(distance);

        if (desiredDir.dot(delta) < 0) delta.multiplyScalar(-1);
    } else {
        delta.addScaledVector(hitNormal, -delta.dot(hitNormal)).multiplyScalar(1 - hitTime);

        if (delta.dot(desiredDir) <= 0) delta.set(0, 0, 0);
    }
}

export default PawnMovementComponent;
