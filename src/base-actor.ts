import { AnimationAction, AnimationClip, Bone, Box3, Mesh, Object3D, Quaternion, Vector3 } from "three";
import RAPIER from "@dimforge/rapier3d";
import type { ActorCollisionProfile_T, CollisionPrimitive_T, ICollidable } from "./objects/objects";
import RenderManager from "./rendering/render-manager";
import type { CheckResult_T } from "./physics/collision-world";
import { findVolumeTransition } from "./physics/volume-bsp";

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
const colliderRotation = new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2);

// Retail APawn::physWalking (0x8d4880) and APawn::stepUp (0x8cf640).
// live retail pawn (APawn+752/+756)
const COLLISION_RADIUS = 7.5;
const COLLISION_HEIGHT = 23;
const WYVERN_COLLISION_RADIUS = 60;
const WYVERN_COLLISION_HEIGHT = 80;
const MAX_STEP_HEIGHT = 10;
const FLOOR_CHECK_DISTANCE = 12;
const MIN_FLOOR_DISTANCE = 1.9;
const MAX_FLOOR_DISTANCE = 2.4;
const FLOOR_DISTANCE = 0.5 * (MIN_FLOOR_DISTANCE + MAX_FLOOR_DISTANCE);
const MIN_FLOOR_Z = 0.7;
const MAX_STEP_SIDE_Z = 0.7;
const STEP_RECURSE_DIST_SQ = 144;
const LEDGE_PROBE = 4;
const LEDGE_DROP = 14;
// live retail player pawn: run speed is APawn+5228, picked by the mode at +1712 (0x8d49ae)
const GROUND_SPEED = 133.88;
const WALK_SPEED = 95;
const WATER_SPEED = 80;
// Retail live wyvern pawn AirSpeed.
const AIR_SPEED = 118.09999084472656;
// live retail player pawn (APawn+5240)
const ACCEL_RATE = 2048;
const DEFAULT_VOLUME_GRAVITY_Z = -1500;
// Retail live FMagic: RotationRate.Yaw=65000, Controller.EnemyTurnSpeed=45000; APawn::physicsRotation doubles EnemyTurnSpeed.
const YAW_RATE = 65000;
const PLAYER_YAW_RATE = 90000;
const SPAWN_FLOOR_PROBE = 1000;
const DEFAULT_VOLUME_TERMINAL_VELOCITY = 2500;
const MOVEMENT_TWEEN_TIME = 0.1;
const IDLE_TWEEN_TIME = 0.2;
// Retail USubSkeletalMeshInstance::DynamicHairGetFrame (0x94f010) writes simulated bone coordinates.
const HAIR_STEP = 1 / 60;
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

class BaseActor extends Object3D implements ICollidable {
    public readonly isActor = true;
    public readonly isCollidable = true;
    public readonly type: string = "Actor";

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
    protected isAnimationsInit = false;
    protected hairStepTime = 0;
    protected readonly hairChains: HairChainState_T[] = [];
    protected blinkStartTime = -Infinity;
    protected blinkNextTime = 0;
    protected blinkIndex = 0;
    protected readonly blinkFaces: BlinkFaceState_T[] = [];
    protected readonly ignoredActors = new Set<ICollidable>();
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

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
        this.up.copy(tmpUp);
    }

    public getCollisionRadius() { return this.collisionRadius; }
    public getCollisionHeight() { return this.collisionHeight; }
    public getCollider(): RAPIER.Collider { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }
    public getBaseActor(): ICollidable | null { return this.base; }
    public getBasedActors(): ReadonlySet<ICollidable> { return this.basedActors; }
    public addBasedActor(actor: ICollidable) { this.basedActors.add(actor); }
    public removeBasedActor(actor: ICollidable) { this.basedActors.delete(actor); }
    public getCollisionProfile(): ActorCollisionProfile_T {
        this.collisionProfile.collisionRadius = this.collisionRadius;
        this.collisionProfile.collisionHeight = this.collisionHeight;

        return this.collisionProfile;
    }

    public getCollisionPrimitive(): CollisionPrimitive_T {
        // getWorldPosition re-multiplies the whole parent chain; every trace asks every pawn for its
        // primitive, so at n pawns that is n^2 chain walks per substep unless nothing moved
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

    public update(_renderManager: RenderManager, currentTime: number, deltaTime: number) {
        if (!this.rigidbody) {
            this.updateHair(currentTime * 0.001, deltaTime);
            this.updateBlink(currentTime * 0.001);
            return;
        }

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
        this.updateHair(currentTime * 0.001, deltaTime);
        this.updateBlink(currentTime * 0.001);
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

        if (desired.actor)
            desired.actor.getWorldPosition(desired.position);

        const distanceX = desired.position.x - position.x;
        const distanceY = desired.position.y - position.y;
        const isThreeDimensional = this.physicsMode === "swimming" || this.physicsMode === "flying";
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
        const dz = this.physicsMode === "swimming" || this.physicsMode === "flying" ? this.actorState.desired.position.z - position.z : 0;
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

        const visited = new Set<ICollidable>();

        for (let current = base; current; current = current.getBaseActor ? current.getBaseActor() as ICollidable & Object3D : null) {
            if (current === this || visited.has(current)) return;

            visited.add(current);
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
        return this.renderManager.collisionWorld.singleLineCheck({
            location: tmpBodyPosition.copy(start).addScaledVector(tmpUp, this.collisionHeight),
            delta: movement,
            extent: tmpTraceExtent.set(radius, radius, height),
            sourceCollider: this.collider,
            sourceBody: this.rigidbody,
            sourceActor: this,
            sourceIsPlayer: !!(this as any).isPlayer,
            sourceProfile: this.collisionProfile,
            ignoredActors: this.ignoredActors
        });
    }

    // APawn::CheckForLedges (0x8ca7f0); StopAtLedge (0x7feef0) is a hard false, so a player redirects.
    // Unreferenced: live capture over 5111 physWalking ticks got 0 hits here, so WantsLedgeCheck
    // (0x7feec0, Pawn+5120 & 0x24) is false in normal play - wire it up once those bits are decoded.
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
        tmpWaterPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight);

        let selected: GD.IWaterVolumeDecodeInfo = null;

        for (const sector of this.renderManager.getLoadedSectors()) {
            const volume = sector.getWaterVolumeAt(tmpWaterPosition);

            if (volume && (!selected || volume.priority >= selected.priority)) selected = volume;
        }

        return selected;
    }

    protected findWaterTransition(position: Vector3, movement: Vector3, startsInWater: boolean): number {
        tmpWaterEnd.copy(position).add(movement);
        const volume = startsInWater ? this.getWaterVolume(position) : this.getWaterVolume(tmpWaterEnd);

        if (!volume) return 1;

        tmpWaterPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight);
        tmpWaterEnd.addScaledVector(tmpUp, this.collisionHeight);

        return findVolumeTransition(tmpWaterPosition, tmpWaterEnd, volume.bsp, startsInWater);
    }

    public moveActor(position: Vector3, movement: Vector3): CheckResult_T | null {
        const bodyPosition = tmpBodyPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight);
        const hit = this.renderManager.collisionWorld.moveActor({
            location: bodyPosition,
            delta: movement,
            extent: tmpStepPosition.set(this.collisionRadius, this.collisionRadius, this.collisionHeight),
            sourceCollider: this.collider,
            sourceBody: this.rigidbody,
            sourceActor: this,
            sourceIsPlayer: !!(this as any).isPlayer,
            sourceProfile: this.collisionProfile,
            ignoredActors: this.ignoredActors,
            ignoreBases: true
        });

        position.copy(bodyPosition).addScaledVector(tmpUp, -this.collisionHeight);

        return hit;
    }

    protected castShape(position: Vector3, movement: Vector3): CheckResult_T | null {
        const bodyPosition = tmpBodyPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight);

        return this.renderManager.collisionWorld.singleLineCheck({
            location: bodyPosition,
            delta: movement,
            extent: tmpStepPosition.set(this.collisionRadius, this.collisionRadius, this.collisionHeight),
            sourceCollider: this.collider,
            sourceBody: this.rigidbody,
            sourceActor: this,
            sourceIsPlayer: !!(this as any).isPlayer,
            sourceProfile: this.collisionProfile,
            ignoredActors: this.ignoredActors
        });
    }

    protected findFloor(position: Vector3, movement: Vector3): CheckResult_T | null {
        let hit = this.castShape(position, movement);

        if (hit && hit.normal.z >= MIN_FLOOR_Z) return hit;

        hit = this.renderManager.collisionWorld.singleLineCheck({
            location: tmpBodyPosition.copy(position).addScaledVector(tmpUp, this.collisionHeight),
            delta: movement,
            extent: tmpStepPosition.set(0, 0, this.collisionHeight),
            sourceCollider: this.collider,
            sourceBody: this.rigidbody,
            sourceActor: this,
            sourceIsPlayer: !!(this as any).isPlayer,
            sourceProfile: this.collisionProfile,
            ignoredActors: this.ignoredActors
        });

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

    public setMeshes(meshes: Mesh[]) {
        this.stopAnimations();
        this.disposeBlinkFaces();

        for (const mesh of this.meshes)
            this.remove(mesh);

        this.meshes = meshes;

        for (const mesh of meshes) {
            (mesh as any).hasStartedAnimation = true;
            this.add(mesh);
        }

        this.initHair();
        this.initBlink();
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
            for (let i = 0; i < chain.bones.length; i++) {
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

            for (let i = 0; i < indices.length; i++)
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

            for (let i = 0; i < face.indices.length; i++) {
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

    public stopAnimations() {
        for (const mesh of this.meshes) {
            if (this.prevAnimations.has(mesh)) this.prevAnimations.get(mesh).stop();
            if (this.currAnimations.has(mesh)) this.currAnimations.get(mesh).stop();
        }
    }

    // materials and textures stay - material-decoder hands those out of name-keyed shared caches
    public release() {
        this.stopAnimations();
        this.disposeBlinkFaces();

        for (const mesh of this.meshes) {
            this.renderManager.mixer.uncacheRoot(mesh);
            mesh.geometry.dispose();
        }
    }

    protected setBasicActorAnimation(key: ValidStateNames_T, animationName: string) {
        if (!(animationName in this.actorAnimations))
            throw new Error(`'${animationName}' is not available.`);

        if (!(key in this.basicActorAnimations))
            throw new Error(`'${key}' is not a valid basic actor animation`);

        (this.basicActorAnimations as any)[key] = animationName;
    }

    public setIdleAnimation(animationName: string) { this.setBasicActorAnimation("idle", animationName); }
    public setWalkingAnimation(animationName: string) { this.setBasicActorAnimation("walking", animationName); }
    public setRunningAnimation(animationName: string) { this.setBasicActorAnimation("running", animationName); }
    public setDeathAnimation(animationName: string) { this.setBasicActorAnimation("dying", animationName); }
    public setFallingAnimation(animationName: string) { this.setBasicActorAnimation("falling", animationName); }
    public setSwimmingAnimation(animationName: string) { this.setBasicActorAnimation("swimming", animationName); }
    public setSwimmingIdleAnimation(animationName: string) { this.setBasicActorAnimation("swimmingIdle", animationName); }

    public initAnimations() {
        this.isAnimationsInit = true;
        this.playAnimation(this.basicActorAnimations.idle, IDLE_TWEEN_TIME);
    }

    public playAnimation(animationName: string, tweenTime: number = MOVEMENT_TWEEN_TIME) {
        if (!this.isAnimationsInit) return;

        if (!(animationName in this.actorAnimations))
            throw new Error(`'${animationName}' is not available.`);

        const clip = this.actorAnimations[animationName];
        const mixer = this.renderManager.mixer;

        for (const mesh of this.meshes) {
            if ((mesh as any).isBoneAttachment) continue; // rides the bone it hangs off, its own skeleton is untouched by this clip
            if ((mesh as any).sharesSkeleton) continue; // skinned off the bodypart that owns the bone tree, one action drives both

            const prevAct = this.prevAnimations.get(mesh) || null;
            const currAct = this.currAnimations.get(mesh) || null;
            const nextAct = mixer.clipAction(clip, mesh);

            if (currAct === nextAct) continue;

            this.currAnimations.set(mesh, nextAct);

            if (prevAct) prevAct.stop();
            if (currAct) {
                this.prevAnimations.set(mesh, currAct);
                currAct.crossFadeTo(nextAct, tweenTime, false);
            }

            nextAct.play();
        }
    }

    public goTo(position: Vector3) {
        console.log(`[actor] goTo from=(${this.position.x}, ${this.position.y}, ${this.position.z}) to=(${position.x}, ${position.y}, ${position.z})`);

        this.actorState.locomotion = true;
        this.actorState.desired.position.copy(position);
        this.actorState.desired.actor = null;
        this.actorState.desired.offset = 0;
        this.actorState.desired.faceMovement = true;
        this.actorState.desired.faceTarget = null;
    }

    public goToActor(actor: Object3D, offset: number = 0) {
        this.actorState.locomotion = true;
        this.actorState.desired.actor = actor;
        this.actorState.desired.offset = offset;
        this.actorState.desired.faceMovement = true;
        this.actorState.desired.faceTarget = null;
    }

    public moveInDirection(direction: Vector3, faceMovement: boolean = true) {
        this.actorState.locomotion = true;
        this.actorState.desired.position.copy(direction).normalize().multiplyScalar(100000).add(this.position);
        this.actorState.desired.actor = null;
        this.actorState.desired.offset = 0;
        this.actorState.desired.faceMovement = faceMovement;
    }

    public faceActor(actor: Object3D | null) {
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

    for (let i = 0; i < name.length; i++) {
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
