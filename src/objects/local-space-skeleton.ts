import { Bone, BufferGeometry, KeyframeTrack, Matrix4, Object3D, Skeleton, SkinnedMesh, Vector3 } from "three";
import { evaluateDeferredPose, invalidatePoseRequirements } from "./skeletal-animation-mixer";
import type { ClipPose_T } from "./skeletal-animation-mixer";
import boneAtlas, { POSE_CLIP, POSE_LOCAL_MATRIX, POSE_SKIN_MATRIX, POSE_TRANSFORM, writePoseMatrix } from "./bone-atlas";

const tmpMeshInverse = new Matrix4();
const tmpBoneMatrix = new Matrix4();
const tmpBoneLocal = new Matrix4();
const tmpBoneRotation = new Matrix4();
const tmpBoneOffset = new Vector3();
const tmpIdentity = new Matrix4();
const tmpAttachmentOffset = new Vector3();
const cacheGeometryBones = new WeakMap<BufferGeometry, number[]>();

function writeBoneMatrix(a: Matrix4, b: Matrix4, target: Float32Array, offset: number): void {
    const ae = a.elements, be = b.elements;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

    target[offset] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    target[offset + 4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    target[offset + 8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    target[offset + 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    target[offset + 1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    target[offset + 5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    target[offset + 9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    target[offset + 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    target[offset + 2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    target[offset + 6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    target[offset + 10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    target[offset + 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    target[offset + 3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    target[offset + 7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    target[offset + 11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    target[offset + 15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
}

function frozenUpdateMatrixWorld(): void { }

function getBoneMesh(bone: Object3D): Object3D {
    while ((bone as Bone).isBone && bone.parent) bone = bone.parent;
    return bone;
}

export function requireBonePose(bone: Bone): void {
    const skeleton = (getBoneMesh(bone) as SkinnedMesh).skeleton as LocalSpaceSkeleton, index = skeleton.bones.indexOf(bone);

    if (index >= 0) skeleton.requireBone(index); // a loose chain hangs off another skeleton's bone and is always posed whole
}

type BoneAttachment_T = { object: Object3D, bone: number, usesBindMatrix: boolean, absolute?: Object3D };

// three skins through world space, where float32 quantizes a vertex to ~0.03 units at level coordinates - a whole frame of idle motion
export class LocalSpaceSkeleton extends Skeleton {
    public static updateEnabled: boolean = true;
    public static renderFrame: number = 0;
    public static nextRenderFrame: number = 0;
    public mesh: SkinnedMesh = null;
    public posePaused: boolean = false;
    public rootBoneSource: Bone = null;
    public isAtlasPacked: boolean = false;
    public atlasOffset: number = -1;
    protected atlasReferences: number = 0;
    protected isMatrixStale: boolean = false;

    protected poseFrame: number = 0;
    protected parents: Int32Array = null;
    protected locals: Matrix4[] = null;
    protected attachments: BoneAttachment_T[] = null;
    protected ownsBones: boolean = false;
    protected requiredBones: Set<number> = null;
    protected activeBones: number[] = null;
    protected attachmentBones: number[] = null;
    protected explicitBones: Set<number> = null;
    protected sampledBones: number[] = null;
    protected evaluatedBones: number[] = null;
    protected boneIndices: Map<Object3D, number> = null;
    protected clipPose: ClipPose_T = null;
    protected readonly cacheTrackAddresses = new Map<KeyframeTrack, number>();

    public addGeometry(geometry: BufferGeometry): void {
        if (!geometry.getAttribute("skinIndex")) return;

        let indices = cacheGeometryBones.get(geometry);

        if (!indices) {
            const bones = new Set<number>();

            for (const suffix of ["", "2"]) {
                const index = geometry.getAttribute(`skinIndex${suffix}`);
                const weight = geometry.getAttribute(`skinWeight${suffix}`);

                if (!index) continue;

                for (let i = 0; i < index.count; i++)
                    for (let j = 0; j < index.itemSize; j++)
                        if (weight.getComponent(i, j) !== 0) bones.add(index.getComponent(i, j));
            }

            cacheGeometryBones.set(geometry, indices = Array.from(bones));
        }

        if (!this.requiredBones) this.requiredBones = new Set();
        for (const index of indices) this.requiredBones.add(index);
        this.activeBones = null;
    }

    public retainAtlas(): void {
        if (this.atlasReferences++ > 0) return;
        if (this.parents === null) this.claimBones();

        this.atlasOffset = boneAtlas.allocate(this.bones.length);
        this.isAtlasPacked = true;
        boneAtlas.setBind(this.atlasOffset, this.boneInverses, this.parents);
        this.writeAtlasPose();
    }

    public releaseAtlas(isDisposed: boolean = false): void {
        if (!this.isAtlasPacked || !isDisposed && --this.atlasReferences > 0) return;
        if (this.clipPose && !isDisposed) {
            evaluateDeferredPose(this.mesh, true);
            this.clearClipPose();
        }

        this.atlasReferences = 0;

        const offset = this.atlasOffset;

        this.isAtlasPacked = false;
        this.atlasOffset = -1;
        boneAtlas.free(offset);
        for (const track of this.cacheTrackAddresses.keys()) boneAtlas.releaseClip(track);
        this.cacheTrackAddresses.clear();
        if (!isDisposed) this.resolveMatrices();
    }

    public dispose(): void {
        this.releaseAtlas(true);
        super.dispose();
    }

    public requireBone(index: number): void {
        if (index < 0) throw new Error(`Bone is not part of skeleton '${this.mesh.name}'.`);
        if (!this.explicitBones) this.explicitBones = new Set();
        if (this.explicitBones.has(index)) return;

        this.explicitBones.add(index);
        if (this.requiredBones) this.requiredBones.add(index);
        this.activeBones = null;
    }

    public getBoneWorldPosition(index: number, target: Vector3, offset?: Vector3): Vector3 {
        this.getBoneWorldMatrix(index, tmpBoneMatrix);

        target.setFromMatrixPosition(tmpBoneMatrix);
        if (offset) target.add(tmpBoneOffset.copy(offset).applyMatrix4(tmpBoneRotation.extractRotation(tmpBoneMatrix)));
        return target;
    }

    public getBoneWorldMatrix(index: number, target: Matrix4): Matrix4 {
        if (this.parents === null) this.claimBones();
        if (!this.ownsBones) {
            evaluateDeferredPose(this.mesh);
            this.bones[index].updateWorldMatrix(true, false);
            return target.copy(this.bones[index].matrixWorld);
        }

        this.getBonePose(index, target);

        this.mesh.updateWorldMatrix(true, false);
        target.premultiply(this.mesh.bindMatrixInverse).premultiply(this.mesh.matrixWorld);

        return target;
    }

    protected getBonePose(index: number, target: Matrix4): void {
        let isLazy = false;

        for (let bone = this.bones[index]; bone.isBone && !isLazy; bone = bone.parent as Bone) {
            if (bone === this.bones[0] && this.rootBoneSource) bone = this.rootBoneSource;
            isLazy = (bone as any).isPoseRequired === false;
        }

        evaluateDeferredPose(this.mesh, isLazy);
        if (this.rootBoneSource) evaluateDeferredPose(getBoneMesh(this.rootBoneSource), isLazy);
        if (isLazy) { // posed exactly now, and every frame after
            this.requireBone(index);
            if (this.rootBoneSource) requireBonePose(this.rootBoneSource);
        }

        target.identity();

        for (let bone = this.bones[index]; bone.isBone; bone = bone.parent as Bone) {
            if (bone === this.bones[0] && this.rootBoneSource) bone = this.rootBoneSource;

            tmpBoneLocal.compose(bone.position, bone.quaternion, bone.scale);
            target.premultiply(tmpBoneLocal);
        }
    }

    public matchRefBone(name: string): number {
        if (!name || name.toLowerCase() === "none") return -1;

        const mesh = this.mesh as any;

        if (mesh?.isLitSkinnedMesh) {
            // Engine.dll MatchRefBone 0x947ae7..0x947b8b resolves attach aliases before ref bones.
            const lowerName = name.toLowerCase();
            const aliasIndex = mesh.tagAliases.findIndex((alias: string) => alias.toLowerCase() === lowerName);

            if (aliasIndex >= 0) name = mesh.tagNames[aliasIndex];
        }

        name = name.replaceAll(" ", "_").toLowerCase();
        return this.bones.findIndex(bone => bone.name === name);
    }

    public attachObject(object: Object3D, boneNameOrIndex: string | number, absolute: boolean = false): boolean {
        if (this.parents === null) this.claimBones();
        if (!this.ownsBones) return false;

        const index = typeof boneNameOrIndex === "number"
            ? boneNameOrIndex
            : this.matchRefBone(boneNameOrIndex);

        if (index < 0 || index >= this.bones.length) return false;

        const bone = this.bones[index];
        this.activeBones = null;
        const attachment = this.attachments.find(attachment => attachment.object === object);
        const oldBone = attachment?.bone;
        let anchor: Object3D = null;

        if (attachment?.absolute) attachment.absolute.removeFromParent();
        if (absolute || (object as any).isAttachedMesh) {
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
        }
        this.updateAttachmentVisibility();

        return true;
    }

    public transferAttachments(skeletons: readonly LocalSpaceSkeleton[]): void {
        if (this.parents === null) this.claimBones();

        for (const attachment of this.attachments.slice()) {
            if (!attachment.usesBindMatrix) continue;

            const name = this.bones[attachment.bone].name;
            const skeleton = skeletons.find(skeleton => {
                if (skeleton.parents === null) skeleton.claimBones();
                return skeleton.ownsBones && skeleton.matchRefBone(name) >= 0;
            });

            if (!skeleton) throw new Error(`Replacement mesh has no attachment bone '${name}'.`);

            this.detachObject(attachment.object);
            skeleton.attachObject(attachment.object, name, !!attachment.absolute);
        }
    }

    public detachObject(object: Object3D): boolean {
        if (this.parents === null) this.claimBones();

        const index = this.attachments.findIndex(attachment => attachment.object === object);

        if (index < 0) return false;

        const bone = this.attachments[index].bone;

        if (this.attachments[index].absolute) this.attachments[index].absolute.removeFromParent();
        this.attachments.splice(index, 1);
        this.activeBones = null;
        object.removeFromParent();

        if (!this.attachments.some(attachment => attachment.bone === bone))
            this.bones[bone].updateWorldMatrix = Object3D.prototype.updateWorldMatrix;

        this.updateAttachmentVisibility();

        return true;
    }

    protected updateAttachmentVisibility(): void {
        for (const bone of this.bones) bone.visible = false;
        for (const attachment of this.attachments)
            for (let i = attachment.bone; i >= 0; i = this.parents[i]) this.bones[i].visible = true;
    }

    public hasCurrentPose(): boolean { return LocalSpaceSkeleton.renderFrame !== 0 && this.poseFrame === LocalSpaceSkeleton.renderFrame && this.activeBones !== null; }

    public update(): void {
        if (!LocalSpaceSkeleton.updateEnabled) return;
        if (this.parents === null) this.claimBones();
        if (this.posePaused) return;

        evaluateDeferredPose(this.mesh, this.activeBones === null);
        if (this.activeBones === null) this.clipPose = null; // every bone was just posed, the mixer samples again on its next steady frame

        if (this.isAtlasPacked) {
            this.writeAtlasPose();
            this.isMatrixStale = true;

            if (this.ownsBones) {
                for (let j = 0, len = this.attachmentBones.length; j < len; j++)
                    if (this.attachmentBones[j] !== 0 || !this.rootBoneSource) this.composeLocal(this.attachmentBones[j]);

                this.updateAttachments();
            }
        } else this.updateMatrices();

        this.poseFrame = LocalSpaceSkeleton.renderFrame;
    }

    public resolveMatrices(): void {
        if (!this.isMatrixStale) return;
        if (this.clipPose) evaluateDeferredPose(this.mesh, true);

        this.updateMatrices();
    }

    public setClipPose(clipPose: ClipPose_T, clipTime: number): void {
        if (!this.isAtlasPacked || !this.ownsBones) return this.clearClipPose();

        const pose = boneAtlas.getPose(), base = this.atlasOffset * 16;

        if (this.clipPose !== clipPose) {
            this.clipPose = null;
            this.writeAtlasPose();

            const sampled = this.sampledBones;

            for (let j = 0, len = sampled.length; j < len; j++) {
                const offset = base + sampled[j] * 16;

                pose[offset + 3] = -1;
                pose[offset + 11] = -1;
                pose[offset + 12] = POSE_CLIP;
                pose[offset + 13] = this.atlasOffset;
            }
            for (const { bone, track, isQuaternion } of clipPose.tracks) {
                const index = this.boneIndices.get(bone);

                if (index === undefined) continue; // a loose chain bone under this mesh
                if (pose[base + index * 16 + 12] !== POSE_CLIP) continue;

                let address = this.cacheTrackAddresses.get(track);

                if (address === undefined) {
                    address = boneAtlas.retainClip(track, clipPose.framerate, clipPose.lastFrame);
                    this.cacheTrackAddresses.set(track, address);
                }
                pose[base + index * 16 + (isQuaternion ? 11 : 3)] = address;
            }

            this.clipPose = clipPose;
            this.setPoseRequirements();
        }

        pose[base + 14] = Math.min(Math.max(clipTime * clipPose.framerate, 0), clipPose.lastFrame);
        pose[base + 15] = clipPose.lastFrame;
        boneAtlas.markDirty(this.atlasOffset, this.bones.length);
    }

    public clearClipPose(): void {
        if (!this.clipPose) return;

        this.clipPose = null;
        if (this.activeBones) this.setPoseRequirements();
    }

    protected setPoseRequirements(): void {
        const bones = this.bones;

        for (let i = 0; i < bones.length; i++) (bones[i] as any).isPoseRequired = false;
        for (const index of this.clipPose ? this.evaluatedBones : this.activeBones) (bones[index] as any).isPoseRequired = true;
        invalidatePoseRequirements(this.mesh);
    }

    protected updateMatrices(): void {
        if (this.ownsBones) this.updateOwnedPose();
        else this.updateAttachedPose();

        if (this.boneTexture !== null) this.boneTexture.needsUpdate = true;
        this.isMatrixStale = false;
    }

    protected writeAtlasPose(): void {
        const bones = this.bones, pose = boneAtlas.getPose(), base = this.atlasOffset * 16;

        if (this.ownsBones) {
            const active = this.getActiveBones(), written = this.clipPose ? this.evaluatedBones : active;

            for (let j = 0, len = written.length; j < len; j++) {
                const i = written[j], offset = base + i * 16;

                if (i === 0 && this.rootBoneSource) {
                    writePoseMatrix(this.composeLocal(0), pose, offset, POSE_LOCAL_MATRIX);
                    continue;
                }

                const position = bones[i].position, quaternion = bones[i].quaternion, scale = bones[i].scale;

                pose[offset] = position.x; pose[offset + 1] = position.y; pose[offset + 2] = position.z;
                pose[offset + 4] = quaternion.x; pose[offset + 5] = quaternion.y; pose[offset + 6] = quaternion.z; pose[offset + 7] = quaternion.w;
                pose[offset + 8] = scale.x; pose[offset + 9] = scale.y; pose[offset + 10] = scale.z;
                pose[offset + 12] = POSE_TRANSFORM;
            }
        } else {
            tmpMeshInverse.copy(this.mesh.matrixWorld).invert();

            for (let i = 0, len = bones.length; i < len; i++) {
                tmpBoneMatrix.multiplyMatrices(bones[i] ? bones[i].matrixWorld : tmpIdentity, this.boneInverses[i]);
                tmpBoneMatrix.premultiply(tmpMeshInverse);
                writePoseMatrix(tmpBoneMatrix, pose, base + i * 16, POSE_SKIN_MATRIX);
            }
        }

        boneAtlas.markDirty(this.atlasOffset, bones.length);
    }

    protected getActiveBones(): number[] {
        if (this.activeBones) return this.activeBones;

        const bones = this.bones, parents = this.parents;
        const active = this.requiredBones ? new Set(this.requiredBones) : new Set(bones.map((_bone, index) => index));
        const attached = new Set<number>();

        for (const attachment of this.attachments) active.add(attachment.bone);
        for (const index of active)
            for (let parent = parents[index]; parent >= 0; parent = parents[parent]) active.add(parent);
        for (const attachment of this.attachments)
            for (let index = attachment.bone; index >= 0; index = parents[index]) attached.add(index);

        const evaluated = new Set(attached);

        if (this.rootBoneSource) evaluated.add(0);
        if (this.explicitBones)
            for (const index of this.explicitBones)
                for (let bone = index; bone >= 0; bone = parents[bone]) evaluated.add(bone);

        this.activeBones = Array.from(active).sort((a, b) => a - b);
        this.attachmentBones = Array.from(attached).sort((a, b) => a - b);
        this.evaluatedBones = Array.from(evaluated).sort((a, b) => a - b);
        this.sampledBones = this.activeBones.filter(index => !evaluated.has(index));
        if (!this.boneIndices) this.boneIndices = new Map(bones.map((bone, index) => [bone, index]));
        this.setPoseRequirements();

        return this.activeBones;
    }

    protected composeLocal(index: number): Matrix4 {
        const bone = this.bones[index], local = this.locals[index], parent = this.parents[index];

        // UExtraSkeletalMeshInstance::GetFrame 0x96feba replaces the root pose with LowbodyBone.
        if (index === 0 && this.rootBoneSource) this.getBonePose(0, local);
        else local.compose(bone.position, bone.quaternion, bone.scale);

        if (parent >= 0) local.premultiply(this.locals[parent]);

        return local;
    }

    protected updateOwnedPose(): void {
        const inverses = this.boneInverses;
        const matrices = this.boneMatrices;
        const active = this.getActiveBones();

        for (let j = 0, len = active.length; j < len; j++)
            writeBoneMatrix(this.composeLocal(active[j]), inverses[active[j]], matrices, active[j] * 16);

        this.updateAttachments();
    }

    protected updateAttachments(): void {
        const bones = this.bones;
        const locals = this.locals;

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
        if ((object as any).isAttachedMesh) {
            // AttachedMeshToWorld 0x94fe80 uses FCoords::OrthoRotation before mesh scale.
            anchor.matrixWorld.extractRotation(bone.matrixWorld).copyPosition(bone.matrixWorld);
            return;
        }

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
        this.updateAttachmentVisibility();
    }
}

export default LocalSpaceSkeleton;
