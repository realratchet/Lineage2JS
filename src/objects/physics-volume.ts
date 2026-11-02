import Actor from "./actor";
import type { PhysicsVolumeDecodeInfo_T } from "@l2js/engine/contracts/volume";
import type { Vector3Arr } from "@l2js/engine";
import Rotator from "../utils/rotator";
import { encompassesVolume } from "../physics/volume-bsp";
import { Vector3 } from "three";
import type { ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";

const tmpRotator = new Rotator();
const tmpLocation = new Vector3();

export class PhysicsVolume extends Actor {
    declare public readonly isVolume: boolean;
    public readonly objectPath: string;
    public readonly bsp: PhysicsVolumeDecodeInfo_T["bsp"];

    public constructor(info: PhysicsVolumeDecodeInfo_T, isLevelActor: boolean = true) {
        super(info, isLevelActor);

        (this as any).isVolume = true;
        this.objectPath = info.objectPath;
        this.bsp = info.bsp;
        this.position.fromArray(this.getUnrealScriptProperty("Location") as Vector3Arr);
        const [pitch, yaw, roll] = this.getUnrealScriptProperty("Rotation") as Vector3Arr;
        tmpRotator.set(pitch, yaw, roll).toQuaternion(this.quaternion);
        this.scale.fromArray(this.getUnrealScriptProperty("DrawScale3D") as Vector3Arr).multiplyScalar(this.getUnrealScriptProperty("DrawScale") as number);
    }

    public encompasses(location: Vector3): boolean {
        if (!this.getUnrealScriptProperty("Brush")) return false;
        if (!this.bsp) throw new Error(`Volume '${this.name}' has no decoded Brush.`);

        return encompassesVolume(location, this.bsp);
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        if (call.name.toLowerCase() === "encompasses") return this.encompasses(tmpLocation.fromArray(call.args[0] as Vector3Arr));

        return super.callUnrealNative(call);
    }
}

export default PhysicsVolume;
