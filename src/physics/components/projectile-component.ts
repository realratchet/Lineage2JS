import { Euler, Matrix4, Object3D, Vector3 } from "three";
import { PhysicsComponent } from "./physics-component";
import { EPhysics_T } from "../../assets/unreal/un-aactor";
import Rotator from "../../utils/rotator";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, type IObject } from "../../game/components";
import { SCRIPT_NATIVE_EVENT } from "../../game/script-component";
import type { ScriptNativeCall_T, ScriptValue_T } from "../../ue-script/vm";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type { CollisionQuery_T } from "../collision-world";
import type NMover from "../mover";

export type ProjectileActor_T = Object3D & IObject & { scriptProperties: Map<string, any> };

const tmpDirection = new Vector3();
const tmpOldPosition = new Vector3();
const tmpInitial = new Vector3();
const tmpTangent = new Vector3();
const tmpWorldMatrix = new Matrix4();
const tmpEuler = new Euler(0, 0, 0, "ZYX");
const tmpRotator = new Rotator();

export class NProjectileComponent extends PhysicsComponent<ProjectileActor_T> {
    public readonly componentName = "nProjectile";
    protected readonly velocity = new Vector3();
    protected readonly acceleration = new Vector3();
    protected readonly targetLocation = new Vector3();
    protected readonly delta = new Vector3();
    protected readonly renderManager: RenderManager;
    protected readonly target: BaseActor;
    protected readonly caster: BaseActor;
    protected readonly onHit: (projectile: ProjectileActor_T) => void;
    protected readonly mover: NMover;
    protected query: CollisionQuery_T;
    protected hasStarted = false;
    protected hasHit = false;

    public constructor(renderManager: RenderManager, caster: BaseActor, target: BaseActor, onHit: (projectile: ProjectileActor_T) => void, mover: NMover = null) {
        super();

        this.renderManager = renderManager;
        this.caster = caster;
        this.target = target;
        this.onHit = onHit;
        this.mover = mover;
    }

    public onAttach(): void {
        const effect = this.getParent();
        const properties = effect.scriptProperties;

        this.velocity.fromArray(properties.get("Velocity"));
        this.acceleration.fromArray(properties.get("Acceleration"));
        properties.set("TargetActor", this.target);
        this.query = {
            location: effect.position, delta: this.delta,
            extent: new Vector3(properties.get("CollisionRadius"), properties.get("CollisionRadius"), properties.get("CollisionHeight")),
            sourceIsPlayer: false, ignoredActors: new Set([this.caster]),
            sourceProfile: {
                collideWorld: !!properties.get("bCollideWorld"), collideActors: !!properties.get("bCollideActors"),
                blockActors: !!properties.get("bBlockActors"), blockPlayers: !!properties.get("bBlockPlayers"),
                blockZeroExtent: !!properties.get("bBlockZeroExtentTraces"), blockNonZeroExtent: !!properties.get("bBlockNonZeroExtentTraces"),
                worldGeometry: false, useCylinderCollision: !!properties.get("bUseCylinderCollision"),
                collisionRadius: properties.get("CollisionRadius"), collisionHeight: properties.get("CollisionHeight")
            }
        };
    }

    public onEvent(type: string, data: unknown): ComponentEventResult_T<ScriptValue_T> {
        if (type !== SCRIPT_NATIVE_EVENT) return COMPONENT_EVENT_NOT_HANDLED;

        const call = data as ScriptNativeCall_T;

        if (call.context !== this.getParent() || call.index !== 3970 && call.name.toLowerCase() !== "setphysics") return COMPONENT_EVENT_NOT_HANDLED;

        const mode = Number(call.args[0]);

        if (mode !== EPhysics_T.PHYS_None && mode !== EPhysics_T.PHYS_NProjectile) throw new Error(`Projectile '${this.getParent().name}' does not implement physics '${mode}'.`);

        this.getParent().scriptProperties.set("Physics", mode);
    }

    public onPhysicsTick(_currentTime: number, deltaTime: number): boolean {
        if (this.hasHit) return false;

        deltaTime *= 0.001;

        const effect = this.getParent();
        const properties = effect.scriptProperties;
        const mode = properties.get("Physics");

        if (mode === EPhysics_T.PHYS_None) return false;
        if (mode !== EPhysics_T.PHYS_NProjectile) throw new Error(`Projectile '${effect.name}' does not implement physics '${mode}'.`);

        this.target.getEffectTargetLocation(this.targetLocation);
        this.targetLocation.toArray(properties.get("LastTargetLocation"));

        if (!this.hasStarted) {
            this.hasStarted = true;
            this.detachFromBase();

            if (properties.get("bSelfRotation") && !properties.get("bHermiteInterpolation")) {
                tmpDirection.subVectors(this.targetLocation, effect.position);
                this.setDirection(tmpDirection, false);
            }
        }

        let volume = null;
        for (const sector of this.renderManager.getLoadedSectors()) {
            const candidate = sector.getWaterVolumeAt(effect.position);

            if (candidate && (!volume || candidate.priority >= volume.priority)) volume = candidate;
        }

        // Engine.dll physNProjectile 0x8d30e4..0x8d31b8: damping, acceleration, BoundProjectileVelocity, then displacement.
        if (volume) this.velocity.multiplyScalar(1 - volume.fluidFriction * deltaTime * 0.2);
        this.velocity.addScaledVector(this.acceleration, deltaTime);
        const accelerationSquared = this.acceleration.lengthSq();
        if (accelerationSquared > 0 && this.velocity.lengthSq() > accelerationSquared) this.velocity.setLength(Math.sqrt(accelerationSquared));
        this.delta.copy(this.velocity).multiplyScalar(deltaTime);

        if (properties.get("bHermiteInterpolation") && properties.get("Duration") > 0) {
            const time = properties.get("CurTime") + deltaTime;
            const t = time / properties.get("Duration"), t2 = t * t, t3 = t2 * t;
            tmpInitial.fromArray(properties.get("LocInitial"));
            const distance = tmpInitial.distanceTo(this.targetLocation);
            const scale = distance / properties.get("Disp");

            if (!Number.isFinite(scale)) throw new Error(`Projectile '${effect.name}' has invalid interpolation displacement.`);

            this.delta.copy(tmpInitial).multiplyScalar(2 * t3 - 3 * t2 + 1).addScaledVector(this.targetLocation, 3 * t2 - 2 * t3);
            tmpTangent.fromArray(properties.get("VelInitial")).multiplyScalar(scale).toArray(properties.get("VelInitial"));
            this.delta.addScaledVector(tmpTangent, t3 - 2 * t2 + t);
            tmpTangent.fromArray(properties.get("VelFinal")).multiplyScalar(scale).toArray(properties.get("VelFinal"));
            this.delta.addScaledVector(tmpTangent, t3 - t2).sub(effect.position);
            properties.set("CurTime", time);
            properties.set("Disp", distance);
            this.setDirection(this.delta, false);
        }

        tmpOldPosition.copy(effect.position);
        const distanceSquared = tmpOldPosition.distanceToSquared(this.targetLocation);
        const hit = this.physicsManager.moveActor(this.query);

        if (hit || tmpOldPosition.distanceToSquared(effect.position) >= distanceSquared) {
            // Engine.dll physNProjectile 0x8d344d..0x8d3524 uses the post-movement position.
            tmpDirection.subVectors(effect.position, this.targetLocation).normalize();
            if (hit) tmpDirection.copy(hit.normal);
            else effect.position.copy(this.targetLocation);
            tmpRotator.set(Math.atan2(tmpDirection.z, Math.hypot(tmpDirection.x, tmpDirection.y)) * 32768 / Math.PI, Math.atan2(tmpDirection.y, tmpDirection.x) * 32768 / Math.PI, 0);
            properties.set("HitRot", [tmpRotator.pitch, tmpRotator.yaw, tmpRotator.roll]);
            properties.set("Physics", EPhysics_T.PHYS_None);
            this.hasHit = true;
            this.onHit(effect);

            // Engine.dll UParticleEmitter::NotifyPreDestroy 0x612750 is empty for sprite/mesh/beam emitters.
            if (!properties.get("bPreDestroy")) this.renderManager.removeTransientEffect(effect);
            return true;
        }

        // Engine.dll NProjectile::Tick calls AEmitter::Tick before steering velocity and acceleration.
        if (deltaTime > 0) this.velocity.subVectors(effect.position, tmpOldPosition).divideScalar(deltaTime);
        if (this.mover) {
            this.mover.getVelocity(effect.position, this.targetLocation, deltaTime, tmpDirection).normalize();
            this.setDirection(tmpDirection, false);
            if (this.velocity.lengthSq() !== 0) properties.set("Speed", this.velocity.length());
            if (properties.get("Speed") === 0) properties.set("Speed", this.mover.getSpeed());
        } else {
            tmpDirection.subVectors(this.targetLocation, effect.position).normalize();
            if (!properties.get("bHermiteInterpolation")) this.setDirection(tmpDirection, !!properties.get("bSelfRotation"));
            properties.set("Speed", this.velocity.length());
        }
        this.velocity.copy(tmpDirection).multiplyScalar(properties.get("Speed"));
        this.acceleration.copy(tmpDirection).multiplyScalar(properties.get("AccSpeed"));
        this.velocity.toArray(properties.get("Velocity"));
        this.acceleration.toArray(properties.get("Acceleration"));
        return true;
    }

    public detachFromBase(): void {
        const effect = this.getParent();

        if ((effect as any).scriptBase) {
            effect.updateWorldMatrix(true, false);
            tmpWorldMatrix.copy(effect.matrixWorld);
            (effect as any).scriptBase.detachBoneObject(effect);
            tmpWorldMatrix.decompose(effect.position, effect.quaternion, effect.scale);
            this.renderManager.scene.add(effect);
        } else if (effect.parent !== this.renderManager.scene) this.renderManager.scene.attach(effect);
    }

    protected setDirection(direction: Vector3, relative: boolean): void {
        const effect = this.getParent();
        const previous = effect.scriptProperties.get("LastTargetRotation");
        const pitch = Math.atan2(direction.z, Math.hypot(direction.x, direction.y)) * 32768 / Math.PI;
        const yaw = Math.atan2(direction.y, direction.x) * 32768 / Math.PI;

        if (relative) {
            tmpEuler.setFromQuaternion(effect.quaternion, "ZYX");
            tmpRotator.set(-tmpEuler.y * 32768 / Math.PI + pitch - previous[0], tmpEuler.z * 32768 / Math.PI + yaw - previous[1], -tmpEuler.x * 32768 / Math.PI - previous[2]);
        } else tmpRotator.set(pitch, yaw, 0);

        tmpRotator.toQuaternion(effect.quaternion);
        previous[0] = pitch;
        previous[1] = yaw;
        previous[2] = 0;
    }
}

export default NProjectileComponent;
