import { Matrix4, Skeleton, SkinnedMesh } from "three";

const tmpMeshInverse = new Matrix4();
const tmpBoneMatrix = new Matrix4();
const tmpIdentity = new Matrix4();

// three skins through world space, where float32 quantizes a vertex to ~0.03 units at level coordinates - a whole frame of idle motion
class LocalSpaceSkeleton extends Skeleton {
    public mesh: SkinnedMesh = null;

    public update(): void {
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

        if (this.boneTexture !== null)
            this.boneTexture.needsUpdate = true;
    }
}

export default LocalSpaceSkeleton;
export { LocalSpaceSkeleton };
