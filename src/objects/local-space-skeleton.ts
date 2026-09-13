import { Matrix4, Object3D, Skeleton, SkinnedMesh, Vector3 } from "three";

const tmpMeshInverse = new Matrix4();
const tmpBoneMatrix = new Matrix4();
const tmpBoneLocal = new Matrix4();
const tmpIdentity = new Matrix4();
const tmpAttachmentOffset = new Vector3();

function frozenUpdateMatrixWorld(): void { }

type BoneAttachment_T = { object: Object3D, bone: number, usesBindMatrix: boolean, absolute?: Object3D };

// three skins through world space, where float32 quantizes a vertex to ~0.03 units at level coordinates - a whole frame of idle motion
export class LocalSpaceSkeleton extends Skeleton {
    public mesh: SkinnedMesh = null;
    public posePaused: boolean = false;

    protected parents: Int32Array = null;
    protected locals: Matrix4[] = null;
    protected attachments: BoneAttachment_T[] = null;
    protected ownsBones: boolean = false;
    protected visibleAttachmentCount = 0;

    public getBoneWorldPosition(index: number, target: Vector3): Vector3 {
        if (this.parents === null) this.claimBones();
        if (!this.ownsBones) return this.bones[index].getWorldPosition(target);

        return target.setFromMatrixPosition(this.getBoneWorldMatrix(index, tmpBoneMatrix));
    }

    protected getBoneWorldMatrix(index: number, target: Matrix4): Matrix4 {
        target.identity();

        for (let i = index; i >= 0; i = this.parents[i]) {
            const bone = this.bones[i];

            tmpBoneLocal.compose(bone.position, bone.quaternion, bone.scale);
            target.premultiply(tmpBoneLocal);
        }

        this.mesh.updateWorldMatrix(true, false);
        target.premultiply(this.mesh.bindMatrixInverse).premultiply(this.mesh.matrixWorld);

        return target;
    }

    public attachObject(object: Object3D, boneNameOrIndex: string | number, absolute: boolean = false): boolean {
        if (this.parents === null) this.claimBones();
        if (!this.ownsBones) return false;

        const index = typeof boneNameOrIndex === "number"
            ? boneNameOrIndex
            : this.bones.findIndex(bone => bone.name === boneNameOrIndex.replaceAll(" ", "_").toLowerCase());

        if (index < 0 || index >= this.bones.length) return false;

        const bone = this.bones[index];
        const attachment = this.attachments.find(attachment => attachment.object === object);
        const oldBone = attachment?.bone;
        let anchor: Object3D = null;

        if (attachment?.absolute) attachment.absolute.removeFromParent();
        if (absolute) {
            anchor = new Object3D();
            anchor.updateMatrixWorld = frozenUpdateMatrixWorld;
            anchor.updateWorldMatrix = () => {
                this.getBoneWorldMatrix(index, bone.matrixWorld);
                this.updateAbsoluteAttachment(object, bone, anchor);
            };
            bone.add(anchor);
            anchor.add(object);
        } else bone.add(object);
        bone.updateWorldMatrix = () => { this.getBoneWorldMatrix(index, bone.matrixWorld); };

        if (attachment) {
            attachment.bone = index;
            attachment.usesBindMatrix = true;
            attachment.absolute = anchor;

            if (oldBone !== index && !this.attachments.some(entry => entry !== attachment && entry.bone === oldBone))
                this.bones[oldBone].updateWorldMatrix = Object3D.prototype.updateWorldMatrix;
        }
        else {
            this.attachments.push({ object, bone: index, usesBindMatrix: true, absolute: anchor });
            this.visibleAttachmentCount++;
            this.bones[0].visible = true;
        }

        return true;
    }

    public detachObject(object: Object3D): boolean {
        if (this.parents === null) this.claimBones();

        const index = this.attachments.findIndex(attachment => attachment.object === object);

        if (index < 0) return false;

        const bone = this.attachments[index].bone;

        if (this.attachments[index].absolute) this.attachments[index].absolute.removeFromParent();
        this.attachments.splice(index, 1);
        object.removeFromParent();
        this.visibleAttachmentCount--;

        if (!this.attachments.some(attachment => attachment.bone === bone))
            this.bones[bone].updateWorldMatrix = Object3D.prototype.updateWorldMatrix;

        if (this.visibleAttachmentCount === 0) this.bones[0].visible = false;

        return true;
    }

    public update(): void {
        if (this.parents === null) this.claimBones();
        if (this.posePaused) return;

        if (this.ownsBones) this.updateOwnedPose();
        else this.updateAttachedPose();

        if (this.boneTexture !== null) this.boneTexture.needsUpdate = true;
    }

    // Compose the mesh-space pose directly and freeze three's redundant world-space walk.
    protected updateOwnedPose(): void {
        const bones = this.bones;
        const inverses = this.boneInverses;
        const matrices = this.boneMatrices;
        const parents = this.parents;
        const locals = this.locals;

        for (let i = 0, len = bones.length; i < len; i++) {
            const bone = bones[i];
            const local = locals[i];
            const parent = parents[i];

            local.compose(bone.position, bone.quaternion, bone.scale);

            if (parent >= 0) local.premultiply(locals[parent]);

            tmpBoneMatrix.multiplyMatrices(local, inverses[i]);
            tmpBoneMatrix.toArray(matrices, i * 16);
        }

        for (let i = 0, len = this.attachments.length; i < len; i++) {
            const attachment = this.attachments[i];

            if (attachment.usesBindMatrix)
                bones[attachment.bone].matrixWorld.multiplyMatrices(this.mesh.matrixWorld, this.mesh.bindMatrixInverse).multiply(locals[attachment.bone]);
            else bones[attachment.bone].matrixWorld.multiplyMatrices(this.mesh.matrixWorld, locals[attachment.bone]);

            if (attachment.absolute) this.updateAbsoluteAttachment(attachment.object, bones[attachment.bone], attachment.absolute);

            attachment.object.updateMatrixWorld(true);
        }
    }

    protected updateAbsoluteAttachment(object: Object3D, bone: Object3D, anchor: Object3D): void {
        // Engine.dll SetAttachmentLocation 0x94b99d: offset in mesh space, RelativeRotation copied directly at 0x94b9eb.
        const position = object.position;
        const origin = bone.matrixWorld.elements;

        tmpBoneMatrix.multiplyMatrices(this.mesh.matrixWorld, this.mesh.bindMatrixInverse);
        tmpAttachmentOffset.copy(position).applyMatrix4(tmpBoneMatrix);
        tmpAttachmentOffset.x += origin[12] - tmpBoneMatrix.elements[12] - position.x;
        tmpAttachmentOffset.y += origin[13] - tmpBoneMatrix.elements[13] - position.y;
        tmpAttachmentOffset.z += origin[14] - tmpBoneMatrix.elements[14] - position.z;
        anchor.matrixWorld.identity().setPosition(tmpAttachmentOffset);
    }

    protected updateAttachedPose(): void {
        const bones = this.bones;
        const inverses = this.boneInverses;
        const matrices = this.boneMatrices;

        tmpMeshInverse.copy(this.mesh.matrixWorld).invert();

        for (let i = 0, len = bones.length; i < len; i++) {
            const bone = bones[i];

            tmpBoneMatrix.multiplyMatrices(bone ? bone.matrixWorld : tmpIdentity, inverses[i]);
            tmpBoneMatrix.premultiply(tmpMeshInverse);
            tmpBoneMatrix.toArray(matrices, i * 16);
        }
    }

    protected claimBones(): void {
        const bones = this.bones;
        const indices = new Map<Object3D, number>();

        this.parents = new Int32Array(bones.length);
        this.locals = bones.map(() => new Matrix4());
        this.attachments = [];
        this.ownsBones = bones[0].parent === this.mesh;

        if (!this.ownsBones) return; // a loose chain attached onto some other skeleton's bone, see attachLooseBoneChains

        for (let i = 0, len = bones.length; i < len; i++) indices.set(bones[i], i);

        for (let i = 0, len = bones.length; i < len; i++) {
            const parent = bones[i].parent;
            const index = indices.has(parent) ? indices.get(parent) : -1;

            if (index >= i) throw new Error(`Bone '${bones[i].name}' is posed before its parent '${parent.name}'.`);
            if (index < 0 && parent !== this.mesh) throw new Error(`Bone '${bones[i].name}' hangs off '${parent.name}', which is outside its own skeleton.`);

            this.parents[i] = index;

            for (const child of bones[i].children) {
                if (indices.has(child)) continue;

                this.attachments.push({ object: child, bone: i, usesBindMatrix: false });
                bones[i].updateWorldMatrix = frozenUpdateMatrixWorld;
            }
        }

        bones[0].updateMatrixWorld = frozenUpdateMatrixWorld;
    }
}

export default LocalSpaceSkeleton;
