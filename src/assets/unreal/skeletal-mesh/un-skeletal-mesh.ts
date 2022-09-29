import BufferValue from "@client/assets/buffer-value";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import { generateUUID } from "three/src/math/MathUtils";
import FArray, { FArrayLazy, FPrimitiveArray, FPrimitiveArrayLazy } from "../un-array";
import FConstructable from "../un-constructable";
import FCoords from "../un-coords";
import ULodMesh from "../un-lod-mesh";
import FNumber from "../un-number";
import FQuaternion, { FAxis } from "../un-quaternion";
import FRawIndexBuffer from "../un-raw-index-buffer";
import FVector from "../un-vector";

class FWeightIndex extends FConstructable {
    public boneInfIndices: FPrimitiveArray<"uint16"> = new FPrimitiveArray(BufferValue.uint16);
    public startBoneInf: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        this.boneInfIndices.load(pkg);
        this.startBoneInf = pkg.read(uint32).value as number;

        return this;
    }
}

class FBoneInfluence extends FConstructable {
    public boneWeight: number;
    public boneIndex: number;

    public load(pkg: UPackage): this {
        const uint16 = new BufferValue(BufferValue.uint16);

        this.boneWeight = pkg.read(uint16).value as number;
        this.boneIndex = pkg.read(uint16).value as number;

        return this;
    }
}

class FJointPos extends FConstructable {
    public rotation = new FQuaternion();
    public position = new FVector();
    public scale = new FVector();
    public length: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);

        this.rotation.load(pkg);
        this.position.load(pkg);
        this.length = pkg.read(float).value as number;
        this.scale.load(pkg);

        this.scale.set(1, 1, 1);

        return this;
    }

}

class FMeshBone extends FConstructable {
    public boneName: string;
    public flags: number;
    public bonePos = new FJointPos();
    public numChildren: number;
    public parentIndex: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);

        const nameIndex = pkg.read(compat).value as number;
        this.boneName = pkg.nameTable[nameIndex].name.value as string;

        this.flags = pkg.read(uint32).value as number;

        this.bonePos.load(pkg);

        this.numChildren = pkg.read(uint32).value as number;
        this.parentIndex = pkg.read(uint32).value as number;

        return this;
    }
}

class FMeshNorm extends FConstructable {
    public x = 10;
    public y = 10;
    public z = 10;

    public v: number;

    public load(pkg: UPackage): this {
        this.v = pkg.read(new BufferValue(BufferValue.uint32)).value as number;

        return this;
    }
}

class FSkinPoint extends FConstructable {
    public point = new FVector();
    public normal = new FMeshNorm();

    public load(pkg: UPackage): this {

        this.point.load(pkg);
        this.normal.load(pkg);

        return this;
    }
}

class FSkelMeshSection extends FConstructable {
    public materialIndex: number;
    public minStreamIndex: number;
    public minWedgeIndex: number;
    public maxWedgeIndex: number;
    public numStreamIndices: number;
    public boneIndex: number;
    public fE: number;
    public firstFace: number;
    public numFaces: number;

    public load(pkg: UPackage): this {
        const int16 = new BufferValue(BufferValue.int16);

        this.materialIndex = pkg.read(int16).value as number;

        this.minStreamIndex = pkg.read(int16).value as number;

        this.minWedgeIndex = pkg.read(int16).value as number;
        this.maxWedgeIndex = pkg.read(int16).value as number;

        this.numStreamIndices = pkg.read(int16).value as number;

        this.boneIndex = pkg.read(int16).value as number;
        this.fE = pkg.read(int16).value as number;
        this.firstFace = pkg.read(int16).value as number;
        this.numFaces = pkg.read(int16).value as number;

        return this;
    }
}

class FAnimMeshVertex extends FConstructable {
    public position = new FVector();
    public normal = new FVector();
    public texU: number;
    public texV: number;

    public load(pkg: UPackage): this {

        const float = new BufferValue(BufferValue.float);

        this.position.load(pkg);
        this.normal.load(pkg);
        this.texU = pkg.read(float).value as number;
        this.texV = pkg.read(float).value as number;

        return this;
    }
}

class FSkinVertexStream extends FConstructable {
    public revision: number;
    public unkVar0: number;
    public unkVar1: number;
    public vertices = new FArray(FAnimMeshVertex);

    public load(pkg: UPackage): this {

        const uint32 = new BufferValue(BufferValue.uint32);

        this.revision = pkg.read(uint32).value as number;
        this.unkVar0 = pkg.read(uint32).value as number;
        this.unkVar1 = pkg.read(uint32).value as number;
        this.vertices.load(pkg);

        return this;
    }
}

class FTriangleLOD extends FConstructable {
    public indices: [number, number, number] = new Array(3) as [number, number, number];
    public materialIndex: number;

    public load(pkg: UPackage): this {
        const uint16 = new BufferValue(BufferValue.uint16);

        this.indices[0] = pkg.read(uint16).value as number;
        this.indices[1] = pkg.read(uint16).value as number;
        this.indices[2] = pkg.read(uint16).value as number;

        this.materialIndex = pkg.read(uint16).value as number;

        return this;
    }
}
class FStaticModelLOD extends FConstructable {
    public skinningData = new FPrimitiveArray(BufferValue.uint32);
    public skinPoints = new FArray(FSkinPoint);
    public numSoftWedges: number;
    public softSections = new FArray(FSkelMeshSection);
    public rigidSections = new FArray(FSkelMeshSection);
    public softIndices = new FRawIndexBuffer();
    public rigidIndices = new FRawIndexBuffer();
    public skinVertexStream = new FSkinVertexStream();
    public vertexInfluences = new FArrayLazy(FVertexInfluence);
    public wedges = new FArrayLazy(FMeshWedge);
    public faces = new FArrayLazy(FTriangleLOD);
    public points = new FArrayLazy(FVector);
    public lodHysteresis: number;
    public numSharedVertices: number;
    public lodMaxInfluences: number;
    public unkVar0: number;
    public unkVar1: number;

    public load(pkg: UPackage): this {

        const int32 = new BufferValue(BufferValue.int32);
        const uint32 = new BufferValue(BufferValue.uint32);
        const float = new BufferValue(BufferValue.float);

        this.skinningData.load(pkg);
        this.skinPoints.load(pkg);
        this.numSoftWedges = pkg.read(int32).value as number;
        this.softSections.load(pkg);
        this.rigidSections.load(pkg);

        this.softIndices.load(pkg);
        this.rigidIndices.load(pkg);
        this.skinVertexStream.load(pkg);

        this.vertexInfluences.load(pkg);
        this.wedges.load(pkg);
        this.faces.load(pkg);
        this.points.load(pkg);

        this.lodHysteresis = pkg.read(float).value as number;
        this.numSharedVertices = pkg.read(uint32).value as number
        this.lodMaxInfluences = pkg.read(uint32).value as number
        this.unkVar0 = pkg.read(uint32).value as number
        this.unkVar1 = pkg.read(uint32).value as number


        const useNewWedges = pkg.read(uint32).value as number

        if (useNewWedges !== 0)
            debugger;

        return this;
    }
}

class FMeshWedge extends FConstructable {
    public iVertex: number;
    public texU: number;
    public texV: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);
        const uint16 = new BufferValue(BufferValue.uint16);

        this.iVertex = pkg.read(uint16).value as number;
        this.texU = pkg.read(float).value as number;
        this.texV = pkg.read(float).value as number;

        return this;
    }
}

class FTriangle extends FConstructable {
    public indices: [number, number, number] = new Array(3) as [number, number, number];
    public materialIndex: number;
    public materialIndex2: number;
    public smoothingGroups: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);
        const uint16 = new BufferValue(BufferValue.uint16);
        const uint8 = new BufferValue(BufferValue.uint8);

        this.indices[0] = pkg.read(uint16).value as number;
        this.indices[1] = pkg.read(uint16).value as number;
        this.indices[2] = pkg.read(uint16).value as number;

        this.materialIndex = pkg.read(uint8).value as number;
        this.materialIndex2 = pkg.read(uint8).value as number;
        this.smoothingGroups = pkg.read(uint32).value as number;

        return this;
    }
}

class FVertexInfluence extends FConstructable {
    public weight: number;
    public iPoint: number;
    public iBone: number;

    public load(pkg: UPackage): this {
        const float = new BufferValue(BufferValue.float);
        const uint16 = new BufferValue(BufferValue.uint16);

        this.weight = pkg.read(float).value as number;
        this.iPoint = pkg.read(uint16).value as number;
        this.iBone = pkg.read(uint16).value as number;

        return this;
    }
}

class USkeletalMesh extends ULodMesh {

    protected points2 = new FArray(FVector);
    protected refSkeleton = new FArray(FMeshBone);
    protected animationId: number;
    protected animation: UMeshAnimation;
    protected skeletalDepth: number;
    protected weightIndices = new FArray(FWeightIndex);
    protected boneInluences = new FArray(FBoneInfluence);
    protected attachAliases: string[];
    protected attachBoneNames: string[];
    protected attachCoords = new FArray(FCoords);
    protected lodModels = new FArray(FStaticModelLOD);
    protected sk_unkIndex1: number;
    protected points = new FArrayLazy(FVector);
    protected wedges = new FArrayLazy(FMeshWedge);
    protected faces = new FArrayLazy(FTriangle);
    protected vertexInfluences = new FArrayLazy(FVertexInfluence);
    protected collapseWedge = new FPrimitiveArrayLazy(BufferValue.uint16);
    protected sk_unkArr10 = new FPrimitiveArrayLazy(BufferValue.uint16);
    protected sk_unkVar1: number;
    protected sk_unkArr11 = new FPrimitiveArray(BufferValue.uint32);
    protected sk_unkVar2: number;

    public doLoad(pkg: UPackage, exp: UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        super.doLoad(pkg, exp);

        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);

        this.points2.load(pkg);
        this.refSkeleton.load(pkg);

        this.animationId = pkg.read(compat).value as number;

        if (this.animationId !== 0) {
            this.promisesLoading.push(new Promise<void>(async resolve => {
                this.animation = await pkg.fetchObject<UMeshAnimation>(this.animationId);

                resolve();
            }));
        }

        this.skeletalDepth = pkg.read(uint32).value as number;
        this.weightIndices.load(pkg);
        this.boneInluences.load(pkg);
        this.attachAliases = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);
        this.attachBoneNames = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);
        this.attachCoords.load(pkg);

        if (this.version >= 2) {
            this.lodModels.load(pkg);
            this.sk_unkIndex1 = pkg.read(compat).value as number;

            if (this.sk_unkIndex1 !== 0)
                debugger;

            this.points.load(pkg);
            this.wedges.load(pkg);
            this.faces.load(pkg);
            this.vertexInfluences.load(pkg);
            this.collapseWedge.load(pkg);
            this.sk_unkArr10.load(pkg);

            if (verArchive >= 118 && verLicense >= 3)
                this.sk_unkVar1 = pkg.read(uint32).value as number;

            if (verArchive >= 123 && verLicense >= 18) {
                this.sk_unkArr11.load(pkg);
            }

            if (verArchive >= 120) {
                this.sk_unkVar2 = pkg.read(uint32).value as number;
            }

            this.readHead = pkg.tell();

        } else {
            debugger;
        }

        console.assert(this.readHead === this.readTail, "Should be zero");
    }

    public async getDecodeInfo(library: DecodeLibrary): Promise<ISkinnedMeshObjectDecodeInfo> {
        await this.onLoaded();

        if (this.uuid in library.geometries) return {
            uuid: this.uuid,
            type: "SkinnedMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid
        } as ISkinnedMeshObjectDecodeInfo;

        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        const section = this;
        const { positions, uvs, bones, weights } = convertWedges(section.points, section.wedges, section.vertexInfluences);
        const { indices, groups } = buildIndices(section.faces, this.lodMeshMaterials.length);
        const skeleton = collectSkeleton(this.refSkeleton);

        const materials = await Promise.all(this.lodMeshMaterials.map((mat: FStaticMeshMaterial) => mat.getDecodeInfo(library)));

        library.materials[this.uuid] = { materialType: "group", materials } as IMaterialGroupDecodeInfo;
        library.geometries[this.uuid] = {
            attributes: {
                positions,
                skinIndex: bones,
                skinWeight: weights,
                uvs
            },
            groups,
            indices,
            bounds: this.decodeBoundsInfo()
        };

        function fixVector(v: FVector) { return new FVector(v.x, v.z, v.y); }
        function fixRotation(v: FQuaternion) { return new FQuaternion(v.x, v.z, v.y, v.w); }

        const animations: GenericObjectContainer_T<IKeyframeDecodeInfo_T[]> = {};

        const boneCount = this.refSkeleton.length;
        const boneMap = new Array(boneCount);
        const refBones = this.animation.refBones;

        for (let i = 0; i < boneCount; i++) {
            const boneSkeleton = this.refSkeleton.getElem(i);

            for (let j = 0, len = refBones.length; j < len; j++) {
                const boneAnim = refBones.getElem(j);

                if (boneSkeleton.boneName !== boneAnim.boneName)
                    continue;

                boneMap[i] = [boneAnim.boneName.replaceAll(" ", "_"), j];
            }
        }

        for (let k = 0, animCount = this.animation.sequences.getElemCount(); k < animCount; k++) {
            const sequence = this.animation.sequences.getElem(k);
            const move = this.animation.moves[k];

            const animName = sequence.name;
            const framerate = sequence.framerate;
            const keyframes: IKeyframeDecodeInfo_T[] = [];

            for (let i = 0, len = move.boneIndices.getElemCount(); i < len; i++) {
                const boneIndexMesh = move.boneIndices.getElem(i);
                const [boneName, boneIndexAnim] = boneMap[boneIndexMesh];
                const track = move.animTracks.getElem(boneIndexAnim);
                const trackFrameCount = track.keyTime.getElemCount();

                const lenPos = track.keyPos.getElemCount();
                const lenRot = track.keyQuat.getElemCount();

                const timesPos = new Float32Array(lenPos);
                const timesRot = new Float32Array(lenRot);

                const positions = new Float32Array(lenPos * 3);
                const rotations = new Float32Array(lenRot * 4);

                for (let j = 0; j < trackFrameCount; j++) {
                    const time = track.keyTime.getElem(j);

                    if (j < lenPos) {
                        const idxPos = j * 3;
                        let pos = track.keyPos.getElem(j < lenPos ? j : lenPos - 1);

                        pos = fixVector(pos);

                        timesPos[j] = time / framerate;

                        positions[idxPos + 0] = pos.x;
                        positions[idxPos + 1] = pos.y;
                        positions[idxPos + 2] = pos.z;

                    }

                    if (j < lenRot) {
                        let rot = track.keyQuat.getElem(j < lenRot ? j : lenRot - 1);
                        const idxRot = j * 4;


                        rot = fixRotation(rot);

                        if (boneIndexAnim === 0)
                            rot = rot.conjugate();

                        timesRot[j] = time / framerate;

                        rotations[idxRot + 0] = rot.x;
                        rotations[idxRot + 1] = rot.y;
                        rotations[idxRot + 2] = rot.z;
                        rotations[idxRot + 3] = rot.w;
                    }
                }

                keyframes.push({ name: `${boneName}.position`, times: timesPos, values: positions, type: "Vector" });
                keyframes.push({ name: `${boneName}.quaternion`, times: timesRot, values: rotations, type: "Quaternion" });
            }

            animations[animName] = keyframes;
        }


        const boneCoords = new Array<FBoneCoord>(boneCount);
        const matrices = [];

        const _positions = new Array<number[]>(boneCount);
        const _rotations = new Array<number[]>(boneCount);

        for (let boneIndex = 0; boneIndex < boneCount; boneIndex++) {
            const bone = this.refSkeleton.getElem(boneIndex);

            let bonePos = bone.bonePos.position.clone();
            let boneRot = bone.bonePos.rotation.clone();

            if (boneIndex === 0)
                boneRot = boneRot.conjugate();

            bonePos = fixVector(bonePos);
            boneRot = fixRotation(boneRot);

            _positions[boneIndex] = [bonePos.x, bonePos.y, bonePos.z];
            _rotations[boneIndex] = [boneRot.x, boneRot.y, boneRot.z, boneRot.w];

            boneRot.w = -boneRot.w;

            let bc = boneCoords[boneIndex] = new FBoneCoord();
            bc.origin = bonePos;
            bc.axis = boneRot.toAxis();

            if (boneIndex > 0) {
                bc = boneCoords[boneIndex] = boneCoords[bone.parentIndex].untransformCoords(bc);
            }

            const invCoords = bc.invert();

            matrices.push(invCoords.toElements());
        }

        return {
            uuid: this.uuid,
            type: "SkinnedMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid,
            skeleton,
            animations,
            matrices,
            boneData: { positions: _positions, rotations: _rotations }
        } as ISkinnedMeshObjectDecodeInfo;
    }
}

export default USkeletalMesh;
export { USkeletalMesh };

const MAX_BONES = 4;

function buildIndices(faces: FTriangle[], materialCount: number) {
    const countFaces = faces.length;
    const TypedIndicesArray = getTypedArrayConstructor(countFaces * 3);
    const indicesByMaterial: number[][] = new Array(materialCount);

    for (let i = 0; i < materialCount; i++)
        indicesByMaterial[i] = [];

    for (let i = 0; i < countFaces; i++) {
        const tri = faces[i];
        const matIndex = tri.materialIndex;
        const constainer = indicesByMaterial[matIndex]

        constainer.push(...tri.indices);
    }

    const indices = new TypedIndicesArray(indicesByMaterial.flat());
    const groups: ArrGeometryGroup[] = new Array(materialCount);

    let firstIndex = 0;

    for (let i = 0; i < materialCount; i++) {
        const indexCount = indicesByMaterial[i].length;

        groups[i] = [firstIndex, indexCount, i];

        firstIndex = firstIndex + indexCount;
    }

    return { indices, groups };
}

function convertWedges(points: FVector[], wedges: FMeshWedge[], influences: FVertexInfluence[]) {
    const vertexInfos: VertexInfo_T[] = new Array(points.length);

    for (let i = 0, len = points.length; i < len; i++) {
        vertexInfos[i] = {
            numInfs: 0,
            bones: new Array(MAX_BONES).fill(0),
            weights: new Array(MAX_BONES).fill(0)
        }
    }

    // collect influences per vertex
    for (const infl of influences) {
        const vinfo = vertexInfos[infl.iPoint];
        const numInfs = vinfo.numInfs++;
        const idx = numInfs;

        if (numInfs >= MAX_BONES) {
            debugger;
        }

        // add the influence
        vinfo.bones[idx] = infl.iBone;
        vinfo.weights[idx] = infl.weight;
    }

    // normalize influences
    for (const V of vertexInfos) {
        if (!V || V.numInfs === 0) {
            debugger;
        }

        if (V.numInfs <= MAX_BONES) continue;   // no normalization is required

        let s = 0;

        for (let j = 0; j < MAX_BONES; j++)     // count sum
            s += V.weights[j];

        s = 1.0 / s;

        for (let j = 0; j < MAX_BONES; j++)     // adjust weights
            V.weights[j] *= s;
    }

    const wedgeCount = wedges.length
    const positions = new Float32Array(3 * wedgeCount);
    const uvs = new Float32Array(2 * wedgeCount);
    const bones = new Uint8Array(MAX_BONES * wedgeCount);
    const weights = new Float32Array(MAX_BONES * wedgeCount);

    // create vertices
    for (let i = 0; i < wedgeCount; i++) {
        const wedge = wedges[i];
        const vinfo = vertexInfos[wedge.iVertex];

        const point = points[wedge.iVertex].getVectorElements();
        const texU = wedge.texU, texV = wedge.texV;

        const offsetUv = 2 * i, offsetVertex = 3 * i, offsetBone = MAX_BONES * i;

        positions[offsetVertex + 0] = point[0];
        positions[offsetVertex + 1] = point[1];
        positions[offsetVertex + 2] = point[2];

        uvs[offsetUv + 0] = texU;
        uvs[offsetUv + 1] = texV;

        for (let j = 0, len = vinfo.numInfs; j < len; j++) {
            const off = offsetBone + j;

            bones[off] = vinfo.bones[j];
            weights[off] = vinfo.weights[j]; // Math.round(vinfo.weights[j] * 255) << (j * 8);
        }
    }

    return { positions, uvs, bones, weights };
}

function collectSkeleton(bones: FMeshBone[]): IBoneDecodeInfo[] {
    const decodedBones: IBoneDecodeInfo[] = new Array(bones.length);

    for (let i = 0, len = bones.length; i < len; i++) {
        const bone = bones[i];
        const pos = bone.bonePos;
        const decoded = {
            type: "Bone",
            uuid: generateUUID(),
            name: bone.boneName.replaceAll(" ", "_"),
            parent: bone.parentIndex,
            position: pos.position.getVectorElements(),
            scale: pos.scale.getVectorElements(),
            quaternion: pos.rotation.toQuatElements()
        } as IBoneDecodeInfo;

        decodedBones[i] = decoded;
    }

    return decodedBones;
}

type VertexInfo_T = {
    numInfs: number;
    bones: number[]
    weights: number[]
}

class FBoneCoord {
    public origin: FVector = new FVector();
    public axis: FAxis = new FAxis();

    public invert() {
        const out = new FBoneCoord();

        // negate inverse rotated origin
        out.origin = this.axis.transformVector(this.origin).negate();

        // transpose axis
        out.axis.x.x = this.axis.x.x;
        out.axis.x.y = this.axis.y.x;
        out.axis.x.z = this.axis.z.x;
        out.axis.y.x = this.axis.x.y;
        out.axis.y.y = this.axis.y.y;
        out.axis.y.z = this.axis.z.y;
        out.axis.z.x = this.axis.x.z;
        out.axis.z.y = this.axis.y.z;
        out.axis.z.z = this.axis.z.z;

        return out;
    }


    public untransformPoint(src: FVector) {
        let tmp = this.origin;

        tmp = this.axis.x.multiplyScalar(src.x).add(tmp);
        tmp = this.axis.y.multiplyScalar(src.y).add(tmp);
        tmp = this.axis.z.multiplyScalar(src.z).add(tmp);

        return tmp;
    }

    public untransformCoords(src: FBoneCoord) {
        const out = new FBoneCoord();

        out.origin = this.untransformPoint(src.origin);
        out.axis = this.axis.untransformAxis(src.axis);

        return out;
    }

    toElements() {
        return [
            this.axis.x.x, this.axis.x.y, this.axis.x.z, 0,
            this.axis.y.x, this.axis.y.y, this.axis.y.z, 0,
            this.axis.z.x, this.axis.z.y, this.axis.z.z, 0,
            this.origin.x, this.origin.y, this.origin.z, 1
        ];
    }
}