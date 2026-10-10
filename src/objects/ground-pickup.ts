import { Box3, Matrix4, Object3D, Quaternion, Raycaster, Vector3 } from "three";
import { decodeSkinnedMesh } from "../assets/decoders/object3d-decoder";
import type DecodeLibrary from "../assets/unreal/decode-library";
import type LitSkinnedMesh from "./lit-skinned-mesh";
import type RenderManager from "../rendering/render-manager";
import L2NMover from "../physics/l2-nmover";
import Rotator from "../utils/rotator";
import type { ActorCollisionProfile_T } from "./objects";

const tmpIdentity = new Matrix4();
const tmpRotationMatrix = new Matrix4();
const tmpStart = new Vector3();
const tmpDelta = new Vector3();
const tmpExtent = new Vector3();
const tmpHit = new Vector3();
const tmpBounds = new Box3();
const arrAxes = ["pitch", "yaw", "roll"] as const;
type PickupRotation_T = { current: Rotator, target: Rotator, rate: Rotator, base: Quaternion };

const pickupProfile: ActorCollisionProfile_T = { collideActors: true, collideWorld: true, blockActors: true, blockPlayers: false, blockZeroExtent: true, blockNonZeroExtent: true, worldGeometry: false, useCylinderCollision: false, collisionRadius: 0, collisionHeight: 0 };

export class GroundPickup extends Object3D {
    public readonly objectId: number;
    public readonly itemId: number;
    public readonly count: number;
    public readonly stackable: boolean;
    protected readonly renderManager: RenderManager;
    protected readonly meshes: LitSkinnedMesh[] = [];
    protected readonly bounds = new Box3();
    protected readonly dropped: boolean;
    protected dropEffect: Object3D = null;
    protected dropEffectName: string;
    protected revealTime = 0;
    protected grounded = false;
    protected readonly origin: Vector3;
    protected readonly arrRotations: PickupRotation_T[] = [];
    protected readonly landingPosition = new Vector3();
    protected readonly effectPosition = new Vector3();
    // shortcut: meshes share one mover and floor hit; split actors for distinct multi-mesh landings.
    protected mover: L2NMover = null;
    protected dropAnimType: number;
    protected lastUpdateTime = 0;
    protected dropSound: string = null;
    protected throwSound: string = null;

    public constructor(renderManager: RenderManager, objectId: number, itemId: number, count: number, stackable: boolean, dropped = false, origin: Vector3 = null) {
        super();

        this.renderManager = renderManager;
        this.objectId = objectId;
        this.itemId = itemId;
        this.count = count;
        this.stackable = stackable;
        this.dropped = dropped;
        this.origin = origin ? origin.clone() : null;
        this.visible = false;
    }

    public setMeshes(library: DecodeLibrary): void {
        // UGameEngine::OnDropItem 0x74d031..0x74d112 selects e_u056_a for drop animation 5.
        this.dropEffectName = library.pickup.dropAnimType === 5 ? "LineageEffect.e_u056_a" : "LineageEffect.e_u056_b";

        this.dropAnimType = library.pickup.dropAnimType;
        for (const item of library.pickup.items) {
            const mesh = decodeSkinnedMesh(library, library.scriptMeshes[item.mesh.toLowerCase()], item.skins);

            for (const inverse of mesh.skeleton.boneInverses) inverse.multiply(mesh.bindMatrix);
            mesh.bind(mesh.skeleton, tmpIdentity);
            // Reference-pose bounds stay local; SkinnedMesh.computeBoundingSphere uses world-space bone matrices.
            mesh.geometry.computeBoundingSphere();
            mesh.boundingSphere = mesh.geometry.boundingSphere.clone();
            (mesh as any).hasStartedAnimation = true;
            this.renderManager.retainGeometry(mesh.geometry);
            this.meshes.push(mesh);
            this.add(mesh);

            const type = library.pickup.dropType, index = item.meshIndex;
            const pitch = type === 1 ? -19114 : type === 2 ? -32768 : type === 3 ? 13653 : 0;
            const heading = new Rotator().setFromRotationMatrix(tmpRotationMatrix.makeRotationFromQuaternion(this.quaternion)).yaw;
            const yaw = this.origin ? Math.trunc(Math.atan2(this.position.y - this.origin.y, this.position.x - this.origin.x) * 32768 / Math.PI) + (type === 2 ? 16384 : 32768) - heading : 0;
            const target = new Rotator(type ? pitch - Math.trunc(1310720 * index / 360) : 0, yaw, type ? 16384 : 0);
            const current = new Rotator(target.pitch, target.yaw, target.roll), rate = new Rotator(), base = mesh.quaternion.clone();

            // UGameEngine::OnDropItem 0x74d96e..0x74da30.
            if (this.dropped && (this.dropAnimType === 1 || this.dropAnimType === 2)) {
                if (type === 2) rate.roll = index % 2 ? 540016 : -540016;
                else rate.pitch = index % 2 ? 540016 : -540016;
            }
            target.toQuaternion(mesh.quaternion).multiply(base);
            this.arrRotations.push({ current, target, rate, base });
        }

        this.updateBounds();
    }

    protected updateBounds(): void {
        this.updateMatrixWorld(true);
        this.bounds.makeEmpty();

        for (const mesh of this.meshes) {
            mesh.skeleton.update();
            mesh.geometry.computeBoundingBox();
            this.bounds.union(tmpBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrix));
        }
    }

    public setDropSounds(dropSound: string, throwSound: string): void {
        this.dropSound = dropSound;
        this.throwSound = throwSound;
    }

    protected playDropSound(): void {
        if (!this.dropSound) return;

        void this.renderManager.getParent().getComponent("audio").playOneShotSound(this.dropSound, this.position, 1, 1, 50, 5000);
        this.dropSound = null;
    }

    public placeOnGround(currentTime = performance.now()): void {
        if (this.grounded || this.mover || !this.meshes.length || !this.renderManager.getSector(this.position)) return;

        const physics = this.renderManager.getParent().getComponent("physics");

        for (let i = 0; i < 30; i++) {
            tmpStart.copy(this.position).add(tmpHit.set(0, 0, 20 + i * 30));
            tmpDelta.set(0, 0, -50 - i * 60);

            const hit = physics.singleLineCheck({ location: tmpStart, delta: tmpDelta, extent: tmpExtent, sourceIsPlayer: false, sourceProfile: pickupProfile });

            if (!hit || (hit.actor as any)?.isActor || hit.normal.z <= 0) continue;

            // UGameEngine::OnDropItem 0x74d462..0x74d49d aligns with FVector(Normal.Z, Normal.Y, -Normal.X).
            const pitch = Math.trunc(Math.atan2(-hit.normal.x, Math.hypot(hit.normal.z, hit.normal.y)) * 32768 / Math.PI);
            const yaw = Math.trunc(Math.atan2(hit.normal.y, hit.normal.z) * 32768 / Math.PI);
            for (let j = 0; j < this.arrRotations.length; j++) {
                const { current, target, base } = this.arrRotations[j];
                current.pitch = target.pitch += pitch;
                current.yaw = target.yaw += yaw;
                current.toQuaternion(this.meshes[j].quaternion).multiply(base);
            }
            this.updateBounds();
            this.position.z = hit.location.z - this.bounds.min.z;
            this.landingPosition.copy(this.position);
            this.effectPosition.copy(hit.location);
            this.lastUpdateTime = currentTime;
            if (this.dropped && this.dropAnimType >= 1 && this.dropAnimType <= 3) {
                // UGameEngine::OnDropItem 0x74d354..0x74d84a: chase a descending target, or fall 30 units without an owner.
                tmpStart.copy(this.landingPosition);
                tmpStart.z += this.origin ? this.origin.distanceTo(this.landingPosition) : 30;
                const target = this.origin ? new L2NMover(tmpStart, this.landingPosition, 300, 100) : null;
                this.mover = new L2NMover(this.origin || tmpStart, target ? target.position : this.landingPosition, this.origin ? 300 : 100, this.origin ? 100 : 0, target);
                this.position.copy(this.mover.position);
                this.visible = true;
                if (this.throwSound) void this.renderManager.getParent().getComponent("audio").playOneShotSound(this.throwSound, this.position, 0.5, 1, 50, 5000);
                return;
            }
            this.updateMatrixWorld(true);
            this.grounded = this.visible = true;
            if (this.dropped && this.dropEffectName === "LineageEffect.e_u056_a") {
                // UGameEngine::OnDropItem 0x74d18b..0x74d1b2, Engine.L2Pickup.Timer.
                this.revealTime = currentTime + Math.fround(0.85) * 1000;
                this.visible = false;
            }
            if (this.dropped) this.addDropEffect();
            this.playDropSound();
            return;
        }
    }

    protected addDropEffect(): void {
        // AL2Pickup::Tick 0x8665d4..0x86666c, PostScriptDestroyed 0x7cdf7b..0x7cdf9d.
        this.dropEffect = this.renderManager.getParent().getComponent("asset").createEffect(this.dropEffectName);
        this.dropEffect.position.copy(this.effectPosition);
        this.renderManager.addTransientEffect(this.dropEffect);
    }

    public update(currentTime: number): void {
        this.placeOnGround(currentTime);
        if (this.mover) {
            const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
            this.mover.tick(deltaTime);
            this.position.copy(this.mover.position);
            let settled = this.mover.isEnded();

            for (let i = 0; i < this.arrRotations.length; i++) {
                const { current, target, rate, base } = this.arrRotations[i];
                for (const axis of arrAxes) {
                    const amount = Math.trunc(rate[axis] * deltaTime);
                    const remaining = rate[axis] < 0 ? ((target[axis] - current[axis]) & 65535) - 65536 : (target[axis] - current[axis]) & 65535;
                    if (this.mover.isEnded() && (rate[axis] === 0 || Math.abs(amount) >= Math.abs(remaining) || (current[axis] & 65535) === (target[axis] & 65535))) current[axis] = target[axis];
                    else { current[axis] += amount; settled = false; }
                }
                current.toQuaternion(this.meshes[i].quaternion).multiply(base);
            }

            if (settled) {
                this.mover = null;
                this.grounded = true;
                this.addDropEffect();
                this.playDropSound();
            }
            this.lastUpdateTime = currentTime;
            this.updateMatrixWorld(true);
        }
        if (this.revealTime > 0 && currentTime >= this.revealTime) {
            this.revealTime = 0;
            this.visible = true;
        }
    }

    public getNamePosition(target: Vector3): Vector3 {
        this.getWorldPosition(target);
        target.z += this.bounds.max.z;
        return target;
    }

    public getPickDistance(raycaster: Raycaster): number {
        if (!this.visible) return Infinity;

        let distance = Infinity;
        for (const mesh of this.meshes) {
            mesh.updateWorldMatrix(true, false);
            tmpBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
            if (raycaster.ray.intersectBox(tmpBounds, tmpHit)) distance = Math.min(distance, raycaster.ray.origin.distanceTo(tmpHit));
        }
        return distance;
    }

    public release(): void {
        if (this.dropEffect && this.dropEffect.parent) this.renderManager.removeTransientEffect(this.dropEffect);
        this.dropEffect = null;

        for (const mesh of this.meshes) {
            mesh.skeleton.dispose();
            this.renderManager.releaseGeometry(mesh.geometry);

            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
        }

        this.meshes.length = 0;
        this.removeFromParent();
    }
}

export default GroundPickup;
