import { AbnormalEffect_T } from "../../network/game-packets";
import type { DecodeLibrary } from "@l2js/engine";
import type { Material, Mesh } from "three";
import { COMPONENT_EVENT_NOT_HANDLED, ComponentEventResult_T, GameObject, ObjectComponent } from "../../game/components";
import type BaseActor from "../../base-actor";
import type RenderManager from "../../rendering/render-manager";
import { MESHES_CHANGED_EVENT, type default as AnimationComponent } from "./animation-component";
import type LitSkinnedMesh from "../lit-skinned-mesh";
import type PawnRenderableComponent from "../../rendering/components/pawn-renderable-component";

type AbnormalSize_T = { phase: number, radius: number, height: number, weaponScale: number };
type AbnormalStat_T = { state: number, effect: GameObject, time: number, scale: number, size: AbnormalSize_T | null };

const ABNORMAL_EFFECTS: Record<number, string> = { [AbnormalEffect_T.ABNORMAL_EFFECT_BLEEDING]: "LineageEffect.a_u001_a", [AbnormalEffect_T.ABNORMAL_EFFECT_POISON]: "LineageEffect.a_u000_a", [AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_3]: "LineageEffect.a_u001_a", [AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_4]: "LineageEffect.a_u001_a", [AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_5]: "LineageEffect.a_u001_a", [AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_6]: "LineageEffect.a_u008_a", [AbnormalEffect_T.ABNORMAL_EFFECT_STUN]: "LineageEffect.a_u002_a", [AbnormalEffect_T.ABNORMAL_EFFECT_SLEEP]: "LineageEffect.a_u004_a", [AbnormalEffect_T.ABNORMAL_EFFECT_MUTED]: "LineageEffect.a_u005_a", [AbnormalEffect_T.ABNORMAL_EFFECT_ROOT]: "LineageEffect.a_u006_a", [AbnormalEffect_T.ABNORMAL_EFFECT_FLAME]: "LineageEffect.a_u007_a" }; // FNAbnormalStat::Init 0x763b40 / Update 0x764970
const PULSE_STATES = AbnormalEffect_T.ABNORMAL_EFFECT_BLEEDING | AbnormalEffect_T.ABNORMAL_EFFECT_POISON | AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_3 | AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_4 | AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_5 | AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_6 | AbnormalEffect_T.ABNORMAL_EFFECT_FLAME;
const E_BONE_STATES = AbnormalEffect_T.ABNORMAL_EFFECT_POISON | AbnormalEffect_T.ABNORMAL_EFFECT_STUN | AbnormalEffect_T.ABNORMAL_EFFECT_SLEEP | AbnormalEffect_T.ABNORMAL_EFFECT_MUTED | AbnormalEffect_T.ABNORMAL_EFFECT_FLAME;

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
    protected bigHeadMaxSize: number = null;
    protected readonly npcSkins: { mesh: Mesh, materials: Material | Material[] }[] = [];

    public constructor(renderManager: RenderManager) {
        super();

        this.renderManager = renderManager;
    }

    public onEvent(type: string): ComponentEventResult_T<void> {
        if (type !== MESHES_CHANGED_EVENT || !this.npcSkins.length) return COMPONENT_EVENT_NOT_HANDLED;

        this.restoreNpcSkins();
        void this.setAbnormalState(this.abnormalState);
        return COMPONENT_EVENT_NOT_HANDLED;
    }

    public async setAbnormalState(abnormalState: number): Promise<void> {
        const asset = this.renderManager.getParent().getComponent("asset");

        if (abnormalState & ~this.abnormalState & (AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_1 | AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_2)) asset.stopPawnSkill(this.getParent());
        if ((abnormalState ^ this.abnormalState) & AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_2) this.setOverlayColor(abnormalState & AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_2 ? 72 : 255, abnormalState & AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_2 ? 105 : 255, abnormalState & AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_2 ? 140 : 255);

        this.abnormalState = abnormalState;

        if (!(abnormalState & AbnormalEffect_T.ABNORMAL_EFFECT_TEXTURE_CHANGE)) this.restoreNpcSkins();
        else if (!this.npcSkins.length && this.getParent().getUnrealScriptProperty("bNpc")) {
            const npc = await asset.resolveNpc(this.getParent().getUnrealScriptProperty("NpcClassID") as number);

            if (!this.isAttached() || !(this.abnormalState & AbnormalEffect_T.ABNORMAL_EFFECT_TEXTURE_CHANGE)) return;

            if (npc.alternateTextures.length && !this.npcSkins.length) {
                const count = npc.textures.length - npc.alternateTextures.length;

                for (const mesh of this.getComponent<AnimationComponent>("animation").getMeshes()) {
                    if (!Array.isArray(mesh.material) || mesh.material.length !== npc.textures.length) throw new Error(`NPC '${npc.id}' has invalid alternate skins.`);

                    this.npcSkins.push({ mesh, materials: mesh.material });
                    mesh.material = mesh.material.slice(count);
                }

                this.renderManager.invalidatePawnLighting(this.getParent());
            }
        }

        if (abnormalState & AbnormalEffect_T.ABNORMAL_EFFECT_BIG_HEAD && this.bigHeadMaxSize === null) {
            const scales = await asset.loadBigHeadScales();
            if (!this.isAttached()) return;
            const mesh = this.getComponent<AnimationComponent>("animation").getMeshes()[0];

            this.bigHeadMaxSize = mesh ? scales[mesh.name.split("_")[0].toLowerCase()] || 0 : 0;
        }

        if (this.library) return;

        const library = await this.renderManager.getParent().getComponent("asset").loadAbnormalEffects();

        if (this.isAttached()) this.library = library;
    }

    public onUpdate(_currentTime: number, deltaTime: number): void {
        let added = this.abnormalState;
        let releasedSize = false;

        for (let i = this.stats.length - 1; i >= 0; i--) { // APawn::UpdateAbnormalState 0x766772..0x766a66
            const stat = this.stats[i];

            if (this.abnormalState & stat.state) {
                added &= ~stat.state;
                continue;
            }

            if (stat.size && stat.size.phase !== 0) {
                if (stat.size.phase === 3) stat.size.phase = 2;
                continue;
            }

            if (stat.effect && stat.effect.parent) this.renderManager.removeTransientEffect(stat.effect);
            if (stat.state === AbnormalEffect_T.ABNORMAL_EFFECT_BIG_HEAD) this.setHeadScale(1);
            if (stat.size) { this.releaseSize(stat); releasedSize = true; }
            this.stats.splice(i, 1);
        }

        for (let state = 1; state < 0x20000; state <<= 1) {
            if (!(added & state)) continue;

            if (!this.library && ABNORMAL_EFFECTS[state]) continue;

            const stat: AbnormalStat_T = { state, effect: null, time: 0, scale: 1, size: null };

            switch (state) {
                case AbnormalEffect_T.ABNORMAL_EFFECT_STUN: case AbnormalEffect_T.ABNORMAL_EFFECT_SLEEP: case AbnormalEffect_T.ABNORMAL_EFFECT_MUTED: case AbnormalEffect_T.ABNORMAL_EFFECT_ROOT: this.spawnEffect(stat); break;
                case AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_1: case AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_2: case AbnormalEffect_T.ABNORMAL_EFFECT_BIG_HEAD: case AbnormalEffect_T.ABNORMAL_EFFECT_TEXTURE_CHANGE: break;
                case AbnormalEffect_T.ABNORMAL_EFFECT_GROW: this.initSize(stat); break;
            }

            this.stats.push(stat);
        }

        for (const stat of this.stats) {
            if (stat.state === AbnormalEffect_T.ABNORMAL_EFFECT_GROW) {
                if (stat.size) this.updateSize(stat, Math.fround(deltaTime));
                else stat.time = Math.fround(stat.time + Math.fround(deltaTime));
                continue;
            }

            if (stat.state === AbnormalEffect_T.ABNORMAL_EFFECT_BIG_HEAD) {
                if (this.bigHeadMaxSize === null) continue;
                const delta = Math.fround(deltaTime);

                if (stat.scale < this.bigHeadMaxSize) {
                    stat.scale = Math.fround(stat.scale + delta * stat.time * 3);
                    this.setHeadScale(stat.scale);
                }

                stat.time = Math.fround(stat.time + delta);
                stat.time = Math.fround(stat.time + delta);
                continue;
            }

            if (!(stat.state & PULSE_STATES)) continue;

            if (stat.time === 0 || stat.time > 3) {
                this.spawnEffect(stat);
                if (stat.time > 3) stat.time -= 3;
            }

            stat.time += deltaTime;
        }

        if (releasedSize && !this.abnormalState && !this.stats.length) this.getParent().removeComponent(this);
    }

    public hasPendingSizeChange(): boolean { return this.stats.some(stat => stat.size && stat.size.phase !== 0); }

    protected getSizePawn(): BaseActor {
        const parent = this.getParent();
        return parent.ridePawn && parent.ridePawn.getUnrealScriptProperty("bRide") ? parent.ridePawn : parent;
    }

    protected initSize(stat: AbnormalStat_T): void {
        const pawn = this.getSizePawn();
        if (!pawn.getUnrealScriptProperty("bNpc") || !this.getComponent<AnimationComponent>("animation").getMeshes().some(mesh => (mesh as any).isLitSkinnedMesh)) return;

        stat.size = { phase: 1, radius: Math.fround(pawn.getCollisionRadius()), height: Math.fround(pawn.getCollisionHeight()), weaponScale: Math.fround(pawn.getUnrealScriptProperty("WeaponScale") as number) };
        const locationZ = Math.fround(pawn.position.z + pawn.getCollisionHeight());
        const radius = Math.fround(pawn.getUnrealScriptProperty("OriCollisionRadius") as number), height = Math.fround(pawn.getUnrealScriptProperty("OriCollisionHeight") as number);

        pawn.position.z = locationZ - height;
        pawn.setCollisionSize(radius, height);
    }

    protected updateSize(stat: AbnormalStat_T, delta: number): void {
        const pawn = this.getSizePawn(), size = stat.size;
        const animation = pawn.getComponent<AnimationComponent>("animation");
        if (!animation.getMeshes().some(mesh => (mesh as any).isLitSkinnedMesh)) {
            stat.time = Math.fround(stat.time + delta);
            return;
        }
        const radius = Math.fround(pawn.getUnrealScriptProperty("OriCollisionRadius") as number), height = Math.fround(pawn.getUnrealScriptProperty("OriCollisionHeight") as number);
        const locationZ = Math.fround(pawn.position.z + pawn.getCollisionHeight());

        if (size.phase === 3) {
            size.radius = radius;
            size.height = height;
            stat.time = 0;
            return;
        }

        if (size.phase === 1 || size.phase === 2) {
            const shrinking = size.phase === 2, max = Math.fround(1.2);
            const scale = shrinking ? stat.scale - delta * stat.time * 3 : stat.scale + delta * stat.time;

            stat.scale = Math.fround(scale);
            if (shrinking && scale <= 1) { stat.scale = 1; size.phase = 0; }
            else if (!shrinking && scale >= max) { stat.scale = max; size.phase = 3; }

            animation.setBoneScale(0, stat.scale);
            if (Math.fround(pawn.getUnrealScriptProperty("WeaponScale") as number) !== 0) pawn.setUnrealScriptProperty("WeaponScale", Math.fround(size.weaponScale * stat.scale));

            const oldHeight = shrinking && stat.time === 0 ? height : Math.fround(pawn.getCollisionHeight());
            const alpha = (stat.scale - 1) / (max - 1);
            const nextRadius = shrinking ? size.radius + (radius - size.radius) * alpha : radius + (size.radius - radius) * alpha;
            const nextHeight = shrinking ? size.height + (height - size.height) * alpha : height + (size.height - height) * alpha;
            const roundedHeight = Math.fround(nextHeight);

            pawn.position.z = Math.fround(locationZ + (nextHeight - oldHeight)) - roundedHeight;
            pawn.setCollisionSize(Math.fround(nextRadius), roundedHeight);
        }

        stat.time = Math.fround(stat.time + delta);
    }

    protected releaseSize(stat: AbnormalStat_T): void {
        const pawn = this.getSizePawn();
        pawn.getComponent<AnimationComponent>("animation").setBoneScale(0, 1);
        pawn.setUnrealScriptProperty("WeaponScale", stat.size.weaponScale);
    }

    protected spawnEffect(stat: AbnormalStat_T): void {
        const parent = this.getParent();
        const mesh = this.getComponent<AnimationComponent>("animation").getMeshes().find(mesh => (mesh as any).isLitSkinnedMesh) as LitSkinnedMesh;

        if (!mesh) return; // FNAbnormalStat::Init 0x763b73..0x763b90.

        const index = mesh.tagAliases.findIndex(name => name.toLowerCase() === "e_bone");
        const radius = parent.getCollisionRadius(), height = parent.getCollisionHeight();

        if (index < 0 && (stat.state & E_BONE_STATES)) return;
        if (stat.effect && stat.effect.parent) this.renderManager.removeTransientEffect(stat.effect);

        const asset = this.renderManager.getParent().getComponent("asset");
        const effect = asset.createScriptObject(this.renderManager, this.library, ABNORMAL_EFFECTS[stat.state]) as GameObject;

        stat.effect = effect;
        effect.position.copy(parent.position);
        if (stat.state === AbnormalEffect_T.ABNORMAL_EFFECT_ROOT)
            effect.scriptProperties.get("TrailerPrePivot")[2] = Math.fround(-(parent.getUnrealScriptProperty("DrawScale") as number) * mesh.meshOrigin.z);
        this.renderManager.addTransientEffect(effect, parent);

        switch (stat.state) {
            case AbnormalEffect_T.ABNORMAL_EFFECT_BLEEDING: case AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_3: case AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_4: case AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_5: case AbnormalEffect_T.ABNORMAL_EFFECT_UNKNOWN_6: {
                const scale = Math.sqrt(height * radius) / Math.sqrt(207);

                parent.attachObjectToBone(effect, 0);
                if (scale > 1) setSizeScale(effect, scale);
                break;
            }
            case AbnormalEffect_T.ABNORMAL_EFFECT_POISON: case AbnormalEffect_T.ABNORMAL_EFFECT_STUN: case AbnormalEffect_T.ABNORMAL_EFFECT_SLEEP: case AbnormalEffect_T.ABNORMAL_EFFECT_MUTED: {
                if (parent.attachObjectToBone(effect, mesh.tagNames[index], true)) {
                    const bigHead = this.stats.find(stat => stat.state === AbnormalEffect_T.ABNORMAL_EFFECT_BIG_HEAD);

                    effect.position.fromArray(mesh.tagOrigins[index]);
                    if (bigHead) effect.position.multiplyScalar(bigHead.scale);
                }
                else parent.attachObjectToBone(effect, 0, true);
                break;
            }
            case AbnormalEffect_T.ABNORMAL_EFFECT_ROOT: case AbnormalEffect_T.ABNORMAL_EFFECT_FLAME: setSizeScale(effect, radius / 9); break;
            default: throw new Error(`Abnormal state 0x${stat.state.toString(16)} has no effect.`);
        }
    }

    protected setHeadScale(scale: number): void {
        this.getComponent<AnimationComponent>("animation").setBoneScale(this.getParent().getUnrealScriptProperty("HeadBone") as string, scale);
    }

    protected restoreNpcSkins(): void {
        for (const skin of this.npcSkins) skin.mesh.material = skin.materials;
        if (this.npcSkins.length) this.renderManager.invalidatePawnLighting(this.getParent());
        this.npcSkins.length = 0;
    }

    protected setOverlayColor(r: number, g: number, b: number): void {
        const parent = this.getParent();

        parent.getComponent<PawnRenderableComponent>("pawnRenderable").texModifierColor.set(r / 255, g / 255, b / 255);
        if (parent.ridePawn) parent.ridePawn.getComponent<PawnRenderableComponent>("pawnRenderable").texModifierColor.set(r / 255, g / 255, b / 255);
    }

    public onDetach(): void {
        this.restoreNpcSkins();
        if (this.abnormalState & AbnormalEffect_T.ABNORMAL_EFFECT_HOLD_2) this.setOverlayColor(255, 255, 255);
        if (this.abnormalState & AbnormalEffect_T.ABNORMAL_EFFECT_BIG_HEAD) this.setHeadScale(1);
        for (const stat of this.stats) {
            if (stat.size) this.releaseSize(stat);
            if (stat.effect && stat.effect.parent) this.renderManager.removeTransientEffect(stat.effect);
        }
        this.stats.length = 0;
    }
}

export default PawnAbnormalComponent;
