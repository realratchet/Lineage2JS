import RAPIER from "@dimforge/rapier3d";
import { Box3, Euler, LoopOnce, Object3D, Quaternion, Sphere, Vector3 } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T } from "../../game/components";
import { SCRIPT_NATIVE_EVENT } from "../../game/script-component";
import { PhysicsComponent } from "./physics-component";
import { findVolumeTransition } from "../volume-bsp";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "../../objects/objects";
import type { CheckResult_T, CollisionQuery_T } from "../collision-world";
import type { ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import type TransformComponent from "../../objects/components/transform-component";
import type { IWaterVolumeDecodeInfo, Vector3Arr } from "@l2js/engine";

const tmpPosition = new Vector3();
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
// APawn::SpawnEnterEvent (0x8b47e0): rise moves 5/9 of its full offset per second.
const ENTER_RISE_RATE = 5 / 9;
const PAWN_TELEPORTED_EVENT = "pawnTeleported";

class PawnMovementComponent extends PhysicsComponent<BaseActor> {
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
    protected isGrounded = false;
    protected hasStartedPhysics = false;
    protected physicsMode: PhysicsMode_T = "falling";
    protected isWalking = false;
    protected airSpeed = AIR_SPEED;
    protected waterVolume: IWaterVolumeDecodeInfo = null;
    protected readonly ignoredActors = new Set<ICollidable>();
    protected readonly collisionQuery: CollisionQuery_T = { location: null, delta: null, extent: null, sourceIsPlayer: false };
    protected readonly actorState = new ActorState();
    protected enterRiseTargetZ: number = null;
    protected enterRiseVelocity = 0;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    protected get position(): Vector3 { return this.getParent().position; }
    protected get rotation(): Euler { return this.getParent().rotation; }
    protected get transformComponent(): TransformComponent { return this.getComponent("transform"); }

    public getPhysicsTickRate(): number { return this.tickRate; }
    public setPhysicsTickRate(tickRate: number): void { this.tickRate = tickRate; }

    public onPhysicsTick(currentTime: number, deltaTime: number, _actors: BaseActor[]): boolean {
        this.updatePhysics(currentTime, deltaTime * 0.001);

        return true;
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        if (type !== SCRIPT_NATIVE_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        const call = data as ScriptNativeCall_T;
        const name = call.name.toLowerCase();

        if (call.index !== 3970 && name !== "setphysics") return COMPONENT_EVENT_NOT_HANDLED;

        const context = call.context as any;

        if (typeof context.setUnrealScriptProperty === "function") context.setUnrealScriptProperty("Physics", call.args[0]);
        else if (context.scriptProperties instanceof Map) context.scriptProperties.set("Physics", call.args[0]);
        else throw new Error(`'${context.scriptClassId}' has no physics mode.`);
    }

    public getCollisionRadius() { return this.collisionRadius; }
    public getCollisionHeight() { return this.collisionHeight; }
    public getCollider(): RAPIER.Collider { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }
    public getBaseActor(): ICollidable | null { return this.transformComponent.getBase(); }
    public getBasedActors(): ReadonlySet<ICollidable> { return this.transformComponent.getBasedActors(); }
    public addBasedActor(actor: ICollidable) { this.transformComponent.addBasedActor(actor); }
    public removeBasedActor(actor: ICollidable) { this.transformComponent.removeBasedActor(actor); }
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

        const rigidbodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.position.x, this.position.y, this.position.z + this.collisionHeight);
        const colliderDesc = RAPIER.ColliderDesc.cylinder(this.collisionHeight, this.collisionRadius).setRotation(colliderRotation);

        this.rigidbody = physicsWorld.createRigidBody(rigidbodyDesc);
        this.collider = physicsWorld.createCollider(colliderDesc, this.rigidbody);

        return this.collider;
    }

    protected updatePhysics(currentTime: number, deltaTime: number) {
        if (this.enterRiseTargetZ !== null) {
            this.updateEnterRise(deltaTime);
            return;
        }

        const isInteractive = this.isInteractive();

        this.collisionProfile.collideActors = isInteractive;

        if (!this.rigidbody || !isInteractive) return;

        this.physicsManager.updateDynamicEntries(currentTime);

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
            if (actor !== this.getParent() && this.isOverlapping(actor, this.position)) this.ignoredActors.add(actor);
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
        const transform = this.transformComponent;
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
        this.rotation.set(0, 0, this.rotationYaw * Math.PI / 32768 - Math.PI / 2);
        transform.updateBaseTransform(tmpBasePosition, tmpBaseQuaternion);
    }

    public setBase(actor: ICollidable | null, floor?: Vector3): void {
        if (floor) this.floor.copy(floor);
        this.transformComponent.setBase(actor);
    }

    protected updateBaseRelativePosition(): void { this.transformComponent.updateBaseRelativePosition(); }

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
        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
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

            if (!(this.getParent() as any).isPlayer && tmpVelocityDelta.lengthSq() <= 90000)
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

    protected getWaterVolume(position: Vector3): IWaterVolumeDecodeInfo | null {
        tmpWaterPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight + WATERLINE_DEPTH);

        return this.getWaterVolumeAt(tmpWaterPosition);
    }

    protected getWaterVolumeAt(position: Vector3): IWaterVolumeDecodeInfo | null {
        let selected: IWaterVolumeDecodeInfo = null;

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
        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = true;
        query.zeroExtent = false;

        const hit = this.physicsManager.moveActor(query);

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
        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
        query.zeroExtent = false;

        return this.physicsManager.singleLineCheck(query);
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
        query.sourceActor = this.getParent();
        query.sourceIsPlayer = !!(this.getParent() as any).isPlayer;
        query.sourceProfile = this.collisionProfile;
        query.ignoredActors = this.ignoredActors;
        query.ignoreBases = false;
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
        if (!this.hasDesiredRotation) return;

        const deltaRate = (this.getParent() as any).isPlayer ? Math.round(PLAYER_YAW_RATE * deltaTime) : Math.trunc(YAW_RATE * deltaTime);

        this.rotationYaw = fixedTurn(this.rotationYaw, this.desiredRotationYaw, deltaRate);
        this.rotation.set(0, 0, this.rotationYaw * Math.PI / 32768 - Math.PI / 2);

        if (this.rotationYaw === this.desiredRotationYaw) this.hasDesiredRotation = false;
    }

    protected checkAnimationState() {
        if (this.actorState.state === "dying") return;

        const action = this.getParent().getAnimationAction();

        if (action && action.loop === LoopOnce) return;

        const isMoving = this.velocity.lengthSq() > 0;
        const state: PawnMovementState_T = !this.hasStartedPhysics ? "idle" : this.physicsMode === "falling" ? "falling" : this.physicsMode === "swimming" ? isMoving ? "swimming" : "swimmingIdle" : isMoving ? this.isWalking ? "walking" : "running" : "idle";

        if (state === this.actorState.state) return;

        this.actorState.state = state;
        this.getParent().playMovementAnimation(state);
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
    public isDying(): boolean { return this.actorState.state === "dying"; }
    public isRunning(): boolean { return this.actorState.state === "running"; }
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
        this.dispatchEvent(PAWN_TELEPORTED_EVENT);

        if (this.rigidbody)
            this.rigidbody.setTranslation(tmpBodyPosition.set(position.x, position.y, position.z + this.collisionHeight), true);
    }
    public getVelocity(): Vector3 { return this.velocity; }
    public getAcceleration(): Vector3 { return this.acceleration; }
    public getPhysicsMode(): PhysicsMode_T { return this.physicsMode; }
    public setVelocity(value: Vector3Arr): void { this.velocity.fromArray(value); }
    public setAcceleration(value: Vector3Arr): void { this.acceleration.fromArray(value); }
    public setPhysicsMode(value: number): void {
        const modes: PhysicsMode_T[] = ["none", "walking", "falling", "swimming", "flying"];
        const mode = modes[value];

        if (!mode) throw new Error(`Unsupported UnrealScript physics mode '${value}'.`);

        this.physicsMode = mode;
    }
    public setDying(): void {
        this.actorState.state = "dying";
        this.stopMoving();
    }
    public resetAnimationState(): void { this.actorState.reset(); }
    public startEnterRise(mode: number): void {
        if (!mode) return;

        const targetZ = this.position.z;

        if (mode === 1) this.position.z -= this.collisionHeight * 2;
        else if (mode === 2) this.position.z += this.collisionHeight * 2;

        this.enterRiseTargetZ = targetZ;
        this.enterRiseVelocity = (targetZ - this.position.z) * ENTER_RISE_RATE;
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
        swimToDepth: false,
        offset: 0,
        faceMovement: true,
        faceTarget: null
    };

    public reset(): void {
        this.state = "idle";
        this.locomotion = false;
    }
}

type DesiredState_T = {
    position: Vector3;
    actor: Object3D | null;
    swimToDepth: boolean;
    offset: number;
    faceMovement: boolean;
    faceTarget: Object3D | null;
};

type PhysicsMode_T = "none" | "walking" | "falling" | "swimming" | "flying";
type PawnMovementState_T = "idle" | "walking" | "running" | "dying" | "falling" | "swimming" | "swimmingIdle";

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

export default PawnMovementComponent;
export { PAWN_TELEPORTED_EVENT, PawnMovementComponent };
export type { PawnMovementState_T };
