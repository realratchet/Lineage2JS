import { Matrix4, Object3D, Skeleton, SkinnedMesh } from "three";

const tmpMeshInverse = new Matrix4();
const tmpBoneMatrix = new Matrix4();
const tmpIdentity = new Matrix4();

const frozenUpdateMatrixWorld = function () { };

type BoneAttachment_T = { object: Object3D, bone: number };

// three skins through world space, where float32 quantizes a vertex to ~0.03 units at level coordinates - a whole frame of idle motion
class LocalSpaceSkeleton extends Skeleton {
    public mesh: SkinnedMesh = null;
    public posePaused: boolean = false;

    protected parents: Int32Array = null;
    protected locals: Matrix4[] = null;
    protected attachments: BoneAttachment_T[] = null;
    protected ownsBones: boolean = false;

    public update(): void {
        if (this.parents === null) this.claimBones();
        if (this.posePaused) return;

        if (this.ownsBones) this.updateOwnedPose();
        else this.updateAttachedPose();

        if (this.boneTexture !== null) this.boneTexture.needsUpdate = true;
    }

    // the bone chain hangs off the mesh, so composing it here in mesh space is the pose the shader
    // wants - three's own world-space walk over the chain is redundant and gets frozen off
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

            bones[attachment.bone].matrixWorld.multiplyMatrices(this.mesh.matrixWorld, locals[attachment.bone]);
            attachment.object.updateMatrixWorld(true);
        }
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

        bones.forEach((bone, i) => indices.set(bone, i));

        for (let i = 0, len = bones.length; i < len; i++) {
            const parent = bones[i].parent;
            const index = indices.has(parent) ? indices.get(parent) : -1;

            if (index >= i) throw new Error(`Bone '${bones[i].name}' is posed before its parent '${parent.name}'.`);
            if (index < 0 && parent !== this.mesh) throw new Error(`Bone '${bones[i].name}' hangs off '${parent.name}', which is outside its own skeleton.`);

            this.parents[i] = index;

            for (const child of bones[i].children)
                if (!indices.has(child)) this.attachments.push({ object: child, bone: i });
        }

        bones[0].updateMatrixWorld = frozenUpdateMatrixWorld;
    }
}

export default LocalSpaceSkeleton;
export { LocalSpaceSkeleton };
