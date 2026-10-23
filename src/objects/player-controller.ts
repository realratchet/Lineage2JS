import UnScriptVM, { ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";
import type { DecodeLibrary } from "@l2js/engine";
import type BaseActor from "../base-actor";
import type NpcLifecycleComponent from "./components/npc-lifecycle-component";

export class PlayerController implements ScriptHost_T {
    public readonly scriptClassId: string;
    public readonly scriptProperties = new Map<string, ScriptValue_T>();
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

        if (!pawn && previous) previous.getComponent<NpcLifecycleComponent>("npcLifecycle").setController(null);
        this.scriptProperties.set("Pawn", pawn);
        if (pawn) pawn.getComponent<NpcLifecycleComponent>("npcLifecycle").setController(this);
        if (!pawn || !target || target === previous || target === this) this.scriptProperties.set("ViewTarget", pawn || this);
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
