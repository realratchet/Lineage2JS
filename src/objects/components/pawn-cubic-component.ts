import { Matrix4, Vector3 } from "three";
import { GameObject, ObjectComponent } from "../../game/components";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type AnimationComponent from "./animation-component";
import type PawnMovementComponent from "../../physics/components/pawn-movement-component";
import type LitSkinnedMesh from "../lit-skinned-mesh";

type Cubic_T = { id: number, effect: GameObject, destination: Vector3 };

const tmpCoords = new Matrix4();
const tmpOrigin = new Vector3();
const tmpAxis = new Vector3();
const tmpDirection = new Vector3();
const tmpSlot = new Vector3();
const tmpDelta = new Vector3();

export class PawnCubicComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnCubic";
    protected readonly renderManager: RenderManager;
    protected readonly cubics: Cubic_T[] = [];
    protected ids: number[] = [];
    protected isSitting = false;
    protected isFakeDeath = false;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public setPosture(isSitting: boolean, isFakeDeath: boolean): void {
        this.isSitting = isSitting;
        this.isFakeDeath = isFakeDeath;
    }

    public async setCubics(ids: number[]): Promise<void> {
        // APawn::CheckCubicStatus 0x78c560 / AddNCubic 0x789e50 insert new cubics at the front.
        for (const id of ids)
            if (id >= 1 && id <= 8 && this.ids.length <= 3 && !this.ids.includes(id)) this.ids.unshift(id);
        this.ids = this.ids.filter(id => ids.includes(id));

        for (let i = this.cubics.length - 1; i >= 0; i--) {
            const cubic = this.cubics[i];

            if (this.ids.includes(cubic.id)) continue;
            this.renderManager.removeTransientEffect(cubic.effect);
            this.cubics.splice(i, 1);
        }

        if (this.ids.every(id => this.cubics.some(cubic => cubic.id === id))) return;

        const asset = this.renderManager.getParent().getComponent("asset");
        const library = await asset.loadCubicEffects();

        if (!this.isAttached()) return;

        for (const id of this.ids) {
            if (this.cubics.some(cubic => cubic.id === id)) continue;

            // AddNCubic 0x789edd..0x789f51, retail IDs 1..8.
            const path = `LineageEffect.s_u013_${["a", "d", "c", "e", "b", "e", "b", "d"][id - 1]}`;
            const effect = asset.createScriptObject(this.renderManager, library, path) as GameObject;

            effect.position.copy(this.getParent().position);
            effect.position.z += 100;
            this.renderManager.addTransientEffect(effect, this.getParent());
            this.cubics.push({ id, effect, destination: new Vector3() });
        }

        this.cubics.sort((a, b) => this.ids.indexOf(a.id) - this.ids.indexOf(b.id));
    }

    public onUpdate(_currentTime: number, deltaTime: number): void {
        if (!this.cubics.length) return;

        const owner = this.getParent();
        const movement = this.getComponent<PawnMovementComponent>("pawnMovement");
        const animation = this.getComponent<AnimationComponent>("animation");
        const mesh = animation.getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;
        const isLying = movement.isDying() || this.isFakeDeath;
        const isFollowing = movement.getAcceleration().lengthSq() !== 0;
        const height = owner.getCollisionHeight();

        // ANCubics::GetVelocity 0x78a270 uses e_bone.XAxis, root.ZAxis when sitting, root.YAxis when dead.
        if (isLying || this.isSitting) {
            animation.getBoneWorldMatrix(0, tmpCoords);
            tmpOrigin.copy(owner.position);
            tmpOrigin.z += isLying ? -height * 0.5 : height;
            tmpAxis.setFromMatrixColumn(tmpCoords, isLying ? 1 : 2);
        } else {
            const index = mesh.tagAliases.findIndex(name => name.toLowerCase() === "e_bone");

            animation.getBoneWorldMatrix(index >= 0 ? mesh.tagNames[index] : "None", tmpCoords, 0);
            tmpOrigin.setFromMatrixPosition(tmpCoords);
            tmpOrigin.z += height / 3;
            tmpAxis.setFromMatrixColumn(tmpCoords, 0);
        }

        tmpAxis.normalize();

        for (let i = 0; i < this.cubics.length; i++) {
            const cubic = this.cubics[i];
            const effect = cubic.effect;
            const destination = cubic.destination;
            const yaw = owner.getRotationYaw() * Math.PI / 32768;
            let angle = this.cubics.length === 3 ? 24576 + i * 8192 : this.cubics.length === 2 ? 24576 + i * 16384 : 24576;

            if (!isFollowing && isLying) angle += 32768;
            tmpDirection.set(Math.cos(yaw), Math.sin(yaw), 0).applyAxisAngle(tmpAxis, angle * Math.PI / 32768);
            tmpSlot.copy(tmpOrigin).addScaledVector(tmpDirection, owner.getCollisionRadius() * 1.5);

            if (effect.position.distanceTo(owner.position) > 512) {
                effect.position.copy(owner.position);
                effect.position.z += 100;
                destination.copy(tmpOrigin);
            }
            if (destination.lengthSq() === 0) destination.copy(tmpOrigin);

            if (isFollowing) {
                destination.copy(tmpSlot);
                tmpDelta.subVectors(destination, effect.position);
                tmpDelta.setLength(Math.min(tmpDelta.length(), movement.getVelocity().length() * deltaTime));
            } else {
                let speed = 1.8;

                if (effect.position.distanceTo(tmpSlot) > height * 0.2) destination.copy(tmpSlot);
                tmpDelta.subVectors(destination, effect.position);

                if (Math.abs(tmpDelta.x) < 1 && Math.abs(tmpDelta.y) < 1 && Math.abs(tmpDelta.z) < 1) {
                    const sign = destination.z >= tmpSlot.z + 2 ? -1 : 1;
                    const z = Math.random() * height * 0.25;
                    const y = Math.random() * 2 - 1;
                    const x = Math.random() * 2 - 1;

                    destination.copy(tmpSlot).add(tmpDelta.set(x, y, z).multiplyScalar(sign));
                    speed = Math.random() * movement.getGroundSpeed() * 0.0125 / 3;
                }

                tmpDelta.subVectors(destination, effect.position).multiplyScalar(speed * deltaTime);
            }

            effect.position.add(tmpDelta);
        }
    }

    public onDetach(): void {
        for (const cubic of this.cubics)
            if (cubic.effect.parent) this.renderManager.removeTransientEffect(cubic.effect);
        this.cubics.length = 0;
        this.ids.length = 0;
    }
}

export default PawnCubicComponent;
