import { AnimationAction, AnimationClip, Bone, Mesh, Object3D, Quaternion, Vector3 } from "three";
import RAPIER from "@dimforge/rapier3d";
import type { ICollidable } from "./objects/objects";
import RenderManager from "./rendering/render-manager";

const tmpPosition = new Vector3();
const tmpWaterPosition = new Vector3();
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
const tmpSumVelocity = new Vector3();
const tmpVelocityDelta = new Vector3();
const tmpNormal = new Vector3();
const tmpStepNormal = new Vector3();
const tmpUp = new Vector3(0, 0, 1);
const tmpColliderRotation = new Quaternion();
const tmpHairVelocity = new Vector3();
const tmpHairRotationX = new Quaternion();
const tmpHairRotationY = new Quaternion();
const tmpHairAxisX = new Vector3(1, 0, 0);
const tmpHairAxisY = new Vector3(0, 1, 0);
const colliderRotation = new Quaternion(Math.SQRT1_2, 0, 0, Math.SQRT1_2);

// Retail APawn::physWalking (0x8d4880) and APawn::stepUp (0x8cf640).
const COLLISION_RADIUS = 6.5;
const COLLISION_HEIGHT = 22.5;
const MAX_STEP_HEIGHT = 10;
const FLOOR_CHECK_DISTANCE = 12;
const MIN_FLOOR_DISTANCE = 1.9;
const MAX_FLOOR_DISTANCE = 2.4;
const FLOOR_DISTANCE = 0.5 * (MIN_FLOOR_DISTANCE + MAX_FLOOR_DISTANCE);
const MIN_FLOOR_Z = 0.7;
const MAX_STEP_SIDE_Z = 0.7;
const GROUND_SPEED = 120;
const WATER_SPEED = 80;
const ACCEL_RATE = 2048;
// Retail Engine.u Pawn.RotationRate.Yaw=20000; APawn::physicsRotation 0x8c9f82.
const YAW_RATE = 20000 * Math.PI * 2 / 65536;
const GROUND_FRICTION = 8;
const BRAKE_STEP = 0.03;
const MIN_BRAKE_SPEED_SQ = 100;
const SPAWN_FLOOR_PROBE = 1000;
const GRAVITY_Z = -980;
const CONTACT_OFFSET = 0.05;
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
    protected readonly colliderShape = new RAPIER.Cylinder(COLLISION_HEIGHT, COLLISION_RADIUS);
    protected readonly velocity = new Vector3();
    protected readonly acceleration = new Vector3();
    protected readonly lastWallPosition = new Vector3();
    protected readonly lastWallNormal = new Vector3();
    protected desiredYaw = 0;
    protected hasDesiredYaw = false;
    protected hasWallPosition = false;
    protected isGrounded = false;
    protected hasStartedPhysics = false;
    protected waterVolume: GD.IWaterVolumeDecodeInfo = null;
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
    protected readonly actorState = new ActorState();
    protected readonly basicActorAnimations: BasicActorAnimations_T = {
        idle: null,
        walking: null,
        running: null,
        dying: null,
        falling: null
    };

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
        this.up.copy(tmpUp);
    }

    public getCollider(): RAPIER.Collider { return this.collider; }
    public getRigidbody(): RAPIER.RigidBody { return this.rigidbody; }

    public createCollider(physicsWorld: RAPIER.World): RAPIER.Collider {
        if (this.collider) return this.collider;

        const rigidbodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.position.x, this.position.y, this.position.z + COLLISION_HEIGHT);
        const colliderDesc = RAPIER.ColliderDesc.cylinder(COLLISION_HEIGHT, COLLISION_RADIUS).setRotation(colliderRotation);

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

        let remainingTime = Math.min(deltaTime, 0.4);
        let iteration = 0;

        while (remainingTime > 0 && iteration++ < 8) {
            const tick = remainingTime > 0.05 ? Math.min(0.05, remainingTime * 0.5) : remainingTime;

            remainingTime -= tick;
            this.tickPhysics(tick);
        }

        this.rigidbody.setNextKinematicTranslation(tmpBodyPosition.set(this.position.x, this.position.y, this.position.z + COLLISION_HEIGHT));
        this.checkAnimationState();
        this.updateHair(currentTime * 0.001, deltaTime);
        this.updateBlink(currentTime * 0.001);
    }

    protected tickPhysics(deltaTime: number) {
        const desired = this.actorState.desired;
        const position = tmpPosition.copy(this.position);
        const waterVolume = this.getWaterVolume(position);

        if (!this.hasStartedPhysics) {
            if (waterVolume) {
                this.hasStartedPhysics = true;
            } else {
                const floorMovement = tmpMovement.set(0, 0, -SPAWN_FLOOR_PROBE);
                const floorHit = this.castShape(position, floorMovement);

                if (!floorHit) return;

                this.getHitNormal(floorHit, tmpNormal);

                if (tmpNormal.z < MIN_FLOOR_Z) return;

                position.addScaledVector(floorMovement, floorHit.toi).addScaledVector(tmpUp, FLOOR_DISTANCE);
                this.isGrounded = true;
                this.hasStartedPhysics = true;
            }
        }

        const distanceX = desired.position.x - position.x;
        const distanceY = desired.position.y - position.y;
        const distanceZ = waterVolume ? desired.position.z - position.z : 0;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY + distanceZ * distanceZ);
        const maxSpeed = waterVolume ? WATER_SPEED : GROUND_SPEED;

        if (this.actorState.locomotion && distance <= Math.max(1, maxSpeed * deltaTime)) {
            this.actorState.locomotion = false;
            this.hasWallPosition = false;
        }

        if (this.actorState.locomotion) {
            this.acceleration.set(distanceX, distanceY, distanceZ).normalize().multiplyScalar(ACCEL_RATE);
            this.desiredYaw = Math.atan2(distanceY, distanceX) - Math.PI / 2;
            this.hasDesiredYaw = true;
        } else {
            this.acceleration.set(0, 0, 0);
        }

        if (this.hasDesiredYaw) {
            const yawDelta = Math.atan2(Math.sin(this.desiredYaw - this.rotation.z), Math.cos(this.desiredYaw - this.rotation.z));
            const maxYawDelta = YAW_RATE * deltaTime;

            this.rotation.x = 0;
            this.rotation.y = 0;
            this.rotation.z += Math.max(-maxYawDelta, Math.min(maxYawDelta, yawDelta));

            if (Math.abs(yawDelta) <= maxYawDelta) this.hasDesiredYaw = false;
        }

        if (waterVolume) {
            this.isGrounded = false;
            this.physSwimming(position, deltaTime, waterVolume);
        } else if (this.isGrounded) this.physWalking(position, deltaTime);
        else this.physFalling(position, deltaTime);

        this.position.copy(position);
        this.waterVolume = this.getWaterVolume(position);
    }

    protected calcVelocity(accelDir: Vector3, deltaTime: number, maxSpeed: number, friction: number) {
        if (this.acceleration.lengthSq() === 0) {
            const oldVelocity = tmpOldVelocity.copy(this.velocity);
            const sumVelocity = tmpSumVelocity.set(0, 0, 0);
            let remainingTime = deltaTime;

            while (remainingTime > BRAKE_STEP) {
                this.velocity.addScaledVector(this.velocity, -2 * BRAKE_STEP * friction);

                if (this.velocity.dot(oldVelocity) > 0) sumVelocity.addScaledVector(this.velocity, BRAKE_STEP / deltaTime);

                remainingTime -= BRAKE_STEP;
            }

            this.velocity.addScaledVector(this.velocity, -2 * remainingTime * friction);

            if (this.velocity.dot(oldVelocity) > 0) sumVelocity.addScaledVector(this.velocity, remainingTime / deltaTime);

            this.velocity.copy(sumVelocity);

            if (oldVelocity.dot(this.velocity) < 0 || this.velocity.lengthSq() < MIN_BRAKE_SPEED_SQ)
                this.velocity.set(0, 0, 0);
        } else {
            const velSize = this.velocity.length();

            if (this.acceleration.lengthSq() > ACCEL_RATE * ACCEL_RATE)
                this.acceleration.copy(accelDir).multiplyScalar(ACCEL_RATE);

            tmpVelocityDelta.copy(this.velocity).addScaledVector(accelDir, -velSize).multiplyScalar(deltaTime * friction);
            this.velocity.sub(tmpVelocityDelta);
        }

        this.velocity.addScaledVector(this.acceleration, deltaTime);

        if (this.velocity.lengthSq() > maxSpeed * maxSpeed)
            this.velocity.normalize().multiplyScalar(maxSpeed);
    }

    protected physWalking(position: Vector3, deltaTime: number) {
        const startX = position.x;
        const startY = position.y;

        this.velocity.z = 0;
        this.acceleration.z = 0;

        tmpAccelDir.copy(this.acceleration);

        if (tmpAccelDir.lengthSq() > 0) tmpAccelDir.normalize();

        this.calcVelocity(tmpAccelDir, deltaTime, GROUND_SPEED, GROUND_FRICTION);

        tmpMovement.set(this.velocity.x * deltaTime, this.velocity.y * deltaTime, 0);

        const deltaX = tmpMovement.x;
        const deltaY = tmpMovement.y;

        if (tmpMovement.lengthSq() > 0) this.moveWalking(position, tmpMovement);

        const floorMovement = tmpMovement.set(0, 0, -FLOOR_CHECK_DISTANCE);
        const floorHit = this.castShape(position, floorMovement);

        if (floorHit) {
            this.getHitNormal(floorHit, tmpNormal);

            if (tmpNormal.z >= MIN_FLOOR_Z) {
                const floorDistance = floorHit.toi * FLOOR_CHECK_DISTANCE;

                if (floorDistance > MAX_FLOOR_DISTANCE)
                    position.z -= floorDistance - FLOOR_DISTANCE;
                else if (floorDistance > 0 && floorDistance < MIN_FLOOR_DISTANCE)
                    position.z += FLOOR_DISTANCE - floorDistance;

                this.updateWalkingVelocity(position, startX, startY, deltaTime);
                return;
            }

            if (deltaX * tmpNormal.x + deltaY * tmpNormal.y < 0) {
                tmpStepUp.copy(tmpUp).multiplyScalar(MAX_STEP_HEIGHT).addScaledVector(tmpNormal, -MAX_STEP_HEIGHT * tmpNormal.z).multiplyScalar(-1);
                this.moveSwept(position, tmpStepUp);
            }
        }

        this.isGrounded = false;
        this.updateWalkingVelocity(position, startX, startY, deltaTime);
    }

    protected updateWalkingVelocity(position: Vector3, startX: number, startY: number, deltaTime: number) {
        const dx = position.x - startX;
        const dy = position.y - startY;

        this.velocity.set(dx / deltaTime, dy / deltaTime, 0);
    }

    protected moveWalking(position: Vector3, movement: Vector3) {
        const hit = this.castShape(position, movement, CONTACT_OFFSET);

        if (!hit) {
            position.add(movement);
            return;
        }

        this.getHitNormal(hit, tmpNormal);
        tmpStepNormal.copy(tmpNormal);

        const length = movement.length();
        const toi = Math.max(0, hit.toi - CONTACT_OFFSET / length);

        position.addScaledVector(movement, toi);
        tmpRemaining.copy(movement).multiplyScalar(1 - hit.toi);

        if (hit.toi > 0) {
            this.lastWallPosition.copy(position);
            this.lastWallNormal.copy(tmpStepNormal);
            this.hasWallPosition = true;
        }

        if (this.stepUp(position, tmpRemaining, tmpStepNormal)) return;

        tmpStepNormal.z = 0;

        if (tmpStepNormal.lengthSq() <= 0) return;

        tmpStepNormal.normalize();
        tmpRemaining.addScaledVector(tmpStepNormal, -tmpRemaining.dot(tmpStepNormal));

        const slideHit = this.castShape(position, tmpRemaining, CONTACT_OFFSET);

        if (!slideHit) position.add(tmpRemaining);
        else position.addScaledVector(tmpRemaining, Math.max(0, slideHit.toi - CONTACT_OFFSET / Math.max(tmpRemaining.length(), CONTACT_OFFSET)));
    }

    protected moveSwept(position: Vector3, movement: Vector3): RAPIER.ShapeColliderTOI | null {
        const hit = this.castShape(position, movement, CONTACT_OFFSET);

        if (!hit) {
            position.add(movement);
            return null;
        }

        position.addScaledVector(movement, Math.max(0, hit.toi - CONTACT_OFFSET / Math.max(movement.length(), CONTACT_OFFSET)));

        return hit;
    }

    protected stepUp(position: Vector3, movement: Vector3, wallNormal: Vector3): boolean {
        const startX = position.x;
        const startY = position.y;

        if (Math.abs(wallNormal.z) < MAX_STEP_SIDE_Z || wallNormal.z >= MIN_FLOOR_Z) {
            const probePosition = tmpStepPosition.copy(position);

            probePosition.x += wallNormal.x * CONTACT_OFFSET;
            probePosition.y += wallNormal.y * CONTACT_OFFSET;

            const upMovement = tmpStepUp.set(0, 0, MAX_STEP_HEIGHT);
            const upHit = this.castShape(probePosition, upMovement, CONTACT_OFFSET);

            position.addScaledVector(upMovement, upHit ? Math.max(0, upHit.toi - CONTACT_OFFSET / MAX_STEP_HEIGHT) : 1);

            const forwardHit = this.moveSwept(position, movement);

            if (forwardHit) {
                this.getHitNormal(forwardHit, tmpNormal);
                tmpNormal.z = 0;

                if (tmpNormal.lengthSq() > 0) {
                    tmpNormal.normalize();
                    tmpStepRemaining.copy(movement).multiplyScalar(1 - forwardHit.toi);
                    tmpStepRemaining.addScaledVector(tmpNormal, -tmpStepRemaining.dot(tmpNormal));
                    this.moveSwept(position, tmpStepRemaining);
                }
            }
        }

        const downMovement = tmpDown.set(0, 0, -MAX_STEP_HEIGHT);
        const downHit = this.castShape(position, downMovement);

        if (downHit) this.getHitNormal(downHit, tmpNormal);

        const downDistance = downHit ? downHit.toi * MAX_STEP_HEIGHT : MAX_STEP_HEIGHT;
        const hasStepSurface = downHit && (tmpNormal.z >= MIN_FLOOR_Z || tmpNormal.z > CONTACT_OFFSET && downDistance >= MIN_FLOOR_DISTANCE);

        position.addScaledVector(downMovement, hasStepSurface ? downHit.toi : 1);

        const dx = position.x - startX;
        const dy = position.y - startY;

        return dx * dx + dy * dy > 0;
    }

    protected physFalling(position: Vector3, deltaTime: number) {
        this.velocity.z += GRAVITY_Z * deltaTime;
        tmpMovement.copy(this.velocity).multiplyScalar(deltaTime);

        const hit = this.castShape(position, tmpMovement);

        if (!hit) {
            position.add(tmpMovement);
            return;
        }

        position.addScaledVector(tmpMovement, Math.max(0, hit.toi - CONTACT_OFFSET / Math.max(tmpMovement.length(), CONTACT_OFFSET)));
        this.getHitNormal(hit, tmpNormal);

        if (this.velocity.z <= 0 && tmpNormal.z >= MIN_FLOOR_Z) {
            this.velocity.z = 0;
            this.isGrounded = true;
            return;
        }

        this.velocity.addScaledVector(tmpNormal, -this.velocity.dot(tmpNormal));
    }

    protected physSwimming(position: Vector3, deltaTime: number, volume: GD.IWaterVolumeDecodeInfo) {
        tmpAccelDir.copy(this.acceleration);

        if (tmpAccelDir.lengthSq() > 0) tmpAccelDir.normalize();
        if (this.acceleration.lengthSq() > ACCEL_RATE * ACCEL_RATE)
            this.acceleration.copy(tmpAccelDir).multiplyScalar(ACCEL_RATE);

        const friction = 0.5 * volume.fluidFriction;
        const velSize = this.velocity.length();

        tmpVelocityDelta.copy(this.velocity).addScaledVector(tmpAccelDir, -velSize).multiplyScalar(deltaTime * friction);
        this.velocity.sub(tmpVelocityDelta).multiplyScalar(Math.max(0, 1 - friction * deltaTime)).addScaledVector(this.acceleration, deltaTime);

        if (this.velocity.lengthSq() > WATER_SPEED * WATER_SPEED)
            this.velocity.normalize().multiplyScalar(WATER_SPEED);

        tmpSwimStart.copy(position);
        tmpMovement.copy(this.velocity).addScaledVector(tmpVelocityDelta.fromArray(volume.zoneVelocity), 25 * deltaTime).multiplyScalar(deltaTime);

        const hit = this.moveSwept(position, tmpMovement);

        if (hit) {
            this.getHitNormal(hit, tmpNormal);
            tmpRemaining.copy(tmpMovement).multiplyScalar(1 - hit.toi).addScaledVector(tmpNormal, -tmpRemaining.dot(tmpNormal));
            this.moveSwept(position, tmpRemaining);
        }

        this.velocity.copy(position).sub(tmpSwimStart).multiplyScalar(1 / deltaTime);
    }

    protected getWaterVolume(position: Vector3): GD.IWaterVolumeDecodeInfo | null {
        const sector = this.renderManager.getSector(tmpWaterPosition.copy(position).addScaledVector(tmpUp, COLLISION_HEIGHT));

        return sector ? sector.getWaterVolumeAt(tmpWaterPosition) : null;
    }

    protected castShape(position: Vector3, movement: Vector3, verticalOffset: number = 0): RAPIER.ShapeColliderTOI | null {
        const bodyPosition = tmpBodyPosition.copy(position).addScaledVector(tmpUp, COLLISION_HEIGHT + verticalOffset);

        return this.renderManager.physicsWorld.castShape(bodyPosition, colliderRotation, movement, this.colliderShape, 1, undefined, undefined, this.collider, this.rigidbody);
    }

    protected getHitNormal(hit: RAPIER.ShapeColliderTOI, target: Vector3): Vector3 {
        return target.copy(hit.normal1 as Vector3).applyQuaternion(tmpColliderRotation.copy(hit.collider.rotation() as Quaternion));
    }

    protected checkAnimationState() {
        const state: ValidStateNames_T = !this.hasStartedPhysics ? "idle" : !this.isGrounded && !this.waterVolume ? "falling" : this.actorState.locomotion ? "running" : "idle";

        if (state === this.actorState.state) return;

        this.actorState.state = state;

        switch (this.actorState.state) {
            case "falling": this.playAnimation(this.basicActorAnimations.falling); break;
            case "idle": this.playAnimation(this.basicActorAnimations.idle); break;
            case "dying": this.playAnimation(this.basicActorAnimations.dying); break;
            case "walking": this.playAnimation(this.basicActorAnimations.walking); break;
            case "running": this.playAnimation(this.basicActorAnimations.running); break;
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

    public initAnimations() {
        this.isAnimationsInit = true;
        this.playAnimation(this.basicActorAnimations.idle);
    }

    public playAnimation(animationName: string) {
        if (!this.isAnimationsInit) return;

        if (!(animationName in this.actorAnimations))
            throw new Error(`'${animationName}' is not available.`);

        const clip = this.actorAnimations[animationName];
        const mixer = this.renderManager.mixer;

        for (const mesh of this.meshes) {
            if ((mesh as any).isBoneAttachment) continue; // rides the bone it hangs off, its own skeleton is untouched by this clip

            const prevAct = this.prevAnimations.get(mesh) || null;
            const currAct = this.currAnimations.get(mesh) || null;
            const nextAct = mixer.clipAction(clip, mesh);

            this.currAnimations.set(mesh, nextAct);

            if (prevAct) prevAct.stop();
            if (currAct) {
                this.prevAnimations.set(mesh, currAct);
                currAct.crossFadeTo(nextAct, 0.25, false);
            }

            nextAct.play();
        }
    }

    public goTo(position: Vector3) {
        console.log(`[actor] goTo from=(${this.position.x}, ${this.position.y}, ${this.position.z}) to=(${position.x}, ${position.y}, ${position.z})`);

        if (this.actorState.locomotion && this.velocity.lengthSq() < MIN_BRAKE_SPEED_SQ && this.hasWallPosition) {
            tmpMovement.copy(position).sub(this.position);
            tmpMovement.z = 0;

            if (tmpMovement.dot(this.lastWallNormal) > 0) {
                this.position.copy(this.lastWallPosition);
                this.hasWallPosition = false;

                if (this.rigidbody)
                    this.rigidbody.setTranslation(tmpBodyPosition.set(this.position.x, this.position.y, this.position.z + COLLISION_HEIGHT), true);
            }
        }

        this.actorState.locomotion = true;
        this.actorState.desired.position.copy(position);
    }

    public teleportTo(position: Vector3) {
        this.position.copy(position);
        this.velocity.set(0, 0, 0);
        this.isGrounded = false;
        this.hasDesiredYaw = false;
        this.hasWallPosition = false;

        this.actorState.locomotion = false;
        this.actorState.desired.position.copy(position);

        if (this.rigidbody)
            this.rigidbody.setTranslation(tmpBodyPosition.set(position.x, position.y, position.z + COLLISION_HEIGHT), true);
    }
}

class ActorState {
    public state: ValidStateNames_T = "idle";
    public locomotion: boolean = false;
    public readonly desired: DesiredState_T = {
        position: new Vector3()
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
};

type DesiredState_T = {
    position: Vector3;
};

type ValidStateNames_T = "idle" | "walking" | "running" | "dying" | "falling";

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

export default BaseActor;
export { BaseActor };
