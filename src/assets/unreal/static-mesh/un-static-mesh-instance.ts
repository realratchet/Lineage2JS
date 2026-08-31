import { UObject, type APackage, type Constructable_T, type UExport, BufferValue, FArray, FPrimitiveArray } from "@l2js/core";
import FRawColorStream from "../un-raw-color-stream";
import ULight from "../un-light";
import type { UStaticMeshActor } from "./un-static-mesh-actor";
import type { DecodeLibrary } from "../decode-library";



export class FStaticMeshLightInfo implements Constructable_T {
    public lightIndex: number; // seems to be light index
    public vertexFlags = new FPrimitiveArray(BufferValue.uint8);
    public applied: boolean;

    public light: ULight;

    public load(pkg: APackage): this {
        this.lightIndex = pkg.read("compat32");
        this.vertexFlags.load(pkg);

        this.applied = pkg.read("int32") !== 0;

        this.light = pkg.fetchObject<ULight>(this.lightIndex);

        return this;
    }

    public toString(..._: any) {
        return `FStaticMeshLightInfo(light=${this.light.toString()})`;
    }

    public getDecodeInfo(library: DecodeLibrary): any {
        return {
            vertexFlags: this.vertexFlags,
            ...(this.light.loadSelf().getDecodeInfo(library))
        };
    }
}

abstract class UStaticMeshInstance extends UObject {
    declare public colorStream: FRawColorStream;
    declare public sceneLights: FArray<FStaticMeshLightInfo>;
    declare public environmentLights: FArray<FStaticMeshLightInfo>;

    declare public unkArrIndex: number[];

    declare protected actor: UStaticMeshActor;

    public setActor(actor: UStaticMeshActor) { this.actor = actor; return this; }

    public getDecodeInfo(library: DecodeLibrary): { color: Float32Array | Uint8Array | null, lights: GD.ILightInstanceDecodeInfo } {
        const len = this.colorStream.getElemCount();
        const color: Uint8Array | null = len > 0 ? new Uint8Array(len * 3) : null;
    
        for (let i = 0; i < len; i++) {
            const [r, g, b] = this.colorStream.getColor(i);
            const offset = i * 3;

            color[offset + 0] = r;
            color[offset + 1] = g;
            color[offset + 2] = b;
        }

        // let validEnvironment: FStaticMeshLightInfo = null;
        // let startIndex: number;
        // let finishIndex: number;
        // // let startTime: number, finishTime: number;

        // let lightingColor: GD.ColorArr;

        // for (let i = 0, len = this.environmentLights.length; i < len; i++) {
        //     const timeForIndex = indexToTime(i, len);

        //     if (timeForIndex > envManager.timeOfDay) {
        //         validEnvironment = this.environmentLights[i];
        //         startIndex = i;
        //         finishIndex = i + 1;
        //         // startTime = timeForIndex;
        //         // finishTime = indexToTime(finishIndex, len);
        //         const light = envManager.selectByTime(env.lightStaticMesh);
        //         lightingColor = light ? light.getColor() : [1, 1, 1, 1];

        //         break;
        //     }
        // }

        // // const rgb = this.sceneLights[0].light.hue;

        // // debugger;

        // // if (this.actor.mesh.exportIndex === 14 && this.actor.mesh.objectName === "oren_curumadungeon19")
        // //     console.warn("Mesh has lights:", this.sceneLights.length, "index:", this.actor.exportIndex+1);

        // // debugger;

        let offset = 0;

        const sceneRanges: [string, number, number][] = [];
        const environmentRanges: [string, number, number][] = [];

        let totalLength = 0;

        for (const l of this.sceneLights) totalLength += l.vertexFlags.getElemCount();
        for (const l of this.environmentLights) totalLength += l.vertexFlags.getElemCount();

        const flags = new Uint8Array(totalLength);

        for (const [lights, container] of ([
            [this.sceneLights, sceneRanges],
            [this.environmentLights, environmentRanges]
        ]) as ([FArray<FStaticMeshLightInfo>, [string, number, number][]][])) {
            for (const light of lights) {
                const arr = light.vertexFlags.getTypedArray(), arrLen = arr.length;

                flags.set(arr, offset);
                container.push([light.light.objectName, offset, arrLen]);
                offset += arrLen;
            }
        }

        return {
            color,
            lights: {
                matrix: this.actor.getWorldMatrixElements(),
                flags: flags.buffer,
                scene: sceneRanges,
                environment: environmentRanges
            }
        };
    }

    protected doLoad(pkg: APackage, exp: UExport): this {
        const verArchive = pkg.header.getArchiveFileVersion();
        const verLicense = pkg.header.getLicenseeVersion();

        this.colorStream = new FRawColorStream();
        this.sceneLights = new FArray(FStaticMeshLightInfo);
        this.environmentLights = new FArray(FStaticMeshLightInfo);

        super.doLoad(pkg, exp);

        if (verArchive < 0x70) {
            debugger;
            throw new Error("not implemented");
        } else this.colorStream.load(pkg);

        this.readHead = pkg.tell();

        if (0x6D < verArchive) this.sceneLights.load(pkg);
        if (0x03 < verLicense) this.environmentLights.load(pkg);
        if (0x0B < verLicense) this.unkArrIndex = new Array(2).fill(1).map(_ => pkg.read("compat32"));

        this.readHead = pkg.tell();

        console.assert(this.readHead === this.readTail, "Should be zero");

        return this;
    }
}

export default UStaticMeshInstance;
export { UStaticMeshInstance };
