import UnScriptVM, { ScriptHost_T, ScriptNativeCall_T, ScriptValue_T } from "../ue-script/vm";

class LineagePlayerController implements ScriptHost_T {
    public readonly scriptClassId: string;
    public readonly scriptProperties = new Map<string, ScriptValue_T>();
    protected readonly scriptVM: UnScriptVM;

    public constructor(library: GD.DecodeLibrary) {
        this.scriptClassId = Object.keys(library.scriptClasses).find(id => id.toLowerCase() === "engine.lineageplayercontroller");

        if (!this.scriptClassId) throw new Error("UnrealScript class 'Engine.LineagePlayerController' is missing.");

        this.scriptVM = new UnScriptVM(library);
        this.scriptVM.initializeHost(this);
        this.scriptVM.call(this, "PostBeginPlay");
    }

    public get underWaterLoopSound(): string {
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

export default LineagePlayerController;
export { LineagePlayerController };
