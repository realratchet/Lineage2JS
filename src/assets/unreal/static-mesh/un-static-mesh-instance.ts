import UObject from "@l2js/core";
import { BufferValue } from "@l2js/core";
import FRawColorStream from "../un-raw-color-stream";
import ULight from "../un-light";
import FArray, { FPrimitiveArray } from "@l2js/core/src/unreal/un-array";
import { indexToTime, timeToIndexFrac } from "@client/assets/unreal/un-l2env";

class FStaticMeshLightInfo implements C.IConstructable {
    public lightIndex: number; // seems to be light index
    public vertexFlags = new FPrimitiveArray(BufferValue.uint8);
    public applied: boolean;

    public light: ULight;

    public load(pkg: GA.UPackage): this {
        const compat32 = new BufferValue(BufferValue.compat32);
        const int32 = new BufferValue(BufferValue.int32);

        this.lightIndex = pkg.read(compat32).value;
        this.vertexFlags.load(pkg);

        if (this.vertexFlags.getElemCount() === 23) {
            const arr = [88, 17, 156, 11, 45, 38, 201, 61, 16, 246, 16, 63, 6, 0, 0, 0, 160, 16, 224, 13, 0, 52, 249];
            const same = new Array(arr.length);
            let isAllSame = true;

            for (let i = 0, len = arr.length; i < len; i++) {
                const isSame = arr[i] === this.vertexFlags.getElem(i);
                same[i] = isSame;
                isAllSame = isAllSame && isSame;
            }

            if (isAllSame)
                debugger;

            const mostlySame = (same.reduce((acc, v) => acc = acc + v, 0) / (this.vertexFlags.getElemCount() - 1)) > 0.9

            if (mostlySame)
                debugger

            debugger;
        }

        // if (this.vertexFlags.getElemCount() === 9) {
        //     const arr = [127, 236, 127, 34, 102, 167, 7, 12, 0];
        //     const same = new Array(arr.len);
        //     let isAllSame = true;

        //     for (let i = 0, len = arr.length; i < len; i++) {
        //         const isSame = arr[i] === this.vertexFlags.getElem(i);
        //         same[i] = isSame;
        //         isAllSame = isAllSame && isSame;
        //     }

        //     if (isAllSame)
        //         debugger;
        // }

        this.applied = pkg.read(int32).value !== 0;

        this.light = pkg.fetchObject<ULight>(this.lightIndex);

        return this;
    }

    public toString(..._: any) {
        return `FStaticMeshLightInfo(light=${this.light.toString()})`;
    }

    public getDecodeInfo(library: GD.DecodeLibrary): any {
        return {
            vertexFlags: this.vertexFlags.getTypedArray(),
            ...(this.light.loadSelf().getDecodeInfo(library))
        };
    }
}

abstract class UStaticMeshInstance extends UObject {
    declare protected colorStream: FRawColorStream;
    declare protected sceneLights: FArray<FStaticMeshLightInfo>;
    declare protected environmentLights: FArray<FStaticMeshLightInfo>;

    declare protected unkArrIndex: number[];

    declare protected actor: GA.UStaticMeshActor;

    public setActor(actor: GA.UStaticMeshActor) { this.actor = actor; return this; }



    public getDecodeInfo(library: GD.DecodeLibrary): any {
        const color = new Float32Array(this.colorStream.color.length * 3);
        const env = this.actor.level.getL2Env();

        for (let i = 0, len = this.colorStream.color.length; i < len; i++) {
            const { r, g, b } = this.colorStream.color[i] as GA.FColor;
            const offset = i * 3;

            color[offset + 0] = r / 255;
            color[offset + 1] = g / 255;
            color[offset + 2] = b / 255;
        }

        let validEnvironment: FStaticMeshLightInfo = null;
        let startIndex: number, finishIndex: number;
        // let startTime: number, finishTime: number;

        let lightingColor: GD.ColorArr;

        for (let i = 0, len = this.environmentLights.length; i < len; i++) {
            const timeForIndex = indexToTime(i, len);

            if (timeForIndex > env.timeOfDay) {
                validEnvironment = this.environmentLights[i];
                startIndex = i;
                finishIndex = i + 1;
                // startTime = timeForIndex;
                // finishTime = indexToTime(finishIndex, len);
                lightingColor = env.selectByTime(env.lightStaticMesh).getColor();

                break;
            }
        }

        // const rgb = this.sceneLights[0].light.hue;

        // debugger;

        // if (this.actor.mesh.exportIndex === 14 && this.actor.mesh.objectName === "Exp_oren_curumadungeon19")
        //     console.warn("Mesh has lights:", this.sceneLights.length, "index:", this.actor.exportIndex+1);

        // debugger;

        return {
            color,
            lights: {
                scene: this.sceneLights,
                environment: validEnvironment ? {
                    indexFrac: timeToIndexFrac(env.timeOfDay, this.environmentLights.length),
                    color: lightingColor,
                    ...validEnvironment
                } : null
            }
        };

        // const allLights = [...this.sceneLights/*, ...this.unkLights1*/];
        // const filteredMapsDict = Object.assign({}, ...allLights.map(x => ({ [x.lightIndex]: x.light })));
        // const filteredMaps = (Object.values(filteredMapsDict) as ULight[]);//.filter(l => l.getZone() === this.actor.getZone());

        // return await Promise.all(filteredMaps.map((l: ULight) => l.getDecodeInfo(library)));
    }

    protected doLoad(pkg: GA.UPackage, exp: C.UExport): this {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();
        const compat32 = new BufferValue(BufferValue.compat32);

        this.colorStream = new FRawColorStream();
        this.sceneLights = new FArray(FStaticMeshLightInfo);
        this.environmentLights = new FArray(FStaticMeshLightInfo);

        super.doLoad(pkg, exp);

        if (verArchive < 0x70) {
            console.warn("Unsupported yet");
            debugger;
        } else this.colorStream.load(pkg);

        this.readHead = pkg.tell();

        if (0x6D < verArchive) this.sceneLights.load(pkg);
        if (0x03 < verLicense) this.environmentLights.load(pkg);
        if (0x0B < verLicense) this.unkArrIndex = new Array(2).fill(1).map(_ => pkg.read(compat32).value as number);

        this.readHead = pkg.tell();

        console.assert(this.readHead === this.readTail, "Should be zero");

        return this;
    }
}

export default UStaticMeshInstance;
export { UStaticMeshInstance };