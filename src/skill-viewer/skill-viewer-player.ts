import { Vector3 } from "three";
import SkillViewerStage, { type SkillViewerSkill_T } from "./skill-viewer-npc";
import { WeaponType } from "@l2js/engine/un-pawn";
import { hasSkillEffectPhase } from "@l2js/engine/skills/skill-visual-definition";
import getSkillAnimation from "../skills/skill-animation";
import type AnimationComponent from "../objects/components/animation-component";
import type PawnAttackComponent from "../objects/components/pawn-attack-component";
import type BaseActor from "../base-actor";
import type { INpcDefinition, NpcSkillAttack_T } from "@l2js/engine/contracts/pawn";

// PhysicsManager uses 100 world units per metre.
const TARGET_DISTANCE = 200;
const tmpPosition = new Vector3();
const arrWeapons = Object.values(WeaponType).filter(value => typeof value === "number") as WeaponType[];

export class PlayerSkillViewerStage extends SkillViewerStage {
    public readonly isPlayerViewer = true;
    protected target: BaseActor = null;
    protected loading: Promise<void> = null;
    protected castRequest = 0;

    public async getSkills(): Promise<SkillViewerSkill_T[]> {
        if (!this.cacheSkills) this.cacheSkills = (await this.assetManager.listPlayerSkills()).map(skill => ({ ...skill, npcs: [] }));
        return this.cacheSkills;
    }

    public getNpcs(): readonly INpcDefinition[] { return []; }
    public preload(_definitions: readonly INpcDefinition[]): void { }

    protected async loadPawns(): Promise<void> {
        await this.assetManager.loadCharacter(this.renderManager, 1, 0, 0, 0, { chest: 0, legs: 0, gloves: 0, boots: 0 });
        this.target = await this.renderManager.spawnNpc(1, tmpPosition.set(0, TARGET_DISTANCE, 0));
        const player = this.renderManager.player;

        player.teleportTo(tmpPosition.set(0, 0, 0));
        player.rotation.z = 0;
        this.target.rotation.z = Math.PI;
        this.renderManager.addPawn(player);
        this.entries.push({ definition: null, npc: player, target: this.target });
    }

    public async spawn(_definitions: readonly INpcDefinition[], onProgress: (message: string) => void): Promise<string[]> {
        this.clear();

        if (this.entries.length > 0) return [];

        try {
            onProgress("spawning Player and Gremlin");
            if (!this.loading) this.loading = this.loadPawns();
            await this.loading;
            return [];
        } catch (error) {
            this.loading = null;
            return [(error as Error).message];
        }
    }

    public async cast(skill: SkillViewerSkill_T): Promise<string[]> {
        if (this.entries.length === 0) return [];

        this.stop();
        const request = this.castRequest;
        // Fixed preview staging keeps melee and self-range casts at the 2 m mark.
        await this.assetManager.castPlayerSkill(this.renderManager, skill.id, skill.level, this.target, TARGET_DISTANCE);
        if (request !== this.castRequest) return [];

        const attack = this.renderManager.player.getNpcAttacks().find(attack => attack.skill?.id === skill.id);
        this.selectWeapon(attack.skill);
        return [];
    }

    protected selectWeapon(skill: NpcSkillAttack_T): void {
        const player = this.renderManager.player;
        const animation = player.getComponent<AnimationComponent>("animation");
        const needsPreShot = hasSkillEffectPhase(skill, "preshot");
        let hasNamedAnimation = false;

        for (const weapon of arrWeapons) {
            player.setUnrealScriptProperty("CurWeaponType", weapon);
            const selected = getSkillAnimation(player, skill.animationCategory);
            const clips = selected.names.map(name => animation.getAnimationClip(name));

            if (selected.names.some(name => name.toLowerCase() !== "none")) hasNamedAnimation = true;
            if (clips.every(clip => !clip) || selected.names.some((name, index) => name.toLowerCase() !== "none" && !clips[index])) continue;
            if (needsPreShot && !clips.some(clip => clip && (clip as any).animationNotifies.some(notify => notify.object?.type === "native" && notify.object.className.toLowerCase() === "animnotify_attackpreshot"))) continue;
            return;
        }

        if (hasNamedAnimation || needsPreShot) throw new Error(`No player animation for category '${skill.animationCategory}'.`);
    }

    public stop(): void {
        this.castRequest++;
        this.assetManager.stopPlayerSkill(this.renderManager);
    }

    public clear(): void {
        this.stop();

        for (const { npc, target } of this.entries) {
            npc.getComponent<PawnAttackComponent>("pawnAttack").clear();
            for (const pawn of [npc, target])
                for (const effect of [...pawn.getScriptChildren()]) this.renderManager.removeTransientEffect(effect);
        }
    }
}

export default PlayerSkillViewerStage;
