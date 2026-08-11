import { BufferValue } from "@l2js/core";
import getTypedArrayConstructor from "@client/utils/typed-arrray-constructor";
import { generateUUID } from "three/src/math/MathUtils";
import FArray, { FArrayLazy, FIndexArray, FPrimitiveArray, FPrimitiveArrayLazy } from "@l2js/core/unreal/un-array";
import ULodMesh from "../un-lod-mesh";
import FQuaternion, { FAxis } from "../un-quaternion";
import FRawIndexBuffer from "../un-raw-index-buffer";
import FVector from "../un-vector";

type SkeletalMeshDecodeResult_T = { object: GD.ISkinnedMeshObjectDecodeInfo, geometry: GD.IGeometryDecodeInfo, material: GD.IMaterialGroupDecodeInfo };
type SkinIndexArray_T = Uint8Array | Uint16Array | Uint32Array;

class FMeshVector {
    public x: number;
    public y: number;
    public z: number;

    public load(pkg: C.APackage): this {
        this.x = pkg.read("float");
        this.y = pkg.read("float");
        this.z = pkg.read("float");

        return this;
    }
}

class FMeshCoords {
    public origin = new FMeshVector();
    public xAxis = new FMeshVector();
    public yAxis = new FMeshVector();
    public zAxis = new FMeshVector();

    public load(pkg: C.APackage): this {
        this.origin.load(pkg);
        this.xAxis.load(pkg);
        this.yAxis.load(pkg);
        this.zAxis.load(pkg);

        return this;
    }
}

class FWeightIndex {
    public boneInfIndices: FPrimitiveArray<"uint16"> = new FPrimitiveArray(BufferValue.uint16);
    public startBoneInf: number;

    public load(pkg: C.APackage): this {
        this.boneInfIndices.load(pkg);
        this.startBoneInf = pkg.read("uint32");

        return this;
    }
}

class FBoneInfluence {
    public boneWeight: number;
    public boneIndex: number;

    public load(pkg: C.APackage): this {
        this.boneWeight = pkg.read("uint16");
        this.boneIndex = pkg.read("uint16");

        return this;
    }
}

class FJointPos {
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

class FMeshBone {
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

class FMeshNorm {
    public x = 10;
    public y = 10;
    public z = 10;

    public v: number;

    public load(pkg: C.APackage): this {
        this.v = pkg.read("uint32");

        return this;
    }
}

class FSkinPoint {
    public point: FVector;
    public normal: FMeshNorm;

    public load(pkg: C.APackage): this {

        this.point = FVector.make().load(pkg);
        this.normal = new FMeshNorm().load(pkg);

        return this;
    }
}

class FSkelMeshSection {
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

class FAnimMeshVertex {
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

class FSkinVertexStream {
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

class FTriangleLOD {
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
class FStaticModelLOD {
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

class FMeshWedge {
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

class FTriangle {
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

class FVertexInfluence {
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

    protected points2 = new FArray(FMeshVector);
    protected refSkeleton = new FArray(FMeshBone);
    protected animationId: number;
    protected animation: GA.UMeshAnimation;
    protected skeletalDepth: number;
    protected weightIndices = new FArray(FWeightIndex);
    protected boneInluences = new FArray(FBoneInfluence);
    protected attachAliases: string[];
    protected attachBoneNames: string[];
    protected attachCoords = new FArray(FMeshCoords);
    protected lodModels = new FArray(FStaticModelLOD);
    protected sk_unkIndex1: number;
    protected points = new FArrayLazy(FMeshVector);
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
            this.animation = pkg.fetchObject<GA.UMeshAnimation>(this.animationId).loadSelf();

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

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder, decodeAnimations: boolean = true, decodeMaterials: boolean = true, decodeAnimationNotifies: boolean = decodeAnimations): SkeletalMeshDecodeResult_T {
        const section = this;

        if (section.points.length > 0) section.points.getElem(0);
        if (section.wedges.length > 0) section.wedges.getElem(0);
        if (section.faces.length > 0) section.faces.getElem(0);
        if (section.vertexInfluences.length > 0) section.vertexInfluences.getElem(0);

        const lod = section.wedges.length === 0 && section.lodModels.length > 0 ? section.lodModels.getElem(0) : null;
        const skin = lod ? convertLodModel(lod, this.lodMeshMaterials.length, this.refSkeleton) : null;
        const { positions, uvs, bones, weights } = skin ?? convertWedges(section.points, section.wedges, section.vertexInfluences, this.refSkeleton.length);
        const { indices, groups } = skin ?? buildIndices(section.faces, this.lodMeshMaterials.length);
        const skeleton = collectSkeleton(this.refSkeleton);

        const materials = decodeMaterials ? this.lodMeshMaterials.map((mat: UStaticMeshMaterial) => builder.pullMaterial(mat)) : [];

        const materialInfo = { name: this.uuid, materialType: "group", materials } as IMaterialGroupDecodeInfo;
        const geometryInfo = {
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
        const animationNotifies: Record<string, GD.IAnimationNotifyDecodeInfo[]> = {};

        const boneCount = this.refSkeleton.length;
        const boneMap = new Array(boneCount);

        if ((decodeAnimations || decodeAnimationNotifies) && this.animation) {
            const refBones = this.animation.refBones;

            if (decodeAnimations) {
                for (let i = 0; i < boneCount; i++) {
                    const boneSkeleton = this.refSkeleton.getElem(i);

                    for (let j = 0, len = refBones.length; j < len; j++) {
                        const boneAnim = refBones.getElem(j);

                        if (normalizeBoneName(boneSkeleton.boneName) !== normalizeBoneName(boneAnim.boneName))
                            continue;

                        boneMap[i] = [normalizeBoneName(boneAnim.boneName), j];
                    }
                }
            }

            for (let k = 0, animCount = this.animation.sequences.getElemCount(); k < animCount; k++) {
                const sequence = this.animation.sequences.getElem(k);
                const animName = sequence.name;

                if (decodeAnimationNotifies)
                    animationNotifies[animName] = this.animation.getSequenceNotifies(builder, sequence);

                if (!decodeAnimations) continue;

                const move = this.animation.moves[k];
                const framerate = sequence.framerate;
                const keyframes: IKeyframeDecodeInfo_T[] = [];

                // MotionChunk.BoneIndices is never used (UnSkeletalMesh.cpp line 376).
                for (let i = 0; i < boneCount; i++) {
                    const boneMapping = boneMap[i];

                    if (!boneMapping) continue; // mesh bone the animation set does not drive

                    const [boneName, boneIndexAnim] = boneMapping;
                    const track = move.animTracks.getElem(boneIndexAnim);
                    const trackFrameCount = track.keyTime.getElemCount();

                    const lenPos = track.keyPos.getElemCount();
                    const lenRot = track.keyQuat.getElemCount();

                    const timesPos = new Float32Array(lenPos + 1);
                    const timesRot = new Float32Array(lenRot + 1);

                    const positions = new Float32Array((lenPos + 1) * 3);
                    const rotations = new Float32Array((lenRot + 1) * 4);

                    for (let j = 0; j < trackFrameCount; j++) {
                        const time = track.keyTime.getElem(j);

                        if (j < lenPos) {
                            const idxPos = j * 3;
                            let pos = track.keyPos.getElem(j < lenPos ? j : lenPos - 1);

                            pos = makeVector(pos);

                            timesPos[j] = time / framerate;

                            positions[idxPos + 0] = pos.x;
                            positions[idxPos + 1] = pos.y;
                            positions[idxPos + 2] = pos.z;

                        }

                        if (j < lenRot) {
                            let rot = track.keyQuat.getElem(j < lenRot ? j : lenRot - 1);
                            const idxRot = j * 4;


                            rot = makeQuaternion(rot);

                            if (boneIndexAnim > 0)
                                rot = rot.conjugate();

                            timesRot[j] = time / framerate;

                            rotations[idxRot + 0] = rot.x;
                            rotations[idxRot + 1] = rot.y;
                            rotations[idxRot + 2] = rot.z;
                            rotations[idxRot + 3] = rot.w;
                        }
                    }

                    // a sequence keys frames 0..frameCount-1 and loops back over the interval past the last one, which three only interpolates if the closing key is there
                    const wrapTime = sequence.frameCount / framerate;

                    timesPos[lenPos] = wrapTime;
                    positions.copyWithin(lenPos * 3, 0, 3);

                    timesRot[lenRot] = wrapTime;
                    rotations.copyWithin(lenRot * 4, 0, 4);

                    keyframes.push({ name: `${boneName}.position`, times: timesPos, values: positions, type: "Vector" });
                    keyframes.push({ name: `${boneName}.quaternion`, times: timesRot, values: rotations, type: "Quaternion" });
                }

                animations[animName] = keyframes;
            }
        }

        return {
            object: {
                uuid: this.uuid,
                type: "SkinnedMesh",
                name: this.objectName,
                geometry: this.uuid,
                materials: this.uuid,
                skeleton,
                animations,
                animationNotifies,
                meshScale: this.meshScale.getElements(),
                meshOrigin: this.meshOrigin.getElements(),
                meshRotOrigin: this.meshRotOrigin.toArray(),
                meshRotOriginQuaternion: this.meshRotOrigin.getQuaternionElements()
            } as ISkinnedMeshObjectDecodeInfo,
            geometry: geometryInfo,
            material: materialInfo
        };
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

const tmpStreamBits = new Uint32Array(1);
const tmpStreamFloat = new Float32Array(tmpStreamBits.buffer);

function readStreamFloat(stream: FPrimitiveArray<"uint32">, index: number) {
    tmpStreamBits[0] = stream.getElem(index);

    return tmpStreamFloat[0];
}

// skinning stream commands, one per soft wedge: 0xF fetches a previously stored vertex, 0x8 stores this one
const SKIN_FETCH_DUPE = 0xf0000000;
const SKIN_STORE_DUPE = 0x80000000;

function convertSkinningStream(lod: FStaticModelLOD, positions: Float32Array, uvs: Float32Array, bones: SkinIndexArray_T, weights: Float32Array) {
    const stream = lod.skinningData;
    const wedgeCount = lod.numSoftWedges;
    const dupes: number[] = [];

    let cursor = 0, pointIndex = 0;

    for (let wedge = 0; wedge < wedgeCount; wedge++) {
        const command = stream.getElem(cursor) >>> 0;
        const offsetVertex = 3 * wedge, offsetUv = 2 * wedge, offsetBone = MAX_BONES * wedge;

        if (command >= SKIN_FETCH_DUPE) {
            const source = dupes[(command & 0x0fffffff) / 6];

            positions.copyWithin(offsetVertex, 3 * source, 3 * source + 3);
            bones.copyWithin(offsetBone, MAX_BONES * source, MAX_BONES * source + MAX_BONES);
            weights.copyWithin(offsetBone, MAX_BONES * source, MAX_BONES * source + MAX_BONES);

            cursor += 1;
        } else {
            const influenceCount = ((command >>> 28) & 0x7) + 1;
            const point = lod.skinPoints[pointIndex++].point;

            positions[offsetVertex + 0] = point.x;
            positions[offsetVertex + 1] = point.y;
            positions[offsetVertex + 2] = point.z;

            let total = 0;

            for (let i = 0; i < influenceCount && i < MAX_BONES; i++) {
                const influence = stream.getElem(cursor + i) >>> 0;
                const weight = ((influence >>> 12) & 0xffff) / 65535;

                bones[offsetBone + i] = (influence & 0xfff) / 6;
                weights[offsetBone + i] = weight;
                total += weight;
            }

            if (influenceCount > MAX_BONES) {
                for (let i = 0; i < MAX_BONES; i++)
                    weights[offsetBone + i] /= total;
            }

            if (command & SKIN_STORE_DUPE) dupes.push(wedge);

            cursor += influenceCount;
        }

        uvs[offsetUv + 0] = readStreamFloat(stream, cursor);
        uvs[offsetUv + 1] = readStreamFloat(stream, cursor + 1);

        cursor += 2;
    }

    if ((stream.getElem(cursor) >>> 0) !== 0xffffffff)
        throw new Error(`Skinning stream stopped at ${cursor} of ${stream.getElemCount()} instead of its terminator after ${wedgeCount} wedges.`);
}

// cooked rigid sections never carry their joint index; the head parts that kept raw influences bind every vertex to Bip01_head
function findRigidBone(section: FSkelMeshSection, refSkeleton: FMeshBone[]) {
    if (section.boneIndex !== 0) return section.boneIndex;

    for (let i = 0, len = refSkeleton.length; i < len; i++) {
        if (/^bip01[ _]head$/i.test(refSkeleton[i].boneName)) return i;
    }

    return 0;
}

function convertLodModel(lod: FStaticModelLOD, materialCount: number, refSkeleton: FMeshBone[]) {
    const rigidStream = lod.skinVertexStream.vertices;
    const softCount = lod.numSoftWedges, rigidCount = rigidStream.length;
    const vertexCount = softCount + rigidCount;

    const positions = new Float32Array(3 * vertexCount);
    const uvs = new Float32Array(2 * vertexCount);
    const BoneIndexConstructor = getTypedArrayConstructor(refSkeleton.length);
    const bones = new BoneIndexConstructor(MAX_BONES * vertexCount);
    const weights = new Float32Array(MAX_BONES * vertexCount);

    if (softCount > 0)
        convertSkinningStream(lod, positions, uvs, bones, weights);

    for (let i = 0; i < rigidCount; i++) {
        const vertex = rigidStream.getElem(i);
        const offsetVertex = 3 * (softCount + i), offsetUv = 2 * (softCount + i);

        positions[offsetVertex + 0] = vertex.position.x;
        positions[offsetVertex + 1] = vertex.position.y;
        positions[offsetVertex + 2] = vertex.position.z;

        uvs[offsetUv + 0] = vertex.texU;
        uvs[offsetUv + 1] = vertex.texV;
    }

    const softBuffer = lod.softIndices.indices, rigidBuffer = lod.rigidIndices.indices;
    const softIndexCount = softBuffer.getElemCount(), rigidIndexCount = rigidBuffer.getElemCount();
    const IndexConstructor = getTypedArrayConstructor(vertexCount);
    const indices = new IndexConstructor(softIndexCount + rigidIndexCount);

    for (let i = 0; i < softIndexCount; i++)
        indices[i] = softBuffer.getElem(i);

    for (let i = 0; i < rigidIndexCount; i++)
        indices[softIndexCount + i] = softCount + rigidBuffer.getElem(i);

    const groups: GD.Vector3Arr[] = [];

    for (let i = 0, len = lod.softSections.length; i < len; i++) {
        const section = lod.softSections[i];

        groups.push([3 * section.firstFace, 3 * section.numFaces, Math.min(section.materialIndex, materialCount - 1)]);
    }

    // rigid sections reuse the influence-count slot to name the single bone every vertex in the section binds to
    for (let i = 0, len = lod.rigidSections.length; i < len; i++) {
        const section = lod.rigidSections[i];
        const boneIndex = findRigidBone(section, refSkeleton);

        for (let vertex = section.minWedgeIndex; vertex <= section.maxWedgeIndex && vertex < rigidCount; vertex++) {
            bones[MAX_BONES * (softCount + vertex)] = boneIndex;
            weights[MAX_BONES * (softCount + vertex)] = 1;
        }

        groups.push([softIndexCount + 3 * section.firstFace, 3 * section.numFaces, Math.min(section.materialIndex, materialCount - 1)]);
    }

    return { positions, uvs, bones, weights, indices, groups };
}

function convertWedges(points: FMeshVector[], wedges: FMeshWedge[], influences: FVertexInfluence[], boneCount: number) {
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
    const BoneIndexConstructor = getTypedArrayConstructor(boneCount);
    const bones = new BoneIndexConstructor(MAX_BONES * wedgeCount);
    const weights = new Float32Array(MAX_BONES * wedgeCount);

    // create vertices
    for (let i = 0; i < wedgeCount; i++) {
        const wedge = wedges[i];
        const vinfo = vertexInfos[wedge.iVertex];

        const point = points[wedge.iVertex];
        const texU = wedge.texU, texV = wedge.texV;

        const offsetUv = 2 * i, offsetVertex = 3 * i, offsetBone = MAX_BONES * i;

        positions[offsetVertex + 0] = point.x;
        positions[offsetVertex + 1] = point.y;
        positions[offsetVertex + 2] = point.z;

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

// bodyparts of one character disagree on the casing of shared bones, so one part's clip only binds to the others once names are canonical
function normalizeBoneName(name: string) {
    return name.replaceAll(" ", "_").toLowerCase();
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

        if (boneIndex > 0)
            boneRot = boneRot.conjugate();

        bonePos = makeVector(bonePos);
        boneRot = makeQuaternion(boneRot);

        boneInfos[boneIndex] = {
            type: "Bone",
            uuid: generateUUID(),
            name: normalizeBoneName(bone.boneName),
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
    public origin: FVector = FVector.make();
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

function makeVector(v: { x: number, y: number, z: number }) { return FVector.make(v.x, v.y, v.z); }
function makeQuaternion(v: { x: number, y: number, z: number, w: number }) { return FQuaternion.make(v.x, v.y, v.z, v.w); }
