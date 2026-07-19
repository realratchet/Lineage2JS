import { BufferValue } from "@l2js/core";
import FArray, { FPrimitiveArray } from "@l2js/core/unreal/un-array";
import UObject from "@l2js/core";
import FQuaternion from "../un-quaternion";
import FVector from "../un-vector";
import { FIndexArray } from "@l2js/core/unreal/un-array";

class FNamedBone extends UObject {
    public boneName: string;
    public unkVar0: number;
    public unkVar1: number;

    public load(pkg: C.APackage): this {
        this.boneName = pkg.nameTable[pkg.read("compat32")].name as string;
        this.unkVar0 = pkg.read("uint32");
        this.unkVar1 = pkg.read("uint32");

        return this;
    }
}

class FAnalogTrack extends UObject {
    public flags: number;
    public keyQuat = new FArray(FQuaternion);
    public keyPos = new FArray(FVector);
    public keyTime = new FPrimitiveArray(BufferValue.float);

    public load(pkg: C.APackage): this {
        this.flags = pkg.read("uint32");
        this.keyQuat.load(pkg);
        this.keyPos.load(pkg);
        this.keyTime.load(pkg);

        return this;
    }
}

class FMotionChunk extends UObject {
    public rootSpeed3d: FVector;
    public trackTime: number;
    public startBone: number;
    public flags: number;
    public boneIndices = new FPrimitiveArray(BufferValue.uint32);
    public animTracks = new FArray(FAnalogTrack)
    public rootTrack = new FAnalogTrack()

    public load(pkg: C.APackage): this {
        this.rootSpeed3d = FVector.make().load(pkg);
        this.trackTime = pkg.read("float");
        this.startBone = pkg.read("uint32");
        this.flags = pkg.read("uint32");
        this.boneIndices.load(pkg);
        this.animTracks.load(pkg);
        this.rootTrack.load(pkg);

        return this;
    }
}

class FMeshAnimNotify extends UObject {
    public time: number;
    public name: string;
    public notifyObjectId: number;

    public load(pkg: C.APackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();

        this.time = pkg.read("float");
        this.name = pkg.nameTable[pkg.read("compat32")].name as string;

        if (verArchive >= 112) {
            this.notifyObjectId = pkg.read("compat32");
        }

        if (verArchive >= 131) {
            debugger;
        }

        return this;
    }
}

class FLineageUnk2 extends UObject {
    public unkVar0: number;
    public unkVar1: number;

    public load(pkg: C.APackage): this {
        this.unkVar0 = pkg.read("uint32");
        this.unkVar1 = pkg.read("uint32");

        return this;
    }
}

class FLineageUnk3 extends UObject {
    public unkVar0: number;
    public unkArr0 = new FArray(FLineageUnk2)

    public load(pkg: C.APackage): this {
        this.unkVar0 = pkg.read("uint32");
        this.unkArr0.load(pkg);

        return this;
    }
}

class FLineageUnk4 extends UObject {
    public unkArr0 = new FArray(FLineageUnk2);
    public unkVar0: number;
    public unkArr1 = new FArray(FLineageUnk3);
    public unkVar1: number;
    public unkVar2: number;
    public unkArr2 = new FArray(FLineageUnk2);

    public load(pkg: C.APackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        if (verLicense === 0x1A) {
            this.unkArr0.load(pkg);
        } else if (verLicense >= 0x1B) {
            this.unkVar0 = pkg.read("uint8");
            this.unkArr0.load(pkg);
            this.unkArr1.load(pkg);
            this.unkVar1 = pkg.read("uint32");
            this.unkVar2 = pkg.read("uint32");
            this.unkArr2.load(pkg);
        }

        return this;
    }
}

class FAnimSequence extends UObject {
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

    public load(pkg: C.APackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        if (verArchive >= 115)
            this.unkVar0 = pkg.read("float");
        else {
            debugger;
        }

        this.name = pkg.nameTable[pkg.read("compat32")].name as string;
        this.groupNames = new FIndexArray().load(pkg).map(v => pkg.nameTable[v.value].name as string);

        this.frameStart = pkg.read("uint32");
        this.frameCount = pkg.read("uint32");
        this.notifications.load(pkg);
        this.framerate = pkg.read("float");

        if (verLicense >= 1) {
            this.unkVar0 = pkg.read("uint32");
            this.unkVar1 = pkg.read("uint32");

            if (verLicense >= 2) this.unkVar2 = pkg.read("uint32");

            this.unkIndex0 = pkg.read("compat32");

            if (verLicense >= 0x14) this.unkVar4 = pkg.read("uint32");
            if (verLicense >= 0x19) this.unkVar5 = pkg.read("uint32");
            if (verLicense >= 0x1A) this.unkVar6.load(pkg);
        }

        return this;
    }
}

abstract class UMeshAnimation extends UObject {
    public version: number;
    public refBones: FArray<FNamedBone>;
    public moves: FMotionChunk[];
    public sequences: FArray<FAnimSequence>;

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        super.doLoad(pkg, exp);

        this.version = pkg.read("uint32");
        this.refBones = new FArray(FNamedBone).load(pkg); // maybe sounds for each of the animation

        if (verArchive >= 123 && verLicense >= 25) {
            const endPos = pkg.read("uint32");
            const countMotion = pkg.read("compat32");

            this.moves = new Array<FMotionChunk>(countMotion);

            this.readHead = pkg.tell();

            for (let i = 0; i < countMotion; i++) {
                const endPos = pkg.read("uint32");

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