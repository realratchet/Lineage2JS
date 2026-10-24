import UnScriptVM, { ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";
import type { DecodeLibrary } from "@l2js/engine";
import type BaseActor from "../base-actor";
import type NpcLifecycleComponent from "./components/npc-lifecycle-component";
import { EPhysics_T } from "../assets/unreal/un-aactor";

export class PlayerController implements ScriptHost_T {
    public readonly scriptClassId: string;
    public readonly scriptProperties = new Map<string, ScriptValue_T>();
    public isEnterChatting = false;
    protected readonly scriptVM: UnScriptVM;

    public constructor(library: DecodeLibrary) {
        (this as any).isPlayerController = true;
        this.scriptClassId = Object.keys(library.scriptClasses).find(id => id.toLowerCase() === "engine.lineageplayercontroller");

        if (!this.scriptClassId) throw new Error("UnrealScript class 'Engine.LineagePlayerController' is missing.");

        this.scriptVM = new UnScriptVM(library);
        this.scriptVM.initializeHost(this);
        this.scriptVM.call(this, "PostBeginPlay");
    }

    public call(name: string, args: ScriptValue_T[] = []): ScriptValue_T { return this.scriptVM.call(this, name, args); }

    public setPawn(pawn: BaseActor): void {
        const previous = this.scriptProperties.get("Pawn") as BaseActor, target = this.scriptProperties.get("ViewTarget");

        if (!pawn && previous) {
            this.setCameraMode(0);
            previous.getComponent<NpcLifecycleComponent>("npcLifecycle").setController(null);
        }
        this.scriptProperties.set("Pawn", pawn);
        this.scriptProperties.set("Level", pawn ? pawn.getUnrealScriptProperty("Level") : null);
        if (pawn) pawn.getComponent<NpcLifecycleComponent>("npcLifecycle").setController(this);
        if (!pawn || !target || target === previous || target === this) this.scriptProperties.set("ViewTarget", pawn || this);
    }

    public setCameraMode(mode: number): boolean { // UGameEngine::OnCameraMode 0x10477410..0x104776f5.
        const properties = this.scriptProperties, pawn = properties.get("Pawn") as BaseActor;

        if (!pawn || !properties.get("Level")) return false;
        const walking = mode === 1;

        if (!walking && !properties.get("bCameraWalking")) return false;
        properties.set("bCameraWalking", walking);
        properties.set("bUseAutoTrackingPawn", false);
        if (walking) properties.set("CameraModeTarget", null);
        pawn.setUnrealScriptProperty("Physics", walking ? EPhysics_T.PHYS_Flying : EPhysics_T.PHYS_Walking);
        pawn.setUnrealScriptProperty("Environment", walking ? 2 : 0);
        pawn.setUnrealScriptProperty("fMaxAirSpeed", walking ? 800 : 120);
        pawn.setUnrealScriptProperty("AirSpeed", walking ? 0 : 120);
        const index = walking ? 1 : 0;
        const disableZoom = !!((properties.get("FixedDefaultCameraDisableZoom") as number[])[index] & 1);

        for (const field of ["Yaw", "Pitch", "Dist"]) {
            properties.set(`DefaultCamera${field}`, (properties.get(`FixedDefaultCamera${field}`) as number[])[index]);
            properties.set(`bUseDefaultCamera${field}`, true);
        }
        properties.set("CameraViewHeightAdjust", (properties.get("FixedDefaultCameraViewHeight") as number[])[index]);
        properties.set("bDisableZoom", disableZoom);
        properties.set("bCameraMovingToDefault", true);
        pawn.setUnrealScriptProperty("bHidden", walking || disableZoom);
        if (!walking) {
            const rotation = pawn.getUnrealScriptProperty("Rotation") as number[];

            properties.set("SavedViewTargetYaw", rotation[1]);
            properties.set("SavedViewTargetPitch", rotation[0]);
        }
        this.isEnterChatting = walking;
        return true;
    }

    public getUnderWaterLoopSound(): string {
        const value = this.scriptProperties.get("UnderWaterLoopSound");

        if (typeof value !== "string") throw new Error(`'${this.scriptClassId}.PostBeginPlay' did not load UnderWaterLoopSound.`);

        return value;
    }

    public resolveUnrealObject(id: string): string { return id; }

    public handlesUnrealNative(_index: number, name: string): boolean {
        const lowerName = name.toLowerCase();

        return lowerName === "dynamicloadobject";
    }

    public callUnrealNative(call: ScriptNativeCall_T): ScriptValue_T {
        switch (call.name.toLowerCase()) {
            case "dynamicloadobject": return call.args[0];
            case "setviewtarget":
                this.scriptProperties.set("ViewTarget", call.args[0]);
                return undefined;
            default: throw new Error(`UnrealScript native '${call.name}' (${call.index}) is not implemented for '${this.scriptClassId}'.`);
        }
    }
}

export default PlayerController;
