import { GameObject, ObjectComponent } from "../../game/components";
import type { DecodeLibrary } from "@l2js/engine";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type AnimationComponent from "./animation-component";
import type LitSkinnedMesh from "../lit-skinned-mesh";
import type EffectLifetimeComponent from "../../rendering/components/effect-lifetime-component";

export const APPENDIX_TEAM_RED = 4;
export const APPENDIX_TEAM_BLUE = 8;

const APPENDIX_STATES = [APPENDIX_TEAM_RED, APPENDIX_TEAM_BLUE];
const APPENDIX_EFFECTS: Record<number, string> = { [APPENDIX_TEAM_RED]: "LineageEffect.e_u520_identifier_r", [APPENDIX_TEAM_BLUE]: "LineageEffect.e_u520_identifier_b" };

type AppendixEffect_T = { state: number, effect: GameObject };

export class PawnAppendixComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnAppendix";
    protected readonly effects: AppendixEffect_T[] = [];
    protected library: DecodeLibrary = null;
    protected state = 0;
    protected needsUpdate = true;

    public constructor(protected readonly renderManager: RenderManager) { super(); }

    public getAppendixState() { return this.state; }

    public async setAppendixState(state: number): Promise<void> {
        if (state === this.state && this.library) return;
        this.state = state;
        this.needsUpdate = true;
        if (this.library) return;

        const library = await this.renderManager.getParent().getComponent("asset").loadAppendixEffects();

        if (this.isAttached()) this.library = library;
    }

    public onUpdate(): void {
        if (!this.needsUpdate) return;

        for (let i = this.effects.length - 1; i >= 0; i--) {
            const entry = this.effects[i];

            if (this.state & entry.state) continue;
            if (entry.effect.parent) this.renderManager.removeTransientEffect(entry.effect);
            this.effects.splice(i, 1);
        }

        if (!this.library) return;

        const parent = this.getParent();
        const mesh = this.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;

        if (!mesh) return;

        for (const state of APPENDIX_STATES) {
            if (!(this.state & state) || this.effects.some(entry => entry.state === state)) continue;

            const effect = this.renderManager.getParent().getComponent("asset").createScriptObject(this.renderManager, this.library, APPENDIX_EFFECTS[state]) as GameObject;

            // FNAppendixEffect::Init 0x10492fc8: TrailerPrePivot.Z = 0.5 - DrawScale * mesh Origin.Z.
            effect.scriptProperties.get("TrailerPrePivot")[2] = Math.fround(0.5 - (parent.getUnrealScriptProperty("DrawScale") as number) * mesh.meshOrigin.z);
            this.renderManager.addTransientEffect(effect, parent);
            effect.getComponent<EffectLifetimeComponent>("effectLifetime").updateTrailerTransform();
            this.effects.push({ state, effect });
        }
        this.needsUpdate = false;
    }

    public onDetach(): void {
        for (const entry of this.effects)
            if (entry.effect.parent) this.renderManager.removeTransientEffect(entry.effect);
        this.effects.length = 0;
    }
}

export default PawnAppendixComponent;
