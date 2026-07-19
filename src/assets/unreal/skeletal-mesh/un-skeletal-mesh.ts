import { BufferValue, UObject } from "@l2js/core";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import { generateUUID } from "three/src/math/MathUtils";
import FArray, { FArrayLazy, FPrimitiveArray, FPrimitiveArrayLazy } from "@l2js/core/unreal/un-array";
import FCoords from "../un-coords";
import ULodMesh from "../un-lod-mesh";
import FQuaternion, { FAxis } from "../un-quaternion";
import FRawIndexBuffer from "../un-raw-index-buffer";
import FVector from "../un-vector";
import { FIndexArray } from "@l2js/core/unreal/un-array";

class FWeightIndex extends UObject {
    public boneInfIndices: FPrimitiveArray<"uint16"> = new FPrimitiveArray(BufferValue.uint16);
    public startBoneInf: number;

    public load(pkg: C.APackage): this {
        this.boneInfIndices.load(pkg);
        this.startBoneInf = pkg.read("uint32");

        return this;
    }
}

class FBoneInfluence extends UObject {
    public boneWeight: number;
    public boneIndex: number;

    public load(pkg: C.APackage): this {
        this.boneWeight = pkg.read("uint16");
        this.boneIndex = pkg.read("uint16");

        return this;
    }
}

class FJointPos extends UObject {
    public rotation: FQuaternion;
    public position: FVector;
    public scale: FVector;
    public length: number;

    public load(pkg: C.APackage): this {
        this.rotation = FQuaternion.make().load(pkg);
        this.position = FVector.make().load(pkg);
        this.length = pkg.read("float");
        this.scale = FVector.make().load(pkg);

        this.scale.set(1, 1, 1);

        return this;
    }

}

class FMeshBone extends UObject {
    public boneName: string;
    public flags: number;
    public bonePos = new FJointPos();
    public numChildren: number;
    public parentIndex: number;

    public load(pkg: C.APackage): this {
        const nameIndex = pkg.read("compat32");
        this.boneName = pkg.nameTable[nameIndex].name as string;

        this.flags = pkg.read("uint32");

        this.bonePos.load(pkg);

        this.numChildren = pkg.read("uint32");
        this.parentIndex = pkg.read("uint32");

        return this;
    }
}

class FMeshNorm extends UObject {
    public x = 10;
    public y = 10;
    public z = 10;

    public v: number;

    public load(pkg: C.APackage): this {
        this.v = pkg.read("uint32");

        return this;
    }
}

class FSkinPoint extends UObject {
    public point: FVector;
    public normal: FMeshNorm;

    public load(pkg: C.APackage): this {

        this.point = FVector.make().load(pkg);
        this.normal = new FMeshNorm().load(pkg);

        return this;
    }
}

class FSkelMeshSection extends UObject {
    public materialIndex: number;
    public minStreamIndex: number;
    public minWedgeIndex: number;
    public maxWedgeIndex: number;
    public numStreamIndices: number;
    public boneIndex: number;
    public fE: number;
    public firstFace: number;
    public numFaces: number;

    public load(pkg: C.APackage): this {
        this.materialIndex = pkg.read("int16");

        this.minStreamIndex = pkg.read("int16");

        this.minWedgeIndex = pkg.read("int16");
        this.maxWedgeIndex = pkg.read("int16");

        this.numStreamIndices = pkg.read("int16");

        this.boneIndex = pkg.read("int16");
        this.fE = pkg.read("int16");
        this.firstFace = pkg.read("int16");
        this.numFaces = pkg.read("int16");

        return this;
    }
}

class FAnimMeshVertex extends UObject {
    public position: FVector;
    public normal: FVector;
    public texU: number;
    public texV: number;

    public load(pkg: C.APackage): this {

        this.position = FVector.make().load(pkg);
        this.normal = FVector.make().load(pkg);
        this.texU = pkg.read("float");
        this.texV = pkg.read("float");

        return this;
    }
}

class FSkinVertexStream extends UObject {
    public revision: number;
    public unkVar0: number;
    public unkVar1: number;
    public vertices = new FArray(FAnimMeshVertex);

    public load(pkg: C.APackage): this {
        this.revision = pkg.read("uint32");
        this.unkVar0 = pkg.read("uint32");
        this.unkVar1 = pkg.read("uint32");
        this.vertices.load(pkg);

        return this;
    }
}

class FTriangleLOD extends UObject {
    public indices: [number, number, number] = new Array(3) as [number, number, number];
    public materialIndex: number;

    public load(pkg: C.APackage): this {
        this.indices[0] = pkg.read("uint16");
        this.indices[1] = pkg.read("uint16");
        this.indices[2] = pkg.read("uint16");

        this.materialIndex = pkg.read("uint16");

        return this;
    }
}
class FStaticModelLOD extends UObject {
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

    public load(pkg: C.APackage): this {
        this.skinningData.load(pkg);
        this.skinPoints.load(pkg);
        this.numSoftWedges = pkg.read("int32");
        this.softSections.load(pkg);
        this.rigidSections.load(pkg);

        this.softIndices.load(pkg);
        this.rigidIndices.load(pkg);
        this.skinVertexStream.load(pkg);

        this.vertexInfluences.load(pkg);
        this.wedges.load(pkg);
        this.faces.load(pkg);
        this.points.load(pkg);

        this.lodHysteresis = pkg.read("float");
        this.numSharedVertices = pkg.read("uint32");
        this.lodMaxInfluences = pkg.read("uint32");
        this.unkVar0 = pkg.read("uint32");
        this.unkVar1 = pkg.read("uint32");


        const useNewWedges = pkg.read("uint32");

        if (useNewWedges !== 0)
            debugger;

        return this;
    }
}

class FMeshWedge extends UObject {
    public iVertex: number;
    public texU: number;
    public texV: number;

    public load(pkg: C.APackage): this {
        this.iVertex = pkg.read("uint16");
        this.texU = pkg.read("float");
        this.texV = pkg.read("float");

        return this;
    }
}

class FTriangle extends UObject {
    public indices: [number, number, number] = new Array(3) as [number, number, number];
    public materialIndex: number;
    public materialIndex2: number;
    public smoothingGroups: number;

    public load(pkg: C.APackage): this {
        this.indices[0] = pkg.read("uint16");
        this.indices[1] = pkg.read("uint16");
        this.indices[2] = pkg.read("uint16");

        this.materialIndex = pkg.read("uint8");
        this.materialIndex2 = pkg.read("uint8");
        this.smoothingGroups = pkg.read("uint32");

        return this;
    }
}

class FVertexInfluence extends UObject {
    public weight: number;
    public iPoint: number;
    public iBone: number;

    public load(pkg: C.APackage): this {
        this.weight = pkg.read("float");
        this.iPoint = pkg.read("uint16");
        this.iBone = pkg.read("uint16");

        return this;
    }
}

abstract class USkeletalMesh extends ULodMesh {

    protected points2 = new FArray(FVector);
    protected refSkeleton = new FArray(FMeshBone);
    protected animationId: number;
    protected animation: GA.UMeshAnimation;
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

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        super.doLoad(pkg, exp);

        this.points2.load(pkg);
        this.refSkeleton.load(pkg);

        this.animationId = pkg.read("compat32");

        if (this.animationId !== 0)
            this.animation = pkg.fetchObject<GA.UMeshAnimation>(this.animationId);

        this.skeletalDepth = pkg.read("uint32");
        this.weightIndices.load(pkg);
        this.boneInluences.load(pkg);
        this.attachAliases = new FIndexArray().load(pkg).map(v => pkg.nameTable[v.value].name as string);
        this.attachBoneNames = new FIndexArray().load(pkg).map(v => pkg.nameTable[v.value].name as string);
        this.attachCoords.load(pkg);

        if (this.version >= 2) {
            this.lodModels.load(pkg);
            this.sk_unkIndex1 = pkg.read("compat32");

            if (this.sk_unkIndex1 !== 0)
                debugger;

            this.points.load(pkg);
            this.wedges.load(pkg);
            this.faces.load(pkg);
            this.vertexInfluences.load(pkg);
            this.collapseWedge.load(pkg);
            this.sk_unkArr10.load(pkg);

            if (verArchive >= 118 && verLicense >= 3)
                this.sk_unkVar1 = pkg.read("uint32");

            if (verArchive >= 123 && verLicense >= 18) {
                this.sk_unkArr11.load(pkg);
            }

            if (verArchive >= 120) {
                this.sk_unkVar2 = pkg.read("uint32");
            }

            this.readHead = pkg.tell();

        } else {
            debugger;
        }

        console.assert(this.readHead === this.readTail, "Should be zero");
    }

    public getDecodeInfo(library: GD.DecodeLibrary): GD.ISkinnedMeshObjectDecodeInfo {
        if (this.uuid in library.geometries) return {
            uuid: this.uuid,
            type: "SkinnedMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid
        } as GD.ISkinnedMeshObjectDecodeInfo;

        library.geometries[this.uuid] = null;
        library.materials[this.uuid] = null;

        const section = this;
        const { positions, uvs, bones, weights } = convertWedges(section.points, section.wedges, section.vertexInfluences);
        const { indices, groups } = buildIndices(section.faces, this.lodMeshMaterials.length);
        const skeleton = collectSkeleton(this.refSkeleton);

        const materials = this.lodMeshMaterials.map((mat: UStaticMeshMaterial) => mat?.loadSelf().getDecodeInfo(library) || null);

        library.materials[this.uuid] = { name: this.uuid, materialType: "group", materials } as IMaterialGroupDecodeInfo;
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

        const animations: Record<string, IKeyframeDecodeInfo_T[]> = {};

        const boneCount = this.refSkeleton.length;
        const boneMap = new Array(boneCount);

        if (this.animation) {
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
        }

        return {
            uuid: this.uuid,
            type: "SkinnedMesh",
            name: this.objectName,
            geometry: this.uuid,
            materials: this.uuid,
            skeleton,
            animations
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
            console.warn("Too many bone influences");
            // debugger;
        }

        // add the influence
        vinfo.bones[idx] = infl.iBone;
        vinfo.weights[idx] = infl.weight;
    }

    // normalize influences
    for (const V of vertexInfos) {
        if (!V || V.numInfs === 0) {
            // debugger;
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
            weights[off] = vinfo.weights[j];
        }
    }

    return { positions, uvs, bones, weights };
}

function collectSkeleton(refSkeleton: FMeshBone[]): IBoneDecodeInfo[] {
    const boneCount = refSkeleton.length;
    const boneInfos = new Array<IBoneDecodeInfo>(boneCount)
    const boneCoords = new Array<FBoneCoord>(boneCount);
    // const matrices = [];

    for (let boneIndex = 0; boneIndex < boneCount; boneIndex++) {
        const bone = refSkeleton[boneIndex];

        let bonePos = bone.bonePos.position.clone();
        let boneRot = bone.bonePos.rotation.clone();

        if (boneIndex === 0)
            boneRot = boneRot.conjugate();

        bonePos = fixVector(bonePos);
        boneRot = fixRotation(boneRot);

        boneInfos[boneIndex] = {
            type: "Bone",
            uuid: generateUUID(),
            name: bone.boneName.replaceAll(" ", "_"),
            parent: bone.parentIndex,
            position: [bonePos.x, bonePos.y, bonePos.z],
            quaternion: [boneRot.x, boneRot.y, boneRot.z, boneRot.w]
        } as IBoneDecodeInfo;

        boneRot.w = -boneRot.w;

        let bc = boneCoords[boneIndex] = new FBoneCoord();
        bc.origin = bonePos;
        bc.axis = boneRot.toAxis();

        if (boneIndex > 0) {
            bc = boneCoords[boneIndex] = boneCoords[bone.parentIndex].untransformCoords(bc);
        }

        // const invCoords = bc.invert();

        // matrices.push(invCoords.toElements());
    }

    return boneInfos;
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

function fixVector(v: FVector) { return new FVector(v.x, v.z, v.y); }
function fixRotation(v: FQuaternion) { return new FQuaternion(v.x, v.z, v.y, v.w); }
