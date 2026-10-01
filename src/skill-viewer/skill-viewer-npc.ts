import { Vector3 } from "three";
import BaseActor from "../base-actor";
import type RenderManager from "../rendering/render-manager";
import type SkillViewerAssetManager from "./skill-viewer-asset-manager";
import type { INpcDefinition } from "@l2js/engine/contracts/pawn";

const GRID_COLUMNS = 5;
const CELL_GAP = 150;
const TARGET_GAP = 10;
const tmpPosition = new Vector3();
const tmpFacing = new Vector3();

export type SkillViewerSkill_T = { id: number, name: string, npcs: INpcDefinition[], isNpcOnly?: boolean, level?: number, previewTarget?: "self" };
export type SkillViewerEntry_T = { definition: INpcDefinition, npc: BaseActor, target: BaseActor };

export class SkillViewerStage {
    public readonly isPlayerViewer: boolean = false;
    protected readonly renderManager: RenderManager;
    protected readonly assetManager: SkillViewerAssetManager;
    protected readonly entries: SkillViewerEntry_T[] = [];
    protected cacheSkills: SkillViewerSkill_T[] = null;
    protected cacheNpcs: INpcDefinition[] = null;
    protected spawnRequest = 0;

    public constructor(renderManager: RenderManager, assetManager: SkillViewerAssetManager) {
        this.renderManager = renderManager;
        this.assetManager = assetManager;
    }

    public getEntries(): readonly SkillViewerEntry_T[] { return this.entries; }

    public async getSkills(): Promise<SkillViewerSkill_T[]> {
        if (this.cacheSkills) return this.cacheSkills;

        const skills = new Map<number, SkillViewerSkill_T>();

        this.cacheNpcs = await this.renderManager.listNpcs();

        for (const npc of this.cacheNpcs)
            for (const attack of npc.skillAttacks) {
                const skill = skills.get(attack.id) || { id: attack.id, name: attack.name, npcs: [] };

                // NPC ids sharing a script class are the same pawn, keep the first
                if (!skill.npcs.some(other => other.className.toLowerCase() === npc.className.toLowerCase())) skill.npcs.push(npc);

                skills.set(attack.id, skill);
            }

        this.cacheSkills = [...skills.values()].sort((a, b) => a.id - b.id);

        return this.cacheSkills;
    }

    public getNpcs(): readonly INpcDefinition[] { return this.cacheNpcs; }

    public preload(definitions: readonly INpcDefinition[]): void { this.assetManager.preloadNpcs(definitions); }
    public setEnterEventEnabled(enabled: boolean): void { this.assetManager.setEnterEventEnabled(enabled); }

    public async spawn(definitions: readonly INpcDefinition[], onProgress: (message: string) => void): Promise<string[]> {
        this.clear();

        const request = this.spawnRequest;
        const failures: string[] = [];
        let cursorX = 0, rowY = 0, rowDepth = 0;

        for (let i = 0; i < definitions.length; i++) {
            const definition = definitions[i];

            onProgress(`spawning ${i + 1}/${definitions.length}: ${definition.id} ${definition.name}`);

            let npc: BaseActor = null, target: BaseActor = null;

            try {
                if (this.entries.length > 0 && this.entries.length % GRID_COLUMNS === 0) {
                    cursorX = 0;
                    rowY -= rowDepth + CELL_GAP;
                    rowDepth = 0;
                }

                npc = await this.renderManager.spawnNpc(definition.id, tmpPosition.set(cursorX, rowY, 0));

                if (request !== this.spawnRequest) {
                    this.renderManager.removePawn(npc);
                    return failures;
                }

                const radius = npc.getCollisionRadius();

                npc.teleportTo(tmpPosition.set(cursorX + radius, rowY - radius, 0));
                cursorX += radius * 2 + CELL_GAP;

                target = await this.spawnTarget();

                if (request !== this.spawnRequest) {
                    this.renderManager.removePawn(npc);
                    this.renderManager.removePawn(target);
                    return failures;
                }

                target.teleportTo(tmpPosition.copy(npc.position).addScaledVector(getFacing(npc, tmpFacing), radius + target.getCollisionRadius() + TARGET_GAP));
                rowDepth = Math.max(rowDepth, radius * 2 + target.getCollisionRadius() * 2 + TARGET_GAP);
                npc.faceActor(target);

                this.entries.push({ definition, npc, target });
            } catch (e) {
                console.error(e);
                failures.push(`${definition.id} ${definition.name}: ${(e as Error).message}`);

                if (npc) this.renderManager.removePawn(npc);
                if (target) this.renderManager.removePawn(target);
            }
        }

        return failures;
    }

    public cast(skill: SkillViewerSkill_T): string[] | Promise<string[]> {
        const skipped: string[] = [];

        for (const entry of this.entries) {
            const attacks = entry.npc.getNpcAttacks();
            const index = skill.isNpcOnly ? Math.min(0, attacks.length - 1) : attacks.findIndex(attack => attack.skill && attack.skill.id === skill.id);

            // passive or animation-less skills never become attacks, see PawnAttackComponent
            if (index < 0) skipped.push(`${entry.definition.id} ${entry.definition.name}`);
            else entry.npc.attack(entry.target, index);
        }

        return skipped;
    }

    public getCastableNpcs(skill: SkillViewerSkill_T, npcs: readonly INpcDefinition[] = skill.npcs): INpcDefinition[] {
        if (skill.isNpcOnly) return [];

        return npcs.filter(npc => npc.skillAttacks.some(attack => attack.id === skill.id && !attack.passive && attack.animation && attack.animation.toLowerCase() !== "none"));
    }

    public isCasting(): boolean { return this.entries.some(entry => (entry.npc.getComponent("pawnAttack") as any).isActive); }

    public castAttack(entry: SkillViewerEntry_T, index: number): void {
        entry.npc.attack(entry.target, index);
    }

    public stop(): void {
        for (const { npc } of this.entries) npc.stopAttack();
    }

    public clear(): void {
        this.spawnRequest++;

        for (const { npc, target } of this.entries) {
            npc.stopAttack();
            this.renderManager.removePawn(npc);
            this.renderManager.removePawn(target);
        }

        this.entries.length = 0;
        this.assetManager.releaseUsedLibraries(this.renderManager);
    }

    protected async spawnTarget(): Promise<BaseActor> {
        const target = new BaseActor(this.renderManager);

        target.name = "Player";

        await this.assetManager.loadCharacter(this.renderManager, 1, 0, 0, 0, { chest: 0, legs: 0, gloves: 0, boots: 0 }, target);

        // layers instead of visible, effects attached to the bones still have to render
        target.traverse(object => { if ((object as any).isMesh) object.layers.disableAll(); });

        this.renderManager.addPawn(target);

        return target;
    }
}

// PawnMovementComponent writes rotation.z = yaw - PI / 2, and only turns a pawn while it's moving
function getFacing(pawn: BaseActor, target: Vector3): Vector3 {
    const yaw = pawn.rotation.z + Math.PI / 2;

    return target.set(Math.cos(yaw), Math.sin(yaw), 0);
}

export default SkillViewerStage;
