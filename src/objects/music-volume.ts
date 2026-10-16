import Actor from "./actor";
import type { IMusicVolumeDecodeInfo } from "@l2js/engine/contracts/volume";
import { encompassesVolume } from "../physics/volume-bsp";
import { Vector3 } from "three";
import type { ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";

const tmpLocation = new Vector3();

export class MusicVolume extends Actor {
    declare public readonly isVolume: boolean;
    public readonly bsp: IMusicVolumeDecodeInfo["bsp"];

    public constructor(info: IMusicVolumeDecodeInfo) {
        super({ uuid: info.uuid, name: info.name, scriptClassId: info.scriptClassId, scriptProperties: info.scriptProperties });

        (this as any).isVolume = true;
        this.bsp = info.bsp;
    }

    public encompasses(location: Vector3): boolean {
        if (!this.getUnrealScriptProperty("Brush")) return false;
        if (!this.bsp) throw new Error(`Volume '${this.name}' has no decoded Brush.`);

        return encompassesVolume(location, this.bsp);
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        if (call.name.toLowerCase() === "encompasses") return this.encompasses(tmpLocation.fromArray(call.args[0] as number[]));

        return super.callUnrealNative(call);
    }
}

export default MusicVolume;
