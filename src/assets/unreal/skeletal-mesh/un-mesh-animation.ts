import BufferValue from "@client/assets/buffer-value";
import FArray, { FPrimitiveArray } from "../un-array";
import FConstructable from "../un-constructable";
import FNumber from "../un-number";
import UObject from "../un-object";
import FQuaternion from "../un-quaternion";
import FVector from "../un-vector";

class FNamedBone extends FConstructable {
    public boneName: string;
    public unkVar0: number;
    public unkVar1: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);

        this.boneName = pkg.nameTable[pkg.read(compat).value as number].name.value as string;
        this.unkVar0 = pkg.read(uint32).value as number;
        this.unkVar1 = pkg.read(uint32).value as number;

        return this;
    }
}

class FAnalogTrack extends FConstructable {
    public flags: number;
    public keyQuat = new FArray(FQuaternion);
    public keyPos = new FArray(FVector);
    public keyTime = new FPrimitiveArray(BufferValue.float);

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        this.flags = pkg.read(uint32).value as number;
        this.keyQuat.load(pkg);
        this.keyPos.load(pkg);
        this.keyTime.load(pkg);

        return this;
    }
}

class FMotionChunk extends FConstructable {
    public rootSpeed3d = new FVector();
    public trackTime: number;
    public startBone: number;
    public flags: number;
    public boneIndices = new FPrimitiveArray(BufferValue.uint32);
    public animTracks = new FArray(FAnalogTrack)
    public rootTrack = new FAnalogTrack()

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);
        const float = new BufferValue(BufferValue.float);

        this.rootSpeed3d.load(pkg);
        this.trackTime = pkg.read(float).value as number;
        this.startBone = pkg.read(uint32).value as number;
        this.flags = pkg.read(uint32).value as number;
        this.boneIndices.load(pkg);
        this.animTracks.load(pkg);
        this.rootTrack.load(pkg);

        return this;
    }
}

class FMeshAnimNotify extends FConstructable {
    public time: number;
    public name: string;
    public notifyObjectId: number;

    public load(pkg: UPackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();

        const float = new BufferValue(BufferValue.float);
        const compat = new BufferValue(BufferValue.compat32);

        this.time = pkg.read(float).value as number;
        this.name = pkg.nameTable[pkg.read(compat).value as number].name.value as string;

        if (verArchive >= 112) {
            this.notifyObjectId = pkg.read(compat).value as number;
        }

        if (verArchive >= 131) {
            debugger;
        }

        return this;
    }
}

class FLineageUnk2 extends FConstructable {
    public unkVar0: number;
    public unkVar1: number;

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        this.unkVar0 = pkg.read(uint32).value as number;
        this.unkVar1 = pkg.read(uint32).value as number;

        return this;
    }
}

class FLineageUnk3 extends FConstructable {
    public unkVar0: number;
    public unkArr0 = new FArray(FLineageUnk2)

    public load(pkg: UPackage): this {
        const uint32 = new BufferValue(BufferValue.uint32);

        this.unkVar0 = pkg.read(uint32).value as number;
        this.unkArr0.load(pkg);

        return this;
    }
}

class FLineageUnk4 extends FConstructable {
    public unkArr0 = new FArray(FLineageUnk2);
    public unkVar0: number;
    public unkArr1 = new FArray(FLineageUnk3);
    public unkVar1: number;
    public unkVar2: number;
    public unkArr2 = new FArray(FLineageUnk2);

    public load(pkg: UPackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const uint8 = new BufferValue(BufferValue.uint8);
        const uint32 = new BufferValue(BufferValue.uint32);

        if (verLicense === 0x1A) {
            this.unkArr0.load(pkg);
        } else if (verLicense >= 0x1B) {
            this.unkVar0 = pkg.read(uint8).value as number;
            this.unkArr0.load(pkg);
            this.unkArr1.load(pkg);
            this.unkVar1 = pkg.read(uint32).value as number;
            this.unkVar2 = pkg.read(uint32).value as number;
            this.unkArr2.load(pkg);
        }

        return this;
    }
}

class FAnimSequence extends FConstructable {
    public unkVar0: number;
    public name: string;
    public groupNames: string[];
    public frameStart: number;
    public frameCount: number;
    public notifications = new FArray(FMeshAnimNotify);
    public framerate: number;
    public unkVar1: number;
    public unkIndex0: number;
    public unkVar2: number;
    public unkVar4: number;
    public unkVar5: number;
    public unkVar6 = new FLineageUnk4();

    public load(pkg: UPackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        const uint32 = new BufferValue(BufferValue.uint32);
        const float = new BufferValue(BufferValue.float);
        const compat = new BufferValue(BufferValue.compat32);


        if (verArchive >= 115)
            this.unkVar0 = pkg.read(float).value as number;
        else {
            debugger;
        }

        this.name = pkg.nameTable[pkg.read(compat).value as number].name.value as string;
        this.groupNames = new FArray(FNumber.forType(BufferValue.compat32) as any).load(pkg).map(v => pkg.nameTable[v.value].name.value as string);

        this.frameStart = pkg.read(uint32).value as number;
        this.frameCount = pkg.read(uint32).value as number;
        this.notifications.load(pkg);
        this.framerate = pkg.read(float).value as number;

        if (verLicense >= 1) {
            this.unkVar0 = pkg.read(uint32).value as number;
            this.unkVar1 = pkg.read(uint32).value as number;

            if (verLicense >= 2) this.unkVar2 = pkg.read(uint32).value as number;

            this.unkIndex0 = pkg.read(compat).value as number;

            if (verLicense >= 0x14) this.unkVar4 = pkg.read(uint32).value as number;
            if (verLicense >= 0x19) this.unkVar5 = pkg.read(uint32).value as number;
            if (verLicense >= 0x1A) this.unkVar6.load(pkg);
        }

        return this;
    }
}

class UMeshAnimation extends UObject {
    public version: number;
    public refBones: FArray<FNamedBone>;
    public moves: FMotionChunk[];
    public sequences: FArray<FAnimSequence>;

    public doLoad(pkg: UPackage, exp: UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        super.doLoad(pkg, exp);

        const uint32 = new BufferValue(BufferValue.uint32);
        const compat = new BufferValue(BufferValue.compat32);

        this.version = pkg.read(uint32).value as number;
        this.refBones = new FArray(FNamedBone).load(pkg); // maybe sounds for each of the animation

        if (verArchive >= 123 && verLicense >= 25) {
            const endPos = pkg.read(uint32).value as number;
            const countMotion = pkg.read(compat).value as number;

            this.moves = new Array<FMotionChunk>(countMotion);

            this.readHead = pkg.tell();

            for (let i = 0; i < countMotion; i++) {
                const endPos = pkg.read(uint32).value as number;

                const chunk = new FMotionChunk().load(pkg);
                this.readHead = pkg.tell();

                this.moves[i] = chunk;

                console.assert(this.readHead == endPos);

                // debugger;
            }

            console.assert(this.readHead == endPos);

            this.sequences = new FArray(FAnimSequence).load(pkg);

        } else {
            debugger;
        }

        this.readHead = pkg.tell();

        console.assert(this.readHead === this.readTail, "Should be zero");
    }
}

export default UMeshAnimation;
export { UMeshAnimation };