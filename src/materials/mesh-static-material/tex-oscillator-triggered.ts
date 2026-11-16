import { getScriptResource, type ScriptHost_T } from "../../ue-script/vm";

export class TexOscillatorTriggered {
    protected readonly path: string;
    protected properties: Record<string, any>;
    protected resource: ScriptHost_T = null;
    protected readonly rateU: number;
    protected readonly rateV: number;

    public constructor(path: string, properties: Record<string, any>, rateU: number, rateV: number) {
        this.path = path;
        this.properties = { ...properties };
        this.rateU = rateU;
        this.rateV = rateV;
    }

    public getTimeSeconds(timeSeconds: number): number {
        if (!this.resource) {
            this.resource = getScriptResource(this.path);
            if (this.resource) this.properties = this.resource.scriptProperties as Record<string, any>;
        }

        const triggeredTime = this.properties.TriggeredTime;
        if (triggeredTime < 0) return 0;

        // Engine.dll UTexOscillatorTriggered::GetMatrix 0x87aa30, float stores 0x87aa9a/0x87aae7.
        const rate = this.rateU >= this.rateV ? this.rateU : this.rateV;
        const duration = Math.fround(this.properties.StopAfterPeriod / rate);
        const elapsed = timeSeconds - triggeredTime;
        let result = this.properties.Reverse ? duration - elapsed : elapsed;

        if (this.properties.Reverse) {
            if (result < 0) result = 0;
        } else if (result > duration) result = duration;

        return Math.fround(result);
    }
}

export default TexOscillatorTriggered;
