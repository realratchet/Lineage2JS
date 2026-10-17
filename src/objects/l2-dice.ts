import { NormalBlending, Vector3 } from "three";
import GroundPickup from "./ground-pickup";
import L2NMover from "../physics/l2-nmover";
import type DecodeLibrary from "../assets/unreal/decode-library";
import type RenderManager from "../rendering/render-manager";
import type { ActorCollisionProfile_T } from "./objects";

const tmpStart = new Vector3();
const tmpEnd = new Vector3();
const tmpDelta = new Vector3();
const tmpExtent = new Vector3();
const diceProfile: ActorCollisionProfile_T = { collideActors: true, collideWorld: true, blockActors: true, blockPlayers: false, blockZeroExtent: true, blockNonZeroExtent: true, worldGeometry: false, useCylinderCollision: false, collisionRadius: 0, collisionHeight: 0 };

export class L2Dice extends GroundPickup {
    public readonly number: number;
    protected collisionRadius: number;
    protected collisionHeight: number;
    protected actionTime = -1;

    public constructor(renderManager: RenderManager, itemId: number, number: number, origin: Vector3) {
        super(renderManager, 0, itemId, 1, false, true, origin);

        if (!Number.isInteger(number) || number < 1 || number > 6) throw new Error(`Invalid dice result '${number}'.`);
        (this as any).isL2Dice = true;
        this.name = "Engine.L2Dice";
        this.number = number;
    }

    public setMeshes(library: DecodeLibrary): void {
        super.setMeshes(library);

        this.collisionRadius = library.pickup.collisionRadius;
        this.collisionHeight = library.pickup.collisionHeight;
    }

    public placeOnGround(currentTime = this.renderManager.getParent().getCurrentTime()): void {
        if (this.grounded || !this.meshes.length || !this.renderManager.getSector(this.position)) return;

        const physics = this.renderManager.getParent().getComponent("physics");

        tmpStart.copy(this.position);
        tmpStart.z += this.collisionHeight + 20;
        tmpEnd.copy(this.position);
        tmpExtent.set(this.collisionRadius, this.collisionRadius, this.collisionHeight);

        // Engine.dll UGameEngine::OnDice 0x1047e378..0x1047ea14.
        for (let i = 0; i < 500; i++) {
            tmpEnd.z -= 50;
            tmpDelta.subVectors(tmpEnd, tmpStart);
            const hit = physics.singleLineCheck({ location: tmpStart, delta: tmpDelta, extent: tmpExtent, sourceIsPlayer: false, sourceProfile: diceProfile });

            if (!hit || hit.location.z === 0) continue;

            this.landingPosition.copy(hit.location);
            this.landingPosition.z += Math.max(0, Math.fround(1.9) - hit.time * 12);
            const pitch = Math.trunc(Math.atan2(-hit.normal.x, Math.hypot(hit.normal.z, hit.normal.y)) * 32768 / Math.PI);
            const yaw = Math.trunc(Math.atan2(hit.normal.y, hit.normal.z) * 32768 / Math.PI);
            const heading = this.origin ? Math.trunc(Math.atan2(this.landingPosition.y - this.origin.y, this.landingPosition.x - this.origin.x) * 32768 / Math.PI) + 32768 : 0;
            const facePitch = this.number === 2 ? 16384 : this.number === 4 ? 49152 : this.number === 6 ? 32768 : 0;
            const faceRoll = this.number === 3 ? 16384 : this.number === 5 ? 49152 : 0;

            for (let j = 0; j < this.arrRotations.length; j++) {
                const { current, target, rate, base } = this.arrRotations[j];

                target.set(pitch + facePitch, yaw + heading, faceRoll);
                current.set(target.pitch, target.yaw, target.roll);
                rate.set(59152, 0, 0);
                current.toQuaternion(this.meshes[j].quaternion).multiply(base);
            }

            tmpStart.copy(this.landingPosition);
            tmpStart.z += this.origin ? this.origin.distanceTo(this.landingPosition) + 50 : 30;
            const target = this.origin ? new L2NMover(tmpStart, this.landingPosition, 200, 100) : null;

            this.mover = new L2NMover(this.origin || tmpStart, target ? target.position : this.landingPosition, 100, 0, target);
            this.position.copy(this.mover.position);
            this.grounded = this.visible = true;
            this.lastUpdateTime = currentTime;
            this.updateMatrixWorld(true);
            return;
        }

        this.renderManager.removePickup(this);
    }

    public update(currentTime: number): void {
        this.placeOnGround(currentTime);
        if (!this.grounded) return;

        const deltaTime = (currentTime - this.lastUpdateTime) * 0.001;
        this.lastUpdateTime = currentTime;
        if (this.mover) {
            this.mover.tick(deltaTime);
            this.position.copy(this.mover.position);
        }
        const moving = this.mover && !this.mover.isEnded();
        let settled = !moving;

        // Engine.dll AL2Dice::Tick 0x10596980..0x10596c73.
        for (let i = 0; i < this.arrRotations.length; i++) {
            const { current, target, rate, base } = this.arrRotations[i];

            current.pitch &= 65535;
            current.yaw &= 65535;
            current.roll &= 65535;
            target.pitch &= 65535;
            target.yaw &= 65535;
            target.roll &= 65535;
            if (moving) current.pitch += Math.trunc(rate.pitch * deltaTime);
            else {
                const remaining = (target.pitch - current.pitch) & 65535;

                if (rate.pitch * deltaTime > remaining) current.pitch = target.pitch;
                else current.pitch = Math.trunc(current.pitch + rate.pitch * deltaTime);
                if ((current.pitch & 65535) !== target.pitch) settled = false;
            }
            current.toQuaternion(this.meshes[i].quaternion).multiply(base);
        }

        if (settled) {
            this.mover = null;
            for (const rotation of this.arrRotations) rotation.rate.set(0, 0, 0);
        }
        if (!moving) {
            if (this.actionTime < 0) this.actionTime = 0;
            else this.actionTime = Math.fround(this.actionTime + deltaTime);

            // Engine.dll DeleteDiceAction 0x10499c20..0x10499d58.
            if (this.actionTime > 6) { this.renderManager.removePickup(this); return; }
            if (this.actionTime > 3) {
                const opacity = Math.trunc(Math.max(0, Math.min(255, 255 - 42.5 * this.actionTime))) / 255;

                for (const mesh of this.meshes) {
                    const materials = mesh.material;
                    const count = Array.isArray(materials) ? materials.length : 1;

                    for (let i = 0; i < count; i++) {
                        const material = Array.isArray(materials) ? materials[i] : materials;

                        if (!material.transparent || material.blending !== NormalBlending || material.depthWrite) {
                            material.transparent = true;
                            material.blending = NormalBlending;
                            material.depthWrite = false;
                            material.needsUpdate = true;
                        }
                        (material as any).uniforms.opacity.value = opacity;
                    }
                }
                this.position.z += (180 - 10 * this.actionTime) / (20 * this.actionTime) * deltaTime;
            }
        }
        this.updateMatrixWorld(true);
    }
}

export default L2Dice;
