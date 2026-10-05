import { Box3, Matrix4, Object3D, Raycaster, Vector3 } from "three";
import { decodeSkinnedMesh } from "../assets/decoders/object3d-decoder";
import type DecodeLibrary from "../assets/unreal/decode-library";
import type LitSkinnedMesh from "./lit-skinned-mesh";
import type RenderManager from "../rendering/render-manager";
import type { ActorCollisionProfile_T } from "./objects";

const tmpIdentity = new Matrix4();
const tmpStart = new Vector3();
const tmpDelta = new Vector3();
const tmpExtent = new Vector3();
const tmpHit = new Vector3();
const tmpBounds = new Box3();
const pickupProfile: ActorCollisionProfile_T = { collideActors: true, collideWorld: true, blockActors: true, blockPlayers: false, blockZeroExtent: true, blockNonZeroExtent: true, worldGeometry: false, useCylinderCollision: false, collisionRadius: 0, collisionHeight: 0 };

export class L2Pickup extends Object3D {
    public readonly objectId: number;
    public readonly itemId: number;
    public readonly count: number;
    public readonly stackable: boolean;
    protected readonly renderManager: RenderManager;
    protected readonly meshes: LitSkinnedMesh[] = [];
    protected readonly bounds = new Box3();
    protected grounded = false;

    public constructor(renderManager: RenderManager, objectId: number, itemId: number, count: number, stackable: boolean) {
        super();

        this.renderManager = renderManager;
        this.objectId = objectId;
        this.itemId = itemId;
        this.count = count;
        this.stackable = stackable;
        this.visible = false;
    }

    public setMeshes(library: DecodeLibrary): void {
        // ponytail: reference-pose drops; port L2NMover and drop rotations for retail landing.
        for (const item of library.pickup.items) {
            const mesh = decodeSkinnedMesh(library, library.scriptMeshes[item.mesh.toLowerCase()], item.skins);

            for (const inverse of mesh.skeleton.boneInverses) inverse.multiply(mesh.bindMatrix);
            mesh.bind(mesh.skeleton, tmpIdentity);
            this.renderManager.retainGeometry(mesh.geometry);
            this.meshes.push(mesh);
            this.add(mesh);
        }

        this.updateMatrixWorld(true);
        for (const mesh of this.meshes) mesh.skeleton.update();
        this.bounds.setFromObject(this).translate(tmpHit.copy(this.position).negate());
    }

    public placeOnGround(): void {
        if (this.grounded || !this.meshes.length || !this.renderManager.getSector(this.position)) return;

        const physics = this.renderManager.getParent().getComponent("physics");

        for (let i = 0; i < 30; i++) {
            tmpStart.copy(this.position).add(tmpHit.set(0, 0, 20 + i * 30));
            tmpDelta.set(0, 0, -50 - i * 60);

            const hit = physics.singleLineCheck({ location: tmpStart, delta: tmpDelta, extent: tmpExtent, sourceIsPlayer: false, sourceProfile: pickupProfile });

            if (!hit || (hit.actor as any)?.isActor || hit.normal.z <= 0) continue;

            this.position.z = hit.location.z - this.bounds.min.z;
            this.updateMatrixWorld(true);
            this.grounded = this.visible = true;
            return;
        }
    }

    public getPickDistance(raycaster: Raycaster): number {
        if (!this.visible) return Infinity;

        tmpBounds.copy(this.bounds).translate(this.position);

        return raycaster.ray.intersectBox(tmpBounds, tmpHit) ? raycaster.ray.origin.distanceTo(tmpHit) : Infinity;
    }

    public release(): void {
        for (const mesh of this.meshes) {
            mesh.skeleton.dispose();
            this.renderManager.releaseGeometry(mesh.geometry);

            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
        }

        this.meshes.length = 0;
        this.removeFromParent();
    }
}

export default L2Pickup;
