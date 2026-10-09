import type { DecodeLibrary } from "@l2js/engine";
import { GameObject, ObjectComponent } from "../../game/components";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import type AnimationComponent from "./animation-component";
import type LitSkinnedMesh from "../lit-skinned-mesh";

type AbnormalStat_T = { state: number, effect: GameObject, time: number };

const ABNORMAL_EFFECTS: Record<number, string> = { 0x1: "LineageEffect.a_u001_a", 0x2: "LineageEffect.a_u000_a", 0x4: "LineageEffect.a_u001_a", 0x8: "LineageEffect.a_u001_a", 0x10: "LineageEffect.a_u001_a", 0x20: "LineageEffect.a_u008_a", 0x40: "LineageEffect.a_u002_a", 0x80: "LineageEffect.a_u004_a", 0x100: "LineageEffect.a_u005_a", 0x200: "LineageEffect.a_u006_a", 0x4000: "LineageEffect.a_u007_a" }; // FNAbnormalStat::Init 0x763b40 / Update 0x764970
const PULSE_STATES = 0x1 | 0x2 | 0x4 | 0x8 | 0x10 | 0x20 | 0x4000;
const E_BONE_STATES = 0x2 | 0x40 | 0x80 | 0x100 | 0x4000;

function setSizeScale(effect: GameObject, scale: number): void {
    effect.traverse((emitter: any) => {
        if (typeof emitter.setSizeScale === "function") emitter.setSizeScale(scale);
    });
}

export class PawnAbnormalComponent extends ObjectComponent<BaseActor> {
    public readonly componentName = "pawnAbnormal";
    protected readonly renderManager: RenderManager;
    protected readonly stats: AbnormalStat_T[] = [];
    protected library: DecodeLibrary = null;
    protected abnormalState = 0;

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public async setAbnormalState(abnormalState: number): Promise<void> {
        this.abnormalState = abnormalState;
        if (this.library) return;

        const library = await this.renderManager.getParent().getComponent("asset").loadAbnormalEffects();

        if (this.isAttached()) this.library = library;
    }

    public onUpdate(_currentTime: number, deltaTime: number): void {
        if (!this.library) return;

        let added = this.abnormalState;

        for (let i = this.stats.length - 1; i >= 0; i--) { // APawn::UpdateAbnormalState 0x766772..0x766a66
            const stat = this.stats[i];

            if (this.abnormalState & stat.state) {
                added &= ~stat.state;
                continue;
            }

            if (stat.effect && stat.effect.parent) this.renderManager.removeTransientEffect(stat.effect);
            this.stats.splice(i, 1);
        }

        for (let state = 1; state < 0x20000; state <<= 1) {
            if (!(added & state)) continue;

            const stat: AbnormalStat_T = { state, effect: null, time: 0 };

            switch (state) {
                case 0x40: case 0x80: case 0x100: case 0x200: this.spawnEffect(stat); break;
                case 0x400: case 0x800: case 0x2000: case 0x8000: case 0x10000: debugger; break;
            }

            this.stats.push(stat);
        }

        for (const stat of this.stats) {
            if (!(stat.state & PULSE_STATES)) continue;

            if (stat.time === 0 || stat.time > 3) {
                this.spawnEffect(stat);
                if (stat.time > 3) stat.time -= 3;
            }

            stat.time += deltaTime;
        }
    }

    protected spawnEffect(stat: AbnormalStat_T): void {
        const parent = this.getParent();
        const mesh = this.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;
        const index = mesh.tagAliases.findIndex(name => name.toLowerCase() === "e_bone");
        const radius = parent.getCollisionRadius(), height = parent.getCollisionHeight();

        if (index < 0 && (stat.state & E_BONE_STATES)) return;
        if (stat.effect && stat.effect.parent) this.renderManager.removeTransientEffect(stat.effect);

        const asset = this.renderManager.getParent().getComponent("asset");
        const effect = asset.createScriptObject(this.renderManager, this.library, ABNORMAL_EFFECTS[stat.state]) as GameObject;

        stat.effect = effect;
        effect.position.copy(parent.position);
        if (stat.state === 0x200) effect.position.z -= height;
        this.renderManager.addTransientEffect(effect, parent);

        switch (stat.state) {
            case 0x1: case 0x4: case 0x8: case 0x10: case 0x20: {
                const scale = Math.sqrt(height * radius) / Math.sqrt(207);

                parent.attachObjectToBone(effect, 0);
                if (scale > 1) setSizeScale(effect, scale);
                break;
            }
            case 0x2: case 0x40: case 0x80: case 0x100:
                if (parent.attachObjectToBone(effect, mesh.tagNames[index])) effect.position.fromArray(mesh.tagOrigins[index]);
                else parent.attachObjectToBone(effect, 0);
                break;
            case 0x200: case 0x4000: setSizeScale(effect, radius / 9); break;
            default: throw new Error(`Abnormal state 0x${stat.state.toString(16)} has no effect.`);
        }
    }

    public onDetach(): void {
        for (const stat of this.stats)
            if (stat.effect && stat.effect.parent) this.renderManager.removeTransientEffect(stat.effect);
        this.stats.length = 0;
    }
}

export default PawnAbnormalComponent;
