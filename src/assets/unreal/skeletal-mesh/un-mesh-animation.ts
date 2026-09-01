import { BufferValue, type APackage, type UObject as CoreUObject, type UExport, FArray, FIndexArray, FPrimitiveArray } from "@l2js/core";
import UObject from "../un-object";
import UAnimNotify, { type IAnimationNotifyObjectDecodeInfo } from "./un-anim-notify";
import type { DecodeLibraryBuilder } from "../decode-library-builder";

type ISkinNotifyEntryDecodeInfo = {
    time: number;
    skinIndex: number;
};

type IFixedSkinNotifyDecodeInfo = {
    mode: "fixed";
    frameCount: number;
    timeline: ISkinNotifyEntryDecodeInfo[];
};

type IGroupedSkinNotifyDecodeInfo = {
    mode: "grouped";
    frameCount: number;
    groups: {
        startFrame: number;
        timeline: ISkinNotifyEntryDecodeInfo[];
    }[];
};

type IRandomSkinNotifyDecodeInfo = {
    mode: "random";
    frameCount: number;
    intervalMin: number;
    intervalMax: number;
    timeline: ISkinNotifyEntryDecodeInfo[];
};

type ISkinNotifyDecodeInfo = IFixedSkinNotifyDecodeInfo | IGroupedSkinNotifyDecodeInfo | IRandomSkinNotifyDecodeInfo;

type IAnimationNotifyDecodeInfo = {
    time: number;
    name: string;
    object: IAnimationNotifyObjectDecodeInfo | null;
};

function decodeNotifyObject(builder: DecodeLibraryBuilder, notify: CoreUObject): IAnimationNotifyObjectDecodeInfo {
    if (!notify) return null;

    const info = (notify as UAnimNotify).getDecodeInfo(builder);

    if (info === undefined) throw new Error(`Animation notify '${notify.name}' returned undefined decode info.`);

    return info;
}

class FAnimVector {
    public x: number;
    public y: number;
    public z: number;

    public load(pkg: APackage): this {
        this.x = pkg.read("float");
        this.y = pkg.read("float");
        this.z = pkg.read("float");

        return this;
    }
}

class FAnimQuaternion {
    public x: number;
    public y: number;
    public z: number;
    public w: number;

    public load(pkg: APackage): this {
        this.x = pkg.read("float");
        this.y = pkg.read("float");
        this.z = pkg.read("float");
        this.w = pkg.read("float");

        return this;
    }
}

class FNamedBone {
    public boneName: string;
    public flags: number;
    public parentIndex: number;

    public load(pkg: APackage): this {
        this.boneName = pkg.nameTable[pkg.read("compat32")].name as string;
        this.flags = pkg.read("uint32");
        this.parentIndex = pkg.read("uint32");

        return this;
    }
}

class FAnalogTrack {
    public flags: number;
    public keyQuat = new FArray(FAnimQuaternion);
    public keyPos = new FArray(FAnimVector);
    public keyTime = new FPrimitiveArray(BufferValue.float);

    public load(pkg: APackage): this {
        this.flags = pkg.read("uint32");
        this.keyQuat.load(pkg);
        this.keyPos.load(pkg);
        this.keyTime.load(pkg);

        return this;
    }
}

class FMotionChunk {
    public rootSpeed3d = new FAnimVector();
    public trackTime: number;
    public startBone: number;
    public flags: number;
    public boneIndices = new FPrimitiveArray(BufferValue.uint32);
    public animTracks = new FArray(FAnalogTrack)
    public rootTrack = new FAnalogTrack()

    public load(pkg: APackage): this {
        this.rootSpeed3d.load(pkg);
        this.trackTime = pkg.read("float");
        this.startBone = pkg.read("uint32");
        this.flags = pkg.read("uint32");
        this.boneIndices.load(pkg);
        this.animTracks.load(pkg);
        this.rootTrack.load(pkg);

        return this;
    }
}

class FMeshAnimNotify {
    public time: number;
    public name: string;
    public notifyObjectId: number;

    public load(pkg: APackage): this {
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

class FSkinNotifyEntry {
    public time: number;
    public skinIndex: number;

    public load(pkg: APackage): this {
        this.time = pkg.read("float");
        this.skinIndex = pkg.read("int32");

        return this;
    }
}

class FSkinNotifyGroup {
    public startFrame: number;
    public timeline = new FArray(FSkinNotifyEntry);

    public load(pkg: APackage): this {
        this.startFrame = pkg.read("float");
        this.timeline.load(pkg);

        return this;
    }
}

class FSkinNotify {
    public fixedTimeline = new FArray(FSkinNotifyEntry);
    public mode: SkinNotifyMode_T;
    public groupedTimeline = new FArray(FSkinNotifyGroup);
    public randomIntervalMin: number;
    public randomIntervalMax: number;
    public randomTimeline = new FArray(FSkinNotifyEntry);

    public load(pkg: APackage): this {
        // const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        if (verLicense === 0x1A) {
            this.fixedTimeline.load(pkg);
        } else if (verLicense >= 0x1B) {
            this.mode = pkg.read("uint8");
            this.fixedTimeline.load(pkg);
            this.groupedTimeline.load(pkg);
            this.randomIntervalMin = pkg.read("float");
            this.randomIntervalMax = pkg.read("float");
            this.randomTimeline.load(pkg);
        }

        return this;
    }
}

class FAnimSequence {
    public bookmark: number;
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
    public skinNotify = new FSkinNotify();

    public load(pkg: APackage): this {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        if (verArchive >= 115)
            this.bookmark = pkg.read("float");
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
            if (verLicense >= 0x1A) this.skinNotify.load(pkg);
        }

        return this;
    }
}

abstract class UMeshAnimation extends UObject {
    public version: number;
    public refBones: FArray<FNamedBone>;
    public moves: FMotionChunk[];
    public sequences: FArray<FAnimSequence>;

    public getSequenceNotifies(builder: DecodeLibraryBuilder, sequence: FAnimSequence): IAnimationNotifyDecodeInfo[] {
        const count = sequence.notifications.getElemCount();
        const notifications = new Array<IAnimationNotifyDecodeInfo>(count);

        for (let i = 0; i < count; i++) {
            const notify = sequence.notifications.getElem(i);
            const notifyObject = notify.notifyObjectId === 0 ? null : this.pkg.fetchObject(notify.notifyObjectId).loadSelf();

            notifications[i] = { time: notify.time, name: notify.name, object: decodeNotifyObject(builder, notifyObject) };
        }

        notifications.sort((a, b) => a.time - b.time);

        return notifications;
    }

    public getSequenceSkinNotify(sequence: FAnimSequence): ISkinNotifyDecodeInfo {
        const info = sequence.skinNotify;
        const frameCount = sequence.frameCount;

        switch (info.mode ?? SkinNotifyMode_T.Fixed) {
            case SkinNotifyMode_T.Fixed: return {
                mode: "fixed", frameCount,
                timeline: info.fixedTimeline.map(entry => ({ time: entry.time, skinIndex: entry.skinIndex }))
            };
            case SkinNotifyMode_T.Grouped: return {
                mode: "grouped", frameCount,
                groups: info.groupedTimeline.map(group => ({
                    startFrame: group.startFrame,
                    timeline: group.timeline.map(entry => ({
                        time: entry.time,
                        skinIndex: entry.skinIndex
                    }))
                }))
            };
            case SkinNotifyMode_T.Random: return {
                mode: "random", frameCount,
                intervalMin: info.randomIntervalMin,
                intervalMax: info.randomIntervalMax,
                timeline: info.randomTimeline.map(entry => ({
                    time: entry.time, skinIndex: entry.skinIndex
                }))
            };
            default: throw new Error(`Unknown skin notify mode '${info.mode}' in animation '${sequence.name}'.`);
        }
    }

    public doLoad(pkg: APackage, exp: UExport) {
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

enum SkinNotifyMode_T {
    Fixed,
    Grouped,
    Random
}

export default UMeshAnimation;
export { UMeshAnimation, type SkinNotifyMode_T };
export type { ISkinNotifyEntryDecodeInfo, IFixedSkinNotifyDecodeInfo, IGroupedSkinNotifyDecodeInfo, IRandomSkinNotifyDecodeInfo, ISkinNotifyDecodeInfo, IAnimationNotifyDecodeInfo };
